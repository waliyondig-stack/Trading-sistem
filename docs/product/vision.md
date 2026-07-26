# Visi Produk

FlowNiaga adalah **AI Business Operating System omnichannel**: satu aplikasi yang menyatukan penjualan, pelanggan, produk, stok, pembayaran, keuangan, marketplace, POS, WhatsApp, cabang, gudang, dan operasional bisnis dalam **satu sumber data**.

## Prinsip utama

### 1. Satu data

Satu usaha memiliki satu master data untuk produk, pelanggan, pesanan, stok, pembayaran, laporan, integrasi, approval, AI assistant, dan audit trail. Data dari semua kanal dipetakan ke master yang sama.

### 2. Banyak kanal

POS/toko fisik, WhatsApp, website toko, marketplace, sales lapangan, reseller, agen, pemesanan manual, file Excel/CSV, dan API pihak ketiga — didukung bertahap melalui **connector framework** dengan kontrak seragam.

### 3. Banyak jenis usaha, satu mesin

Satu core engine universal + **industry pack** (retail/online seller, distributor, F&B, laundry, bengkel, salon/booking, jasa lapangan, produksi ringan, professional service, project-based). Tidak ada aplikasi terpisah per industri.

### 4. AI sebagai sistem tindakan

AI berkembang melalui empat level: **Informasi → Rekomendasi → Draft → Execute** (dengan approval). AI tidak mengarang data, tidak menjalankan tindakan berisiko tanpa persetujuan, dan seluruh AI run tercatat di audit log. Detail: `docs/ai/ai-safety-and-approval.md`.

## Nilai yang dijanjikan

- Pemilik usaha melihat kondisi bisnis real-time dari satu dashboard.
- Data tidak tercecer antar aplikasi/kanal.
- Operasional (stok, pesanan, pembayaran) punya jejak audit lengkap.
- Otomasi bertahap yang aman: mesin menyarankan, manusia menyetujui.

## Identitas merek

"FlowNiaga" adalah nama kerja. Nama, tagline, locale, timezone, dan mata uang dikendalikan konfigurasi (`packages/config` + env), sehingga rebranding tidak menyentuh logika aplikasi.
