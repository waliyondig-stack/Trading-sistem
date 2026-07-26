# Runbook — Deployment

FlowNiaga terdiri dari 3 proses (api, web, worker) + PostgreSQL + Redis. Web **memproksikan** `/api/backend/*` ke API sehingga browser berbicara same-origin — cookie session httpOnly (ADR-005) berfungsi tanpa konfigurasi cross-site.

> **Tanpa kartu kredit / gratis penuh?** Lihat [deployment-free.md](deployment-free.md) — Neon (PostgreSQL) + Render (API) + Netlify/Vercel (web), tanpa Redis.

## Opsi A — Render (paling mudah, sekali klik)

1. Buka [dashboard.render.com](https://dashboard.render.com) → **New → Blueprint** → hubungkan repo GitHub `flowniaga`.
2. Render membaca `render.yaml` di root repo dan otomatis membuat: PostgreSQL, Redis (Key Value), service **flowniaga-api**, dan **flowniaga-web**. JWT secret di-generate otomatis.
3. Bila nama `flowniaga-api`/`flowniaga-web` sudah dipakai pengguna Render lain, ganti namanya di `render.yaml` **dan** sesuaikan `API_PROXY_TARGET` + `API_CORS_ORIGIN`.
4. Tunggu build hijau (±10–15 menit pertama kali), lalu buka `https://flowniaga-web.onrender.com` → **Daftar usaha baru** → pakai aplikasinya.

Catatan plan free: database kedaluwarsa setelah 30 hari dan service tidur saat idle (request pertama lambat). Untuk pemakaian serius, upgrade plan. Worker (outbox) opsional untuk Fase 2 — blok komentarnya ada di `render.yaml`.

## Opsi B — VPS satu host (Docker Compose)

Prasyarat: VPS dengan Docker + Docker Compose.

```bash
git clone https://github.com/waliyondig-stack/flowniaga && cd flowniaga
cp .env.example .env
# WAJIB: isi JWT_ACCESS_SECRET & JWT_REFRESH_SECRET (openssl rand -base64 32)
# dan POSTGRES_PASSWORD yang kuat.
docker compose -f docker-compose.prod.yml up -d --build
```

Buka `http://<ip-vps>:3000`. Untuk domain + HTTPS, pasang Caddy/nginx di depan port 3000 (cookie `Secure` menuntut HTTPS di production).

## Opsi C — Manual/platform lain

Build gambar dari root repo:

```bash
docker build -f apps/api/Dockerfile -t flowniaga-api .
docker build -f apps/web/Dockerfile --build-arg API_PROXY_TARGET=https://api.domainanda.com -t flowniaga-web .
docker build -f apps/worker/Dockerfile -t flowniaga-worker .
```

Env wajib API: `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `NODE_ENV=production`, `API_CORS_ORIGIN`, dan `REFRESH_COOKIE_PATH=/api/backend/auth` bila memakai proxy web. API menghormati `PORT` dari platform. Migration berjalan otomatis saat container API start (`prisma migrate deploy`).

## Checklist wajib production

1. `JWT_ACCESS_SECRET` & `JWT_REFRESH_SECRET` acak ≥ 32 karakter (secret manager — API menolak start tanpa ini di production).
2. `NODE_ENV=production`, `SEED_DEMO_DATA` **tidak diset** (seed demo otomatis menolak; akun dibuat lewat halaman **/daftar**).
3. `API_CORS_ORIGIN` = origin web produksi saja.
4. HTTPS aktif (cookie `Secure`); API di balik proxy sudah `trust proxy`.
5. Health check: liveness `GET /health`, readiness `GET /health/ready`.
6. Log JSON (pino) ke agregator; `LOG_LEVEL=info`.
7. Backup database aktif (lihat `backup-and-restore.md`).

## Urutan rilis & rollback

build → rollout api (migrate otomatis, backward-compatible satu versi / expand-contract) → rollout worker → rollout web → smoke test (`/health/ready`, login). Rollback aplikasi: kembalikan image sebelumnya; rollback data: restore backup.
