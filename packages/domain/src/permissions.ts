/**
 * Katalog permission granular FlowNiaga.
 *
 * Prinsip: DEFAULT DENY. Endpoint tanpa permission eksplisit ditolak
 * oleh PermissionsGuard di backend. Frontend BUKAN lapisan keamanan.
 */
export const PERMISSIONS = {
  // Tenant & organisasi
  TENANT_READ: 'tenant.read',
  TENANT_UPDATE: 'tenant.update',
  BRANCH_READ: 'branch.read',
  BRANCH_CREATE: 'branch.create',
  BRANCH_UPDATE: 'branch.update',
  BRANCH_DELETE: 'branch.delete',
  WAREHOUSE_READ: 'warehouse.read',
  WAREHOUSE_CREATE: 'warehouse.create',
  WAREHOUSE_UPDATE: 'warehouse.update',
  WAREHOUSE_DELETE: 'warehouse.delete',

  // Keanggotaan & RBAC
  MEMBER_READ: 'member.read',
  MEMBER_INVITE: 'member.invite',
  MEMBER_UPDATE: 'member.update',
  MEMBER_REMOVE: 'member.remove',
  ROLE_READ: 'role.read',
  ROLE_MANAGE: 'role.manage',

  // Observabilitas & kepatuhan
  AUDIT_READ: 'audit.read',
  DASHBOARD_READ: 'dashboard.read',

  // Catalog (Fase 2)
  CATALOG_CATEGORY_READ: 'catalog.category.read',
  CATALOG_CATEGORY_CREATE: 'catalog.category.create',
  CATALOG_CATEGORY_UPDATE: 'catalog.category.update',
  CATALOG_CATEGORY_DELETE: 'catalog.category.delete',
  CATALOG_PRODUCT_READ: 'catalog.product.read',
  CATALOG_PRODUCT_CREATE: 'catalog.product.create',
  CATALOG_PRODUCT_UPDATE: 'catalog.product.update',
  CATALOG_PRODUCT_DELETE: 'catalog.product.delete',
  CATALOG_VARIANT_READ: 'catalog.variant.read',
  CATALOG_VARIANT_CREATE: 'catalog.variant.create',
  CATALOG_VARIANT_UPDATE: 'catalog.variant.update',
  CATALOG_VARIANT_DELETE: 'catalog.variant.delete',
  CATALOG_IMPORT_PREVIEW: 'catalog.import.preview',
  CATALOG_IMPORT_EXECUTE: 'catalog.import.execute',
  CATALOG_CHANNEL_LISTING_READ: 'catalog.channelListing.read',
  CATALOG_CHANNEL_LISTING_MANAGE: 'catalog.channelListing.manage',

  // Customer (Fase 2)
  CUSTOMER_READ: 'customer.read',
  CUSTOMER_CREATE: 'customer.create',
  CUSTOMER_UPDATE: 'customer.update',
  CUSTOMER_DELETE: 'customer.delete',
  CUSTOMER_IDENTITY_MANAGE: 'customer.identity.manage',
  CUSTOMER_MERGE_REVIEW: 'customer.merge.review',
  CUSTOMER_MERGE_EXECUTE: 'customer.merge.execute',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: PermissionCode[] = Object.values(PERMISSIONS);

export const PERMISSION_DESCRIPTIONS: Record<PermissionCode, string> = {
  'tenant.read': 'Melihat profil tenant',
  'tenant.update': 'Mengubah profil tenant',
  'branch.read': 'Melihat cabang',
  'branch.create': 'Membuat cabang',
  'branch.update': 'Mengubah cabang',
  'branch.delete': 'Menghapus (soft delete) cabang',
  'warehouse.read': 'Melihat gudang',
  'warehouse.create': 'Membuat gudang',
  'warehouse.update': 'Mengubah gudang',
  'warehouse.delete': 'Menghapus (soft delete) gudang',
  'member.read': 'Melihat anggota tenant',
  'member.invite': 'Menambahkan anggota',
  'member.update': 'Mengubah role/scope anggota',
  'member.remove': 'Menonaktifkan anggota',
  'role.read': 'Melihat role dan permission',
  'role.manage': 'Mengelola role dan permission',
  'audit.read': 'Melihat audit log',
  'dashboard.read': 'Melihat dashboard ringkasan',
  'catalog.category.read': 'Melihat kategori produk',
  'catalog.category.create': 'Membuat kategori produk',
  'catalog.category.update': 'Mengubah kategori produk',
  'catalog.category.delete': 'Mengarsipkan kategori produk',
  'catalog.product.read': 'Melihat produk',
  'catalog.product.create': 'Membuat produk',
  'catalog.product.update': 'Mengubah produk',
  'catalog.product.delete': 'Mengarsipkan produk',
  'catalog.variant.read': 'Melihat variasi produk',
  'catalog.variant.create': 'Membuat variasi produk',
  'catalog.variant.update': 'Mengubah variasi produk',
  'catalog.variant.delete': 'Mengarsipkan variasi produk',
  'catalog.import.preview': 'Mengunggah dan preview import CSV produk',
  'catalog.import.execute': 'Menjalankan import CSV produk',
  'catalog.channelListing.read': 'Melihat pemetaan listing kanal',
  'catalog.channelListing.manage': 'Mengelola pemetaan listing kanal',
  'customer.read': 'Melihat pelanggan',
  'customer.create': 'Membuat pelanggan',
  'customer.update': 'Mengubah pelanggan',
  'customer.delete': 'Mengarsipkan pelanggan',
  'customer.identity.manage': 'Mengelola identitas kanal pelanggan',
  'customer.merge.review': 'Meninjau kandidat duplikat pelanggan',
  'customer.merge.execute': 'Menjalankan penggabungan pelanggan',
};

/** Role sistem bawaan. Setiap tenant mendapat salinan role sistem ini. */
export const SYSTEM_ROLES = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  CASHIER: 'Cashier',
  SALES: 'Sales',
  WAREHOUSE: 'Warehouse',
  FINANCE: 'Finance',
  STAFF: 'Staff',
  AUDITOR: 'Auditor',
} as const;

