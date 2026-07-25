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
];

/**
 * Pemetaan permission default per role sistem.
 * Owner memegang semua permission. Auditor hanya membaca.
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
  ],
  Cashier: [P.TENANT_READ, P.BRANCH_READ, P.DASHBOARD_READ],
  Sales: [P.TENANT_READ, P.BRANCH_READ, P.DASHBOARD_READ],
  Warehouse: [P.TENANT_READ, P.BRANCH_READ, P.WAREHOUSE_READ, P.DASHBOARD_READ],
  Finance: [P.TENANT_READ, P.BRANCH_READ, P.WAREHOUSE_READ, P.AUDIT_READ, P.DASHBOARD_READ],
  Staff: [P.TENANT_READ, P.BRANCH_READ, P.DASHBOARD_READ],
  Auditor: READ_ONLY,
};
