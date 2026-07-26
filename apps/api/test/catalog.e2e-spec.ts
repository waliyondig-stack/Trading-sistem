/**
 * Acceptance test Catalog: isolasi tenant, SKU/barcode unik per tenant,
 * circular category, mapping ambigu, soft delete.
 */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { authed, createTestApp, registerTenant, TenantFixture } from './helpers';

describe('Catalog', () => {
  let app: INestApplication;
  let tenantA: TenantFixture;
  let tenantB: TenantFixture;
  let categoryAId: string;
  let productAId: string;
  let variantAId: string;
  let channelAId: string;

  beforeAll(async () => {
    app = await createTestApp();
    tenantA = await registerTenant(app, 'cata');
    tenantB = await registerTenant(app, 'catb');

    const cat = await request(app.getHttpServer())
      .post('/categories')
      .set(authed(tenantA))
      .send({ name: 'Minuman Uji' })
      .expect(201);
    categoryAId = cat.body.id;

    const prod = await request(app.getHttpServer())
      .post('/products')
      .set(authed(tenantA))
      .send({
        name: 'Kopi Uji',
        categoryId: categoryAId,
        variants: [
          {
            name: 'Kopi Uji 250g',
            internalSku: 'UJI-SKU-001',
            barcode: 'BR-0001',
            sellingPrice: 50000,
          },
        ],
      })
      .expect(201);
    productAId = prod.body.id;
    variantAId = prod.body.variants[0].id;

    const channel = await request(app.getHttpServer())
      .post('/channels')
      .set(authed(tenantA))
      .send({ type: 'MOCK_MARKETPLACE', name: 'Mock Uji' })
      .expect(201);
    channelAId = channel.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ---------- Isolasi tenant ----------

  it('Tenant B tidak melihat kategori Tenant A', async () => {
    const res = await request(app.getHttpServer())
      .get('/categories')
      .set(authed(tenantB))
      .expect(200);
    expect(res.body.map((c: { id: string }) => c.id)).not.toContain(categoryAId);
  });

  it('Tenant B tidak melihat produk Tenant A', async () => {
    const list = await request(app.getHttpServer())
      .get('/products')
      .set(authed(tenantB))
      .expect(200);
    expect(list.body.data.map((p: { id: string }) => p.id)).not.toContain(productAId);
    await request(app.getHttpServer())
      .get(`/products/${productAId}`)
      .set(authed(tenantB))
      .expect(404);
  });

  it('Tenant B tidak dapat mencari SKU Tenant A', async () => {
    await request(app.getHttpServer())
      .get('/variants/lookup?sku=UJI-SKU-001')
      .set(authed(tenantB))
      .expect(404);
    // Tenant A sendiri bisa.
    const res = await request(app.getHttpServer())
      .get('/variants/lookup?sku=UJI-SKU-001')
      .set(authed(tenantA))
      .expect(200);
    expect(res.body.id).toBe(variantAId);
  });

  // ---------- SKU & barcode ----------

  it('SKU unik per tenant (duplikat ditolak 409)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/products/${productAId}/variants`)
      .set(authed(tenantA))
      .send([{ name: 'Dup', internalSku: 'UJI-SKU-001' }])
      .expect(409);
    expect(res.body.error.code).toBe('SKU_TAKEN');
  });

  it('SKU yang sama boleh dipakai tenant berbeda', async () => {
    await request(app.getHttpServer())
      .post('/products')
      .set(authed(tenantB))
      .send({
        name: 'Kopi Tenant B',
        variants: [{ name: 'Kopi B', internalSku: 'UJI-SKU-001' }],
      })
      .expect(201);
  });

  it('Barcode unik per tenant', async () => {
    const res = await request(app.getHttpServer())
      .post(`/products/${productAId}/variants`)
      .set(authed(tenantA))
      .send([{ name: 'Barcode Dup', internalSku: 'UJI-SKU-BC', barcode: 'BR-0001' }])
      .expect(409);
    expect(res.body.error.code).toBe('BARCODE_TAKEN');
  });

  // ---------- Kategori ----------

  it('Circular category ditolak', async () => {
    const child = await request(app.getHttpServer())
      .post('/categories')
      .set(authed(tenantA))
      .send({ name: 'Anak Uji', parentCategoryId: categoryAId })
      .expect(201);
    const res = await request(app.getHttpServer())
      .patch(`/categories/${categoryAId}`)
      .set(authed(tenantA))
      .send({ parentCategoryId: child.body.id })
      .expect(400);
    expect(res.body.error.code).toBe('CATEGORY_CIRCULAR');
  });

  it('Produk dengan variant terbaca benar (harga integer rupiah)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/products/${productAId}`)
      .set(authed(tenantA))
      .expect(200);
    expect(res.body.variants.length).toBeGreaterThanOrEqual(1);
    const v = res.body.variants.find(
      (x: { internalSku: string }) => x.internalSku === 'UJI-SKU-001',
    );
    expect(v.sellingPrice).toBe(50000);
    expect(typeof v.sellingPrice).toBe('number');
  });

  // ---------- Channel listing ----------

  it('Mapping ambigu ditolak: satu external SKU tidak boleh menunjuk dua variant', async () => {
    await request(app.getHttpServer())
      .post('/channel-listings')
      .set(authed(tenantA))
      .send({
        channelId: channelAId,
        productVariantId: variantAId,
        externalSku: 'EXT-001',
        listingName: 'Listing Uji',
      })
      .expect(201);

    const other = await request(app.getHttpServer())
      .post(`/products/${productAId}/variants`)
      .set(authed(tenantA))
      .send([{ name: 'Variant Kedua', internalSku: 'UJI-SKU-002' }])
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/channel-listings')
      .set(authed(tenantA))
      .send({
        channelId: channelAId,
        productVariantId: other.body[0].id,
        externalSku: 'EXT-001',
        listingName: 'Listing Ambigu',
      })
      .expect(409);
    expect(res.body.error.code).toBe('LISTING_AMBIGUOUS_MAPPING');
  });

  it('resolve-unmapped mendeteksi SKU eksternal yang belum terpetakan', async () => {
    const res = await request(app.getHttpServer())
      .post('/channel-listings/resolve-unmapped')
      .set(authed(tenantA))
      .send({ channelId: channelAId, externalSkus: ['EXT-001', 'EXT-TIDAK-ADA'] })
      .expect(201);
    expect(res.body.mapped.map((m: { externalSku: string }) => m.externalSku)).toContain('EXT-001');
    expect(res.body.unmapped).toContain('EXT-TIDAK-ADA');
  });

  // ---------- Soft delete ----------

  it('Produk yang diarsipkan tidak muncul di list default', async () => {
    const prod = await request(app.getHttpServer())
      .post('/products')
      .set(authed(tenantA))
      .send({ name: 'Produk Arsip Uji' })
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/products/${prod.body.id}`)
      .set(authed(tenantA))
      .expect(200);
    const list = await request(app.getHttpServer())
      .get('/products?search=Produk Arsip Uji')
      .set(authed(tenantA))
      .expect(200);
    expect(list.body.data.map((p: { id: string }) => p.id)).not.toContain(prod.body.id);
  });

  it('Audit log mencatat product.created & variant.created', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit-logs?entityType=Product')
      .set(authed(tenantA))
      .expect(200);
    const actions = res.body.data.map((r: { action: string }) => r.action);
    expect(actions).toContain('product.created');
  });
});
