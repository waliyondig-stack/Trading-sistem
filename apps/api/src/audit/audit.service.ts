import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  tenantId?: string | null;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  correlationId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

/** Pencatatan audit trail. Critical action WAJIB memanggil service ini. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tulis audit log. Bila `tx` diberikan, penulisan ikut transaksi
   * mutasi utamanya (atomik).
   */
  async log(entry: AuditEntry, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.auditLog.create({
      data: {
        tenantId: entry.tenantId ?? null,
        userId: entry.userId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        before: (entry.before ?? undefined) as Prisma.InputJsonValue | undefined,
        after: (entry.after ?? undefined) as Prisma.InputJsonValue | undefined,
        correlationId: entry.correlationId ?? null,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  }

  /** Varian non-blocking untuk jalur yang tidak boleh gagal karena audit (mis. access denied). */
  logSafe(entry: AuditEntry): void {
    void this.log(entry).catch((err: unknown) => {
      this.logger.error(`Gagal menulis audit log untuk ${entry.action}`, err as Error);
    });
  }
}
