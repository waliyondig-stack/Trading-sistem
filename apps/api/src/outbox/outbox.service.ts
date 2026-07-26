import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Transactional outbox: domain event ditulis dalam transaksi yang sama
 * dengan mutasi datanya, lalu dipublikasikan asinkron oleh worker.
 * Pola ini memudahkan pemisahan modul menjadi service di masa depan.
 */
@Injectable()
export class OutboxService {
  constructor(private readonly prisma: PrismaService) {}

  async emit(
    eventType: string,
    payload: Record<string, unknown>,
    tenantId?: string | null,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.outboxEvent.create({
      data: {
        eventType,
        payload: payload as Prisma.InputJsonValue,
        tenantId: tenantId ?? null,
      },
    });
  }
}
