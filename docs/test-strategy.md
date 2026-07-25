# Test Strategy

## Piramida test

| Lapisan         | Alat                        | Lokasi                        | Cakupan                                                                                                   |
| --------------- | --------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| Unit            | Jest                        | `apps/api/src/**/*.spec.ts`   | Logika murni: password hashing, pagination, normalisasi, sanitasi CSV                                     |
| Integration/API | Jest + supertest + Postgres | `apps/api/test/*.e2e-spec.ts` | Perilaku endpoint nyata: auth, session+CSRF, RBAC, isolasi tenant, catalog, import, customer/merge        |
| E2E browser     | Playwright (Chromium)       | `apps/web/e2e/*.spec.ts`      | Alur kritis pengguna: login, buat produk, import preview, buat pelanggan, kandidat duplikat, manual merge |

## Prinsip

1. **Isolasi tenant adalah gerbang rilis** — setiap modul baru wajib menambah kasus lintas-tenant; CI gagal bila bocor.
2. **Fixture unik-acak** — integration test membuat tenant/identitas dengan sufiks acak sehingga aman diulang tanpa reset DB.
3. **Integration memakai database test terpisah** (`DATABASE_URL_TEST`), dimigrasi otomatis oleh Jest global setup.
4. **Import diproses inline di test** (NODE_ENV=test) agar deterministik; idempotency worker diuji dengan memanggil processor berulang.
5. **E2E memakai data demo** (`pnpm db:seed`) + data unik per run; dijalankan serial.
6. Dilarang menonaktifkan/menghapus test agar pipeline lolos.

## Menjalankan

```bash
pnpm test               # unit
pnpm test:integration   # butuh Postgres (DATABASE_URL_TEST)
pnpm test:e2e           # butuh Postgres+Redis, DB dev ter-migrate + ter-seed
```

## Cakupan test wajib Fase 1–2 (ringkas)

- Isolasi tenant: organisasi (Fase 1), katalog, SKU lookup, pelanggan, kandidat merge, eksekusi merge lintas tenant, job import.
- Auth/session: login/refresh-rotation/logout, cookie httpOnly, CSRF double-submit, Bearer tanpa CSRF, tenant context server-side.
- RBAC: default deny, Cashier dibatasi (role, import, merge), Sales tanpa merge execute, LAST_OWNER.
- Catalog: SKU/barcode unik per tenant (dan boleh sama lintas tenant), circular category, ambiguous mapping, soft delete.
- Import: preview tanpa simpan, error per baris, confirm idempotent, retry tanpa duplikasi, error report CSV, formula injection.
- Customer: normalisasi telepon/email, kandidat dari sinyal kuat, nama-mirip tidak cukup, merge atomic + history + source preserved, identity conflict.
