# ADR-005: Web Session via Cookie httpOnly + CSRF Double-Submit

- Status: Diterima (2026-07-25)
- Konteks fase: 2

## Konteks

Fase 1 menyimpan access/refresh token di `localStorage` (tercatat sebagai risiko di threat model): token dapat dicuri oleh XSS. Fase 2 mensyaratkan perbaikan sebelum fitur bisnis bertambah.

## Keputusan

1. **Session web memakai cookie yang diset server**:
   - `fn_access` — access token JWT, `httpOnly`, `SameSite=Lax`, `Secure` di production, umur 15 menit, path `/`;
   - `fn_refresh` — refresh token opaque, `httpOnly`, `SameSite=Lax`, `Secure` di production, path **`/auth`** (memperkecil permukaan), umur 30 hari, **rotasi sekali pakai** (disimpan hash SHA-256, revoke saat logout);
   - `fn_csrf` — token CSRF acak, **sengaja non-httpOnly** untuk pola double-submit.
2. **CSRF protection (double-submit cookie)**: setiap request mutasi (POST/PATCH/PUT/DELETE) yang terautentikasi **lewat cookie** wajib mengirim header `x-csrf-token` yang sama dengan cookie `fn_csrf`; dibandingkan timing-safe di `CsrfGuard`. Metode aman (GET/HEAD/OPTIONS) dan endpoint `@Public` dikecualikan.
3. **Klien API (Bearer)** tetap didukung lewat header `Authorization` dan **tidak** diwajibkan CSRF (tidak rentan CSRF karena tidak memakai kredensial ambient). Body login tetap memuat token untuk klien non-browser.
4. **Frontend tidak menyimpan token di mana pun yang bisa dibaca JS** — hanya `tenantId` aktif (bukan rahasia) di localStorage; semua fetch memakai `credentials: 'include'`.
5. Logout menghapus semua cookie session dan mencabut refresh token di server.

`SameSite=Lax` cukup karena web (`app.domain`) dan API (`api.domain`) berada pada site yang sama (eTLD+1); CORS dibatasi origin web + `credentials: true`.

## Alternatif ditolak

- **localStorage** (status quo): rentan XSS → ditolak.
- **SameSite=Strict**: memutus navigasi top-level dari tautan eksternal ke halaman ter-autentikasi; Lax + CSRF token memberi perlindungan setara untuk mutasi.
- **Session server-side stateful (express-session)**: menambah kebutuhan sticky session/penyimpanan sesi; rotasi refresh token yang sudah ada memberikan lifecycle yang setara.

## Konsekuensi

- (+) Token tidak dapat dibaca JavaScript; pencurian via XSS jauh lebih sulit.
- (+) Verifikasi otomatis: `apps/api/test/session.e2e-spec.ts` (flag httpOnly, penolakan tanpa CSRF, rotasi, logout, validasi tenant server-side).
- (−) Deployment web & API harus satu site (subdomain berbeda boleh); didokumentasikan di runbook deployment.
- (−) Klien mobile/API memakai jalur Bearer terpisah — dua jalur autentikasi yang harus dites keduanya.
