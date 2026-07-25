/**
 * Acceptance test CSV import: preview tanpa simpan, error per baris,
 * confirm idempotent, retry tanpa duplikasi, error report, formula injection,
 * dan isolasi tenant.
 */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { authed, createTestApp, registerTenant, TenantFixture } from './helpers';
import { ImportService } from '../src/catalog/import.service';

const CSV_VALID = [
  'product_name,category,variant_name,internal_sku,barcode,cost_amount,selling_price,unit,status',
  'Kopi Import,Minuman Import,Kopi Import 250g,IMP-SKU-001,,45000,75000,pcs,ACTIVE',
  'Kopi Import,Minuman Import,Kopi Import 500g,IMP-SKU-002,,85000,140000,pcs,ACTIVE',
  'Teh Import,Minuman Import,Teh Import 100g,IMP-SKU-003,,15000,28000,pcs,aktif',
].join('\n');

const CSV_WITH_ERRORS = [
  'product_name,category,variant_name,internal_sku,barcode,cost_amount,selling_price,unit,status',
  'Produk Valid,Kat,Var A,ERR-SKU-001,,1000,2000,pcs,ACTIVE',
  ',Kat,Tanpa Nama,ERR-SKU-002,,1000,2000,pcs,ACTIVE', // product_name kosong
  'Harga Rusak,Kat,Var C,ERR-SKU-003,,abc,2000,pcs,ACTIVE', // cost invalid
  'Formula,Kat,Var D,ERR-SKU-004,=EVIL(),1000,2000,pcs,ACTIVE', // barcode formula
  'Duplikat,Kat,Var E,ERR-SKU-001,,1000,2000,pcs,ACTIVE', // duplikat dalam file
].join('\n');

function upload(app: INestApplication, fixture: TenantFixture, csv: string, name = 'produk.csv') {
  return request(app.getHttpServer())
    .post('/catalog-imports')
    .set(authed(fixture))
    .attach('file', Buffer.from(csv, 'utf8'), { filename: name, contentType: 'text/csv' });
}

