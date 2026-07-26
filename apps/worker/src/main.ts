/**
 * FlowNiaga Worker — Fase 1 (kerangka).
 *
 * Tanggung jawab saat ini:
 * 1. Outbox dispatcher: poll tabel OutboxEvent (status PENDING),
 *    publikasikan ke queue BullMQ `domain-events`, tandai PROCESSED.
 * 2. Consumer `domain-events`: saat ini hanya mencatat log terstruktur.
 *
 * Fase berikutnya: connector sync job, retry, dead-letter queue,
 * notifikasi, dan workflow automation memakai kerangka yang sama.
 */
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { Pool } from 'pg';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const DATABASE_URL = process.env.DATABASE_URL;
const POLL_INTERVAL_MS = Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 5000);
const QUEUE_NAME = 'domain-events';

function log(level: 'info' | 'error', message: string, extra: Record<string, unknown> = {}): void {
  console.log(
    JSON.stringify({ level, ts: new Date().toISOString(), service: 'worker', message, ...extra }),
  );
}

async function main(): Promise<void> {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL wajib diset untuk worker.');
  }
  const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
  const pool = new Pool({ connectionString: DATABASE_URL });
  const queue = new Queue(QUEUE_NAME, { connection });

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      log('info', 'domain event diterima', {
        eventType: job.name,
        outboxId: job.data.outboxId,
        tenantId: job.data.tenantId,
      });
    },
    { connection },
  );
  worker.on('failed', (job, err) => {
    log('error', 'job gagal', { jobId: job?.id, error: err.message });
  });

  log('info', 'worker aktif', { queue: QUEUE_NAME, pollIntervalMs: POLL_INTERVAL_MS });

  // Outbox dispatcher loop.
  let stopping = false;
  const stop = async () => {
    stopping = true;
    await worker.close();
    await queue.close();
    await pool.end();
    connection.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => void stop());
  process.on('SIGTERM', () => void stop());

  while (!stopping) {
    try {
      const { rows } = await pool.query<{
        id: string;
        eventType: string;
        payload: unknown;
        tenantId: string | null;
      }>(
        `SELECT id, "eventType", payload, "tenantId"
         FROM "OutboxEvent"
         WHERE status = 'PENDING'
         ORDER BY "createdAt" ASC
         LIMIT 50`,
      );
      for (const row of rows) {
        await queue.add(row.eventType, {
          outboxId: row.id,
          tenantId: row.tenantId,
          payload: row.payload,
        });
        await pool.query(
          `UPDATE "OutboxEvent"
           SET status = 'PROCESSED', "processedAt" = NOW(), attempts = attempts + 1
           WHERE id = $1`,
          [row.id],
        );
      }
      if (rows.length > 0) {
        log('info', 'outbox events dipublikasikan', { count: rows.length });
      }
    } catch (err) {
      log('error', 'outbox poll gagal', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

void main();
