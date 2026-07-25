import type { PermissionCode } from '@flowniaga/domain';

export interface RequestUser {
  id: string;
  email: string;
}

export interface TenantContext {
  tenantId: string;
  membershipId: string;
  roleId: string;
  roleName: string;
  permissions: PermissionCode[];
  /** true = akses semua cabang; false = terbatas pada branchIds */
  allBranches: boolean;
  branchIds: string[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: RequestUser;
      tenantContext?: TenantContext;
      correlationId?: string;
    }
  }
}
