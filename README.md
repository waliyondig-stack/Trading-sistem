# FlowNiaga

**AI Business Operating System omnichannel** — menyatukan penjualan, pelanggan, produk, stok, pembayaran, keuangan, marketplace, POS, WhatsApp, cabang, gudang, dan operasional bisnis dalam **satu sumber data**.

> "FlowNiaga" adalah nama kerja. Seluruh identitas merek diganti lewat environment variable (`APP_NAME`, `NEXT_PUBLIC_APP_NAME`) tanpa mengubah logika aplikasi — lihat `packages/config`.

## Status: Fase 1 — Foundation ✅

Yang sudah tersedia:

- Monorepo pnpm (apps: `api`, `web`, `worker`; packages: `config`, `domain`, `ui`).
- Autentikasi (register/login/refresh-rotation/logout, scrypt + JWT).
- Multi-tenancy: Tenant → Legal Entity → Branch → Warehouse.
- RBAC granular dengan **default deny** di backend + branch scope.
- Audit log untuk seluruh critical action (termasuk percobaan akses lintas tenant).
- Transactional outbox + worker dispatcher (BullMQ).
- Dashboard shell berbahasa Indonesia (PWA, mobile-first).
- OpenAPI/Swagger di `/docs`, health check, structured logging + correlation ID.
- Test: unit + integration (isolasi tenant, RBAC, auth) — semua hijau.

Roadmap lengkap: [docs/product/roadmap.md](docs/product/roadmap.md).

## Struktur repository

```
apps/
  api/      # NestJS modular monolith (REST + Prisma + Swagger)
  web/      # Next.js App Router dashboard (Tailwind, TanStack Query)
  worker/   # Outbox dispatcher + BullMQ consumer
packages/
  config/   # Konfigurasi brand (nama aplikasi via env)
  domain/   # Kontrak domain bersama (katalog permission, role sistem)
  ui/       # Komponen UI bersama
docs/       # Dokumentasi produk, arsitektur, keamanan, ADR, runbook
legacy/     # Aplikasi trading lama (tidak terkait FlowNiaga, diarsipkan)
```

## Menjalankan secara lokal

Prasyarat: Node.js ≥ 20, pnpm ≥ 9, Docker (untuk PostgreSQL + Redis).

```bash
# 1. Salin konfigurasi environment
cp .env.example .env

# 2. Jalankan infrastruktur
docker compose up -d

# 3. Install dependency & build shared packages
pnpm install
pnpm --filter @flowniaga/domain --filter @flowniaga/config build

# 4. Migrasi & seed database
pnpm db:migrate
pnpm db:seed          # hanya jalan bila SEED_DEMO_DATA=true & bukan production

# 5. Jalankan aplikasi (terminal terpisah)
pnpm dev:api          # API di http://localhost:3001 (Swagger: /docs)
pnpm dev:web          # Web di http://localhost:3000
pnpm dev:worker       # Worker outbox (opsional untuk dev)
```

Panduan lengkap: [docs/runbook/local-development.md](docs/runbook/local-development.md).

## Akun demo (khusus local development)

Seed membuat tenant **PT Demo Flow Niaga** (2 cabang, 2 gudang) dengan akun berikut, semua berkata sandi `Demo1234!`:

| Email                            | Role      |
| -------------------------------- | --------- |
| `owner@demo.flowniaga.local`     | Owner     |
| `manager@demo.flowniaga.local`   | Manager   |
| `cashier@demo.flowniaga.local`   | Cashier   |
| `warehouse@demo.flowniaga.local` | Warehouse |
| `finance@demo.flowniaga.local`   | Finance   |

⚠️ Akun demo **tidak boleh** dipakai di production. Seed menolak berjalan bila `NODE_ENV=production`, dan hanya aktif bila `SEED_DEMO_DATA=true`.

## Perintah penting

| Perintah                | Fungsi                               |
| ----------------------- | ------------------------------------ |
| `pnpm lint`             | ESLint seluruh repo                  |
| `pnpm typecheck`        | Type-check seluruh workspace         |
| `pnpm test`             | Unit test seluruh workspace          |
| `pnpm test:integration` | Integration test API (butuh DB test) |
| `pnpm build`            | Build seluruh workspace              |
| `pnpm db:migrate`       | Terapkan migration (deploy)          |
| `pnpm db:seed`          | Seed data demo                       |
| `pnpm format`           | Prettier                             |

## Dokumentasi

- Visi produk: [docs/product/vision.md](docs/product/vision.md)
- Arsitektur: [docs/architecture/system-context.md](docs/architecture/system-context.md)
- Data model + ERD: [docs/architecture/data-model.md](docs/architecture/data-model.md)
- Keamanan: [docs/security/threat-model.md](docs/security/threat-model.md), [docs/security/tenant-isolation.md](docs/security/tenant-isolation.md)
- Keputusan arsitektur (ADR): [docs/decisions/](docs/decisions/)
- Asumsi: [docs/assumptions.md](docs/assumptions.md)
- Panduan coding agent: [AGENTS.md](AGENTS.md)
