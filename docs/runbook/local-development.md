# Runbook — Local Development

## Prasyarat

- Node.js ≥ 20, pnpm ≥ 9 (`corepack enable` disarankan).
- Docker + Docker Compose (untuk PostgreSQL, Redis, MinIO) — atau PostgreSQL 16 & Redis lokal.

## Langkah awal

```bash
cp .env.example .env               # sesuaikan bila perlu
docker compose up -d               # postgres (5432), postgres-test (5433), redis, minio
pnpm install
pnpm --filter @flowniaga/domain --filter @flowniaga/config build
pnpm db:migrate                    # prisma migrate deploy
pnpm db:seed                       # tenant demo (perlu SEED_DEMO_DATA=true)
```

> Catatan: bila memakai `postgres-test` dari Docker (port 5433), set `DATABASE_URL_TEST=postgresql://flowniaga:flowniaga@localhost:5433/flowniaga_test?schema=public` di `.env`.

## Menjalankan

```bash
pnpm dev:api      # http://localhost:3001 — Swagger di /docs, health di /health
pnpm dev:web      # http://localhost:3000 — login dengan akun demo
pnpm dev:worker   # outbox dispatcher (opsional)
```

## Verifikasi

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration && pnpm build
```

Integration test memakai `DATABASE_URL_TEST` (database terpisah, dimigrasi otomatis oleh global setup Jest; fixture memakai identitas acak sehingga aman dijalankan berulang).

## Masalah umum

| Gejala                                          | Solusi                                                                            |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| `Cannot find module '@flowniaga/domain'`        | Jalankan `pnpm --filter @flowniaga/domain --filter @flowniaga/config build`       |
| Prisma `P1001` (DB tidak terjangkau)            | Pastikan `docker compose up -d` dan `DATABASE_URL` benar                          |
| Error scrypt `memory limit exceeded`            | Sudah ditangani (`maxmem` diset); pastikan kode terbaru                           |
| Seed menolak berjalan                           | Set `SEED_DEMO_DATA=true` dan pastikan bukan `NODE_ENV=production`                |
| 403 `TENANT_HEADER_REQUIRED` saat memanggil API | Sertakan header `x-tenant-id` (ambil dari respons login `memberships[].tenantId`) |
