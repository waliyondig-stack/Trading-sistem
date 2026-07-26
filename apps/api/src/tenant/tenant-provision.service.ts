import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  ALL_PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  SYSTEM_ROLE_PERMISSIONS,
  SYSTEM_ROLES,
} from '@flowniaga/domain';

/**
 * Provisioning tenant baru: membuat tenant, legal entity default,
 * salinan role sistem beserta permission-nya. Dipakai oleh register & seed.
 */
@Injectable()
export class TenantProvisionService {
  /** Pastikan katalog permission global tersedia (idempotent). */
  async ensurePermissionCatalog(tx: Prisma.TransactionClient): Promise<void> {
    for (const code of ALL_PERMISSIONS) {
      await tx.permission.upsert({
        where: { code },
        create: { code, description: PERMISSION_DESCRIPTIONS[code] },
        update: { description: PERMISSION_DESCRIPTIONS[code] },
      });
    }
  }

  /** Buat tenant + legal entity default + role sistem. Return tenant & roleId Owner. */
  async provisionTenant(
    tx: Prisma.TransactionClient,
    input: { name: string; slug: string },
  ): Promise<{ tenantId: string; ownerRoleId: string; roleIds: Record<string, string> }> {
    await this.ensurePermissionCatalog(tx);

    const tenant = await tx.tenant.create({
      data: { name: input.name, slug: input.slug },
    });

    await tx.legalEntity.create({
      data: { tenantId: tenant.id, name: input.name, isDefault: true },
    });

    const roleIds: Record<string, string> = {};
    for (const roleName of Object.values(SYSTEM_ROLES)) {
      const role = await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: roleName,
          isSystem: true,
          description: `Role sistem ${roleName}`,
          permissions: {
            create: SYSTEM_ROLE_PERMISSIONS[roleName].map((code) => ({ permissionCode: code })),
          },
        },
      });
      roleIds[roleName] = role.id;
    }

    return { tenantId: tenant.id, ownerRoleId: roleIds[SYSTEM_ROLES.OWNER], roleIds };
  }
}
