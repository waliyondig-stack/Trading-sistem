# AGENTS.md — Panduan Coding Agent FlowNiaga

Dokumen ini mengikat untuk semua coding agent (dan kontributor manusia) yang bekerja di repository ini.

## Konteks proyek

FlowNiaga adalah AI Business Operating System omnichannel, dibangun sebagai **modular monolith** TypeScript (NestJS + Next.js + Prisma + PostgreSQL + Redis) dalam monorepo pnpm. Spesifikasi produk lengkap ada di `docs/product/` dan arsitektur di `docs/architecture/`.

Status fase pengembangan ada di `docs/product/roadmap.md`. **Kerjakan fase secara berurutan; jangan lompat fase.**

## Aturan wajib

1. Periksa repository dan dokumentasi (`README.md`, `docs/`, ADR) sebelum mengubah file.
2. Kerjakan secara bertahap dengan vertical slice; jangan membangun semuanya sekaligus.
3. Dokumentasikan asumsi baru di `docs/assumptions.md`; keputusan arsitektur penting sebagai ADR baru di `docs/decisions/`.
4. Tidak ada pseudocode untuk fitur yang dinyatakan selesai.
5. **Jangan pernah** menyimpan secret (API key, password, token) di source code — gunakan env var; perbarui `.env.example` bila menambah variabel.
6. Jangan scraping marketplace. Hanya API resmi, webhook resmi, file import, atau mock adapter.
7. Semua endpoint: validation (class-validator, whitelist) + authorization (`@RequirePermissions`, atau `@Public`/`@AuthOnly` dengan alasan kuat). Prinsip **default deny** — endpoint tanpa deklarasi permission ditolak `AccessGuard`.
8. Semua critical action dicatat via `AuditService` (dalam transaksi yang sama dengan mutasinya bila memungkinkan).
9. Modul tidak boleh menulis tabel modul lain secara langsung; komunikasi lewat application service atau domain event (transactional outbox — `OutboxService`).
10. Setiap perubahan disertai test yang sesuai (unit dan/atau integration di `apps/api/test`).
11. Jangan menyatakan fase selesai bila build, lint, type-check, test, atau migration gagal.
12. Uang: integer rupiah / `Decimal` — **jangan floating point**. Timestamp disimpan UTC; tampilan default Asia/Jakarta, format id-ID.
13. Bahasa Indonesia untuk UI dan pesan error yang dilihat pengguna.
14. Nama merek harus tetap dapat dikonfigurasi (`packages/config`); jangan hardcode "FlowNiaga" pada logika.

## Perintah verifikasi (jalankan sebelum menyatakan selesai)

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration   # butuh PostgreSQL test (DATABASE_URL_TEST)
pnpm build
pnpm db:migrate         # harus jalan dari database kosong
pnpm db:seed
```

## Konvensi kode

- TypeScript strict mode; hindari `any`.
- Error API: `{ error: { code, message, details?, correlationId } }` — kode error UPPER_SNAKE_CASE.
- Permission baru didaftarkan di `packages/domain/src/permissions.ts` (satu sumber untuk guard + seed).
- Model Prisma baru wajib punya `tenantId` + index tenant (kecuali entitas global seperti `User`, `Permission`).
- Soft delete (`deletedAt`) untuk data bisnis; jangan hard delete.
- Setiap laporan akhir fase mencakup: file yang diubah, fitur selesai, keputusan arsitektur, test yang dijalankan, cara menjalankan, keterbatasan, rekomendasi fase berikutnya.

## Struktur test

- Unit: `apps/api/src/**/*.spec.ts` (tanpa DB).
- Integration: `apps/api/test/**/*.e2e-spec.ts` (DB test terpisah via `DATABASE_URL_TEST`, migrasi otomatis oleh global setup, fixture memakai identitas unik-acak sehingga idempotent).

## Folder `legacy/`

Berisi aplikasi trading lama yang tidak terkait FlowNiaga. Jangan disentuh dan jangan dihapus tanpa instruksi eksplisit pemilik repo.
