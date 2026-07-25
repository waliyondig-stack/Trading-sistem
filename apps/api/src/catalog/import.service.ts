import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { TenantContext } from '../common/request-types';
import { slugify } from './slug';
import type { Actor } from './category.service';

export const IMPORT_QUEUE = 'catalog-import';
export const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_ROWS = 5000;
const PREVIEW_ROWS = 50;

/** Kolom kanonik template import produk. */
export const IMPORT_FIELDS = [
  'product_name',
  'category',
  'variant_name',
  'internal_sku',
  'barcode',
  'cost_amount',
  'selling_price',
  'unit',
  'status',
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

export interface RowError {
  row: number; // nomor baris data (1-based, tanpa header)
  field?: string;
  code: string;
  message: string;
  /** Nilai mentah yang bermasalah (untuk error report). */
  value?: string;
}

interface ParsedRow {
  row: number;
  values: Partial<Record<ImportField, string>>;
  errors: RowError[];
  /** true bila baris duplikat SKU dalam file (dilewati saat eksekusi). */
  duplicateInFile: boolean;
}

const SKU_RE = /^[A-Za-z0-9._/-]{2,64}$/;
const BARCODE_RE = /^[A-Za-z0-9-]{4,64}$/;

/**
 * Netralisasi formula injection untuk file CSV yang DIUNDUH pengguna
 * (error report): sel yang diawali = + - @ atau tab diberi prefix kutip.
 */
export function sanitizeCsvCell(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) return `'${value}`;
  return value;
}

