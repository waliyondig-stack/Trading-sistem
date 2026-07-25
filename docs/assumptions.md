# Asumsi

Dokumen ini mencatat asumsi yang diambil selama pengembangan. Setiap asumsi baru wajib ditambahkan di sini.

## Fase 0–1 (Foundation)

1. **Repository awal berisi aplikasi lain.** Repo `Trading-sistem` berisi PWA sinyal trading kripto (Vercel) yang tidak terkait FlowNiaga. Diasumsikan aplikasi tersebut ingin dipertahankan sebagai arsip → dipindahkan utuh ke `legacy/` tanpa perubahan, dan FlowNiaga dibangun di root repo. Bila pemilik ingin menghapusnya, lakukan di komit terpisah.
2. **Nama repo tidak diubah.** Repo tetap bernama `Trading-sistem`; nama produk dikendalikan `packages/config` + env var.
3. **Registrasi = pembuatan tenant.** `POST /auth/register` membuat user + tenant baru dengan role Owner (model self-service SaaS). Undangan anggota dilakukan Owner/Admin dari dalam aplikasi.
4. **Penambahan anggota tanpa email.** Fase 1 belum punya layanan email; `POST /members` menerima `initialPassword` untuk user baru (diberikan offline oleh pemilik). Undangan via email menyusul saat modul Notification dibangun.
5. **Token di localStorage (web).** Untuk MVP, access/refresh token disimpan di localStorage dan tenant aktif di header `x-tenant-id`. Akan dievaluasi ulang (httpOnly cookie + CSRF) pada fase hardening sebelum production.
6. **Legal entity tunggal default.** Setiap tenant otomatis mendapat satu legal entity default; UI pengelolaannya menyusul di fase Enterprise (Fase 9), namun struktur datanya sudah dipakai (branch → legalEntityId).
7. **Worker memakai SQL langsung (pg).** Worker membaca tabel outbox via `pg` dengan parameterized query, bukan Prisma Client, untuk menghindari kopling build antar-app. Akan dipertimbangkan paket `packages/db` bersama bila kebutuhan bertambah.
8. **Scrypt untuk password.** Dipilih `crypto.scrypt` bawaan Node (parameter OWASP: N=2^15, r=8, p=1) alih-alih bcrypt/argon2 untuk menghindari dependency native. Format hash menyimpan parameternya sehingga bisa dimigrasi bertahap.
9. **Rate limiting in-memory.** Throttler NestJS memakai storage in-memory (cukup untuk single instance MVP). Redis storage dipakai saat horizontal scaling.
10. **Playwright E2E belum ada di Fase 1.** Critical flow tercakup integration test API (supertest). E2E browser ditambahkan mulai Fase 2 ketika ada alur UI bisnis nyata (lihat known limitations di laporan fase).
11. **Bahasa**: UI dan pesan error berbahasa Indonesia; struktur i18n formal (kamus terjemahan) ditambahkan saat ada kebutuhan bahasa kedua.
12. **Zona waktu**: penyimpanan UTC; tampilan default `Asia/Jakarta` dengan `Intl` id-ID.
