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

  await prisma.$transaction(
    async (tx) => {
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

      // ================= FASE 2 — Catalog & Customer =================

      // 6. Kategori (5).
      const categoryNames = ['Minuman', 'Camilan', 'Bahan Dapur', 'Perawatan Rumah', 'Elektronik'];
      const categoryIds: Record<string, string> = {};
      for (const [i, name] of categoryNames.entries()) {
        const category = await tx.category.create({
          data: {
            tenantId: tenant.id,
            name,
            slug: name.toLowerCase().replace(/\s+/g, '-'),
            sortOrder: i,
          },
        });
        categoryIds[name] = category.id;
      }

      // 7. Produk (20) + variant (30+). Uang: integer rupiah (BigInt).
      const productSpecs: {
        name: string;
        category: string;
        variants: { suffix: string; sku: string; cost: number; price: number; barcode?: string }[];
      }[] = [
        {
          name: 'Kopi Arabika Gayo',
          category: 'Minuman',
          variants: [
            {
              suffix: '250g',
              sku: 'KOPI-GAYO-250',
              cost: 45000,
              price: 75000,
              barcode: '8991000000011',
            },
            {
              suffix: '500g',
              sku: 'KOPI-GAYO-500',
              cost: 85000,
              price: 140000,
              barcode: '8991000000012',
            },
          ],
        },
        {
          name: 'Teh Melati Premium',
          category: 'Minuman',
          variants: [
            {
              suffix: '100g',
              sku: 'TEH-MELATI-100',
              cost: 15000,
              price: 28000,
              barcode: '8991000000021',
            },
            {
              suffix: '200g',
              sku: 'TEH-MELATI-200',
              cost: 28000,
              price: 52000,
              barcode: '8991000000022',
            },
          ],
        },
        {
          name: 'Sirup Markisa',
          category: 'Minuman',
          variants: [
            { suffix: '600ml', sku: 'SIRUP-MARKISA-600', cost: 18000, price: 32000 },
            { suffix: '300ml', sku: 'SIRUP-MARKISA-300', cost: 10000, price: 18000 },
          ],
        },
        {
          name: 'Air Mineral Galon',
          category: 'Minuman',
          variants: [{ suffix: '19L', sku: 'AIR-GALON-19', cost: 12000, price: 20000 }],
        },
        {
          name: 'Keripik Singkong Balado',
          category: 'Camilan',
          variants: [
            { suffix: '200g', sku: 'KRPK-BALADO-200', cost: 9000, price: 18000 },
            { suffix: '400g', sku: 'KRPK-BALADO-400', cost: 16000, price: 30000 },
          ],
        },
        {
          name: 'Kacang Mete Panggang',
          category: 'Camilan',
          variants: [
            { suffix: '250g', sku: 'METE-250', cost: 55000, price: 85000 },
            { suffix: '500g', sku: 'METE-500', cost: 105000, price: 160000 },
          ],
        },
        {
          name: 'Cokelat Batang 70%',
          category: 'Camilan',
          variants: [{ suffix: '90g', sku: 'COKLAT-70-90', cost: 22000, price: 38000 }],
        },
        {
          name: 'Biskuit Gandum',
          category: 'Camilan',
          variants: [{ suffix: '300g', sku: 'BISKUIT-GANDUM-300', cost: 14000, price: 25000 }],
        },
        {
          name: 'Gula Aren Bubuk',
          category: 'Bahan Dapur',
          variants: [{ suffix: '500g', sku: 'GULA-AREN-500', cost: 22000, price: 35000 }],
        },
        {
          name: 'Minyak Kelapa Murni',
          category: 'Bahan Dapur',
          variants: [
            { suffix: '500ml', sku: 'VCO-500', cost: 40000, price: 65000 },
            { suffix: '1L', sku: 'VCO-1000', cost: 75000, price: 120000 },
          ],
        },
        {
          name: 'Beras Pandan Wangi',
          category: 'Bahan Dapur',
          variants: [
            { suffix: '5kg', sku: 'BERAS-PANDAN-5', cost: 68000, price: 82000 },
            { suffix: '10kg', sku: 'BERAS-PANDAN-10', cost: 130000, price: 158000 },
          ],
        },
        {
          name: 'Tepung Terigu Protein Tinggi',
          category: 'Bahan Dapur',
          variants: [{ suffix: '1kg', sku: 'TERIGU-PRO-1', cost: 11000, price: 16000 }],
        },
        {
          name: 'Kecap Manis Premium',
          category: 'Bahan Dapur',
          variants: [{ suffix: '600ml', sku: 'KECAP-600', cost: 17000, price: 27000 }],
        },
        {
          name: 'Sambal Bawang Botol',
          category: 'Bahan Dapur',
          variants: [{ suffix: '200g', sku: 'SAMBAL-BWG-200', cost: 15000, price: 26000 }],
        },
        {
          name: 'Sabun Cuci Piring',
          category: 'Perawatan Rumah',
          variants: [{ suffix: '800ml', sku: 'SABUN-PIRING-800', cost: 9000, price: 15000 }],
        },
        {
          name: 'Deterjen Cair',
          category: 'Perawatan Rumah',
          variants: [
            { suffix: '1L', sku: 'DETERJEN-1L', cost: 18000, price: 28000 },
            { suffix: '2L', sku: 'DETERJEN-2L', cost: 33000, price: 50000 },
          ],
        },
        {
          name: 'Pewangi Pakaian',
          category: 'Perawatan Rumah',
          variants: [{ suffix: '900ml', sku: 'PEWANGI-900', cost: 12000, price: 21000 }],
        },
        {
          name: 'Lampu LED 9W',
          category: 'Elektronik',
          variants: [
            { suffix: 'Putih', sku: 'LED-9W-PUTIH', cost: 18000, price: 30000 },
            { suffix: 'Kuning', sku: 'LED-9W-KUNING', cost: 18000, price: 30000 },
          ],
        },
        {
          name: 'Stop Kontak 4 Lubang',
          category: 'Elektronik',
          variants: [{ suffix: '3m', sku: 'STOPKONTAK-4-3M', cost: 35000, price: 55000 }],
        },
        {
          name: 'Baterai AA Alkaline',
          category: 'Elektronik',
          variants: [
            { suffix: 'isi 4', sku: 'BATERAI-AA-4', cost: 16000, price: 26000 },
            { suffix: 'isi 8', sku: 'BATERAI-AA-8', cost: 30000, price: 48000 },
          ],
        },
      ];

      const variantIds: Record<string, string> = {};
      for (const spec of productSpecs) {
        const product = await tx.product.create({
          data: {
            tenantId: tenant.id,
            name: spec.name,
            slug: spec.name
              .toLowerCase()
              .replace(/[^a-z0-9\s-]/g, '')
              .replace(/\s+/g, '-'),
            categoryId: categoryIds[spec.category],
            productType: 'PHYSICAL',
            defaultUnit: 'pcs',
          },
        });
        for (const v of spec.variants) {
          const variant = await tx.productVariant.create({
            data: {
              tenantId: tenant.id,
              productId: product.id,
              name: `${spec.name} ${v.suffix}`,
              internalSku: v.sku,
              barcode: v.barcode ?? null,
              costAmount: BigInt(v.cost),
              sellingPrice: BigInt(v.price),
            },
          });
          variantIds[v.sku] = variant.id;
        }
      }

      // 8. Kanal (3) + channel listing.
      const channelPos = await tx.channel.create({
        data: { tenantId: tenant.id, type: 'POS', name: 'POS Toko' },
      });
      const channelMock = await tx.channel.create({
        data: { tenantId: tenant.id, type: 'MOCK_MARKETPLACE', name: 'Mock Marketplace' },
      });
      await tx.channel.create({
        data: { tenantId: tenant.id, type: 'CSV', name: 'Import CSV' },
      });
      const listingSpecs = [
        { channelId: channelMock.id, sku: 'KOPI-GAYO-250', ext: 'MKT-KOPI-250', price: 78000 },
        { channelId: channelMock.id, sku: 'KOPI-GAYO-500', ext: 'MKT-KOPI-500', price: 145000 },
        { channelId: channelMock.id, sku: 'KRPK-BALADO-200', ext: 'MKT-KRPK-200', price: 19500 },
        { channelId: channelPos.id, sku: 'BERAS-PANDAN-5', ext: 'POS-BERAS-5', price: 82000 },
      ];
      for (const l of listingSpecs) {
        await tx.channelListing.create({
          data: {
            tenantId: tenant.id,
            channelId: l.channelId,
            productVariantId: variantIds[l.sku],
            externalSku: l.ext,
            listingName: `Listing ${l.sku}`,
            channelPrice: BigInt(l.price),
          },
        });
      }

      // 9. Pelanggan (15) + identitas.
      const customerSpecs: {
        name: string;
        phone?: string;
        email?: string;
        type?: 'INDIVIDUAL' | 'BUSINESS';
        company?: string;
      }[] = [
        { name: 'Budi Santoso', phone: '+628121000001', email: 'budi.santoso@contoh.id' },
        { name: 'Siti Rahayu', phone: '+628121000002', email: 'siti.rahayu@contoh.id' },
        { name: 'Agus Wijaya', phone: '+628121000003' },
        { name: 'Rina Marlina', email: 'rina.marlina@contoh.id' },
        { name: 'Dedi Kurniawan', phone: '+628121000005' },
        { name: 'Lestari Putri', phone: '+628121000006', email: 'lestari@contoh.id' },
        { name: 'Hendra Gunawan', phone: '+628121000007' },
        { name: 'Maya Sari', email: 'maya.sari@contoh.id' },
        { name: 'Rudi Hartono', phone: '+628121000009' },
        { name: 'Fitri Handayani', phone: '+628121000010' },
        {
          name: 'Toko Berkah Jaya',
          type: 'BUSINESS',
          company: 'CV Berkah Jaya',
          phone: '+628121000011',
          email: 'order@berkahjaya.id',
        },
        {
          name: 'Warung Ibu Nia',
          type: 'BUSINESS',
          company: 'Warung Ibu Nia',
          phone: '+628121000012',
        },
        {
          name: 'PT Sumber Rezeki',
          type: 'BUSINESS',
          company: 'PT Sumber Rezeki',
          email: 'purchasing@sumberrezeki.co.id',
        },
        // Duplikat disengaja untuk demo kandidat:
        { name: 'Budi S.', phone: '+628121000001' }, // telepon sama dengan Budi Santoso
        { name: 'Siti Rahayu (Lama)', email: 'siti.rahayu@contoh.id' }, // email sama dengan Siti Rahayu
      ];

      const customerIds: string[] = [];
      for (const c of customerSpecs) {
        const customer = await tx.customer.create({
          data: {
            tenantId: tenant.id,
            type: c.type ?? 'INDIVIDUAL',
            displayName: c.name,
            companyName: c.company ?? null,
            primaryPhone: c.phone ?? null,
            primaryEmail: c.email ?? null,
          },
        });
        customerIds.push(customer.id);
        if (c.phone) {
          await tx.customerIdentity.create({
            data: {
              tenantId: tenant.id,
              customerId: customer.id,
              identityType: 'PHONE',
              normalizedValue: c.phone,
              displayValue: c.phone,
              isPrimary: true,
            },
          });
        }
        if (c.email) {
          await tx.customerIdentity.create({
            data: {
              tenantId: tenant.id,
              customerId: customer.id,
              identityType: 'EMAIL',
              normalizedValue: c.email,
              displayValue: c.email,
              isPrimary: !c.phone,
            },
          });
        }
      }
      // Identitas marketplace untuk pelanggan pertama (Budi).
      await tx.customerIdentity.create({
        data: {
          tenantId: tenant.id,
          customerId: customerIds[0],
          identityType: 'MARKETPLACE_ACCOUNT',
          channelId: channelMock.id,
          externalId: 'mkt-buyer-8801',
          normalizedValue: 'mkt-buyer-8801',
          displayValue: 'mkt-buyer-8801',
        },
      });
      // Alamat contoh.
      await tx.customerAddress.create({
        data: {
          tenantId: tenant.id,
          customerId: customerIds[0],
          label: 'Rumah',
          recipientName: 'Budi Santoso',
          phone: '+628121000001',
          addressLine: 'Jl. Melati No. 10 RT 02/RW 05',
          city: 'Jakarta Pusat',
          province: 'DKI Jakarta',
          postalCode: '10310',
          isPrimary: true,
        },
      });

      // 10. Kandidat duplikat (2) — deterministik: telepon & email sama.
      const [dupPhoneA, dupPhoneB] = [customerIds[0], customerIds[13]].sort();
      await tx.customerMergeCandidate.create({
        data: {
          tenantId: tenant.id,
          customerAId: dupPhoneA,
          customerBId: dupPhoneB,
          score: 100,
          reasons: [
            { code: 'PHONE_SAME', detail: 'Nomor telepon ternormalisasi sama', score: 80 },
            { code: 'NAME_SIMILAR', detail: 'Kemiripan nama 50%', score: 20 },
          ] as Prisma.InputJsonValue,
        },
      });
      const [dupEmailA, dupEmailB] = [customerIds[1], customerIds[14]].sort();
      await tx.customerMergeCandidate.create({
        data: {
          tenantId: tenant.id,
          customerAId: dupEmailA,
          customerBId: dupEmailB,
          score: 100,
          reasons: [
            { code: 'EMAIL_SAME', detail: 'Email ternormalisasi sama', score: 80 },
            { code: 'NAME_SIMILAR', detail: 'Kemiripan nama 67%', score: 20 },
          ] as Prisma.InputJsonValue,
        },
      });

      // 11. Contoh merge history: "Agus W (duplikat lama)" telah digabung ke Agus Wijaya.
      const mergedSource = await tx.customer.create({
        data: {
          tenantId: tenant.id,
          displayName: 'Agus W (duplikat lama)',
          primaryPhone: '+628121000003',
          status: 'MERGED',
          mergedIntoId: customerIds[2],
        },
      });
      const ownerUser = await tx.user.findUniqueOrThrow({
        where: { email: 'owner@demo.flowniaga.local' },
      });
      await tx.customerMergeHistory.create({
        data: {
          tenantId: tenant.id,
          sourceCustomerId: mergedSource.id,
          targetCustomerId: customerIds[2],
          snapshotBefore: {
            source: { displayName: 'Agus W (duplikat lama)', primaryPhone: '+628121000003' },
            target: { displayName: 'Agus Wijaya', primaryPhone: '+628121000003' },
          } as Prisma.InputJsonValue,
          mergeStrategy: { keepFromSource: [] } as Prisma.InputJsonValue,
          performedBy: ownerUser.id,
          reason: 'Contoh data demo: nomor telepon sama, digabung manual.',
        },
      });

      // 12. Audit log pembuatan tenant demo.
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
      console.log(
        `Katalog: ${categoryNames.length} kategori, ${productSpecs.length} produk, ${Object.keys(variantIds).length} variant, 3 kanal, ${listingSpecs.length} listing.`,
      );
      console.log(`Pelanggan: ${customerSpecs.length + 1} (2 kandidat duplikat, 1 merge history).`);
      console.log(`Akun demo (kata sandi: ${DEMO_PASSWORD}):`);
      for (const u of DEMO_USERS) console.log(`  - ${u.email} (${u.role})`);
    },
    { timeout: 120000 },
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
