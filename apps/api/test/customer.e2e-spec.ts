/**
 * Acceptance test Customer: normalisasi, deteksi duplikat deterministik,
 * manual merge (permission, atomic, history, source preserved, identity
 * conflict), dan isolasi tenant.
 */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { authed, createTestApp, registerTenant, TenantFixture } from './helpers';

describe('Customer', () => {
  let app: INestApplication;
  let tenantA: TenantFixture;
  let tenantB: TenantFixture;

  beforeAll(async () => {
    app = await createTestApp();
    tenantA = await registerTenant(app, 'cusa');
    tenantB = await registerTenant(app, 'cusb');
  });

  afterAll(async () => {
    await app.close();
  });

  const createCustomer = (fixture: TenantFixture, body: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/customers').set(authed(fixture)).send(body);

  it('Nomor telepon dinormalisasi ke format +62', async () => {
    const res = await createCustomer(tenantA, {
      displayName: 'Norma Telepon',
      primaryPhone: '0812-9999-0001',
    }).expect(201);
    expect(res.body.primaryPhone).toBe('+6281299990001');
  });

  it('Email dinormalisasi (lowercase + trim)', async () => {
    const res = await createCustomer(tenantA, {
      displayName: 'Norma Email',
      primaryEmail: '  Norma.Email@Contoh.ID ',
    }).expect(201);
    expect(res.body.primaryEmail).toBe('norma.email@contoh.id');
  });

  it('Duplikat telepon persis membuat merge candidate (bukan merge otomatis)', async () => {
    await createCustomer(tenantA, {
      displayName: 'Dodi Asli',
      primaryPhone: '081277770001',
    }).expect(201);
    const second = await createCustomer(tenantA, {
      displayName: 'Dodi Duplikat',
      primaryPhone: '+6281277770001',
    }).expect(201);
    expect(second.body.duplicateCandidatesCreated).toBeGreaterThanOrEqual(1);
    // Kedua customer tetap ACTIVE — tidak ada merge otomatis.
    expect(second.body.status).toBe('ACTIVE');

    const candidates = await request(app.getHttpServer())
      .get('/customers/merge-candidates')
      .set(authed(tenantA))
      .expect(200);
    const found = candidates.body.find(
      (c: { customerA: { displayName: string }; customerB: { displayName: string } }) =>
        [c.customerA.displayName, c.customerB.displayName].includes('Dodi Duplikat'),
    );
    expect(found).toBeDefined();
    expect(found.score).toBeGreaterThanOrEqual(60);
    expect(found.reasons.some((r: { code: string }) => r.code === 'PHONE_SAME')).toBe(true);
  });

  it('Duplikat email persis membuat merge candidate', async () => {
    await createCustomer(tenantA, {
      displayName: 'Eka Satu',
      primaryEmail: 'eka@contoh.id',
    }).expect(201);
    const res = await createCustomer(tenantA, {
      displayName: 'Eka Dua',
      primaryEmail: 'EKA@contoh.id',
    }).expect(201);
    expect(res.body.duplicateCandidatesCreated).toBeGreaterThanOrEqual(1);
  });

  it('Nama mirip saja TIDAK membuat candidate dan tidak ada merge otomatis', async () => {
    await createCustomer(tenantA, { displayName: 'Fajar Nugroho Pratama' }).expect(201);
    const res = await createCustomer(tenantA, { displayName: 'Fajar Nugroho' }).expect(201);
    expect(res.body.duplicateCandidatesCreated).toBe(0);
    expect(res.body.status).toBe('ACTIVE');
  });

  it('Manual merge memerlukan permission customer.merge.execute (Sales ditolak)', async () => {
    const roles = await request(app.getHttpServer()).get('/roles').set(authed(tenantA)).expect(200);
    const salesRole = roles.body.find((r: { name: string }) => r.name === 'Sales');
    const invite = await request(app.getHttpServer())
      .post('/members')
      .set(authed(tenantA))
      .send({
        email: `sales-${tenantA.tenantId.slice(0, 8)}@test.flowniaga.local`,
        roleId: salesRole.id,
        name: 'Sales Uji',
        initialPassword: 'SalesUjian123!',
      })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: invite.body.email, password: 'SalesUjian123!' })
      .expect(200);

    const c1 = await createCustomer(tenantA, { displayName: 'Merge Uji 1' }).expect(201);
    const c2 = await createCustomer(tenantA, { displayName: 'Merge Uji 2' }).expect(201);

    // Sales boleh preview (merge.review) tetapi TIDAK boleh execute.
    const salesHeaders = {
      Authorization: `Bearer ${login.body.accessToken}`,
      'x-tenant-id': tenantA.tenantId,
    };
    await request(app.getHttpServer())
      .post('/customers/merge/preview')
      .set(salesHeaders)
      .send({ targetCustomerId: c1.body.id, sourceCustomerId: c2.body.id })
      .expect(200);
    const denied = await request(app.getHttpServer())
      .post('/customers/merge/execute')
      .set(salesHeaders)
      .send({ targetCustomerId: c1.body.id, sourceCustomerId: c2.body.id, reason: 'uji' })
      .expect(403);
    expect(denied.body.error.code).toBe('PERMISSION_DENIED');
  });

  it('Merge atomic: identity & address pindah, history tersimpan, source tidak hilang', async () => {
    const target = await createCustomer(tenantA, {
      displayName: 'Gina Master',
      primaryPhone: '081266660001',
    }).expect(201);
    const source = await createCustomer(tenantA, {
      displayName: 'Gina Lama',
      primaryEmail: 'gina@contoh.id',
      notes: 'Catatan penting dari data lama',
    }).expect(201);
    await request(app.getHttpServer())
      .post(`/customers/${source.body.id}/addresses`)
      .set(authed(tenantA))
      .send({
        recipientName: 'Gina',
        addressLine: 'Jl. Kenanga No. 2',
        city: 'Bandung',
        province: 'Jawa Barat',
      })
      .expect(201);

    // Preview tidak mengubah data.
    const preview = await request(app.getHttpServer())
      .post('/customers/merge/preview')
      .set(authed(tenantA))
      .send({
        targetCustomerId: target.body.id,
        sourceCustomerId: source.body.id,
        keepFromSource: ['notes'],
      })
      .expect(200);
    expect(preview.body.willMove.addresses).toBe(1);
    const sourceStillActive = await request(app.getHttpServer())
      .get(`/customers/${source.body.id}`)
      .set(authed(tenantA))
      .expect(200);
    expect(sourceStillActive.body.status).toBe('ACTIVE');

    // Eksekusi.
    const exec = await request(app.getHttpServer())
      .post('/customers/merge/execute')
      .set(authed(tenantA))
      .send({
        targetCustomerId: target.body.id,
        sourceCustomerId: source.body.id,
        keepFromSource: ['notes'],
        reason: 'Pelanggan yang sama, konfirmasi via telepon.',
      })
      .expect(200);
    expect(exec.body.merged).toBe(true);
    expect(exec.body.mergeHistoryId).toBeTruthy();

    // Target: field strategi diterapkan, identity+address pindah.
    const targetAfter = await request(app.getHttpServer())
      .get(`/customers/${target.body.id}`)
      .set(authed(tenantA))
      .expect(200);
    expect(targetAfter.body.notes).toBe('Catatan penting dari data lama');
    expect(targetAfter.body.addresses).toHaveLength(1);
    expect(
      targetAfter.body.identities.some(
        (i: { normalizedValue: string }) => i.normalizedValue === 'gina@contoh.id',
      ),
    ).toBe(true);

    // Source: MERGED, tidak dihapus permanen, menunjuk target.
    const sourceAfter = await request(app.getHttpServer())
      .get(`/customers/${source.body.id}`)
      .set(authed(tenantA))
      .expect(200);
    expect(sourceAfter.body.status).toBe('MERGED');
    expect(sourceAfter.body.mergedInto.id).toBe(target.body.id);

    // History tersimpan dengan snapshot.
    const history = await request(app.getHttpServer())
      .get(`/customers/merge-history?customerId=${target.body.id}`)
      .set(authed(tenantA))
      .expect(200);
    expect(history.body[0].source.id).toBe(source.body.id);

    // Audit customer.merged tercatat.
    const audit = await request(app.getHttpServer())
      .get('/audit-logs?action=customer.merged')
      .set(authed(tenantA))
      .expect(200);
    expect(audit.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('Identity conflict: identity terverifikasi tidak boleh di dua customer aktif', async () => {
    const c1 = await createCustomer(tenantA, { displayName: 'Verif Satu' }).expect(201);
    const c2 = await createCustomer(tenantA, { displayName: 'Verif Dua' }).expect(201);
    await request(app.getHttpServer())
      .post(`/customers/${c1.body.id}/identities`)
      .set(authed(tenantA))
      .send({ identityType: 'PHONE', value: '081255550009', verificationStatus: 'VERIFIED' })
      .expect(201);
    const conflict = await request(app.getHttpServer())
      .post(`/customers/${c2.body.id}/identities`)
      .set(authed(tenantA))
      .send({ identityType: 'PHONE', value: '0812-5555-0009', verificationStatus: 'VERIFIED' })
      .expect(409);
    expect(conflict.body.error.code).toBe('IDENTITY_CONFLICT');
  });

  // ---------- Isolasi tenant ----------

  it('Tenant B tidak melihat pelanggan Tenant A', async () => {
    const a = await createCustomer(tenantA, { displayName: 'Rahasia Tenant A' }).expect(201);
    const list = await request(app.getHttpServer())
      .get('/customers?search=Rahasia Tenant A')
      .set(authed(tenantB))
      .expect(200);
    expect(list.body.data).toHaveLength(0);
    await request(app.getHttpServer())
      .get(`/customers/${a.body.id}`)
      .set(authed(tenantB))
      .expect(404);
  });

  it('Tenant B tidak melihat merge candidate Tenant A', async () => {
    const candidatesB = await request(app.getHttpServer())
      .get('/customers/merge-candidates')
      .set(authed(tenantB))
      .expect(200);
    const namesA = ['Dodi Asli', 'Dodi Duplikat', 'Eka Satu', 'Eka Dua'];
    for (const c of candidatesB.body) {
      expect(namesA).not.toContain(c.customerA.displayName);
      expect(namesA).not.toContain(c.customerB.displayName);
    }
  });

  it('Tenant B tidak dapat menjalankan merge pada pelanggan Tenant A', async () => {
    const a1 = await createCustomer(tenantA, { displayName: 'Lintas Uji 1' }).expect(201);
    const a2 = await createCustomer(tenantA, { displayName: 'Lintas Uji 2' }).expect(201);
    const res = await request(app.getHttpServer())
      .post('/customers/merge/execute')
      .set(authed(tenantB))
      .send({
        targetCustomerId: a1.body.id,
        sourceCustomerId: a2.body.id,
        reason: 'percobaan lintas tenant',
      })
      .expect(404);
    expect(res.body.error.code).toBe('CUSTOMER_NOT_FOUND');
    // Data tenant A tidak berubah.
    const check = await request(app.getHttpServer())
      .get(`/customers/${a2.body.id}`)
      .set(authed(tenantA))
      .expect(200);
    expect(check.body.status).toBe('ACTIVE');
  });
});
