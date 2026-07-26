# Deployment Gratis (Tanpa Kartu Kredit)

Kombinasi free tier untuk menjalankan FlowNiaga online tanpa biaya:

| Komponen   | Layanan                                                                       | Biaya  | Kartu kredit |
| ---------- | ----------------------------------------------------------------------------- | ------ | ------------ |
| PostgreSQL | [Neon](https://neon.tech)                                                     | Gratis | Tidak perlu  |
| API        | [Render](https://render.com) Web Service **manual** (bukan Blueprint)          | Gratis | Tidak perlu  |
| Web        | [Netlify](https://netlify.com) (atau Vercel Hobby)                             | Gratis | Tidak perlu  |
| Redis      | **Tidak wajib** — import CSV otomatis diproses inline bila `REDIS_URL` kosong | —      | —            |
| Worker     | **Tidak wajib** untuk Fase 2                                                  | —      | —            |

> Semua akun bisa dibuat dengan login GitHub. Total waktu ±20 menit.
>
> **Catatan (Juli 2026):** Koyeb — yang sebelumnya direkomendasikan di sini — bergabung dengan Mistral dan tidak lagi menerima deployment pengguna baru, sehingga panduan ini memakai Render.

## Langkah 1 — Database di Neon

1. Daftar di **neon.tech** (login GitHub) → **Create project** → nama `flowniaga`, region Singapore.
2. Buka **Connection Details** → salin **connection string** (pilih yang _Direct connection_, bukan pooled), bentuknya:
   `postgresql://user:password@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`
3. Simpan — ini nilai `DATABASE_URL`.

## Langkah 2 — API di Render (Web Service manual)

> Jangan pakai menu **Blueprint** — Blueprint membuat database/Redis berbayar. Buat satu **Web Service** saja secara manual; database tetap di Neon (gratis).

1. Daftar di **dashboard.render.com** (login GitHub) → **New → Web Service** → pilih repo **`flowniaga`**.
2. **Name**: `flowniaga-api`. **Language**: **Docker**. **Region**: Singapore. **Dockerfile Path**: `apps/api/Dockerfile` (context: root repo).
3. **Instance Type**: **Free**. Port: biarkan (API membaca `PORT` otomatis).
4. Environment variables:
   - `NODE_ENV` = `production`
   - `DATABASE_URL` = (dari Langkah 1)
   - `JWT_ACCESS_SECRET` = nilai acak ≥32 karakter — buat di https://generate-secret.vercel.app/32
   - `JWT_REFRESH_SECRET` = nilai acak lain ≥32 karakter
   - `REFRESH_COOKIE_PATH` = `/api/backend/auth`
   - `API_CORS_ORIGIN` = URL web produksi (mis. `https://flowniaga.netlify.app` — sesuaikan nanti)
5. **Deploy Web Service** → tunggu status **Live** → catat URL API, mis. `https://flowniaga-api-xxx.onrender.com`.
6. Uji: buka `https://<url-api>/health/ready` → harus `{"status":"ok","database":"up"}` (migration berjalan otomatis saat start).

## Langkah 3 — Web di Netlify (atau Vercel)

Web perlu di-build dengan env berikut, apa pun platformnya:

- `NEXT_PUBLIC_API_URL` = `/api/backend`
- `API_PROXY_TARGET` = URL API dari Langkah 2
- `NEXT_PUBLIC_APP_NAME` = `FlowNiaga`

**Netlify:** app.netlify.com → **Add new project → Import an existing project** → repo `flowniaga` → base directory `apps/web` → tambahkan env di **Site configuration → Environment variables** → Deploy.

**Vercel:** vercel.com → **Add New → Project** → import repo `flowniaga` → **Root Directory** `apps/web` (monorepo pnpm + Next.js dikenali otomatis) → isi env untuk Production → Deploy.

Terakhir: kembali ke Render → pastikan `API_CORS_ORIGIN` sama persis dengan URL web yang sebenarnya → redeploy API bila diubah.

## Langkah 4 — Mulai pakai

Buka URL web → **“Daftar usaha baru”** → isi nama, usaha, email, kata sandi → langsung masuk dashboard. (Seed demo sengaja tidak berjalan di production — akun dibuat lewat halaman daftar.)

## Cara kerja & batasan free tier

- Web memproksikan `/api/backend/*` ke API (rewrite Next.js), jadi cookie login httpOnly berfungsi penuh walau web & API di layanan berbeda.
- Tanpa `REDIS_URL`, job import CSV diproses langsung di API (inline) — cukup untuk file kecil-menengah.
- Neon free: database “tidur” saat idle beberapa menit — request pertama agak lambat, lalu normal. Kapasitas ±0,5 GB.
- Render free: instance tidur saat idle; request pertama butuh beberapa detik untuk bangun.
- Free tier cocok untuk uji coba/demo. Untuk operasional bisnis nyata, gunakan plan berbayar atau VPS (`docker-compose.prod.yml`, lihat `deployment.md`).

## Kalau ada error

Salin pesan error dari log layanan (Render/Netlify: tab **Logs**) dan kirimkan — konfigurasi paling sering salah ada di `DATABASE_URL` (harus pakai _Direct connection_ + `sslmode=require`) dan `API_CORS_ORIGIN`.
