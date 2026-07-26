import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { TenantContext } from '../common/request-types';
import { pageArgs, paginate } from '../common/pagination';
import { serializeListing } from './serialize';
import type { Actor } from './category.service';
import type {
  CreateListingDto,
  ListingListQueryDto,
  ResolveUnmappedDto,
  UpdateListingDto,
} from './listing.dto';

@Injectable()
export class ListingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(ctx: TenantContext, query: ListingListQueryDto) {
    const { skip, take, page, pageSize } = pageArgs(query);
    const where: Prisma.ChannelListingWhereInput = {
      tenantId: ctx.tenantId,
      ...(query.channelId ? { channelId: query.channelId } : {}),
      ...(query.productVariantId ? { productVariantId: query.productVariantId } : {}),
      ...(query.search
        ? {
            OR: [
              { externalSku: { contains: query.search, mode: 'insensitive' } },
              { listingName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.channelListing.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          channel: { select: { id: true, name: true, type: true } },
          variant: {
            select: {
              id: true,
              name: true,
              internalSku: true,
              product: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.channelListing.count({ where }),
    ]);
    return paginate(rows.map(serializeListing), total, page, pageSize);
  }

  async create(ctx: TenantContext, actor: Actor, dto: CreateListingDto) {
    const [channel, variant] = await Promise.all([
      this.prisma.channel.findFirst({ where: { id: dto.channelId, tenantId: ctx.tenantId } }),
      this.prisma.productVariant.findFirst({
        where: { id: dto.productVariantId, tenantId: ctx.tenantId, deletedAt: null },
      }),
    ]);
    if (!channel) {
      throw new NotFoundException({ code: 'CHANNEL_NOT_FOUND', message: 'Kanal tidak ditemukan.' });
    }
    if (!variant) {
      throw new NotFoundException({
        code: 'VARIANT_NOT_FOUND',
        message: 'Variasi tidak ditemukan.',
      });
    }
    await this.assertUnambiguous(ctx, dto.channelId, dto.externalSku.trim());

    return this.prisma.$transaction(async (tx) => {
      const listing = await tx.channelListing.create({
        data: {
          tenantId: ctx.tenantId,
          channelId: channel.id,
          productVariantId: variant.id,
          externalSku: dto.externalSku.trim(),
          listingName: dto.listingName,
          externalProductId: dto.externalProductId ?? null,
          externalVariantId: dto.externalVariantId ?? null,
          channelPrice: dto.channelPrice === undefined ? null : BigInt(dto.channelPrice),
          listingStatus: dto.listingStatus ?? 'ACTIVE',
          metadata: (dto.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
      await this.audit.log(
        {
          tenantId: ctx.tenantId,
          userId: actor.userId,
          action: 'channel_listing.created',
          entityType: 'ChannelListing',
          entityId: listing.id,
          after: {
            channelId: channel.id,
            externalSku: listing.externalSku,
            variantId: variant.id,
            internalSku: variant.internalSku,
          },
          correlationId: actor.correlationId,
          ip: actor.ip,
        },
        tx,
      );
      return serializeListing(listing);
    });
  }

  async update(ctx: TenantContext, actor: Actor, id: string, dto: UpdateListingDto) {
    const before = await this.prisma.channelListing.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!before) {
      throw new NotFoundException({
        code: 'LISTING_NOT_FOUND',
        message: 'Listing tidak ditemukan.',
      });
    }
    const newSku = dto.externalSku?.trim() ?? before.externalSku;
    if (newSku !== before.externalSku) {
      await this.assertUnambiguous(ctx, before.channelId, newSku, id);
    }
    let newVariantId = before.productVariantId;
    if (dto.productVariantId && dto.productVariantId !== before.productVariantId) {
      const variant = await this.prisma.productVariant.findFirst({
        where: { id: dto.productVariantId, tenantId: ctx.tenantId, deletedAt: null },
      });
      if (!variant) {
        throw new NotFoundException({
          code: 'VARIANT_NOT_FOUND',
          message: 'Variasi tujuan tidak ditemukan.',
        });
      }
      newVariantId = variant.id;
    }

    return this.prisma.$transaction(async (tx) => {
      const listing = await tx.channelListing.update({
        where: { id: before.id },
        data: {
          externalSku: newSku,
          listingName: dto.listingName ?? before.listingName,
          productVariantId: newVariantId,
          externalProductId:
            dto.externalProductId === undefined ? before.externalProductId : dto.externalProductId,
          externalVariantId:
            dto.externalVariantId === undefined ? before.externalVariantId : dto.externalVariantId,
          channelPrice:
            dto.channelPrice === undefined ? before.channelPrice : BigInt(dto.channelPrice),
          listingStatus: dto.listingStatus ?? before.listingStatus,
          metadata: (dto.metadata === undefined
            ? undefined
            : (dto.metadata as Prisma.InputJsonValue)) as Prisma.InputJsonValue | undefined,
        },
      });
      await this.audit.log(
        {
          tenantId: ctx.tenantId,
          userId: actor.userId,
          action: 'channel_listing.updated',
          entityType: 'ChannelListing',
          entityId: listing.id,
          before: {
            externalSku: before.externalSku,
            variantId: before.productVariantId,
            listingStatus: before.listingStatus,
          },
          after: {
            externalSku: listing.externalSku,
            variantId: listing.productVariantId,
            listingStatus: listing.listingStatus,
          },
          correlationId: actor.correlationId,
          ip: actor.ip,
        },
        tx,
      );
      return serializeListing(listing);
    });
  }

  /** Cari variant dari external SKU pada satu kanal. */
  async resolve(ctx: TenantContext, channelId: string, externalSku: string) {
    const listing = await this.prisma.channelListing.findFirst({
      where: { tenantId: ctx.tenantId, channelId, externalSku },
      include: {
        variant: {
          select: {
            id: true,
            name: true,
            internalSku: true,
            product: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!listing) {
      throw new NotFoundException({
        code: 'EXTERNAL_SKU_UNMAPPED',
        message: `External SKU "${externalSku}" belum terpetakan pada kanal ini.`,
      });
    }
    return serializeListing(listing);
  }

  /** Deteksi external SKU yang belum terpetakan (batch). */
  async resolveUnmapped(ctx: TenantContext, dto: ResolveUnmappedDto) {
    const channel = await this.prisma.channel.findFirst({
      where: { id: dto.channelId, tenantId: ctx.tenantId },
    });
    if (!channel) {
      throw new NotFoundException({ code: 'CHANNEL_NOT_FOUND', message: 'Kanal tidak ditemukan.' });
    }
    const skus = [...new Set(dto.externalSkus.map((s) => s.trim()).filter(Boolean))];
    const listings = await this.prisma.channelListing.findMany({
      where: { tenantId: ctx.tenantId, channelId: dto.channelId, externalSku: { in: skus } },
      select: {
        externalSku: true,
        productVariantId: true,
        variant: { select: { internalSku: true, name: true } },
      },
    });
    const mappedSet = new Map(listings.map((l) => [l.externalSku, l]));
    return {
      channelId: dto.channelId,
      mapped: listings.map((l) => ({
        externalSku: l.externalSku,
        productVariantId: l.productVariantId,
        internalSku: l.variant.internalSku,
        variantName: l.variant.name,
      })),
      unmapped: skus.filter((s) => !mappedSet.has(s)),
    };
  }

  /** Satu external SKU per kanal hanya boleh menunjuk satu variant. */
  private async assertUnambiguous(
    ctx: TenantContext,
    channelId: string,
    externalSku: string,
    excludeId?: string,
  ): Promise<void> {
    const dup = await this.prisma.channelListing.findFirst({
      where: {
        tenantId: ctx.tenantId,
        channelId,
        externalSku,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (dup) {
      throw new ConflictException({
        code: 'LISTING_AMBIGUOUS_MAPPING',
        message: `External SKU "${externalSku}" sudah terpetakan pada kanal ini. Satu SKU eksternal tidak boleh menunjuk dua variasi.`,
      });
    }
  }
}
