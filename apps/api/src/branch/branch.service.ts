import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OutboxService } from '../outbox/outbox.service';
import type { TenantContext } from '../common/request-types';
import type { CreateBranchDto, UpdateBranchDto } from './branch.dto';

interface Actor {
  userId: string;
  correlationId?: string;
  ip?: string;
}

@Injectable()
export class BranchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  /** Daftar cabang sesuai scope membership (allBranches atau daftar branchIds). */
  async list(ctx: TenantContext) {
    return this.prisma.branch.findMany({
      where: {
        tenantId: ctx.tenantId,
        deletedAt: null,
        ...(ctx.allBranches ? {} : { id: { in: ctx.branchIds } }),
      },
      orderBy: { code: 'asc' },
      include: {
        warehouses: { where: { deletedAt: null }, select: { id: true, code: true, name: true } },
      },
    });
  }

  async getById(ctx: TenantContext, id: string) {
    const branch = await this.prisma.branch.findFirst({
      where: {
        id,
        tenantId: ctx.tenantId,
        deletedAt: null,
        ...(ctx.allBranches ? {} : { id: { in: ctx.branchIds } }),
      },
      include: { warehouses: { where: { deletedAt: null } } },
    });
    if (!branch) {
      throw new NotFoundException({ code: 'BRANCH_NOT_FOUND', message: 'Cabang tidak ditemukan.' });
    }
    return branch;
  }

  async create(ctx: TenantContext, actor: Actor, dto: CreateBranchDto) {
    const dup = await this.prisma.branch.findFirst({
      where: { tenantId: ctx.tenantId, code: dto.code },
    });
    if (dup) {
      throw new ConflictException({
        code: 'BRANCH_CODE_TAKEN',
        message: 'Kode cabang sudah dipakai.',
      });
    }
    const defaultEntity = await this.prisma.legalEntity.findFirst({
      where: { tenantId: ctx.tenantId, isDefault: true, deletedAt: null },
    });
    return this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.create({
        data: {
          tenantId: ctx.tenantId,
          legalEntityId: defaultEntity?.id ?? null,
          code: dto.code,
          name: dto.name,
          address: dto.address ?? null,
          phone: dto.phone ?? null,
        },
      });
      await this.audit.log(
        {
          tenantId: ctx.tenantId,
          userId: actor.userId,
          action: 'branch.created',
          entityType: 'Branch',
          entityId: branch.id,
          after: { code: branch.code, name: branch.name },
          correlationId: actor.correlationId,
          ip: actor.ip,
        },
        tx,
      );
      await this.outbox.emit('branch.created', { branchId: branch.id }, ctx.tenantId, tx);
      return branch;
    });
  }

  async update(ctx: TenantContext, actor: Actor, id: string, dto: UpdateBranchDto) {
    const before = await this.getById(ctx, id);
    return this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.update({
        where: { id: before.id },
        data: {
          name: dto.name ?? before.name,
          address: dto.address === undefined ? before.address : dto.address,
          phone: dto.phone === undefined ? before.phone : dto.phone,
        },
      });
      await this.audit.log(
        {
          tenantId: ctx.tenantId,
          userId: actor.userId,
          action: 'branch.updated',
          entityType: 'Branch',
          entityId: branch.id,
          before: { name: before.name, address: before.address, phone: before.phone },
          after: { name: branch.name, address: branch.address, phone: branch.phone },
          correlationId: actor.correlationId,
          ip: actor.ip,
        },
        tx,
      );
      return branch;
    });
  }

  /** Soft delete — data bisnis tidak dihapus permanen. */
  async remove(ctx: TenantContext, actor: Actor, id: string) {
    const before = await this.getById(ctx, id);
    const activeWarehouses = await this.prisma.warehouse.count({
      where: { branchId: id, deletedAt: null },
    });
    if (activeWarehouses > 0) {
      throw new ConflictException({
        code: 'BRANCH_HAS_WAREHOUSES',
        message: 'Cabang masih memiliki gudang aktif. Hapus atau pindahkan gudang lebih dulu.',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.branch.update({ where: { id: before.id }, data: { deletedAt: new Date() } });
      await this.audit.log(
        {
          tenantId: ctx.tenantId,
          userId: actor.userId,
          action: 'branch.deleted',
          entityType: 'Branch',
          entityId: before.id,
          before: { code: before.code, name: before.name },
          correlationId: actor.correlationId,
          ip: actor.ip,
        },
        tx,
      );
    });
    return { id: before.id, deleted: true };
  }
}
