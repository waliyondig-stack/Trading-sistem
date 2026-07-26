import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { nameSimilarity, normalizeEmail, normalizePhoneId } from '@flowniaga/domain';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { TenantContext } from '../common/request-types';
import { pageArgs, paginate } from '../common/pagination';
import type {
  AddAddressDto,
  AddIdentityDto,
  CreateCustomerDto,
  CustomerListQueryDto,
  PatchCustomerDto,
} from './customer.dto';

export interface Actor {
  userId: string;
  correlationId?: string;
  ip?: string;
}

/** Bobot skor duplikat — deterministik dan dapat dijelaskan (tanpa AI). */
const SCORE = {
  EXTERNAL_IDENTITY_SAME: 100,
  PHONE_SAME: 80,
  EMAIL_SAME: 80,
  NAME_SIMILAR: 20,
  COMPANY_SIMILAR: 10,
  CITY_SAME: 10,
} as const;
/** Kandidat dibuat hanya bila ada sinyal kuat (≥60). Nama mirip saja tidak cukup. */
const CANDIDATE_THRESHOLD = 60;

@Injectable()
export class CustomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------- CRUD -------------------------

  async list(ctx: TenantContext, query: CustomerListQueryDto) {
    const { skip, take, page, pageSize } = pageArgs(query);
    const normalizedPhone = query.search ? normalizePhoneId(query.search) : null;
    const where: Prisma.CustomerWhereInput = {
      tenantId: ctx.tenantId,
      deletedAt: null,
      status: query.status ?? { not: 'MERGED' },
      ...(query.type ? { type: query.type } : {}),
      ...(query.search
        ? {
            OR: [
              { displayName: { contains: query.search, mode: 'insensitive' } },
              { companyName: { contains: query.search, mode: 'insensitive' } },
              { primaryEmail: { contains: query.search.toLowerCase() } },
              ...(normalizedPhone ? [{ primaryPhone: normalizedPhone }] : []),
              {
                identities: { some: { normalizedValue: { contains: query.search.toLowerCase() } } },
              },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        orderBy: { [query.sortBy ?? 'displayName']: query.sortDir ?? 'asc' },
        skip,
        take,
        include: {
          _count: { select: { identities: true, addresses: true } },
        },
      }),
      this.prisma.customer.count({ where }),
    ]);
    // Tandai pelanggan yang punya kandidat duplikat pending (indikator UI).
    const ids = rows.map((r) => r.id);
    const pendings = ids.length
      ? await this.prisma.customerMergeCandidate.findMany({
          where: {
            tenantId: ctx.tenantId,
            status: 'PENDING',
            OR: [{ customerAId: { in: ids } }, { customerBId: { in: ids } }],
          },
          select: { customerAId: true, customerBId: true },
        })
      : [];
    const flagged = new Set(pendings.flatMap((p) => [p.customerAId, p.customerBId]));
    return paginate(
      rows.map((r) => ({ ...r, hasPendingDuplicate: flagged.has(r.id) })),
      total,
      page,
      pageSize,
    );
  }

  async getById(ctx: TenantContext, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null },
      include: {
        identities: {
          orderBy: { createdAt: 'asc' },
          include: { channel: { select: { id: true, name: true, type: true } } },
        },
        addresses: { orderBy: { createdAt: 'asc' } },
        mergedInto: { select: { id: true, displayName: true } },
      },
    });
    if (!customer) {
      throw new NotFoundException({
        code: 'CUSTOMER_NOT_FOUND',
        message: 'Pelanggan tidak ditemukan.',
      });
    }
    const pendingCandidates = await this.prisma.customerMergeCandidate.count({
      where: {
        tenantId: ctx.tenantId,
        status: 'PENDING',
        OR: [{ customerAId: id }, { customerBId: id }],
      },
    });
    return { ...customer, pendingDuplicateCount: pendingCandidates };
  }

  async create(ctx: TenantContext, actor: Actor, dto: CreateCustomerDto) {
    const phone = this.normalizePhoneOrThrow(dto.primaryPhone);
    const email = this.normalizeEmailOrThrow(dto.primaryEmail);

    const customer = await this.prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: {
          tenantId: ctx.tenantId,
          type: dto.type ?? 'INDIVIDUAL',
          displayName: dto.displayName,
          firstName: dto.firstName ?? null,
          lastName: dto.lastName ?? null,
          companyName: dto.companyName ?? null,
          primaryPhone: phone,
          primaryEmail: email,
          notes: dto.notes ?? null,
          tags: dto.tags ?? [],
          consentStatus: dto.consentStatus ?? 'UNKNOWN',
          preferredLanguage: dto.preferredLanguage ?? 'id',
          preferredChannel: dto.preferredChannel ?? null,
          createdBy: actor.userId,
          updatedBy: actor.userId,
        },
      });
      if (phone) {
        await tx.customerIdentity.create({
          data: {
            tenantId: ctx.tenantId,
            customerId: created.id,
            identityType: 'PHONE',
            normalizedValue: phone,
            displayValue: dto.primaryPhone!,
            isPrimary: true,
          },
        });
      }
      if (email) {
        await tx.customerIdentity.create({
          data: {
            tenantId: ctx.tenantId,
            customerId: created.id,
            identityType: 'EMAIL',
            normalizedValue: email,
            displayValue: dto.primaryEmail!,
            isPrimary: !phone,
          },
        });
      }
      await this.audit.log(
        {
          tenantId: ctx.tenantId,
          userId: actor.userId,
          action: 'customer.created',
          entityType: 'Customer',
          entityId: created.id,
          after: { displayName: created.displayName, phone, email },
          correlationId: actor.correlationId,
          ip: actor.ip,
        },
        tx,
      );
      return created;
    });

    const candidates = await this.detectDuplicates(ctx.tenantId, customer.id);
    return { ...customer, duplicateCandidatesCreated: candidates };
  }

  async update(ctx: TenantContext, actor: Actor, id: string, dto: PatchCustomerDto) {
    const before = await this.prisma.customer.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null },
    });
    if (!before) {
      throw new NotFoundException({
        code: 'CUSTOMER_NOT_FOUND',
        message: 'Pelanggan tidak ditemukan.',
      });
    }
    if (before.status === 'MERGED') {
      throw new ConflictException({
        code: 'CUSTOMER_MERGED',
        message: 'Pelanggan sudah digabung. Ubah data pada pelanggan master.',
      });
    }
    const phone =
      dto.primaryPhone === undefined
        ? before.primaryPhone
        : this.normalizePhoneOrThrow(dto.primaryPhone);
    const email =
      dto.primaryEmail === undefined
        ? before.primaryEmail
        : this.normalizeEmailOrThrow(dto.primaryEmail);

    const updated = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.update({
        where: { id: before.id },
        data: {
          type: dto.type ?? before.type,
          displayName: dto.displayName ?? before.displayName,
          firstName: dto.firstName === undefined ? before.firstName : dto.firstName,
          lastName: dto.lastName === undefined ? before.lastName : dto.lastName,
          companyName: dto.companyName === undefined ? before.companyName : dto.companyName,
          primaryPhone: phone,
          primaryEmail: email,
          notes: dto.notes === undefined ? before.notes : dto.notes,
          tags: dto.tags ?? before.tags,
          consentStatus: dto.consentStatus ?? before.consentStatus,
          status: dto.status ?? before.status,
          preferredLanguage: dto.preferredLanguage ?? before.preferredLanguage,
          preferredChannel:
            dto.preferredChannel === undefined ? before.preferredChannel : dto.preferredChannel,
          updatedBy: actor.userId,
        },
      });
      await this.audit.log(
        {
          tenantId: ctx.tenantId,
          userId: actor.userId,
          action: 'customer.updated',
          entityType: 'Customer',
          entityId: customer.id,
          before: {
            displayName: before.displayName,
            primaryPhone: before.primaryPhone,
            primaryEmail: before.primaryEmail,
            status: before.status,
          },
          after: {
            displayName: customer.displayName,
            primaryPhone: customer.primaryPhone,
            primaryEmail: customer.primaryEmail,
            status: customer.status,
          },
          correlationId: actor.correlationId,
          ip: actor.ip,
        },
        tx,
      );
      return customer;
    });

    await this.detectDuplicates(ctx.tenantId, updated.id);
    return updated;
  }

  async archive(ctx: TenantContext, actor: Actor, id: string) {
    const before = await this.prisma.customer.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null },
    });
    if (!before) {
      throw new NotFoundException({
        code: 'CUSTOMER_NOT_FOUND',
        message: 'Pelanggan tidak ditemukan.',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: before.id },
        data: { deletedAt: new Date(), status: 'INACTIVE', updatedBy: actor.userId },
      });
      await this.audit.log(
        {
          tenantId: ctx.tenantId,
          userId: actor.userId,
          action: 'customer.archived',
          entityType: 'Customer',
          entityId: before.id,
          before: { displayName: before.displayName },
          correlationId: actor.correlationId,
          ip: actor.ip,
        },
        tx,
      );
    });
    return { id: before.id, archived: true };
  }

  // ------------------------- Identity -------------------------

  async addIdentity(ctx: TenantContext, actor: Actor, customerId: string, dto: AddIdentityDto) {
    const customer = await this.assertActiveCustomer(ctx, customerId);
    const normalized = this.normalizeIdentityValue(dto.identityType, dto.value, dto.externalId);
    if (dto.channelId) {
      const channel = await this.prisma.channel.findFirst({
        where: { id: dto.channelId, tenantId: ctx.tenantId },
      });
      if (!channel) {
        throw new NotFoundException({
          code: 'CHANNEL_NOT_FOUND',
          message: 'Kanal tidak ditemukan.',
        });
      }
    }

    // Identity TERVERIFIKASI tidak boleh terpasang pada dua customer aktif.
    const verifiedConflict = await this.prisma.customerIdentity.findFirst({
      where: {
        tenantId: ctx.tenantId,
        identityType: dto.identityType,
        normalizedValue: normalized,
        verificationStatus: 'VERIFIED',
        customerId: { not: customerId },
        customer: { status: 'ACTIVE', deletedAt: null },
      },
      include: { customer: { select: { id: true, displayName: true } } },
    });
    if (verifiedConflict && dto.verificationStatus === 'VERIFIED') {
      throw new ConflictException({
        code: 'IDENTITY_CONFLICT',
        message: `Identitas ini sudah terverifikasi pada pelanggan "${verifiedConflict.customer.displayName}". Selesaikan lewat proses merge/review duplikat.`,
      });
    }

    const identity = await this.prisma.$transaction(async (tx) => {
      const created = await tx.customerIdentity.create({
        data: {
          tenantId: ctx.tenantId,
          customerId: customer.id,
          identityType: dto.identityType,
          channelId: dto.channelId ?? null,
          externalId: dto.externalId ?? null,
          normalizedValue: normalized,
          displayValue: dto.value,
          verificationStatus: dto.verificationStatus ?? 'UNVERIFIED',
          isPrimary: dto.isPrimary ?? false,
        },
      });
      await this.audit.log(
        {
          tenantId: ctx.tenantId,
          userId: actor.userId,
          action: 'customer.identity_added',
          entityType: 'CustomerIdentity',
          entityId: created.id,
          after: {
            customerId: customer.id,
            identityType: created.identityType,
            normalizedValue: created.normalizedValue,
          },
          correlationId: actor.correlationId,
          ip: actor.ip,
        },
        tx,
      );
      return created;
    });

    const candidates = await this.detectDuplicates(ctx.tenantId, customerId);
    return { ...identity, duplicateCandidatesCreated: candidates };
  }

  async updateIdentity(
    ctx: TenantContext,
    actor: Actor,
    identityId: string,
    dto: { verificationStatus?: 'UNVERIFIED' | 'VERIFIED'; isPrimary?: boolean },
  ) {
    const before = await this.prisma.customerIdentity.findFirst({
      where: { id: identityId, tenantId: ctx.tenantId },
    });
    if (!before) {
      throw new NotFoundException({
        code: 'IDENTITY_NOT_FOUND',
        message: 'Identitas tidak ditemukan.',
      });
    }
    if (dto.verificationStatus === 'VERIFIED') {
      const conflict = await this.prisma.customerIdentity.findFirst({
        where: {
          tenantId: ctx.tenantId,
          identityType: before.identityType,
          normalizedValue: before.normalizedValue,
          verificationStatus: 'VERIFIED',
          customerId: { not: before.customerId },
          customer: { status: 'ACTIVE', deletedAt: null },
        },
      });
      if (conflict) {
        throw new ConflictException({
          code: 'IDENTITY_CONFLICT',
          message: 'Identitas yang sama sudah terverifikasi pada pelanggan aktif lain.',
        });
      }
    }
    return this.prisma.$transaction(async (tx) => {
      const identity = await tx.customerIdentity.update({
        where: { id: before.id },
        data: {
          verificationStatus: dto.verificationStatus ?? before.verificationStatus,
          isPrimary: dto.isPrimary ?? before.isPrimary,
        },
      });
      await this.audit.log(
        {
          tenantId: ctx.tenantId,
          userId: actor.userId,
          action: 'customer.identity_updated',
          entityType: 'CustomerIdentity',
          entityId: identity.id,
          before: { verificationStatus: before.verificationStatus, isPrimary: before.isPrimary },
          after: { verificationStatus: identity.verificationStatus, isPrimary: identity.isPrimary },
          correlationId: actor.correlationId,
          ip: actor.ip,
        },
        tx,
      );
      return identity;
    });
  }

  // ------------------------- Address -------------------------

  async addAddress(ctx: TenantContext, actor: Actor, customerId: string, dto: AddAddressDto) {
    const customer = await this.assertActiveCustomer(ctx, customerId);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.customerAddress.updateMany({
          where: { tenantId: ctx.tenantId, customerId: customer.id },
          data: { isPrimary: false },
        });
      }
      const address = await tx.customerAddress.create({
        data: {
          tenantId: ctx.tenantId,
          customerId: customer.id,
          label: dto.label ?? 'Utama',
          recipientName: dto.recipientName,
          phone: dto.phone ?? null,
          addressLine: dto.addressLine,
          village: dto.village ?? null,
          district: dto.district ?? null,
          city: dto.city,
          province: dto.province,
          postalCode: dto.postalCode ?? null,
          country: dto.country ?? 'ID',
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
          isPrimary: dto.isPrimary ?? false,
        },
      });
      await this.audit.log(
        {
          tenantId: ctx.tenantId,
          userId: actor.userId,
          action: 'customer.updated',
          entityType: 'CustomerAddress',
          entityId: address.id,
          after: { customerId: customer.id, label: address.label, city: address.city },
          correlationId: actor.correlationId,
          ip: actor.ip,
        },
        tx,
      );
      return address;
    });
  }

  // ------------------------- Duplicate detection -------------------------

  /**
   * Deteksi duplikat deterministik untuk satu customer terhadap customer aktif
   * lain dalam tenant. Membuat/memperbarui CustomerMergeCandidate PENDING.
   * TIDAK pernah melakukan merge otomatis.
   * @returns jumlah kandidat baru yang dibuat
   */
  async detectDuplicates(tenantId: string, customerId: string): Promise<number> {
    const subject = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null, status: 'ACTIVE' },
      include: { identities: true, addresses: { where: { isPrimary: true } } },
    });
    if (!subject) return 0;

    // Kumpulkan lawan pembanding lewat sinyal kuat (query terarah, bukan scan penuh).
    const strongValues = subject.identities.map((i) => i.normalizedValue);
    const others = await this.prisma.customer.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: 'ACTIVE',
        id: { not: subject.id },
        OR: [
          ...(subject.primaryPhone ? [{ primaryPhone: subject.primaryPhone }] : []),
          ...(subject.primaryEmail ? [{ primaryEmail: subject.primaryEmail }] : []),
          ...(strongValues.length
            ? [{ identities: { some: { normalizedValue: { in: strongValues } } } }]
            : []),
        ],
      },
      include: { identities: true, addresses: { where: { isPrimary: true } } },
    });

    let created = 0;
    for (const other of others) {
      const reasons: { code: string; detail: string; score: number }[] = [];

      const externalMatch = subject.identities.find((si) =>
        other.identities.some(
          (oi) =>
            oi.identityType === si.identityType &&
            oi.normalizedValue === si.normalizedValue &&
            (si.identityType === 'MARKETPLACE_ACCOUNT' || si.identityType === 'MANUAL_REFERENCE'),
        ),
      );
      if (externalMatch) {
        reasons.push({
          code: 'EXTERNAL_IDENTITY_SAME',
          detail: `Identitas kanal sama: ${externalMatch.normalizedValue}`,
          score: SCORE.EXTERNAL_IDENTITY_SAME,
        });
      }
      const phoneMatch =
        (subject.primaryPhone && subject.primaryPhone === other.primaryPhone) ||
        subject.identities.some(
          (si) =>
            si.identityType === 'PHONE' &&
            other.identities.some(
              (oi) => oi.identityType === 'PHONE' && oi.normalizedValue === si.normalizedValue,
            ),
        );
      if (phoneMatch) {
        reasons.push({
          code: 'PHONE_SAME',
          detail: `Nomor telepon ternormalisasi sama`,
          score: SCORE.PHONE_SAME,
        });
      }
      const emailMatch =
        (subject.primaryEmail && subject.primaryEmail === other.primaryEmail) ||
        subject.identities.some(
          (si) =>
            si.identityType === 'EMAIL' &&
            other.identities.some(
              (oi) => oi.identityType === 'EMAIL' && oi.normalizedValue === si.normalizedValue,
            ),
        );
      if (emailMatch) {
        reasons.push({
          code: 'EMAIL_SAME',
          detail: 'Email ternormalisasi sama',
          score: SCORE.EMAIL_SAME,
        });
      }

      // Sinyal pendukung.
      const nameSim = nameSimilarity(subject.displayName, other.displayName);
      if (nameSim >= 0.6) {
        reasons.push({
          code: 'NAME_SIMILAR',
          detail: `Kemiripan nama ${(nameSim * 100).toFixed(0)}%`,
          score: SCORE.NAME_SIMILAR,
        });
      }
      if (
        subject.companyName &&
        other.companyName &&
        nameSimilarity(subject.companyName, other.companyName) >= 0.6
      ) {
        reasons.push({
          code: 'COMPANY_SIMILAR',
          detail: 'Nama perusahaan mirip',
          score: SCORE.COMPANY_SIMILAR,
        });
      }
      const subjectCity = subject.addresses[0]?.city?.toLowerCase();
      const otherCity = other.addresses[0]?.city?.toLowerCase();
      if (subjectCity && subjectCity === otherCity) {
        reasons.push({
          code: 'CITY_SAME',
          detail: `Kota alamat sama (${subject.addresses[0].city})`,
          score: SCORE.CITY_SAME,
        });
      }

      const score = Math.min(
        100,
        reasons.reduce((acc, r) => acc + r.score, 0),
      );
      if (score < CANDIDATE_THRESHOLD) continue;

      // Pasangan disimpan terurut agar unik (A < B).
      const [aId, bId] = [subject.id, other.id].sort();
      const result = await this.prisma.customerMergeCandidate.upsert({
        where: {
          tenantId_customerAId_customerBId: {
            tenantId,
            customerAId: aId,
            customerBId: bId,
          },
        },
        create: {
          tenantId,
          customerAId: aId,
          customerBId: bId,
          score,
          reasons: reasons as unknown as Prisma.InputJsonValue,
        },
        update: {
          // Kandidat yang sudah direview tidak di-reset.
          score,
          reasons: reasons as unknown as Prisma.InputJsonValue,
        },
      });
      if (result.status === 'PENDING' && result.reviewedAt === null) created += 1;
    }
    return created;
  }

  async listCandidates(ctx: TenantContext, status?: string) {
    return this.prisma.customerMergeCandidate.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(status ? { status: status as never } : { status: 'PENDING' }),
      },
      orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
      include: {
        customerA: {
          select: {
            id: true,
            displayName: true,
            primaryPhone: true,
            primaryEmail: true,
            status: true,
          },
        },
        customerB: {
          select: {
            id: true,
            displayName: true,
            primaryPhone: true,
            primaryEmail: true,
            status: true,
          },
        },
      },
    });
  }

  async reviewCandidate(
    ctx: TenantContext,
    actor: Actor,
    candidateId: string,
    status: 'CONFIRMED_DUPLICATE' | 'REJECTED' | 'IGNORED',
  ) {
    const candidate = await this.prisma.customerMergeCandidate.findFirst({
      where: { id: candidateId, tenantId: ctx.tenantId },
    });
    if (!candidate) {
      throw new NotFoundException({
        code: 'CANDIDATE_NOT_FOUND',
        message: 'Kandidat tidak ditemukan.',
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.customerMergeCandidate.update({
        where: { id: candidate.id },
        data: { status, reviewedBy: actor.userId, reviewedAt: new Date() },
      });
      await this.audit.log(
        {
          tenantId: ctx.tenantId,
          userId: actor.userId,
          action: 'customer.merge_candidate_reviewed',
          entityType: 'CustomerMergeCandidate',
          entityId: candidate.id,
          before: { status: candidate.status },
          after: { status: updated.status },
          correlationId: actor.correlationId,
          ip: actor.ip,
        },
        tx,
      );
      return updated;
    });
  }

  // ------------------------- Helpers -------------------------

  async assertActiveCustomer(ctx: TenantContext, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null },
    });
    if (!customer) {
      throw new NotFoundException({
        code: 'CUSTOMER_NOT_FOUND',
        message: 'Pelanggan tidak ditemukan.',
      });
    }
    if (customer.status === 'MERGED') {
      throw new ConflictException({
        code: 'CUSTOMER_MERGED',
        message: 'Pelanggan sudah digabung ke pelanggan lain.',
      });
    }
    return customer;
  }

  private normalizePhoneOrThrow(raw?: string | null): string | null {
    if (!raw) return null;
    const normalized = normalizePhoneId(raw);
    if (!normalized) {
      throw new BadRequestException({
        code: 'INVALID_PHONE',
        message: `Nomor telepon "${raw}" tidak valid untuk format Indonesia.`,
      });
    }
    return normalized;
  }

  private normalizeEmailOrThrow(raw?: string | null): string | null {
    if (!raw) return null;
    const normalized = normalizeEmail(raw);
    if (!normalized) {
      throw new BadRequestException({
        code: 'INVALID_EMAIL',
        message: `Email "${raw}" tidak valid.`,
      });
    }
    return normalized;
  }

  private normalizeIdentityValue(type: string, value: string, externalId?: string): string {
    switch (type) {
      case 'PHONE':
      case 'WHATSAPP': {
        const phone = normalizePhoneId(value);
        if (!phone) {
          throw new BadRequestException({
            code: 'INVALID_PHONE',
            message: 'Nomor telepon tidak valid.',
          });
        }
        return phone;
      }
      case 'EMAIL': {
        const email = normalizeEmail(value);
        if (!email) {
          throw new BadRequestException({ code: 'INVALID_EMAIL', message: 'Email tidak valid.' });
        }
        return email;
      }
      case 'MARKETPLACE_ACCOUNT':
        return (externalId ?? value).trim().toLowerCase();
      default:
        return value.trim().toLowerCase();
    }
  }
}