export type SystemRoleName = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];

const P = PERMISSIONS;

const READ_ONLY: PermissionCode[] = [
  P.TENANT_READ,
  P.BRANCH_READ,
  P.WAREHOUSE_READ,
  P.MEMBER_READ,
  P.ROLE_READ,
  P.AUDIT_READ,
  P.DASHBOARD_READ,
  P.CATALOG_CATEGORY_READ,
  P.CATALOG_PRODUCT_READ,
  P.CATALOG_VARIANT_READ,
  P.CATALOG_CHANNEL_LISTING_READ,
  P.CUSTOMER_READ,
];

const CATALOG_READ: PermissionCode[] = [
  P.CATALOG_CATEGORY_READ,
  P.CATALOG_PRODUCT_READ,
  P.CATALOG_VARIANT_READ,
  P.CATALOG_CHANNEL_LISTING_READ,
];

const CATALOG_MANAGE: PermissionCode[] = [
  ...CATALOG_READ,
  P.CATALOG_CATEGORY_CREATE,
  P.CATALOG_CATEGORY_UPDATE,
  P.CATALOG_CATEGORY_DELETE,
  P.CATALOG_PRODUCT_CREATE,
  P.CATALOG_PRODUCT_UPDATE,
  P.CATALOG_PRODUCT_DELETE,
  P.CATALOG_VARIANT_CREATE,
  P.CATALOG_VARIANT_UPDATE,
  P.CATALOG_VARIANT_DELETE,
  P.CATALOG_IMPORT_PREVIEW,
  P.CATALOG_IMPORT_EXECUTE,
  P.CATALOG_CHANNEL_LISTING_MANAGE,
];

const CUSTOMER_BASIC: PermissionCode[] = [P.CUSTOMER_READ, P.CUSTOMER_CREATE, P.CUSTOMER_UPDATE];

const CUSTOMER_MANAGE: PermissionCode[] = [
  ...CUSTOMER_BASIC,
  P.CUSTOMER_DELETE,
  P.CUSTOMER_IDENTITY_MANAGE,
  P.CUSTOMER_MERGE_REVIEW,
  P.CUSTOMER_MERGE_EXECUTE,
];

/**
 * Pemetaan permission default per role sistem (least privilege).
 *
 * Catatan Fase 2:
 * - Cashier: baca katalog + baca/buat pelanggan; TIDAK boleh menghapus produk,
 *   merge pelanggan, mengelola channel mapping, atau import massal.
 * - Warehouse: baca katalog (butuh SKU/barcode), tanpa akses pelanggan.
 * - Sales: baca katalog + kelola pelanggan dasar + review duplikat (tanpa eksekusi merge).
 */
export const SYSTEM_ROLE_PERMISSIONS: Record<SystemRoleName, PermissionCode[]> = {
  Owner: ALL_PERMISSIONS,
  Admin: ALL_PERMISSIONS.filter((p) => p !== P.TENANT_UPDATE),
  Manager: [
    P.TENANT_READ,
    P.BRANCH_READ,
    P.BRANCH_UPDATE,
    P.WAREHOUSE_READ,
    P.WAREHOUSE_CREATE,
    P.WAREHOUSE_UPDATE,
    P.MEMBER_READ,
    P.ROLE_READ,
    P.AUDIT_READ,
    P.DASHBOARD_READ,
    ...CATALOG_MANAGE,
    ...CUSTOMER_MANAGE,
  ],
  Cashier: [
    P.TENANT_READ,
    P.BRANCH_READ,
    P.DASHBOARD_READ,
    ...CATALOG_READ,
    P.CUSTOMER_READ,
    P.CUSTOMER_CREATE,
  ],
  Sales: [
    P.TENANT_READ,
    P.BRANCH_READ,
    P.DASHBOARD_READ,
    ...CATALOG_READ,
    ...CUSTOMER_BASIC,
    P.CUSTOMER_IDENTITY_MANAGE,
    P.CUSTOMER_MERGE_REVIEW,
  ],
  Warehouse: [P.TENANT_READ, P.BRANCH_READ, P.WAREHOUSE_READ, P.DASHBOARD_READ, ...CATALOG_READ],
  Finance: [
    P.TENANT_READ,
    P.BRANCH_READ,
    P.WAREHOUSE_READ,
    P.AUDIT_READ,
    P.DASHBOARD_READ,
    ...CATALOG_READ,
    P.CUSTOMER_READ,
  ],
  Staff: [P.TENANT_READ, P.BRANCH_READ, P.DASHBOARD_READ, ...CATALOG_READ, P.CUSTOMER_READ],
  Auditor: READ_ONLY,
};