describe('CSV Import', () => {
  let app: INestApplication;
  let tenantA: TenantFixture;
  let tenantB: TenantFixture;
  let importService: ImportService;

  beforeAll(async () => {
    app = await createTestApp();
    tenantA = await registerTenant(app, 'impa');
    tenantB = await registerTenant(app, 'impb');
    importService = app.get(ImportService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('Preview tidak langsung menyimpan data produk', async () => {
    const res = await upload(app, tenantA, CSV_VALID).expect(201);
    expect(res.body.status).toBe('PREVIEWED');
    expect(res.body.summary.validRows).toBe(3);
    const list = await request(app.getHttpServer())
      .get('/products?search=Kopi Import')
      .set(authed(tenantA))
      .expect(200);
    expect(list.body.data).toHaveLength(0);
  });

  it('Error satu baris tidak menggagalkan preview; error per baris tersedia', async () => {
    const res = await upload(app, tenantA, CSV_WITH_ERRORS).expect(201);
    expect(res.body.summary.invalidRows).toBe(3);
    expect(res.body.summary.duplicateInFileRows).toBe(1);
    expect(res.body.summary.validRows).toBe(1);
    const rowErrors = res.body.preview.filter((r: { errors: unknown[] }) => r.errors.length > 0);
    expect(rowErrors.length).toBe(3);
  });

  it('Confirm import idempotent + retry worker tidak membuat duplikasi', async () => {
    const preview = await upload(app, tenantA, CSV_VALID).expect(201);
    const jobId = preview.body.jobId;

    const first = await request(app.getHttpServer())
      .post(`/catalog-imports/${jobId}/confirm`)
      .set(authed(tenantA))
      .set('idempotency-key', `test-${jobId}`)
      .expect(200);
    expect(first.body.status).toBe('COMPLETED');
    expect(first.body.createdRows).toBe(3);

    // Confirm kedua (idempotent) — tidak memproses ulang.
    const second = await request(app.getHttpServer())
      .post(`/catalog-imports/${jobId}/confirm`)
      .set(authed(tenantA))
      .set('idempotency-key', `test-${jobId}`)
      .expect(200);
    expect(second.body.status).toBe('COMPLETED');

    // Simulasi retry worker: proses ulang job yang sama secara langsung.
    await importService.processImportJob(jobId);
    await importService.processImportJob(jobId);

    const list = await request(app.getHttpServer())
      .get('/products?search=Kopi Import')
      .set(authed(tenantA))
      .expect(200);
    // Tetap 1 produk "Kopi Import" (2 variant) + tidak ada duplikasi.
    expect(list.body.data).toHaveLength(1);
    const detail = await request(app.getHttpServer())
      .get(`/products/${list.body.data[0].id}`)
      .set(authed(tenantA))
      .expect(200);
    expect(detail.body.variants).toHaveLength(2);
  });

  it('Error report CSV tersedia dan formula dinetralisasi', async () => {
    const preview = await upload(app, tenantA, CSV_WITH_ERRORS).expect(201);
    const jobId = preview.body.jobId;
    await request(app.getHttpServer())
      .post(`/catalog-imports/${jobId}/confirm`)
      .set(authed(tenantA))
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`/catalog-imports/${jobId}/errors.csv`)
      .set(authed(tenantA))
      .expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const text = res.text;
    expect(text).toContain('row,field,value,code,message');
    // Barcode formula dinetralisasi dengan prefix kutip.
    expect(text).toContain("'=EVIL()");
    expect(text).not.toMatch(/(^|,)"?=EVIL/m);
  });

  it('Import Tenant A tidak mengubah produk Tenant B (SKU sama, tenant beda)', async () => {
    // Tenant B punya produk dengan SKU yang juga ada di file import Tenant A.
    await request(app.getHttpServer())
      .post('/products')
      .set(authed(tenantB))
      .send({
        name: 'Produk Milik B',
        variants: [{ name: 'Var B', internalSku: 'IMP-SKU-001', sellingPrice: 999999 }],
      })
      .expect(201);

    // Import tenant A sudah berjalan pada test sebelumnya (IMP-SKU-001 → 75000).
    const bVariant = await request(app.getHttpServer())
      .get('/variants/lookup?sku=IMP-SKU-001')
      .set(authed(tenantB))
      .expect(200);
    expect(bVariant.body.sellingPrice).toBe(999999);
    expect(bVariant.body.product.name).toBe('Produk Milik B');

    // Job import tenant A tidak terlihat oleh tenant B.
    const jobsB = await request(app.getHttpServer())
      .get('/catalog-imports')
      .set(authed(tenantB))
      .expect(200);
    expect(jobsB.body).toHaveLength(0);
  });

  it('Cashier tidak boleh menjalankan import (permission)', async () => {
    const roles = await request(app.getHttpServer()).get('/roles').set(authed(tenantA)).expect(200);
    const cashierRole = roles.body.find((r: { name: string }) => r.name === 'Cashier');
    const invite = await request(app.getHttpServer())
      .post('/members')
      .set(authed(tenantA))
      .send({
        email: `kasir-imp-${tenantA.tenantId.slice(0, 8)}@test.flowniaga.local`,
        roleId: cashierRole.id,
        name: 'Kasir Import',
        initialPassword: 'KasirUjian123!',
      })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: invite.body.email, password: 'KasirUjian123!' })
      .expect(200);
    const res = await request(app.getHttpServer())
      .post('/catalog-imports')
      .set({ Authorization: `Bearer ${login.body.accessToken}`, 'x-tenant-id': tenantA.tenantId })
      .attach('file', Buffer.from(CSV_VALID), { filename: 'x.csv', contentType: 'text/csv' })
      .expect(403);
    expect(res.body.error.code).toBe('PERMISSION_DENIED');
  });
});
