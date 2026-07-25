# ADR-003: Inventory Ledger Append-Only

- Status: Diterima (2026-07-25) — implementasi Fase 3
- Konteks fase: 0 (desain), 3 (implementasi)

## Konteks

Stok adalah data paling rawan sengketa. Menyimpan hanya angka saldo membuat kesalahan tidak dapat diaudit dan sinkronisasi omnichannel rapuh.

## Keputusan

Seluruh pergerakan stok dicatat sebagai **ledger entry append-only** (`InventoryLedgerEntry`): `RECEIPT`, `RESERVATION`, `RESERVATION_RELEASE`, `SALE`, `FULFILLMENT_ISSUE`, `RETURN`, `TRANSFER_OUT/IN` (dengan status in-transit), `ADJUSTMENT` (wajib alasan; besar → approval), `DAMAGE`, `EXPIRY`.

`InventoryBalance` (physical, reserved, available, incoming, in-transit, damaged, returned, safety) adalah **proyeksi** yang diperbarui dalam transaksi yang sama dengan penulisan ledger — dapat direkonsiliasi ulang dari ledger kapan pun.

Aturan kunci:

- Reservation mengurangi **available**, bukan physical.
- Pembatalan menulis `RESERVATION_RELEASE`; fulfillment menulis `FULFILLMENT_ISSUE` yang baru mengurangi physical.
- Dilarang meng-update angka saldo langsung tanpa entry ledger.

## Konsekuensi

- (+) Audit penuh, rekonsiliasi deterministik, dukungan multi-gudang/transfer, dasar akurat untuk sinkronisasi kanal.
- (−) Volume tulis lebih besar dan perlu kehati-hatian konkurensi (row lock per balance) — diterima demi kebenaran data.
