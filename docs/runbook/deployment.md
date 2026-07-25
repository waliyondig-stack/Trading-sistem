# Runbook — Deployment

> Fase 1 belum menyediakan pipeline deploy production; dokumen ini menetapkan baseline yang wajib dipenuhi saat deploy pertama (direncanakan setelah Fase 4).

## Topologi minimum

- 1× container `apps/api` (NestJS, port 3001) di belakang reverse proxy TLS.
- 1× container `apps/web` (Next.js, port 3000).
- 1× container `apps/worker`.
- PostgreSQL terkelola (backup otomatis) + Redis terkelola.
- Object storage S3-compatible (mulai Fase 2).

## Checklist wajib sebelum production

1. `JWT_ACCESS_SECRET` & `JWT_REFRESH_SECRET` acak ≥ 32 karakter (secret manager, bukan file).
2. `NODE_ENV=production`, `SEED_DEMO_DATA` **tidak diset** (seed demo otomatis menolak).
3. `API_CORS_ORIGIN` diisi domain web produksi saja.
4. Migrasi dijalankan sebagai langkah rilis: `pnpm db:migrate` (prisma migrate deploy) — bukan `migrate dev`.
5. Health check: liveness `GET /health`, readiness `GET /health/ready` (dipakai orchestrator).
6. Log JSON (pino) dikirim ke agregator; `LOG_LEVEL=info`.
7. Error tracking adapter + metrics diaktifkan (hook disiapkan bertahap).
8. Reevaluasi penyimpanan token web (httpOnly cookie + CSRF) — lihat threat model.

## Urutan rilis

build → migrate (sekali, sebelum rollout) → rollout api → rollout worker → rollout web → smoke test (`/health/ready`, login akun uji non-demo).

## Rollback

- Aplikasi: kembalikan image sebelumnya (stateless).
- Database: migration wajib backward-compatible satu versi (expand-contract); bila tidak memungkinkan, restore dari backup (lihat `backup-and-restore.md`).
