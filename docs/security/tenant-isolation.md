# Tenant Isolation

Isolasi tenant adalah properti keamanan nomor satu FlowNiaga. **Frontend bukan lapisan keamanan** — seluruh penegakan ada di backend.

## Model

```
Tenant ──< LegalEntity ──< Branch ──< Warehouse
Tenant ──< Membership (User × Role, opsional branch scope)
```

Semua baris data bisnis membawa `tenantId` yang tidak ambigu.

## Mekanisme penegakan (lapis-berlapis)

1. **Autentikasi** — `JwtAuthGuard` global; tanpa Bearer token valid → 401. Endpoint publik harus ditandai `@Public()` eksplisit.
2. **Konteks tenant** — klien mengirim header `x-tenant-id`. `AccessGuard` memverifikasi ada `Membership` **ACTIVE** milik user pada tenant itu (dan tenant ACTIVE, tidak soft-deleted). Tidak ada membership → `403 TENANT_ACCESS_DENIED` + audit `access.denied`.
3. **Default deny permission** — endpoint ter-autentikasi tanpa `@RequirePermissions` ditolak (`PERMISSION_NOT_DECLARED`). Permission diambil dari role membership; kekurangan permission → `403 PERMISSION_DENIED` + audit.
4. **Tenant-scoped query** — setiap query service menyertakan `tenantId` dari `TenantContext` yang di-set guard (bukan dari body/param klien). Entity milik tenant lain tampak sebagai `404`.
5. **Branch scope** — membership dengan `allBranches=false` hanya melihat branch/warehouse pada `MembershipBranchAccess`.
6. **Audit percobaan lintas tenant** — setiap `TENANT_ACCESS_DENIED` dan `PERMISSION_DENIED` dicatat (userId, tenant sasaran, path) untuk deteksi penyalahgunaan.

## Verifikasi otomatis

`apps/api/test/tenant-isolation.e2e-spec.ts` menjamin:

- Tenant B tidak melihat data Tenant A (list, detail, dashboard, audit log).
- Tenant B tidak dapat mengubah data Tenant A (404 lewat tenant sendiri; 403 lewat header tenant A).
- Critical action tercatat di audit log tenant yang benar dan tidak bocor lintas tenant.

Test ini adalah acceptance test wajib; **CI gagal bila isolasi bocor**.

## Aturan untuk kode baru

- Model Prisma baru wajib `tenantId` + index, kecuali entitas global yang disepakati (`User`, `Permission`).
- Jangan pernah membaca `tenantId` dari input klien untuk query — selalu dari `TenantContext` (`@CurrentTenant()`).
- Endpoint baru wajib `@RequirePermissions(...)`; tambah permission baru di `packages/domain`.
- Tambahkan kasus isolasi tenant pada integration test untuk setiap modul baru.

## Evolusi

Bila diperlukan (enterprise/regulasi), lapisan tambahan yang disiapkan: PostgreSQL Row-Level Security per `tenantId`, atau pemisahan schema/database untuk tenant besar. Keputusan di ADR-002.
