# Roadmap Pengembangan

| Fase | Nama                      | Cakupan inti                                                                                    | Status     |
| ---- | ------------------------- | ----------------------------------------------------------------------------------------------- | ---------- |
| 0    | Product & Architecture    | Audit repo, asumsi, arsitektur, ERD, domain boundaries, security model, ADR, backlog            | ✅ Selesai |
| 1    | Foundation                | Monorepo, auth, tenant, branch, warehouse, RBAC, audit, outbox, CI, logging, dashboard shell    | ✅ Selesai |
| 2    | Catalog & Customer        | Product, variant, category, channel listing, CSV import, customer, identity, duplicate merge    | ✅ Selesai |
| 3    | Order & Inventory         | Manual order, mock channel, status, reservation, inventory ledger, fulfillment, adjustment      | ⬜         |
| 4    | Payment & Reconciliation  | Cash, transfer, mock payment, invoice, allocation, fee, mismatch queue                          | ⬜         |
| 5    | Integration Hub           | Connector contract, sync job, webhook, retry, dead-letter queue, connector health               | ⬜         |
| 6    | AI Assistant              | Tool-based read-only assistant, source citation, AI run log, prompt version, approval framework | ⬜         |
| 7    | Workflow & Recommendation | Automation rule, reorder recommendation, payment reminder, anomaly detection, draft action      | ⬜         |
| 8    | Industry Packs            | Distributor, retail, F&B, services                                                              | ⬜         |
| 9    | Enterprise                | Multi-legal entity, advanced approval, SSO, analytics warehouse, enterprise API, data retention | ⬜         |

Aturan: sebuah fase hanya dinyatakan selesai bila memenuhi Definition of Done (lihat `AGENTS.md` — build, lint, type-check, test, migration, seed, dokumentasi, tanpa secret, authorization + audit diterapkan).

## Backlog awal Fase 3 (Order & Inventory)

1. Model `Order`, `OrderLine`, `OrderStatusHistory`, `Fulfillment`, `InventoryLedgerEntry`, `InventoryBalance`, `InventoryReservation` + migration (sesuai ADR-003 ledger append-only).
2. Manual order dari UI (kasir) → cocokkan pelanggan (modul Customer) + variant (modul Catalog) → hitung total (integer rupiah) → reservasi stok.
3. Idempotency order: unique `(tenantId, channelId, externalOrderId)` + header `Idempotency-Key`.
4. MockMarketplaceAdapter: order masuk memakai `ChannelListing.externalSku` → resolve variant (endpoint `resolve` sudah tersedia).
5. Inventory: receipt, reservation/release, fulfillment issue, adjustment dengan alasan + `ApprovalRequest` untuk adjustment besar.
6. Status order + riwayat; pembatalan melepaskan reservation.
7. Dashboard: omzet hari ini, pesanan baru, stok kritis (mengisi placeholder Fase 1).
8. Test: idempotency order, reservation vs physical vs available, pembatalan, isolasi tenant; E2E kasir membuat order.

## Backlog lama Fase 2 (selesai)

1. ~~Model Catalog + Customer + migration~~ ✅
2. ~~CRUD produk/kategori/variant/listing + permission baru~~ ✅
3. ~~CSV import preview → confirm → worker idempotent + error per baris~~ ✅
4. ~~Customer + identity + duplicate detection + manual merge~~ ✅
5. ~~Halaman Produk & Pelanggan + import wizard + merge flow~~ ✅
6. ~~Session cookie httpOnly + CSRF (ADR-005)~~ ✅
7. Model `Customer`, `CustomerIdentity`, `CustomerAddress` + deteksi kandidat duplikat (nomor telepon/email) + manual merge dengan `merge history`.
8. Halaman web: Produk & Pelanggan (list, form, import wizard).
9. Test: import idempotent, error per baris, isolasi tenant untuk catalog/customer.
