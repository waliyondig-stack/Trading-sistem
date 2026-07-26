import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { TenantContext } from '../common/request-types';
import type { CreateWarehouseDto, UpdateWarehouseDto } from './warehouse.dto';

interface Actor {
  userId: string;
  correlationId?: string;
  ip?: string;
}

@Injectable()
export class WarehouseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private branchScope(ctx: TenantContext) {
    return ctx.allBranches ? {} : { branchId: { in: ctx.branchIds } };
  }

  async list(ctx: TenantContext) {
    return this.prisma.warehouse.findMany({
      where: { tenantId: ctx.tenantId, deletedAt: null, ...this.branchScope(ctx) },
      orderBy: { code: 'asc' },
      include: { branch: { select: { id: true, code: true, name: true } } },
    });
  }

  async getById(ctx: TenantContext, id: string) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null, ...this.branchScope(ctx) },
      include: { branch: { select: { id: true, code: true, name: true } } },
    });
    if (!warehouse) {
      throw new NotFoundException({
        code: 'WAREHOUSE_NOT_FOUND',
        message: 'Gudang tidak ditemukan.',
      });
    }
    return warehouse;
  }

  async create(ctx: TenantContext, actor: Actor, dto: CreateWarehouseDto) {
    // Cabang harus milik tenant yang sama DAN dalam scope membership.
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: dto.branchId,
        tenantId: ctx.tenantId,
        deletedAt: null,
        ...(ctx.allBranches ? {} : { id: { in: ctx.branchIds } }),
      },
    });
    if (!branch) {
      throw new NotFoundException({ code: 'BRANCH_NOT_FOUND', message: 'Cabang tidak ditemukan.' });
    }
    const dup = await this.prisma.warehouse.findFirst({
      where: { tenantId: ctx.tenantId, code: dto.code },
    });
    if (dup) {
      throw new ConflictException({
        code: 'WAREHOUSE_CODE_TAKEN',
        message: 'Kode gudang sudah dipakai.',
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.create({
        data: {
          tenantId: ctx.tenantId,
          branchId: branch.id,
          code: dto.code,
          name: dto.name,
          address: dto.address ?? null,
        },
      });
      await this.audit.log(
        {
          tenantId: ctx.tenantId,
          userId: actor.userId,
          action: 'warehouse.created',
          entityType: 'Warehouse',
          entityId: warehouse.id,
          after: { code: warehouse.code, name: warehouse.name, branchId: branch.id },
          correlationId: actor.correlationId,
          ip: actor.ip,
        },
        tx,
      );
      return warehouse;
    });
  }

  async update(ctx: TenantContext, actor: Actor, id: string, dto: UpdateWarehouseDto) {
    const before = await this.getById(ctx, id);
    return this.prisma.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.update({
        where: { id: before.id },
        data: {
          name: dto.name ?? before.name,
          address: dto.address === undefined ? before.address : dto.address,
        },
      });
      await this.audit.log(
        {
          tenantId: ctx.tenantId,
          userId: actor.userId,
          action: 'warehouse.updated',
          entityType: 'Warehouse',
          entityId: warehouse.id,
          before: { name: before.name, address: before.address },
          after: { name: warehouse.name, address: warehouse.address },
          correlationId: actor.correlationId,
          ip: actor.ip,
        },
        tx,
      );
      return warehouse;
    });
  }

  async remove(ctx: TenantContext, actor: Actor, id: string) {
    const before = await this.getById(ctx, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.warehouse.update({ where: { id: before.id }, data: { deletedAt: new Date() } });
      await this.audit.log(
        {
          tenantId: ctx.tenantId,
          userId: actor.userId,
          action: 'warehouse.deleted',
          entityType: 'Warehouse',
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
