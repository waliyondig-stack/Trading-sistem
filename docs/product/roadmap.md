# Roadmap Pengembangan

| Fase | Nama                      | Cakupan inti                                                                                    | Status        |
| ---- | ------------------------- | ----------------------------------------------------------------------------------------------- | ------------- |
| 0    | Product & Architecture    | Audit repo, asumsi, arsitektur, ERD, domain boundaries, security model, ADR, backlog            | ✅ Selesai    |
| 1    | Foundation                | Monorepo, auth, tenant, branch, warehouse, RBAC, audit, outbox, CI, logging, dashboard shell    | ✅ Selesai    |
| 2    | Catalog & Customer        | Product, variant, category, channel listing, CSV import, customer, identity, duplicate merge    | ⬜ Berikutnya |
| 3    | Order & Inventory         | Manual order, mock channel, status, reservation, inventory ledger, fulfillment, adjustment      | ⬜            |
| 4    | Payment & Reconciliation  | Cash, transfer, mock payment, invoice, allocation, fee, mismatch queue                          | ⬜            |
| 5    | Integration Hub           | Connector contract, sync job, webhook, retry, dead-letter queue, connector health               | ⬜            |
| 6    | AI Assistant              | Tool-based read-only assistant, source citation, AI run log, prompt version, approval framework | ⬜            |
| 7    | Workflow & Recommendation | Automation rule, reorder recommendation, payment reminder, anomaly detection, draft action      | ⬜            |
| 8    | Industry Packs            | Distributor, retail, F&B, services                                                              | ⬜            |
| 9    | Enterprise                | Multi-legal entity, advanced approval, SSO, analytics warehouse, enterprise API, data retention | ⬜            |

Aturan: sebuah fase hanya dinyatakan selesai bila memenuhi Definition of Done (lihat `AGENTS.md` — build, lint, type-check, test, migration, seed, dokumentasi, tanpa secret, authorization + audit diterapkan).

## Backlog awal Fase 2

1. Model `Product`, `ProductVariant`, `Category`, `Channel`, `ChannelAccount`, `ChannelListing` + migration.
2. CRUD produk + kategori dengan permission baru (`product.*`, `category.*`).
3. CSV import: upload → parse → preview → validasi per baris → commit (job di worker).
4. Model `Customer`, `CustomerIdentity`, `CustomerAddress` + deteksi kandidat duplikat (nomor telepon/email) + manual merge dengan `merge history`.
5. Halaman web: Produk & Pelanggan (list, form, import wizard).
6. Test: import idempotent, error per baris, isolasi tenant untuk catalog/customer.
