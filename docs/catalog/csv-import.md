# CSV Import Produk

Alur import produk massal dengan tahap preview, error per baris, dan worker idempotent.

## Template

`docs/examples/product-import-template.csv` — kolom:

| Kolom           | Wajib | Keterangan                                            |
| --------------- | ----- | ----------------------------------------------------- |
| `product_name`  | ✅    | Nama produk (produk dikelompokkan per nama/slug)      |
| `category`      |       | Nama kategori; dibuat otomatis bila belum ada         |
| `variant_name`  |       | Nama variasi (default: nama produk)                   |
| `internal_sku`  | ✅    | SKU internal — unik per tenant, kunci idempotency     |
| `barcode`       |       | Barcode (unik per tenant)                             |
| `cost_amount`   |       | Harga pokok, bilangan bulat rupiah (`45000`/`45.000`) |
| `selling_price` |       | Harga jual, bilangan bulat rupiah                     |
| `unit`          |       | Satuan (default `pcs`)                                |
| `status`        |       | `ACTIVE`/`INACTIVE` (atau `aktif`/`nonaktif`)         |

Batas: **2 MB / 5.000 baris** per file.

## Alur

1. `POST /catalog-imports` (multipart `file`, opsional `columnMapping` JSON header→field) — permission `catalog.import.preview`. Menghasilkan job berstatus `PREVIEWED` + preview 50 baris pertama dengan validasi per baris. **Belum ada data yang disimpan.**
2. Pengguna memeriksa preview di UI (`/produk/import`), memperbaiki file/mapping bila perlu.
3. `POST /catalog-imports/:id/confirm` (permission `catalog.import.execute`, header `Idempotency-Key` opsional) — job masuk queue BullMQ `catalog-import` dan diproses worker (inline di lingkungan test).
4. `GET /catalog-imports/:id` — progress & hasil: `totalRows`, `createdRows`, `updatedRows`, `failedRows`, `skippedRows`.
5. `GET /catalog-imports/:id/errors.csv` — unduh error per baris (kolom `row, field, value, code, message`).

## Semantik & jaminan

- **Idempotent per baris**: baris di-upsert berdasarkan `internal_sku` per tenant — SKU sudah ada → variasinya diperbarui (`updatedRows`), belum ada → produk/variasi dibuat (`createdRows`). Retry worker atau confirm ganda **tidak membuat duplikat**.
- **Idempotent per job**: job berstatus selain `PREVIEWED` tidak diproses ulang; `Idempotency-Key` yang sama mengembalikan hasil job sebelumnya.
- **Baris invalid tidak menggagalkan file** — dicatat sebagai `failedRows` dengan error per baris; baris duplikat dalam file di-skip (`skippedRows`).
- **Formula injection**: seluruh sel pada file CSV yang DIUNDUH (error report) dinetralisasi (`= + - @` diberi prefix kutip) — lihat `sanitizeCsvCell`.
- **Audit**: `catalog_import.previewed` dan `catalog_import.executed` tercatat di audit log.
- **Tenant-scoped**: job, preview, dan hasil hanya terlihat oleh tenant pemiliknya; import tenant A tidak pernah menyentuh data tenant B (diverifikasi test).
