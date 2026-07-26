# Scope MVP

MVP berfokus pada **retail, distributor, dan online seller**. Rincian per area (fase dalam kurung):

## Foundation (Fase 1 — ✅ selesai)

Monorepo, PostgreSQL + Redis + Docker Compose, auth (register/login/refresh/logout), tenant, legal entity dasar, branch, warehouse, RBAC + permission granular + branch scope, audit log, transactional outbox + worker, CI, structured logging + correlation ID, health check, dashboard shell, seed demo, test isolasi tenant.

## Catalog (Fase 2)

Produk, variasi, kategori, SKU, barcode, harga, channel listing mapping, CSV import dengan preview dan error per baris.

## Customer (Fase 2)

Pelanggan, kontak, alamat, channel identity, kandidat duplikat, manual merge + merge history.

## Order (Fase 3)

Manual order, mock marketplace order, order lines, status history, idempotency, invoice sederhana, fulfillment sederhana.

## Inventory (Fase 3)

Inventory ledger append-only, stock balance (physical/reserved/available/in-transit/damaged/returned/safety), reservation & release, fulfillment issue, adjustment dengan alasan + approval untuk adjustment besar.

## Payment (Fase 4)

Tunai, transfer manual, mock payment provider, payment allocation, reconciliation status, mismatch queue. Integrasi payment gateway nyata di luar MVP.

## Dashboard (bertahap 1→4)

Omzet, pesanan, stok kritis, pembayaran mismatch, connector health, aktivitas.

## Integrasi (Fase 5)

CSV import, MockMarketplaceAdapter, ManualOrderAdapter, sync log, retry, dead-letter display, manual replay. **Tanpa kredensial marketplace nyata.**

## AI read-only (Fase 6)

Menjawab omzet/pesanan/produk terlaris/stok kritis/pembayaran belum cocok — hanya lewat internal tool ber-otorisasi, selalu menyertakan rentang waktu, sumber data, waktu pembaruan, dan pesan "data tidak cukup" bila kosong.

## Di luar MVP

Payment gateway nyata, koneksi marketplace nyata, aplikasi mobile native, WhatsApp Business API, akuntansi penuh, HR, industry pack non-retail, SSO/enterprise.
