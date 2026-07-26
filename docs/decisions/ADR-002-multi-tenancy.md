# ADR-002: Multi-Tenancy Shared Database + Tenant Scoping

- Status: Diterima (2026-07-25)
- Konteks fase: 1

## Konteks

FlowNiaga adalah SaaS multi-tenant dari usaha mikro hingga enterprise. Pilihan: (a) database per tenant, (b) schema per tenant, (c) shared database dengan kolom `tenantId`.

## Keputusan

**Shared database, shared schema** dengan `tenantId` pada setiap tabel bisnis, ditegakkan berlapis:

1. Hirarki organisasi `Tenant → LegalEntity → Branch → Warehouse` (legal entity sudah ada sejak MVP meski belum dipakai penuh).
2. Konteks tenant per-request via header `x-tenant-id`, divalidasi `AccessGuard` terhadap `Membership` aktif — bukan dipercaya dari klien.
3. RBAC: role sistem per tenant (Owner…Auditor) → permission granular (`packages/domain`), **default deny**, plus branch scope (`allBranches`/`MembershipBranchAccess`).
4. Semua query service wajib menyertakan `tenantId` dari `TenantContext`.
5. Acceptance test isolasi tenant sebagai gerbang CI.

## Alternatif ditolak

- DB/schema per tenant: operasional & migrasi mahal untuk ribuan UMKM; dipertimbangkan ulang untuk tenant enterprise (Fase 9), termasuk opsi PostgreSQL RLS sebagai lapisan tambahan.

## Konsekuensi

- (+) Onboarding tenant instan, biaya rendah, agregasi lintas tenant (internal) mudah.
- (−) Isolasi bergantung disiplin query → dimitigasi guard terpusat, aturan kode (AGENTS.md), dan test wajib.