export function toCsvLine(cells: string[]): string {
  return cells
    .map((c) => {
      const sanitized = sanitizeCsvCell(c);
      return /[",\n;]/.test(sanitized) ? `"${sanitized.replace(/"/g, '""')}"` : sanitized;
    })
    .join(',');
}

function parseAmount(raw: string): number | null {
  // Terima "12000", "12.000", "12,000" (pemisah ribuan) — bukan desimal.
  const cleaned = raw.replace(/[.,\s]/g, '');
  if (!/^\d{1,15}$/.test(cleaned)) return null;
  return Number(cleaned);
}

function parseStatus(raw: string): 'ACTIVE' | 'INACTIVE' | null {
  const v = raw.trim().toUpperCase();
  if (['ACTIVE', 'AKTIF', ''].includes(v)) return 'ACTIVE';
  if (['INACTIVE', 'NONAKTIF', 'TIDAK AKTIF'].includes(v)) return 'INACTIVE';
  return null;
}

@Injectable()
export class ImportService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImportService.name);
  private queue: Queue | null = null;
  private worker: Worker | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    // Worker BullMQ berjalan di dalam proses API (bounded context yang sama).
    // Di lingkungan test, job diproses inline agar deterministik.
    if (process.env.NODE_ENV === 'test' || !process.env.REDIS_URL) return;
    try {
      const connection = () => new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
      this.queue = new Queue(IMPORT_QUEUE, { connection: connection() });
      this.worker = new Worker(
        IMPORT_QUEUE,
        async (job) => {
          await this.processImportJob(job.data.jobId as string);
        },
        { connection: connection() },
      );
      this.worker.on('failed', (job, err) => {
        this.logger.error(`Import job ${job?.data?.jobId} gagal: ${err.message}`);
      });
    } catch (err) {
      this.logger.error('Gagal inisialisasi queue import — fallback inline.', err as Error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  // ------------------------- Upload + Preview -------------------------

  async createPreview(
    ctx: TenantContext,
    actor: Actor,
    file: { originalname: string; size: number; buffer: Buffer },
    columnMappingRaw?: string,
  ) {
    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: `Ukuran file maksimal ${MAX_FILE_BYTES / 1024 / 1024} MB.`,
      });
    }
    if (!file.originalname.toLowerCase().endsWith('.csv')) {
      throw new BadRequestException({ code: 'INVALID_FILE_TYPE', message: 'File harus .csv.' });
    }
    const content = file.buffer.toString('utf8');
    let columnMapping: Record<string, ImportField> | undefined;
    if (columnMappingRaw) {
      try {
        columnMapping = JSON.parse(columnMappingRaw) as Record<string, ImportField>;
      } catch {
        throw new BadRequestException({
          code: 'INVALID_COLUMN_MAPPING',
          message: 'columnMapping harus JSON valid.',
        });
      }
    }

    const { rows, headers, globalErrors } = this.parseAndValidate(content, columnMapping);

    const summary = this.summarize(rows);
    const job = await this.prisma.catalogImportJob.create({
      data: {
        tenantId: ctx.tenantId,
        fileName: file.originalname,
        rawContent: content,
        columnMapping: (columnMapping ?? undefined) as Prisma.InputJsonValue | undefined,
        status: 'PREVIEWED',
        totalRows: rows.length,
        previewResult: {
          headers,
          globalErrors,
          summary,
        } as unknown as Prisma.InputJsonValue,
        rowErrors: rows.flatMap((r) => r.errors) as unknown as Prisma.InputJsonValue,
        createdBy: actor.userId,
      },
    });

    this.audit.logSafe({
      tenantId: ctx.tenantId,
      userId: actor.userId,
      action: 'catalog_import.previewed',
      entityType: 'CatalogImportJob',
      entityId: job.id,
      after: { fileName: file.originalname, ...summary },
      correlationId: actor.correlationId,
      ip: actor.ip,
    });

    return {
      jobId: job.id,
      fileName: job.fileName,
      status: job.status,
      totalRows: rows.length,
      headers,
      globalErrors,
      summary,
      preview: rows.slice(0, PREVIEW_ROWS).map((r) => ({
        row: r.row,
        values: r.values,
        errors: r.errors,
        duplicateInFile: r.duplicateInFile,
      })),
      note: 'Preview belum menyimpan data produk apa pun. Konfirmasi diperlukan untuk menjalankan import.',
    };
  }

  // ------------------------- Confirm -------------------------

  async confirm(ctx: TenantContext, actor: Actor, jobId: string, idempotencyKey?: string) {
    const job = await this.getJob(ctx, jobId);

    // Idempotent: job yang sudah berjalan/selesai tidak dijalankan ulang.
    if (job.status !== 'PREVIEWED') {
      return this.statusPayload(job);
    }
    if (idempotencyKey) {
      const existing = await this.prisma.catalogImportJob.findFirst({
        where: { tenantId: ctx.tenantId, idempotencyKey, id: { not: job.id } },
      });
      if (existing) {
        return this.statusPayload(existing);
      }
    }

    await this.prisma.catalogImportJob.update({
      where: { id: job.id },
      data: { status: 'QUEUED', idempotencyKey: idempotencyKey ?? null },
    });

    this.audit.logSafe({
      tenantId: ctx.tenantId,
      userId: actor.userId,
      action: 'catalog_import.executed',
      entityType: 'CatalogImportJob',
      entityId: job.id,
      after: { fileName: job.fileName, totalRows: job.totalRows },
      correlationId: actor.correlationId,
      ip: actor.ip,
    });

    if (this.queue) {
      await this.queue.add(
        'import',
        { jobId: job.id },
        { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
      );
    } else {
      // Fallback inline (test / tanpa Redis) — tetap idempotent.
      await this.processImportJob(job.id);
    }

    const fresh = await this.getJob(ctx, jobId);
    return this.statusPayload(fresh);
  }

  // ------------------------- Status & error report -------------------------

  async listJobs(ctx: TenantContext) {
    const jobs = await this.prisma.catalogImportJob.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        fileName: true,
        status: true,
        totalRows: true,
        createdRows: true,
        updatedRows: true,
        failedRows: true,
        skippedRows: true,
        createdAt: true,
        finishedAt: true,
      },
    });
    return jobs;
  }

  async getStatus(ctx: TenantContext, jobId: string) {
    const job = await this.getJob(ctx, jobId);
    return this.statusPayload(job);
  }

  /** Error report CSV (dinetralisasi dari formula injection). */
  async errorReportCsv(ctx: TenantContext, jobId: string): Promise<string> {
    const job = await this.getJob(ctx, jobId);
    const errors = (job.rowErrors ?? []) as unknown as RowError[];
    const lines = [toCsvLine(['row', 'field', 'value', 'code', 'message'])];
    for (const e of errors) {
      lines.push(toCsvLine([String(e.row), e.field ?? '', e.value ?? '', e.code, e.message]));
    }
    return lines.join('\n') + '\n';
  }

  // ------------------------- Processor (idempotent) -------------------------

  /**
   * Proses import job. IDEMPOTENT: upsert per internal_sku sehingga retry
   * (BullMQ attempts / dipanggil ulang) tidak membuat duplikasi.
   */
  async processImportJob(jobId: string): Promise<void> {
    const job = await this.prisma.catalogImportJob.findUnique({ where: { id: jobId } });
    if (!job) return;
    if (job.status === 'COMPLETED') return; // sudah selesai — no-op

    await this.prisma.catalogImportJob.update({
      where: { id: job.id },
      data: { status: 'PROCESSING', startedAt: job.startedAt ?? new Date() },
    });

    const { rows } = this.parseAndValidate(
      job.rawContent,
      (job.columnMapping ?? undefined) as Record<string, ImportField> | undefined,
    );

    let created = 0;
    let updated = 0;
    let failed = 0;
    let skipped = 0;
    const errors: RowError[] = [];
    const categoryCache = new Map<string, string>(); // nama-lower → id

    for (const row of rows) {
      if (row.duplicateInFile) {
        skipped += 1;
        errors.push({
          row: row.row,
          field: 'internal_sku',
          code: 'DUPLICATE_IN_FILE',
          message: 'SKU duplikat dalam file — baris dilewati.',
        });
        continue;
      }
      if (row.errors.length > 0) {
        failed += 1;
        errors.push(...row.errors);
        continue;
      }
      try {
        const result = await this.applyRow(job.tenantId, job.createdBy, row, categoryCache);
        if (result === 'created') created += 1;
        else updated += 1;
      } catch (err) {
        failed += 1;
        errors.push({
          row: row.row,
          code: 'ROW_APPLY_FAILED',
          message: err instanceof Error ? err.message : 'Kesalahan tidak dikenal.',
        });
      }
      // Progress berkala agar dapat dipantau UI.
      if ((created + updated + failed + skipped) % 25 === 0) {
        await this.prisma.catalogImportJob.update({
          where: { id: job.id },
          data: {
            createdRows: created,
            updatedRows: updated,
            failedRows: failed,
            skippedRows: skipped,
          },
        });
      }
    }

    await this.prisma.catalogImportJob.update({
      where: { id: job.id },
      data: {
        status: 'COMPLETED',
        createdRows: created,
        updatedRows: updated,
        failedRows: failed,
        skippedRows: skipped,
        rowErrors: errors as unknown as Prisma.InputJsonValue,
        finishedAt: new Date(),
      },
    });
  }

  /** Terapkan satu baris (upsert kategori → produk → variant). */
  private async applyRow(
    tenantId: string,
    createdBy: string | null,
    row: ParsedRow,
    categoryCache: Map<string, string>,
  ): Promise<'created' | 'updated'> {
    const v = row.values;
    const sku = v.internal_sku!.trim();
    const productName = v.product_name!.trim();
    const variantName = (v.variant_name ?? '').trim() || productName;
    const status = parseStatus(v.status ?? '') ?? 'ACTIVE';
    const cost = v.cost_amount ? BigInt(parseAmount(v.cost_amount)!) : 0n;
    const price = v.selling_price ? BigInt(parseAmount(v.selling_price)!) : 0n;
    const unit = (v.unit ?? '').trim() || 'pcs';
    const barcode = (v.barcode ?? '').trim() || null;

    return this.prisma.$transaction(async (tx) => {
      // Kategori (opsional): cari case-insensitive di root, buat bila belum ada.
      let categoryId: string | null = null;
      const categoryName = (v.category ?? '').trim();
      if (categoryName) {
        const cacheKey = categoryName.toLowerCase();
        if (categoryCache.has(cacheKey)) {
          categoryId = categoryCache.get(cacheKey)!;
        } else {
          const existing = await tx.category.findFirst({
            where: {
              tenantId,
              deletedAt: null,
              name: { equals: categoryName, mode: 'insensitive' },
            },
          });
          const category =
            existing ??
            (await tx.category.create({
              data: {
                tenantId,
                name: categoryName,
                slug: slugify(categoryName) || `kategori-${Date.now()}`,
                createdBy,
                updatedBy: createdBy,
              },
            }));
          categoryId = category.id;
          categoryCache.set(cacheKey, category.id);
        }
      }

      // Variant sudah ada (tenant-scoped by unique) → update (idempotent retry).
      const existingVariant = await tx.productVariant.findFirst({
        where: { tenantId, internalSku: sku },
      });
      if (existingVariant) {
        await tx.productVariant.update({
          where: { id: existingVariant.id },
          data: {
            name: variantName,
            barcode,
            unit,
            costAmount: cost,
            sellingPrice: price,
            status,
            deletedAt: null,
            updatedBy: createdBy,
          },
        });
        return 'updated';
      }

      // Produk: cari berdasarkan slug nama; buat bila belum ada.
      const slug = slugify(productName) || `produk-${sku.toLowerCase()}`;
      let product = await tx.product.findFirst({ where: { tenantId, slug } });
      if (!product) {
        product = await tx.product.create({
          data: {
            tenantId,
            name: productName,
            slug,
            categoryId,
            defaultUnit: unit,
            status,
            createdBy,
            updatedBy: createdBy,
          },
        });
      } else if (product.deletedAt) {
        product = await tx.product.update({
          where: { id: product.id },
          data: { deletedAt: null, status, updatedBy: createdBy },
        });
      }

      await tx.productVariant.create({
        data: {
          tenantId,
          productId: product.id,
          name: variantName,
          internalSku: sku,
          barcode,
          unit,
          costAmount: cost,
          sellingPrice: price,
          status,
          createdBy,
          updatedBy: createdBy,
        },
      });
      return 'created';
    });
  }

  // ------------------------- Parsing & validation -------------------------

  private parseAndValidate(
    content: string,
    columnMapping?: Record<string, ImportField>,
  ): { rows: ParsedRow[]; headers: string[]; globalErrors: string[] } {
    const globalErrors: string[] = [];
    let records: Record<string, string>[];
    try {
      records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
        relax_column_count: true,
      }) as Record<string, string>[];
    } catch (err) {
      throw new BadRequestException({
        code: 'CSV_PARSE_FAILED',
        message: `CSV tidak dapat dibaca: ${err instanceof Error ? err.message : 'format tidak valid'}`,
      });
    }
    if (records.length === 0) {
      throw new BadRequestException({ code: 'CSV_EMPTY', message: 'File CSV tidak berisi data.' });
    }
    if (records.length > MAX_ROWS) {
      throw new BadRequestException({
        code: 'CSV_TOO_MANY_ROWS',
        message: `Maksimal ${MAX_ROWS} baris per import.`,
      });
    }

    const headers = Object.keys(records[0]);
    // Terjemahkan header → field kanonik (mapping eksplisit menang; default: nama sama).
    const headerToField = new Map<string, ImportField>();
    for (const h of headers) {
      const mapped = columnMapping?.[h] ?? (IMPORT_FIELDS.includes(h as ImportField) ? h : null);
      if (mapped) headerToField.set(h, mapped as ImportField);
    }
    const mappedFields = new Set(headerToField.values());
    for (const required of ['product_name', 'internal_sku'] as ImportField[]) {
      if (!mappedFields.has(required)) {
        globalErrors.push(
          `Kolom wajib "${required}" tidak ditemukan. Sesuaikan mapping kolom atau gunakan template.`,
        );
      }
    }

    const seenSkus = new Set<string>();
    const rows: ParsedRow[] = records.map((record, i) => {
      const rowNo = i + 1;
      const values: Partial<Record<ImportField, string>> = {};
      for (const [header, field] of headerToField.entries()) {
        const raw = record[header];
        if (raw !== undefined && raw !== '') values[field] = String(raw);
      }
      const errors: RowError[] = [];
      const err = (field: string, code: string, message: string, value?: string) =>
        errors.push({ row: rowNo, field, code, message, value });

      if (globalErrors.length === 0) {
        if (!values.product_name?.trim()) {
          err('product_name', 'REQUIRED', 'Nama produk wajib diisi.');
        }
        const sku = values.internal_sku?.trim();
        if (!sku) {
          err('internal_sku', 'REQUIRED', 'internal_sku wajib diisi.');
        } else if (!SKU_RE.test(sku)) {
          err('internal_sku', 'INVALID_FORMAT', 'internal_sku 2-64 karakter alfanumerik/._-/', sku);
        }
        if (values.barcode && !BARCODE_RE.test(values.barcode.trim())) {
          err(
            'barcode',
            'INVALID_FORMAT',
            'Barcode 4-64 karakter alfanumerik/tanda hubung.',
            values.barcode.trim(),
          );
        }
        if (values.cost_amount && parseAmount(values.cost_amount) === null) {
          err(
            'cost_amount',
            'INVALID_AMOUNT',
            'Harga pokok harus bilangan bulat rupiah.',
            values.cost_amount,
          );
        }
        if (values.selling_price && parseAmount(values.selling_price) === null) {
          err(
            'selling_price',
            'INVALID_AMOUNT',
            'Harga jual harus bilangan bulat rupiah.',
            values.selling_price,
          );
        }
        if (values.status && parseStatus(values.status) === null) {
          err(
            'status',
            'INVALID_STATUS',
            'Status harus ACTIVE/INACTIVE (atau aktif/nonaktif).',
            values.status,
          );
        }
      }

      const skuKey = values.internal_sku?.trim().toLowerCase();
      let duplicateInFile = false;
      if (skuKey) {
        if (seenSkus.has(skuKey)) duplicateInFile = true;
        else seenSkus.add(skuKey);
      }
      return { row: rowNo, values, errors, duplicateInFile };
    });

    return { rows, headers, globalErrors };
  }

  private summarize(rows: ParsedRow[]) {
    const invalid = rows.filter((r) => r.errors.length > 0).length;
    const duplicate = rows.filter((r) => r.duplicateInFile).length;
    return {
      totalRows: rows.length,
      validRows: rows.length - invalid - duplicate,
      invalidRows: invalid,
      duplicateInFileRows: duplicate,
    };
  }

  private async getJob(ctx: TenantContext, jobId: string) {
    const job = await this.prisma.catalogImportJob.findFirst({
      where: { id: jobId, tenantId: ctx.tenantId },
    });
    if (!job) {
      throw new NotFoundException({
        code: 'IMPORT_JOB_NOT_FOUND',
        message: 'Job import tidak ditemukan.',
      });
    }
    return job;
  }

  private statusPayload(job: {
    id: string;
    fileName: string;
    status: string;
    totalRows: number;
    createdRows: number;
    updatedRows: number;
    failedRows: number;
    skippedRows: number;
    rowErrors: unknown;
    createdAt: Date;
    startedAt: Date | null;
    finishedAt: Date | null;
  }) {
    const errors = (job.rowErrors ?? []) as RowError[];
    return {
      jobId: job.id,
      fileName: job.fileName,
      status: job.status,
      totalRows: job.totalRows,
      createdRows: job.createdRows,
      updatedRows: job.updatedRows,
      failedRows: job.failedRows,
      skippedRows: job.skippedRows,
      processedRows: job.createdRows + job.updatedRows + job.failedRows + job.skippedRows,
      errorCount: errors.length,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
    };
  }
}
