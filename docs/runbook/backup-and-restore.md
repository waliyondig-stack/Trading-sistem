# Runbook — Backup & Restore

## Kebijakan

- **PostgreSQL adalah satu-satunya sumber kebenaran** (Fase 1). Redis hanya berisi queue yang boleh hilang (outbox akan dipublikasi ulang; konsumen idempotent).
- Target: backup harian penuh + WAL/PITR pada layanan terkelola; retensi ≥ 30 hari.
- Soft delete (`deletedAt`) melindungi dari penghapusan tidak sengaja di level aplikasi; backup melindungi dari kegagalan besar.

## Backup manual (dev/self-hosted)

```bash
pg_dump "$DATABASE_URL" --format=custom --file=flowniaga-$(date +%Y%m%d%H%M).dump
```

## Restore

```bash
createdb flowniaga_restore
pg_restore --dbname=postgresql://.../flowniaga_restore --clean --if-exists flowniaga-<stamp>.dump
# verifikasi: jumlah tenant, user, audit log terakhir
psql .../flowniaga_restore -c 'SELECT count(*) FROM "Tenant";'
```

Setelah verifikasi, arahkan `DATABASE_URL` ke database hasil restore (atau rename), jalankan `pnpm db:migrate` untuk memastikan schema sinkron, lalu restart api & worker.

## Uji pemulihan

Lakukan latihan restore minimal tiap kuartal di environment staging; catat durasi (RTO) dan titik pulih (RPO) aktual.
