# ADR-004: Connector Framework dengan Kontrak Seragam

- Status: Diterima (2026-07-25) — implementasi penuh Fase 5
- Konteks fase: 0 (desain), 3 (mock adapter), 5 (hub penuh)

## Konteks

FlowNiaga harus terhubung ke banyak kanal (marketplace, POS, messaging, payment, shipping, accounting, import/export) tanpa membocorkan detail penyedia ke domain inti, dan tanpa scraping.

## Keputusan

1. Satu interface `CommerceConnector` (lihat `docs/integrations/connector-contract.md`) untuk seluruh penyedia; modul inti hanya mengenal data ternormalisasi (`ExternalOrder` → master `Order`, dst.).
2. Infrastruktur wajib per connector: health & auth status, sync cursor, retry + exponential backoff, rate limit, webhook signature verification, webhook log, idempotency, dead-letter queue, manual replay/resync, error classification, correlation ID.
3. MVP hanya `ManualOrderAdapter`, `CsvImportAdapter`, `MockMarketplaceAdapter` — tanpa kredensial marketplace nyata.
4. Sync job berjalan di `apps/worker` (BullMQ) memakai kerangka outbox/queue yang sudah ada sejak Fase 1.

## Konsekuensi

- (+) Menambah kanal = menambah adapter, bukan mengubah domain; pengujian end-to-end bisa berjalan penuh dengan mock.
- (+) Kegagalan integrasi terisolasi dan dapat di-replay.
- (−) Investasi awal pada kerangka (cursor, DLQ, replay) sebelum ada integrasi nyata — diterima karena ini kapabilitas inti produk.
