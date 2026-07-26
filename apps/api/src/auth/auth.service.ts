import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OutboxService } from '../outbox/outbox.service';
import { PasswordService } from './password.service';
import { TenantProvisionService } from '../tenant/tenant-provision.service';
import { envConfig } from '../config/env';
import type { LoginDto, RegisterDto } from './dto/auth.dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface RequestMeta {
  correlationId?: string;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
    private readonly provision: TenantProvisionService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  /** Registrasi pemilik usaha baru: user + tenant + role sistem + membership Owner. */
  async register(dto: RegisterDto, meta: RequestMeta) {
    const email = dto.email.toLowerCase();
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException({ code: 'EMAIL_TAKEN', message: 'Email sudah terdaftar.' });
    }
    const existingSlug = await this.prisma.tenant.findUnique({ where: { slug: dto.tenantSlug } });
    if (existingSlug) {
      throw new ConflictException({ code: 'SLUG_TAKEN', message: 'Slug tenant sudah dipakai.' });
    }

    const passwordHash = await this.passwordService.hash(dto.password);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, passwordHash, name: dto.name },
      });
      const { tenantId, ownerRoleId } = await this.provision.provisionTenant(tx, {
        name: dto.tenantName,
        slug: dto.tenantSlug,
      });
      await tx.membership.create({
        data: { tenantId, userId: user.id, roleId: ownerRoleId },
      });
      await this.audit.log(
        {
          tenantId,
          userId: user.id,
          action: 'tenant.created',
          entityType: 'Tenant',
          entityId: tenantId,
          after: { name: dto.tenantName, slug: dto.tenantSlug },
          ...meta,
        },
        tx,
      );
      await this.outbox.emit('tenant.created', { tenantId, slug: dto.tenantSlug }, tenantId, tx);
      return { user, tenantId };
    });

    const tokens = await this.issueTokens(result.user.id, email, meta.userAgent);
    return {
      user: { id: result.user.id, email, name: dto.name },
      tenantId: result.tenantId,
      ...tokens,
    };
  }

  async login(dto: LoginDto, meta: RequestMeta) {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    const invalid = new UnauthorizedException({
      code: 'INVALID_CREDENTIALS',
      message: 'Email atau kata sandi salah.',
    });
    if (!user || user.status !== 'ACTIVE') throw invalid;

    const ok = await this.passwordService.verify(dto.password, user.passwordHash);
    if (!ok) {
      this.audit.logSafe({
        userId: user.id,
        action: 'auth.login_failed',
        entityType: 'User',
        entityId: user.id,
        ...meta,
      });
      throw invalid;
    }

    this.audit.logSafe({
      userId: user.id,
      action: 'auth.login',
      entityType: 'User',
      entityId: user.id,
      ...meta,
    });

    const tokens = await this.issueTokens(user.id, email, meta.userAgent);
    const memberships = await this.listMemberships(user.id);
    return { user: { id: user.id, email, name: user.name }, memberships, ...tokens };
  }

  async refresh(refreshToken: string, meta: RequestMeta): Promise<AuthTokens> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (
      !stored ||
      stored.revokedAt ||
      stored.expiresAt < new Date() ||
      stored.user.status !== 'ACTIVE'
    ) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Sesi tidak valid. Silakan masuk kembali.',
      });
    }
    // Rotasi: token lama dicabut, token baru diterbitkan.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(stored.userId, stored.user.email, meta.userAgent);
  }

  async logout(refreshToken: string, userId: string, meta: RequestMeta): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, userId },
      data: { revokedAt: new Date() },
    });
    this.audit.logSafe({
      userId,
      action: 'auth.logout',
      entityType: 'User',
      entityId: userId,
      ...meta,
    });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, name: true, status: true, createdAt: true },
    });
    const memberships = await this.listMemberships(userId);
    return { user, memberships };
  }

  private async listMemberships(userId: string) {
    const rows = await this.prisma.membership.findMany({
      where: { userId, status: 'ACTIVE', deletedAt: null, tenant: { deletedAt: null } },
      include: { tenant: true, role: { include: { permissions: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((m) => ({
      membershipId: m.id,
      tenantId: m.tenantId,
      tenantName: m.tenant.name,
      tenantSlug: m.tenant.slug,
      roleName: m.role.name,
      permissions: m.role.permissions.map((p) => p.permissionCode),
      allBranches: m.allBranches,
    }));
  }

  private async issueTokens(
    userId: string,
    email: string,
    userAgent?: string,
  ): Promise<AuthTokens> {
    const env = envConfig();
    const accessToken = await this.jwtService.signAsync(
      { sub: userId, email, typ: 'access' },
      { secret: env.jwtAccessSecret, expiresIn: env.jwtAccessTtl as unknown as number },
    );
    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + env.jwtRefreshTtlDays * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
        userAgent: userAgent?.slice(0, 255) ?? null,
      },
    });
    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
