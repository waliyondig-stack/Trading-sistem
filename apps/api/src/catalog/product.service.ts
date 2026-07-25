import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { TenantContext } from '../common/request-types';
import { pageArgs, paginate } from '../common/pagination';
import { slugify } from './slug';
import { serializeVariant } from './serialize';
import type { Actor } from './category.service';
import type {
  CreateProductDto,
  CreateVariantDto,
  ProductListQueryDto,
  UpdateProductDto,
  UpdateVariantDto,
} from './product.dto';

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------- Product -------------------------

  async list(ctx: TenantContext, query: ProductListQueryDto) {
    const { skip, take, page, pageSize } = pageArgs(query);
    const where: Prisma.ProductWhereInput = {
      tenantId: ctx.tenantId,
      deletedAt: null,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.productType ? { productType: query.productType } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
              {
                variants: {
                  some: {
                    deletedAt: null,
                    OR: [
                      { internalSku: { contains: query.search, mode: 'insensitive' } },
                      { barcode: { contains: query.search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };
    const orderBy = { [query.sortBy ?? 'name']: query.sortDir ?? 'asc' };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          _count: { select: { variants: { where: { deletedAt: null } } } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);
    return paginate(rows, total, page, pageSize);
  }

  async getById(ctx: TenantContext, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        variants: { where: { deletedAt: null }, orderBy: { internalSku: 'asc' } },
      },
    });
    if (!product) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: 'Produk tidak ditemukan.',
      });
    }
    return { ...product, variants: product.variants.map(serializeVariant) };
  }

  async create(ctx: TenantContext, actor: Actor, dto: CreateProductDto) {
    const slug = dto.slug ?? slugify(dto.name);
    if (!slug) {
      throw new BadRequestException({ code: 'INVALID_SLUG', message: 'Slug tidak valid.' });
    }
    if (dto.categoryId) await this.assertCategory(ctx, dto.categoryId);
    const dupSlug = await this.prisma.product.findFirst({
      where: { tenantId: ctx.tenantId, slug },
    });
    if (dupSlug) {
      throw new ConflictException({
        code: 'PRODUCT_SLUG_TAKEN',
        message: 'Slug produk sudah dipakai.',
      });
    }
    if (dto.variants?.length) {
      await this.assertVariantIdentifiers(ctx, dto.variants);
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          tenantId: ctx.tenantId,
          categoryId: dto.categoryId ?? null,
          name: dto.name,
          slug,
          description: dto.description ?? null,
          productType: dto.productType ?? 'PHYSICAL',
          brand: dto.brand ?? null,
          taxCategory: dto.taxCategory ?? null,
          defaultUnit: dto.defaultUnit ?? 'pcs',
          tags: dto.tags ?? [],
          metadata: (dto.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
          createdBy: actor.userId,
          updatedBy: actor.userId,
        },
      });
      const variants = [];
      for (const v of dto.variants ?? []) {
        const variant = await tx.productVariant.create({
          data: this.variantCreateData(ctx, actor, product.id, v),
        });
        variants.push(serializeVariant(variant));
        await this.audit.log(
          {
            tenantId: ctx.tenantId,
            userId: actor.userId,
            action: 'variant.created',
            entityType: 'ProductVariant',
            entityId: variant.id,
            after: { internalSku: variant.internalSku, name: variant.name, productId: product.id },
            correlationId: actor.correlationId,
            ip: actor.ip,
          },
          tx,
        );
      }
      await this.audit.log(
        {
          tenantId: ctx.tenantId,
          userId: actor.userId,
          action: 'product.created',
          entityType: 'Product',
          entityId: product.id,
          after: { name: product.name, slug: product.slug, variantCount: variants.length },
          correlationId: actor.correlationId,
          ip: actor.ip,
        },
        tx,
      );
      return { ...product, variants };
    });
  }

  async update(ctx: TenantContext, actor: Actor, id: string, dto: UpdateProductDto) {
    const before = await this.prisma.product.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null },
    });
    if (!before) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: 'Produk tidak ditemukan.',
      });
    }
    const newCategory = dto.categoryId === undefined ? before.categoryId : dto.categoryId;
    if (newCategory && newCategory !== before.categoryId) {
      await this.assertCategory(ctx, newCategory);
    }
    const newSlug = dto.slug ?? before.slug;
    if (newSlug !== before.slug) {
      const dup = await this.prisma.product.findFirst({
        where: { tenantId: ctx.tenantId, slug: newSlug, id: { not: id } },
      });
      if (dup) {
        throw new ConflictException({
          code: 'PRODUCT_SLUG_TAKEN',
          message: 'Slug produk sudah dipakai.',
        });
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id: before.id },
        data: {
          name: dto.name ?? before.name,
          slug: newSlug,
          categoryId: newCategory,
          description: dto.description === undefined ? before.description : dto.description,
          productType: dto.productType ?? before.productType,
          brand: dto.brand === undefined ? before.brand : dto.brand,
          taxCategory: dto.taxCategory === undefined ? before.taxCategory : dto.taxCategory,
          defaultUnit: dto.defaultUnit ?? before.defaultUnit,
          tags: dto.tags ?? before.tags,
          metadata: (dto.metadata === undefined
            ? undefined
            : (dto.metadata as Prisma.InputJsonValue)) as Prisma.InputJsonValue | undefined,
          status: dto.status ?? before.status,
          updatedBy: actor.userId,
        },
      });
      await this.audit.log(
        {
          tenantId: ctx.tenantId,
          userId: actor.userId,
          action: 'product.updated',
          entityType: 'Product',
          entityId: product.id,
          before: {
            name: before.name,
            slug: before.slug,
            status: before.status,
            categoryId: before.categoryId,
          },
          after: {
            name: product.name,
            slug: product.slug,
            status: product.status,
            categoryId: product.categoryId,
          },
          correlationId: actor.correlationId,
          ip: actor.ip,
        },
        tx,
      );
      return product;
    });
  }

  /** Arsip produk (soft delete) beserta status variannya. Listing kanal ikut nonaktif. */
  async archive(ctx: TenantContext, actor: Actor, id: string) {
    const before = await this.prisma.product.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null },
    });
    if (!before) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: 'Produk tidak ditemukan.',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.product.update({
        where: { id: before.id },
        data: { deletedAt: now, status: 'INACTIVE', updatedBy: actor.userId },
      });
      await tx.productVariant.updateMany({
        where: { tenantId: ctx.tenantId, productId: before.id, deletedAt: null },
        data: { status: 'INACTIVE' },
      });
      await tx.channelListing.updateMany({
        where: {
          tenantId: ctx.tenantId,
          variant: { productId: before.id },
        },
        data: { listingStatus: 'INACTIVE' },
      });
      await this.audit.log(
        {
          tenantId: ctx.tenantId,
          userId: actor.userId,
          action: 'product.archived',
          entityType: 'Product',
          entityId: before.id,
          before: { name: before.name, slug: before.slug },
          correlationId: actor.correlationId,
          ip: actor.ip,
        },
        tx,
      );
    });
    return { id: before.id, archived: true };
  }

  // ------------------------- Variant -------------------------

  async addVariants(ctx: TenantContext, actor: Actor, productId: string, dtos: CreateVariantDto[]) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId: ctx.tenantId, deletedAt: null },
    });
    if (!product) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: 'Produk tidak ditemukan.',
      });
    }
    await this.assertVariantIdentifiers(ctx, dtos);

    return this.prisma.$transaction(async (tx) => {
      const created = [];
      for (const v of dtos) {
        const variant = await tx.productVariant.create({
          data: this.variantCreateData(ctx, actor, product.id, v),
        });
        created.push(serializeVariant(variant));
        await this.audit.log(
          {
            tenantId: ctx.tenantId,
            userId: actor.userId,
            action: 'variant.created',
            entityType: 'ProductVariant',
            entityId: variant.id,
            after: { internalSku: variant.internalSku, name: variant.name, productId: product.id },
            correlationId: actor.correlationId,
            ip: actor.ip,
          },
          tx,
        );
      }
      return created;
    });
  }

  async updateVariant(ctx: TenantContext, actor: Actor, variantId: string, dto: UpdateVariantDto) {
    const before = await this.prisma.productVariant.findFirst({
      where: { id: variantId, tenantId: ctx.tenantId, deletedAt: null },
    });
    if (!before) {
      throw new NotFoundException({
        code: 'VARIANT_NOT_FOUND',
        message: 'Variasi tidak ditemukan.',
      });
    }
    if (dto.barcode && dto.barcode !== before.barcode) {
      const dup = await this.prisma.productVariant.findFirst({
        where: { tenantId: ctx.tenantId, barcode: dto.barcode, id: { not: variantId } },
      });
      if (dup) {
        throw new ConflictException({
          code: 'BARCODE_TAKEN',
          message: 'Barcode sudah dipakai variasi lain.',
        });
      }
    }
    return this.prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.update({
        where: { id: before.id },
        data: {
          name: dto.name ?? before.name,
          barcode: dto.barcode === undefined ? before.barcode : dto.barcode,
          attributes: (dto.attributes === undefined
            ? undefined
            : (dto.attributes as Prisma.InputJsonValue)) as Prisma.InputJsonValue | undefined,
          unit: dto.unit ?? before.unit,
          costAmount: dto.costAmount === undefined ? before.costAmount : BigInt(dto.costAmount),
          sellingPrice:
            dto.sellingPrice === undefined ? before.sellingPrice : BigInt(dto.sellingPrice),
          weightGrams: dto.weightGrams === undefined ? before.weightGrams : dto.weightGrams,
          dimensions: (dto.dimensions === undefined
            ? undefined
            : (dto.dimensions as Prisma.InputJsonValue)) as Prisma.InputJsonValue | undefined,
          status: dto.status ?? before.status,
          updatedBy: actor.userId,
        },
      });
      await this.audit.log(
        {
          tenantId: ctx.tenantId,
          userId: actor.userId,
          action: 'variant.updated',
          entityType: 'ProductVariant',
          entityId: variant.id,
          before: {
            name: before.name,
            sellingPrice: Number(before.sellingPrice),
            costAmount: Number(before.costAmount),
            status: before.status,
            barcode: before.barcode,
          },
          after: {
            name: variant.name,
            sellingPrice: Number(variant.sellingPrice),
            costAmount: Number(variant.costAmount),
            status: variant.status,
            barcode: variant.barcode,
          },
          correlationId: actor.correlationId,
          ip: actor.ip,
        },
        tx,
      );
      return serializeVariant(variant);
    });
  }

  async archiveVariant(ctx: TenantContext, actor: Actor, variantId: string) {
    const before = await this.prisma.productVariant.findFirst({
      where: { id: variantId, tenantId: ctx.tenantId, deletedAt: null },
    });
    if (!before) {
      throw new NotFoundException({
        code: 'VARIANT_NOT_FOUND',
        message: 'Variasi tidak ditemukan.',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.productVariant.update({
        where: { id: before.id },
        data: { deletedAt: new Date(), status: 'INACTIVE', updatedBy: actor.userId },
      });
      await tx.channelListing.updateMany({
        where: { tenantId: ctx.tenantId, productVariantId: before.id },
        data: { listingStatus: 'INACTIVE' },
      });
      await this.audit.log(
        {
          tenantId: ctx.tenantId,
          userId: actor.userId,
          action: 'variant.archived',
          entityType: 'ProductVariant',
          entityId: before.id,
          before: { internalSku: before.internalSku, name: before.name },
          correlationId: actor.correlationId,
          ip: actor.ip,
        },
        tx,
      );
    });
    return { id: before.id, archived: true };
  }

  /** Cari variant berdasarkan SKU internal atau barcode (tenant-scoped). */
  async lookupVariant(ctx: TenantContext, sku: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: {
        tenantId: ctx.tenantId,
        deletedAt: null,
        OR: [{ internalSku: sku }, { barcode: sku }],
      },
      include: { product: { select: { id: true, name: true, slug: true, status: true } } },
    });
    if (!variant) {
      throw new NotFoundException({
        code: 'VARIANT_NOT_FOUND',
        message: `SKU/barcode "${sku}" tidak ditemukan.`,
      });
    }
    return serializeVariant(variant);
  }

  // ------------------------- Helpers -------------------------

  private variantCreateData(
    ctx: TenantContext,
    actor: Actor,
    productId: string,
    v: CreateVariantDto,
  ): Prisma.ProductVariantUncheckedCreateInput {
    return {
      tenantId: ctx.tenantId,
      productId,
      name: v.name,
      internalSku: v.internalSku.trim(),
      barcode: v.barcode?.trim() ?? null,
      attributes: (v.attributes ?? undefined) as Prisma.InputJsonValue | undefined,
      unit: v.unit ?? 'pcs',
      costAmount: BigInt(v.costAmount ?? 0),
      sellingPrice: BigInt(v.sellingPrice ?? 0),
      currency: v.currency ?? 'IDR',
      weightGrams: v.weightGrams ?? null,
      dimensions: (v.dimensions ?? undefined) as Prisma.InputJsonValue | undefined,
      createdBy: actor.userId,
      updatedBy: actor.userId,
    };
  }

  private async assertCategory(ctx: TenantContext, categoryId: string): Promise<void> {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, tenantId: ctx.tenantId, deletedAt: null },
    });
    if (!category) {
      throw new NotFoundException({
        code: 'CATEGORY_NOT_FOUND',
        message: 'Kategori tidak ditemukan.',
      });
    }
  }

  /** Validasi SKU & barcode unik per tenant (termasuk di antara input batch). */
  private async assertVariantIdentifiers(
    ctx: TenantContext,
    variants: CreateVariantDto[],
  ): Promise<void> {
    const skus = variants.map((v) => v.internalSku.trim());
    const barcodes = variants.map((v) => v.barcode?.trim()).filter((b): b is string => !!b);
    if (new Set(skus).size !== skus.length) {
      throw new BadRequestException({
        code: 'DUPLICATE_SKU_IN_REQUEST',
        message: 'internalSku duplikat dalam permintaan.',
      });
    }
    if (new Set(barcodes).size !== barcodes.length) {
      throw new BadRequestException({
        code: 'DUPLICATE_BARCODE_IN_REQUEST',
        message: 'Barcode duplikat dalam permintaan.',
      });
    }
    const existingSku = await this.prisma.productVariant.findFirst({
      where: { tenantId: ctx.tenantId, internalSku: { in: skus } },
      select: { internalSku: true },
    });
    if (existingSku) {
      throw new ConflictException({
        code: 'SKU_TAKEN',
        message: `internalSku "${existingSku.internalSku}" sudah dipakai pada tenant ini.`,
      });
    }
    if (barcodes.length) {
      const existingBarcode = await this.prisma.productVariant.findFirst({
        where: { tenantId: ctx.tenantId, barcode: { in: barcodes } },
        select: { barcode: true },
      });
      if (existingBarcode) {
        throw new ConflictException({
          code: 'BARCODE_TAKEN',
          message: `Barcode "${existingBarcode.barcode}" sudah dipakai pada tenant ini.`,
        });
      }
    }
  }
}
