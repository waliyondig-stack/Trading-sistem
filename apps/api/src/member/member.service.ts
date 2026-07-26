import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SYSTEM_ROLES } from '@flowniaga/domain';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PasswordService } from '../auth/password.service';
import type { TenantContext } from '../common/request-types';
import type { InviteMemberDto, UpdateMemberDto } from './member.dto';

interface Actor {
  userId: string;
  correlationId?: string;
  ip?: string;
}

@Injectable()
export class MemberService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly passwordService: PasswordService,
  ) {}

  async list(ctx: TenantContext) {
    const rows = await this.prisma.membership.findMany({
      where: { tenantId: ctx.tenantId, deletedAt: null },
      include: {
        user: { select: { id: true, name: true, email: true, status: true } },
        role: { select: { id: true, name: true } },
        branchAccess: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((m) => ({
      membershipId: m.id,
      user: m.user,
      role: m.role,
      status: m.status,
      allBranches: m.allBranches,
      branchIds: m.branchAccess.map((b) => b.branchId),
      createdAt: m.createdAt,
    }));
  }

  async invite(ctx: TenantContext, actor: Actor, dto: InviteMemberDto) {
    const email = dto.email.toLowerCase();
    const role = await this.prisma.role.findFirst({
      where: { id: dto.roleId, tenantId: ctx.tenantId },
    });
    if (!role) {
      throw new NotFoundException({ code: 'ROLE_NOT_FOUND', message: 'Role tidak ditemukan.' });
    }
    await this.validateBranchIds(ctx, dto.branchIds);

    return this.prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({ where: { email } });
      let createdUser = false;
      if (!user) {
        if (!dto.name || !dto.initialPassword) {
          throw new BadRequestException({
            code: 'NEW_USER_FIELDS_REQUIRED',
            message: 'User belum terdaftar: name dan initialPassword wajib diisi.',
          });
        }
        user = await tx.user.create({
          data: {
            email,
            name: dto.name,
            passwordHash: await this.passwordService.hash(dto.initialPassword),
          },
        });
        createdUser = true;
      }

      const existing = await tx.membership.findUnique({
        where: { tenantId_userId: { tenantId: ctx.tenantId, userId: user.id } },
      });
      if (existing && !existing.deletedAt) {
        throw new ConflictException({
          code: 'ALREADY_MEMBER',
          message: 'User sudah menjadi anggota tenant ini.',
        });
      }

      const allBranches = dto.allBranches ?? true;
      const membership = existing
        ? await tx.membership.update({
            where: { id: existing.id },
            data: { deletedAt: null, status: 'ACTIVE', roleId: role.id, allBranches },
          })
        : await tx.membership.create({
            data: {
              tenantId: ctx.tenantId,
              userId: user.id,
              roleId: role.id,
              allBranches,
            },
          });

      if (!allBranches && dto.branchIds?.length) {
        await tx.membershipBranchAccess.deleteMany({ where: { membershipId: membership.id } });
        await tx.membershipBranchAccess.createMany({
          data: dto.branchIds.map((branchId) => ({ membershipId: membership.id, branchId })),
        });
      }

      await this.audit.log(
        {
          tenantId: ctx.tenantId,
          userId: actor.userId,
          action: 'member.invited',
          entityType: 'Membership',
          entityId: membership.id,
          after: { email, roleId: role.id, roleName: role.name, createdUser },
          correlationId: actor.correlationId,
          ip: actor.ip,
        },
        tx,
      );

      return {
        membershipId: membership.id,
        userId: user.id,
        email,
        roleName: role.name,
        createdUser,
      };
    });
  }

  async update(ctx: TenantContext, actor: Actor, membershipId: string, dto: UpdateMemberDto) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, tenantId: ctx.tenantId, deletedAt: null },
      include: { role: true },
    });
    if (!membership) {
      throw new NotFoundException({
        code: 'MEMBER_NOT_FOUND',
        message: 'Anggota tidak ditemukan.',
      });
    }

    let newRole = membership.role;
    if (dto.roleId && dto.roleId !== membership.roleId) {
      const role = await this.prisma.role.findFirst({
        where: { id: dto.roleId, tenantId: ctx.tenantId },
      });
      if (!role) {
        throw new NotFoundException({ code: 'ROLE_NOT_FOUND', message: 'Role tidak ditemukan.' });
      }
      newRole = role;
    }
    await this.validateBranchIds(ctx, dto.branchIds);

    // Jangan biarkan tenant kehilangan Owner aktif terakhir.
    const demotingOwner =
      membership.role.name === SYSTEM_ROLES.OWNER &&
      ((dto.roleId && newRole.name !== SYSTEM_ROLES.OWNER) || dto.status === 'DISABLED');
    if (demotingOwner) {
      const ownerCount = await this.prisma.membership.count({
        where: {
          tenantId: ctx.tenantId,
          status: 'ACTIVE',
          deletedAt: null,
          role: { name: SYSTEM_ROLES.OWNER },
        },
      });
      if (ownerCount <= 1) {
        throw new ConflictException({
          code: 'LAST_OWNER',
          message: 'Tenant harus memiliki minimal satu Owner aktif.',
        });
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.membership.update({
        where: { id: membership.id },
        data: {
          roleId: newRole.id,
          status: dto.status ?? membership.status,
          allBranches: dto.allBranches ?? membership.allBranches,
        },
      });
      if (dto.branchIds) {
        await tx.membershipBranchAccess.deleteMany({ where: { membershipId: membership.id } });
        if (!(dto.allBranches ?? membership.allBranches)) {
          await tx.membershipBranchAccess.createMany({
            data: dto.branchIds.map((branchId) => ({ membershipId: membership.id, branchId })),
          });
        }
      }
      await this.audit.log(
        {
          tenantId: ctx.tenantId,
          userId: actor.userId,
          action: 'member.updated',
          entityType: 'Membership',
          entityId: membership.id,
          before: {
            roleId: membership.roleId,
            roleName: membership.role.name,
            status: membership.status,
          },
          after: { roleId: updated.roleId, roleName: newRole.name, status: updated.status },
          correlationId: actor.correlationId,
          ip: actor.ip,
        },
        tx,
      );
      return updated;
    });
  }

  private async validateBranchIds(ctx: TenantContext, branchIds?: string[]) {
    if (!branchIds?.length) return;
    const count = await this.prisma.branch.count({
      where: { id: { in: branchIds }, tenantId: ctx.tenantId, deletedAt: null },
    });
    if (count !== branchIds.length) {
      throw new BadRequestException({
        code: 'INVALID_BRANCH_IDS',
        message: 'Sebagian branch ID tidak valid untuk tenant ini.',
      });
    }
  }
}
