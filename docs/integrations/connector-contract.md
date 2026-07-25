# Connector Contract

Kontrak seragam untuk seluruh integrasi eksternal (marketplace, POS, messaging, payment, shipping, accounting, import/export). Implementasi penuh di Fase 5; kontrak didefinisikan sejak awal agar modul lain tidak bergantung pada detail penyedia.

## Prinsip

1. Hanya **API resmi, webhook resmi, file import, atau mock adapter** — dilarang scraping.
2. Kredensial disimpan terenkripsi per `ChannelAccount`; tidak pernah di source code.
3. Semua operasi idempotent (sync cursor + idempotency key + unique constraint di master data).
4. Kegagalan diklasifikasikan (auth, rate-limit, transient, permanent) → retry dengan exponential backoff → dead-letter queue → manual replay.
5. Setiap webhook diverifikasi signature-nya sebelum diproses.
6. Semua aktivitas connector membawa `correlationId` dan tercatat (`ConnectorSyncJob`, `ConnectorEvent`).

## Interface inti

```typescript
interface CommerceConnector {
  validateCredentials(): Promise<ConnectorHealth>;

  pullProducts(cursor?: string): Promise<ConnectorPage<ExternalProduct>>;
  pushProduct(input: ProductPublishRequest): Promise<ExternalReference>;

  pullOrders(cursor?: string): Promise<ConnectorPage<ExternalOrder>>;
  acknowledgeOrder(input: OrderAcknowledgement): Promise<void>;

  pushInventory(input: InventorySyncRequest): Promise<void>;
  pushFulfillment(input: FulfillmentUpdate): Promise<void>;

  handleWebhook(payload: unknown, headers: Record<string, string>): Promise<NormalizedEvent[]>;
}
```

Kemampuan wajib pendukung: health status, authentication status, sync cursor, retry + exponential backoff, rate limit, webhook log, idempotency, dead-letter queue, manual replay, manual resync, error classification, correlation ID.

## Adapter MVP

| Adapter                  | Fungsi                                                                                                          | Fase |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- | ---- |
| `ManualOrderAdapter`     | Pesanan dientri manual dari UI/POS                                                                              | 3    |
| `CsvImportAdapter`       | Import produk/pelanggan/pesanan dari CSV dengan preview                                                         | 2–3  |
| `MockMarketplaceAdapter` | Mensimulasikan marketplace (order masuk, ack, inventory push) untuk pengujian end-to-end tanpa kredensial nyata | 3–5  |

**Dilarang** memakai akun/kredensial marketplace nyata pada MVP.

## Alur pesanan omnichannel (target)

1. Pesanan masuk (UI/POS/CSV/API/connector) → 2. validasi sumber & signature → 3. cek idempotency → 4. normalisasi → 5. cocokkan listing ke master product → 6. cocokkan pelanggan → 7. hitung harga/diskon/fee/pajak → 8. cek stok → 9. reservasi stok → 10. buat master order → 11. fulfillment task → 12. catat pembayaran → 13. update status → 14. kurangi stok saat fulfillment → 15. kirim update ke kanal asal → 16. domain event → 17. audit log → 18. analytics.

Pesanan dengan `(channel, externalOrderId)` atau `idempotencyKey` sama tidak boleh dibuat dua kali (unique constraint + pemeriksaan aplikasi).
