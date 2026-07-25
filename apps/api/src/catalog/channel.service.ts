import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { TenantContext } from '../common/request-types';
import type { Actor } from './category.service';
import type { CreateChannelDto, UpdateChannelDto } from './channel.dto';

@Injectable()
export class ChannelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(ctx: TenantContext) {
    return this.prisma.channel.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { listings: true } } },
    });
  }

  async create(ctx: TenantContext, actor: Actor, dto: CreateChannelDto) {
    const dup = await this.prisma.channel.findFirst({
      where: { tenantId: ctx.tenantId, name: dto.name },
    });
    if (dup) {
      throw new ConflictException({
        code: 'CHANNEL_NAME_TAKEN',
        message: 'Nama kanal sudah dipakai.',
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const channel = await tx.channel.create({
        data: {
          tenantId: ctx.tenantId,
          type: dto.type,
          name: dto.name,
          configuration: (dto.configuration ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
      await this.audit.log(
        {
          tenantId: ctx.tenantId,
          userId: actor.userId,
          action: 'channel.created',
          entityType: 'Channel',
          entityId: channel.id,
          after: { name: channel.name, type: channel.type },
          correlationId: actor.correlationId,
          ip: actor.ip,
        },
        tx,
      );
      return channel;
    });
  }

  async update(ctx: TenantContext, actor: Actor, id: string, dto: UpdateChannelDto) {
    const before = await this.prisma.channel.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!before) {
      throw new NotFoundException({ code: 'CHANNEL_NOT_FOUND', message: 'Kanal tidak ditemukan.' });
    }
    return this.prisma.$transaction(async (tx) => {
      const channel = await tx.channel.update({
        where: { id: before.id },
        data: {
          name: dto.name ?? before.name,
          status: dto.status ?? before.status,
          configuration: (dto.configuration === undefined
            ? undefined
            : (dto.configuration as Prisma.InputJsonValue)) as Prisma.InputJsonValue | undefined,
        },
      });
      await this.audit.log(
        {
          tenantId: ctx.tenantId,
          userId: actor.userId,
          action: 'channel.updated',
          entityType: 'Channel',
          entityId: channel.id,
          before: { name: before.name, status: before.status },
          after: { name: channel.name, status: channel.status },
          correlationId: actor.correlationId,
          ip: actor.ip,
        },
        tx,
      );
      return channel;
    });
  }
}
