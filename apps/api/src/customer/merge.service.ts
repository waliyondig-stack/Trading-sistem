import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Customer, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { TenantContext } from '../common/request-types';
import type { Actor } from './customer.service';
import type { MergeExecuteDto, MergePreviewDto } from './customer.dto';

/** Field customer yang dapat dipilih strateginya saat merge. */
const MERGEABLE_FIELDS = [
  'displayName',
  'firstName',
  'lastName',
  'companyName',
  'primaryPhone',
  'primaryEmail',
  'notes',
  'preferredLanguage',
  'preferredChannel',
  'consentStatus',
  'type',
] as const;
type MergeableField = (typeof MERGEABLE_FIELDS)[number];

@Injectable()
export class MergeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Preview hasil merge — tidak mengubah data apa pun. */
  async preview(ctx: TenantContext, dto: MergePreviewDto) {
    const { source, target } = await this.loadPair(ctx, dto.sourceCustomerId, dto.targetCustomerId);
    const keep = new Set((dto.keepFromSource ?? []) as MergeableField[]);

    const resultFields: Record<string, unknown> = {};
    const comparison: Record<string, { source: unknown; target: unknown; result: unknown }> = {};
    for (const field of MERGEABLE_FIELDS) {
      const sourceValue = source[field as keyof Customer] ?? null;
      const targetValue = target[field as keyof Customer] ?? null;
      const result = keep.has(field) && sourceValue !== null ? sourceValue : targetValue;
      resultFields[field] = result;
      comparison[field] = { source: sourceValue, target: targetValue, result };
    }

    // Identity: yang persis sama (type+normalizedValue+channel) dianggap redundan.
    const targetKeys = new Set(
      target.identities.map((i) => `${i.identityType}|${i.normalizedValue}|${i.channelId ?? ''}`),
    );
    const identitiesToMove = source.identities.filter(
      (i) => !targetKeys.has(`${i.identityType}|${i.normalizedValue}|${i.channelId ?? ''}`),
    );
    const redundantIdentities = source.identities.length - identitiesToMove.length;

    return {
      source: this.summaryOf(source),
      target: this.summaryOf(target),
      comparison,
      result: resultFields,
      willMove: {
        identities: identitiesToMove.length,
        redundantIdentities,
        addresses: source.addresses.length,
      },
      note: 'Preview — belum ada data yang diubah. Eksekusi memerlukan permission customer.merge.execute dan alasan.',
    };
  }

  /**
   * Eksekusi merge dalam SATU transaksi:
   * pindahkan identity & address, terapkan strategi field, tandai source
   * MERGED (tidak dihapus permanen), simpan merge history + audit log.
   */
  async execute(ctx: TenantContext, actor: Actor, dto: MergeExecuteDto) {
    const { source, target } = await this.loadPair(ctx, dto.sourceCustomerId, dto.targetCustomerId);
    const keep = new Set((dto.keepFromSource ?? []) as MergeableField[]);

    const snapshotBefore = {
      source: { ...this.snapshotOf(source) },
      target: { ...this.snapshotOf(target) },
    };

    const merged = await this.prisma.$transaction(async (tx) => {
      // 1. Terapkan strategi field ke target.
      const fieldData: Record<string, unknown> = {};
      for (const field of keep) {
        const value = source[field as keyof Customer];
        if (value !== null && value !== undefined) fieldData[field] = value;
      }
      const updatedTarget = await tx.customer.update({
        where: { id: target.id },
        data: { ...(fieldData as Prisma.CustomerUncheckedUpdateInput), updatedBy: actor.userId },
      });

      // 2. Pindahkan identity yang tidak redundan; hapus duplikat persis
      //    (nilainya tetap terekam pada snapshotBefore).
      const targetKeys = new Set(
        target.identities.map((i) => `${i.identityType}|${i.normalizedValue}|${i.channelId ?? ''}`),
      );
      const targetHasPrimary = new Set(
        target.identities.filter((i) => i.isPrimary).map((i) => i.identityType),
      );
      for (const identity of source.identities) {
        const key = `${identity.identityType}|${identity.normalizedValue}|${identity.channelId ?? ''}`;
        if (targetKeys.has(key)) {
          await tx.customerIdentity.delete({ where: { id: identity.id } });
        } else {
          await tx.customerIdentity.update({
            where: { id: identity.id },
            data: {
              customerId: target.id,
              isPrimary: identity.isPrimary && !targetHasPrimary.has(identity.identityType),
            },
          });
        }
      }

      // 3. Pindahkan seluruh alamat (primary source diturunkan bila target sudah punya).
      const targetHasPrimaryAddress = target.addresses.some((a) => a.isPrimary);
      await tx.customerAddress.updateMany({
        where: { tenantId: ctx.tenantId, customerId: source.id },
        data: { customerId: target.id, ...(targetHasPrimaryAddress ? { isPrimary: false } : {}) },
      });

      // 4. Tandai source MERGED (soft — tidak hilang permanen).
      await tx.customer.update({
        where: { id: source.id },
        data: {
          status: 'MERGED',
          mergedIntoId: target.id,
          updatedBy: actor.userId,
        },
      });

      // 5. Kandidat pasangan ini → CONFIRMED_DUPLICATE.
      const [aId, bId] = [source.id, target.id].sort();
      await tx.customerMergeCandidate.updateMany({
        where: { tenantId: ctx.tenantId, customerAId: aId, customerBId: bId },
        data: { status: 'CONFIRMED_DUPLICATE', reviewedBy: actor.userId, reviewedAt: new Date() },
      });

      // 6. Merge history (cukup untuk investigasi & pemulihan manual).
      const history = await tx.customerMergeHistory.create({
        data: {
          tenantId: ctx.tenantId,
          sourceCustomerId: source.id,
          targetCustomerId: target.id,
          snapshotBefore: snapshotBefore as unknown as Prisma.InputJsonValue,
          mergeStrategy: {
            keepFromSource: [...keep],
            movedIdentities: source.identities.length,
            movedAddresses: source.addresses.length,
          } as unknown as Prisma.InputJsonValue,
          performedBy: actor.userId,
          reason: dto.reason,
        },
      });

      // 7. Audit log.
      await this.audit.log(
        {
          tenantId: ctx.tenantId,
          userId: actor.userId,
          action: 'customer.merged',
          entityType: 'Customer',
          entityId: target.id,
          before: { sourceId: source.id, sourceName: source.displayName },
          after: {
            targetId: target.id,
            targetName: updatedTarget.displayName,
            mergeHistoryId: history.id,
            reason: dto.reason,
          },
          correlationId: actor.correlationId,
          ip: actor.ip,
        },
        tx,
      );

      return { target: updatedTarget, historyId: history.id };
    });

    return {
      merged: true,
      targetCustomerId: merged.target.id,
      sourceCustomerId: source.id,
      mergeHistoryId: merged.historyId,
    };
  }

  async history(ctx: TenantContext, customerId?: string) {
    return this.prisma.customerMergeHistory.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(customerId
          ? { OR: [{ sourceCustomerId: customerId }, { targetCustomerId: customerId }] }
          : {}),
      },
      orderBy: { performedAt: 'desc' },
      take: 50,
      include: {
        source: { select: { id: true, displayName: true, status: true } },
        target: { select: { id: true, displayName: true, status: true } },
      },
    });
  }

  private async loadPair(ctx: TenantContext, sourceId: string, targetId: string) {
    if (sourceId === targetId) {
      throw new BadRequestException({
        code: 'MERGE_SAME_CUSTOMER',
        message: 'Source dan target tidak boleh pelanggan yang sama.',
      });
    }
    const [source, target] = await Promise.all([
      this.prisma.customer.findFirst({
        where: { id: sourceId, tenantId: ctx.tenantId, deletedAt: null },
        include: { identities: true, addresses: true },
      }),
      this.prisma.customer.findFirst({
        where: { id: targetId, tenantId: ctx.tenantId, deletedAt: null },
        include: { identities: true, addresses: true },
      }),
    ]);
    if (!source || !target) {
      throw new NotFoundException({
        code: 'CUSTOMER_NOT_FOUND',
        message: 'Pelanggan source/target tidak ditemukan.',
      });
    }
    if (source.status === 'MERGED' || target.status === 'MERGED') {
      throw new BadRequestException({
        code: 'CUSTOMER_ALREADY_MERGED',
        message: 'Salah satu pelanggan sudah berstatus MERGED.',
      });
    }
    return { source, target };
  }

  private summaryOf(c: Customer & { identities: unknown[]; addresses: unknown[] }) {
    return {
      id: c.id,
      displayName: c.displayName,
      primaryPhone: c.primaryPhone,
      primaryEmail: c.primaryEmail,
      status: c.status,
      identityCount: c.identities.length,
      addressCount: c.addresses.length,
    };
  }

  private snapshotOf(c: Customer & { identities: unknown[]; addresses: unknown[] }) {
    const { identities, addresses, ...fields } = c;
    return { ...fields, identities, addresses };
  }
}
