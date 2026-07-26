# Deployment Gratis (Tanpa Kartu Kredit)

Kombinasi free tier untuk menjalankan FlowNiaga online tanpa biaya:

| Komponen   | Layanan                                                                       | Biaya  | Kartu kredit |
| ---------- | ----------------------------------------------------------------------------- | ------ | ------------ |
| PostgreSQL | [Neon](https://neon.tech)                                                     | Gratis | Tidak perlu  |
| API        | [Koyeb](https://koyeb.com) (atau Render free)                                 | Gratis | Tidak perlu  |
| Web        | [Vercel](https://vercel.com) Hobby                                            | Gratis | Tidak perlu  |
| Redis      | **Tidak wajib** — import CSV otomatis diproses inline bila `REDIS_URL` kosong | —      | —            |
| Worker     | **Tidak wajib** untuk Fase 2                                                  | —      | —            |

> Semua akun bisa dibuat dengan login GitHub. Total waktu ±20 menit.

## Langkah 1 — Database di Neon

1. Daftar di **neon.tech** (login GitHub) → **Create project** → nama `flowniaga`, region Singapore.
2. Buka **Connection Details** → salin **connection string** (pilih yang _Direct connection_, bukan pooled), bentuknya:
   `postgresql://user:password@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`
3. Simpan — ini nilai `DATABASE_URL`.

## Langkah 2 — API di Koyeb

1. Daftar di **koyeb.com** (login GitHub) → **Create Web Service** → pilih repo **`flowniaga`**.
2. Builder: **Dockerfile** → path `apps/api/Dockerfile` (context: root repo).
3. Instance: **Free**. Port: biarkan (API membaca `PORT` otomatis).
4. Environment variables:
   - `NODE_ENV` = `production`
   - `DATABASE_URL` = (dari Langkah 1)
   - `JWT_ACCESS_SECRET` = nilai acak ≥32 karakter — buat di https://generate-secret.vercel.app/32
   - `JWT_REFRESH_SECRET` = nilai acak lain ≥32 karakter
   - `REFRESH_COOKIE_PATH` = `/api/backend/auth`
   - `API_CORS_ORIGIN` = `https://flowniaga.vercel.app` (sesuaikan dengan URL Vercel Anda nanti)
5. Deploy → tunggu hijau → catat URL API, mis. `https://flowniaga-xxx.koyeb.app`.
6. Uji: buka `https://<url-api>/health/ready` → harus `{"status":"ok","database":"up"}` (migration berjalan otomatis saat start).

> Alternatif: Render **manual** (New → Web Service satu per satu, bukan Blueprint) juga punya free tier; bila diminta kartu, pakai Koyeb.

## Langkah 3 — Web di Vercel

1. Daftar di **vercel.com** (login GitHub) → **Add New → Project** → import repo **`flowniaga`**.
2. **Root Directory**: `apps/web` (Vercel otomatis mengenali monorepo pnpm + Next.js).
3. Environment variables (untuk Production):
   - `NEXT_PUBLIC_API_URL` = `/api/backend`
   - `API_PROXY_TARGET` = URL API dari Langkah 2 (mis. `https://flowniaga-xxx.koyeb.app`)
   - `NEXT_PUBLIC_APP_NAME` = `FlowNiaga`
4. Deploy → buka URL Vercel (mis. `https://flowniaga.vercel.app`).
5. Kembali ke Koyeb → perbarui `API_CORS_ORIGIN` dengan URL Vercel yang sebenarnya → redeploy API.

## Langkah 4 — Mulai pakai

Buka URL Vercel → **“Daftar usaha baru”** → isi nama, usaha, email, kata sandi → langsung masuk dashboard. (Seed demo sengaja tidak berjalan di production — akun dibuat lewat halaman daftar.)

## Cara kerja & batasan free tier

- Web memproksikan `/api/backend/*` ke API (rewrite Next.js), jadi cookie login httpOnly berfungsi penuh walau web & API di layanan berbeda.
- Tanpa `REDIS_URL`, job import CSV diproses langsung di API (inline) — cukup untuk file kecil-menengah.
- Neon free: database “tidur” saat idle beberapa menit — request pertama agak lambat, lalu normal. Kapasitas ±0,5 GB.
- Koyeb/Render free: instance tidur saat idle; request pertama butuh beberapa detik untuk bangun.
- Free tier cocok untuk uji coba/demo. Untuk operasional bisnis nyata, gunakan plan berbayar atau VPS (`docker-compose.prod.yml`, lihat `deployment.md`).

## Kalau ada error

Salin pesan error dari log layanan (Koyeb/Vercel: tab **Logs**) dan kirimkan — konfigurasi paling sering salah ada di `DATABASE_URL` (harus pakai _Direct connection_ + `sslmode=require`) dan `API_CORS_ORIGIN`.
