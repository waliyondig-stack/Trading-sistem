# ADR-001: Modular Monolith untuk MVP

- Status: Diterima (2026-07-25)
- Konteks fase: 0–1

## Konteks

FlowNiaga mencakup ≥ 20 bounded context. Tim/agen perlu mengirim MVP cepat dengan biaya infrastruktur terkendali, sementara transaksi lintas modul (order ↔ stok ↔ pembayaran) harus konsisten.

## Keputusan

Membangun **modular monolith** (satu deployable NestJS `apps/api` + proses `apps/worker`), bukan microservices.

Penegakan modularitas:

1. Satu module NestJS per bounded context; kepemilikan tabel eksklusif per modul.
2. Komunikasi antar modul via application service atau **domain event** melalui **transactional outbox** (`OutboxEvent` + worker dispatcher BullMQ).
3. Kontrak bersama (permission, tipe domain) di `packages/domain`.

## Konsekuensi

- (+) MVP lebih cepat, deployment sederhana, transaksi ACID lintas modul mudah, biaya rendah.
- (+) Jalur evolusi jelas: modul dengan beban tinggi dapat diekstrak menjadi service; konsumen event tinggal berpindah transport (outbox → broker) tanpa ubah semantik.
- (−) Disiplin batas modul bergantung review/lint, bukan batas jaringan.
- (−) Scaling per-modul belum bisa independen (diterima untuk MVP).
