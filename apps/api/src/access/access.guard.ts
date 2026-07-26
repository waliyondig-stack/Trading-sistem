import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { PermissionCode } from '@flowniaga/domain';
import { IS_AUTH_ONLY_KEY, IS_PUBLIC_KEY, REQUIRED_PERMISSIONS_KEY } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export const TENANT_HEADER = 'x-tenant-id';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Guard otorisasi tenant-scoped dengan prinsip DEFAULT DENY:
 * - @Public / @AuthOnly → lolos (autentikasi sudah ditangani JwtAuthGuard);
 * - selain itu WAJIB ada @RequirePermissions — jika tidak ada, akses ditolak;
 * - header x-tenant-id wajib, membership aktif diverifikasi,
 *   dan seluruh permission yang diminta harus dimiliki role membership.
 * Percobaan akses lintas tenant dicatat ke audit log.
 */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;
    if (this.reflector.getAllAndOverride<boolean>(IS_AUTH_ONLY_KEY, targets)) return true;

    const required = this.reflector.getAllAndOverride<PermissionCode[] | undefined>(
      REQUIRED_PERMISSIONS_KEY,
      targets,
    );
    const req = context.switchToHttp().getRequest<Request>();

    // Default deny: endpoint terautentikasi tanpa deklarasi permission = bug konfigurasi.
    if (!required || required.length === 0) {
      throw new ForbiddenException({
        code: 'PERMISSION_NOT_DECLARED',
        message: 'Endpoint tidak mendeklarasikan permission. Akses ditolak (default deny).',
      });
    }

    const user = req.user;
    if (!user) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Konteks pengguna tidak ada.' });
    }

    const tenantIdRaw = req.headers[TENANT_HEADER];
    const tenantId = Array.isArray(tenantIdRaw) ? tenantIdRaw[0] : tenantIdRaw;
    if (!tenantId || !UUID_RE.test(tenantId)) {
      throw new ForbiddenException({
        code: 'TENANT_HEADER_REQUIRED',
        message: `Header ${TENANT_HEADER} wajib diisi dengan ID tenant yang valid.`,
      });
    }

    const membership = await this.prisma.membership.findFirst({
      where: {
        tenantId,
        userId: user.id,
        status: 'ACTIVE',
        deletedAt: null,
        tenant: { status: 'ACTIVE', deletedAt: null },
      },
      include: {
        role: { include: { permissions: true } },
        branchAccess: true,
      },
    });

    if (!membership) {
      // Audit percobaan akses tenant yang bukan miliknya (deteksi kebocoran).
      this.audit.logSafe({
        tenantId,
        userId: user.id,
        action: 'access.denied',
        entityType: 'Tenant',
        entityId: tenantId,
        after: { reason: 'NO_ACTIVE_MEMBERSHIP', path: req.path, method: req.method },
        correlationId: req.correlationId,
        ip: req.ip,
      });
      throw new ForbiddenException({
        code: 'TENANT_ACCESS_DENIED',
        message: 'Anda tidak memiliki akses pada tenant ini.',
      });
    }

    const granted = new Set(membership.role.permissions.map((p) => p.permissionCode));
    const missing = required.filter((p) => !granted.has(p));
    if (missing.length > 0) {
      this.audit.logSafe({
        tenantId,
        userId: user.id,
        action: 'access.denied',
        entityType: 'Permission',
        after: { reason: 'MISSING_PERMISSIONS', missing, path: req.path, method: req.method },
        correlationId: req.correlationId,
        ip: req.ip,
      });
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: `Izin tidak mencukupi: ${missing.join(', ')}.`,
      });
    }

    req.tenantContext = {
      tenantId,
      membershipId: membership.id,
      roleId: membership.roleId,
      roleName: membership.role.name,
      permissions: [...granted] as PermissionCode[],
      allBranches: membership.allBranches,
      branchIds: membership.branchAccess.map((b) => b.branchId),
    };
    return true;
  }
}
