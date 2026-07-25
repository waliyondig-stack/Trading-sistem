# Threat Model

Model ancaman berbasis STRIDE untuk kondisi Fase 1, diperbarui setiap fase.

## Aset yang dilindungi

1. Data bisnis tenant (organisasi, keanggotaan; ke depan: pesanan, pelanggan, stok, pembayaran).
2. Kredensial user (password hash, refresh token).
3. Integritas audit trail.
4. Secret aplikasi (JWT secret, kredensial DB — hanya via env).

## Ancaman & mitigasi

| STRIDE                 | Ancaman                            | Mitigasi (status)                                                                                                        |
| ---------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Spoofing               | Brute force login                  | Throttling login 10/menit/IP (✅); pesan error generik `INVALID_CREDENTIALS` (✅); lockout progresif (Fase hardening)    |
| Spoofing               | Pencurian refresh token            | Token acak 48 byte, disimpan **hash SHA-256** (✅), rotasi sekali-pakai (✅), revoke saat logout (✅)                    |
| Tampering              | SQL injection                      | Prisma parameterized query (✅); worker memakai parameterized `pg` (✅)                                                  |
| Tampering              | Mass assignment                    | `ValidationPipe` whitelist + `forbidNonWhitelisted` (✅)                                                                 |
| Tampering              | Manipulasi audit trail             | AuditLog append-only dari kode aplikasi; tidak ada endpoint update/delete audit (✅); proteksi level DB (Fase hardening) |
| Repudiation            | Aksi tanpa jejak                   | AuditService pada semua critical action + correlationId (✅)                                                             |
| Information disclosure | Kebocoran lintas tenant            | Lihat `tenant-isolation.md` — guard + tenant-scoped query + test otomatis (✅)                                           |
| Information disclosure | Kebocoran secret di log            | Redact header `authorization`/`cookie` di pino (✅); tidak ada secret di repo (✅)                                       |
| Information disclosure | XSS                                | React auto-escaping; secure headers (helmet di API, header di Next) (✅); CSP ketat (Fase hardening)                     |
| DoS                    | Flood request                      | Throttler global 120/menit/IP (✅); rate limit per-tenant + Redis storage (saat scaling)                                 |
| Elevation of privilege | Endpoint lupa deklarasi permission | **Default deny**: `AccessGuard` menolak endpoint tenpa `@RequirePermissions`/`@Public`/`@AuthOnly` (✅)                  |
| Elevation of privilege | Kasir mengubah role                | Permission `member.update`/`role.manage` tidak diberikan ke Cashier; diverifikasi test RBAC (✅)                         |
| Elevation of privilege | Tenant kehilangan kontrol          | Proteksi `LAST_OWNER` (✅)                                                                                               |

## Risiko diterima sementara (dengan rencana)

1. **Token di localStorage (web)** — risiko XSS→token theft; mitigasi sementara: React escaping + secure headers; rencana: httpOnly cookie + CSRF token sebelum production (dicatat di assumptions #5).
2. **Rate limit in-memory** — reset saat restart; cukup untuk single-instance MVP.
3. **Registrasi terbuka tanpa verifikasi email** — modul Notification (Fase 7) menambah verifikasi email.

## Praktik berkelanjutan

- Dependency scanning: `pnpm audit` di CI (non-blocking Fase 1, blocking mulai Fase 4).
- Webhook signature verification wajib saat connector nyata (Fase 5).
- File upload validation + private object storage saat fitur upload (Fase 2).
- Sensitive data masking pada log & AI context (Fase 6).
