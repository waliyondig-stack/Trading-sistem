import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Category } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { TenantContext } from '../common/request-types';
import { slugify } from './slug';
import type { CreateCategoryDto, UpdateCategoryDto } from './category.dto';

export interface Actor {
  userId: string;
  correlationId?: string;
  ip?: string;
}

export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
}

@Injectable()
export class CategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(ctx: TenantContext, includeInactive = false) {
    return this.prisma.category.findMany({
      where: {
        tenantId: ctx.tenantId,
        deletedAt: null,
        ...(includeInactive ? {} : { status: 'ACTIVE' }),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: { where: { deletedAt: null } } } } },
    });
  }

  /** Tree kategori (nested) dari daftar flat. */
  async tree(ctx: TenantContext): Promise<CategoryTreeNode[]> {
    const rows = await this.prisma.category.findMany({
      where: { tenantId: ctx.tenantId, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    const byId = new Map<string, CategoryTreeNode>(
      rows.map((r) => [r.id, { ...r, children: [] as CategoryTreeNode[] }]),
    );
    const roots: CategoryTreeNode[] = [];
    for (const node of byId.values()) {
      if (node.parentCategoryId && byId.has(node.parentCategoryId)) {
        byId.get(node.parentCategoryId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  async getById(ctx: TenantContext, id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null },
      include: {
        parent: { select: { id: true, name: true, slug: true } },
        _count: { select: { products: { where: { deletedAt: null } }, children: true } },
      },
    });
    if (!category) {
      throw new NotFoundException({
        code: 'CATEGORY_NOT_FOUND',
        message: 'Kategori tidak ditemukan.',
      });
    }
    return category;
  }

  async create(ctx: TenantContext, actor: Actor, dto: CreateCategoryDto) {
    const slug = dto.slug ?? slugify(dto.name);
    if (!slug) {
      throw new BadRequestException({ code: 'INVALID_SLUG', message: 'Slug tidak valid.' });
    }
    if (dto.parentCategoryId) {
      await this.assertParentValid(ctx, dto.parentCategoryId, null);
    }
    await this.assertSlugAvailable(ctx, slug, dto.parentCategoryId ?? null);

    return this.prisma.$transaction(async (tx) => {
      const category = await tx.category.create({
        data: {
          tenantId: ctx.tenantId,
          parentCategoryId: dto.parentCategoryId ?? null,
          name: dto.name,
          slug,
          description: dto.description ?? null,
          sortOrder: dto.sortOrder ?? 0,
          createdBy: actor.userId,
          updatedBy: actor.userId,
        },
      });
      await this.audit.log(
        {
          tenantId: ctx.tenantId,
          userId: actor.userId,
          action: 'category.created',
          entityType: 'Category',
          entityId: category.id,
          after: { name: category.name, slug: category.slug, parent: category.parentCategoryId },
          correlationId: actor.correlationId,
          ip: actor.ip,
        },
        tx,
      );
      return category;
    });
  }

  async update(ctx: TenantContext, actor: Actor, id: string, dto: UpdateCategoryDto) {
    const before = await this.getById(ctx, id);

    const newParent =
      dto.parentCategoryId === undefined ? before.parentCategoryId : dto.parentCategoryId;
    if (newParent) {
      await this.assertParentValid(ctx, newParent, id);
    }
    const newSlug = dto.slug ?? (dto.name ? slugify(dto.name) : before.slug);
    if (newSlug !== before.slug || newParent !== before.parentCategoryId) {
      await this.assertSlugAvailable(ctx, newSlug, newParent, id);
    }

    return this.prisma.$transaction(async (tx) => {
      const category = await tx.category.update({
        where: { id: before.id },
        data: {
          name: dto.name ?? before.name,
          slug: newSlug,
          parentCategoryId: newParent,
          description: dto.description === undefined ? before.description : dto.description,
          status: dto.status ?? before.status,
          sortOrder: dto.sortOrder ?? before.sortOrder,
          updatedBy: actor.userId,
        },
      });
      await this.audit.log(
        {
          tenantId: ctx.tenantId,
          userId: actor.userId,
          action: 'category.updated',
          entityType: 'Category',
          entityId: category.id,
          before: {
            name: before.name,
            slug: before.slug,
            status: before.status,
            parent: before.parentCategoryId,
          },
          after: {
            name: category.name,
            slug: category.slug,
            status: category.status,
            parent: category.parentCategoryId,
          },
          correlationId: actor.correlationId,
          ip: actor.ip,
        },
        tx,
      );
      return category;
    });
  }

  /** Arsip (soft delete). Kategori dengan anak aktif atau produk aktif tidak boleh diarsipkan. */
  async archive(ctx: TenantContext, actor: Actor, id: string) {
    const before = await this.getById(ctx, id);
    const [activeChildren, activeProducts] = await this.prisma.$transaction([
      this.prisma.category.count({
        where: { tenantId: ctx.tenantId, parentCategoryId: id, deletedAt: null },
      }),
      this.prisma.product.count({
        where: { tenantId: ctx.tenantId, categoryId: id, deletedAt: null },
      }),
    ]);
    if (activeChildren > 0 || activeProducts > 0) {
      throw new ConflictException({
        code: 'CATEGORY_IN_USE',
        message:
          'Kategori masih memiliki sub-kategori atau produk aktif. Pindahkan atau arsipkan dulu isinya.',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.category.update({
        where: { id: before.id },
        data: { deletedAt: new Date(), status: 'INACTIVE', updatedBy: actor.userId },
      });
      await this.audit.log(
        {
          tenantId: ctx.tenantId,
          userId: actor.userId,
          action: 'category.archived',
          entityType: 'Category',
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

  /** Validasi parent: milik tenant, tidak terhapus, dan tidak menimbulkan siklus. */
  private async assertParentValid(
    ctx: TenantContext,
    parentId: string,
    selfId: string | null,
  ): Promise<void> {
    if (selfId && parentId === selfId) {
      throw new BadRequestException({
        code: 'CATEGORY_CIRCULAR',
        message: 'Kategori tidak boleh menjadi parent dirinya sendiri.',
      });
    }
    const parent = await this.prisma.category.findFirst({
      where: { id: parentId, tenantId: ctx.tenantId, deletedAt: null },
    });
    if (!parent) {
      throw new NotFoundException({
        code: 'PARENT_CATEGORY_NOT_FOUND',
        message: 'Kategori parent tidak ditemukan.',
      });
    }
    // Telusuri rantai parent ke atas; bila menemukan selfId → siklus.
    if (selfId) {
      let cursor: string | null = parent.parentCategoryId;
      let depth = 0;
      while (cursor && depth < 50) {
        if (cursor === selfId) {
          throw new BadRequestException({
            code: 'CATEGORY_CIRCULAR',
            message: 'Perubahan ini akan membuat hirarki kategori melingkar.',
          });
        }
        const next: { parentCategoryId: string | null } | null =
          await this.prisma.category.findFirst({
            where: { id: cursor, tenantId: ctx.tenantId },
            select: { parentCategoryId: true },
          });
        cursor = next?.parentCategoryId ?? null;
        depth += 1;
      }
    }
  }

  /** Slug unik dalam parent yang sama (termasuk parent null/root). */
  private async assertSlugAvailable(
    ctx: TenantContext,
    slug: string,
    parentId: string | null,
    excludeId?: string,
  ): Promise<void> {
    const dup = await this.prisma.category.findFirst({
      where: {
        tenantId: ctx.tenantId,
        parentCategoryId: parentId,
        slug,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (dup) {
      throw new ConflictException({
        code: 'CATEGORY_SLUG_TAKEN',
        message: 'Slug kategori sudah dipakai pada level yang sama.',
      });
    }
  }
}
