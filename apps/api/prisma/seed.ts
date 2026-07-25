/**
 * Seed data demo FlowNiaga — HANYA untuk local development.
 * Dijalankan via: pnpm db:seed
 *
 * Guard ganda: menolak berjalan bila NODE_ENV=production atau
 * SEED_DEMO_DATA != 'true'.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import {
  ALL_PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  SYSTEM_ROLE_PERMISSIONS,
  SYSTEM_ROLES,
} from '@flowniaga/domain';

const prisma = new PrismaClient();
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$32768$8$1$${salt.toString('hex')}$${derived.toString('hex')}`;
}

const DEMO_TENANT_SLUG = 'pt-demo-flow-niaga';
const DEMO_PASSWORD = 'Demo1234!';

const DEMO_USERS = [
  { email: 'owner@demo.flowniaga.local', name: 'Dewi Owner', role: SYSTEM_ROLES.OWNER },
  { email: 'manager@demo.flowniaga.local', name: 'Made Manager', role: SYSTEM_ROLES.MANAGER },
  { email: 'cashier@demo.flowniaga.local', name: 'Citra Kasir', role: SYSTEM_ROLES.CASHIER },
  { email: 'warehouse@demo.flowniaga.local', name: 'Wawan Gudang', role: SYSTEM_ROLES.WAREHOUSE },
  { email: 'finance@demo.flowniaga.local', name: 'Fina Keuangan', role: SYSTEM_ROLES.FINANCE },
] as const;

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed demo DILARANG dijalankan di production.');
  }
  if (process.env.SEED_DEMO_DATA !== 'true') {
    console.log('SEED_DEMO_DATA != true — seed demo dilewati.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    // 1. Katalog permission global (idempotent).
    for (const code of ALL_PERMISSIONS) {
      await tx.permission.upsert({
        where: { code },
        create: { code, description: PERMISSION_DESCRIPTIONS[code] },
        update: { description: PERMISSION_DESCRIPTIONS[code] },
      });
    }

    // 2. Tenant demo.
    let tenant = await tx.tenant.findUnique({ where: { slug: DEMO_TENANT_SLUG } });
    if (tenant) {
      console.log('Tenant demo sudah ada — seed idempotent, selesai.');
      return;
    }
    tenant = await tx.tenant.create({
      data: { name: 'PT Demo Flow Niaga', slug: DEMO_TENANT_SLUG },
    });
    await tx.legalEntity.create({
      data: { tenantId: tenant.id, name: 'PT Demo Flow Niaga', isDefault: true },
    });

    // 3. Role sistem.
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

    // 4. Dua cabang + dua gudang.
    const branchJkt = await tx.branch.create({
      data: {
        tenantId: tenant.id,
        code: 'JKT-01',
        name: 'Cabang Jakarta Pusat',
        address: 'Jl. Sudirman No. 1, Jakarta Pusat',
        phone: '+62215550001',
      },
    });
    const branchBdg = await tx.branch.create({
      data: {
        tenantId: tenant.id,
        code: 'BDG-01',
        name: 'Cabang Bandung',
        address: 'Jl. Asia Afrika No. 8, Bandung',
        phone: '+62225550002',
      },
    });
    await tx.warehouse.create({
      data: {
        tenantId: tenant.id,
        branchId: branchJkt.id,
        code: 'WH-JKT-01',
        name: 'Gudang Utama Jakarta',
        address: 'Kawasan Industri Pulogadung, Jakarta',
      },
    });
    await tx.warehouse.create({
      data: {
        tenantId: tenant.id,
        branchId: branchBdg.id,
        code: 'WH-BDG-01',
        name: 'Gudang Bandung',
        address: 'Jl. Soekarno-Hatta No. 100, Bandung',
      },
    });

    // 5. User demo + membership.
    for (const demoUser of DEMO_USERS) {
      const user = await tx.user.upsert({
        where: { email: demoUser.email },
        create: {
          email: demoUser.email,
          name: demoUser.name,
          passwordHash: await hashPassword(DEMO_PASSWORD),
        },
        update: {},
      });
      await tx.membership.create({
        data: { tenantId: tenant.id, userId: user.id, roleId: roleIds[demoUser.role] },
      });
    }

    // 6. Audit log pembuatan tenant demo.
    await tx.auditLog.create({
      data: {
        tenantId: tenant.id,
        action: 'tenant.seeded',
        entityType: 'Tenant',
        entityId: tenant.id,
        after: { name: tenant.name, slug: tenant.slug, source: 'seed' } as Prisma.InputJsonValue,
      },
    });

    console.log(`Tenant demo dibuat: ${tenant.name} (${tenant.id})`);
    console.log(`Akun demo (kata sandi: ${DEMO_PASSWORD}):`);
    for (const u of DEMO_USERS) console.log(`  - ${u.email} (${u.role})`);
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
