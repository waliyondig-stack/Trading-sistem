/**
 * Acceptance test kritis: RBAC.
 * - Cashier tidak dapat mengubah role/permission (default deny di backend).
 * - Owner dapat mengelola anggota; perubahan tercatat di audit log.
 */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { authed, createTestApp, registerTenant, TenantFixture } from './helpers';

describe('RBAC', () => {
  let app: INestApplication;
  let owner: TenantFixture;
  let cashierToken: string;
  let cashierMembershipId: string;
  let roleIds: Record<string, string>;

  beforeAll(async () => {
    app = await createTestApp();
    owner = await registerTenant(app, 'rbac');

    const rolesRes = await request(app.getHttpServer())
      .get('/roles')
      .set(authed(owner))
      .expect(200);
    roleIds = Object.fromEntries(
      rolesRes.body.map((r: { name: string; id: string }) => [r.name, r.id]),
    );

    const inviteRes = await request(app.getHttpServer())
      .post('/members')
      .set(authed(owner))
      .send({
        email: `kasir-${owner.tenantId.slice(0, 8)}@test.flowniaga.local`,
        roleId: roleIds['Cashier'],
        name: 'Kasir Uji',
        initialPassword: 'KasirUjian123!',
      })
      .expect(201);
    cashierMembershipId = inviteRes.body.membershipId;

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: inviteRes.body.email, password: 'KasirUjian123!' })
      .expect(200);
    cashierToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  const cashierHeaders = () => ({
    Authorization: `Bearer ${cashierToken}`,
    'x-tenant-id': owner.tenantId,
  });

  it('Cashier dapat membaca cabang (permission branch.read dimiliki)', async () => {
    await request(app.getHttpServer()).get('/branches').set(cashierHeaders()).expect(200);
  });

  it('Cashier TIDAK dapat membuat cabang (403 PERMISSION_DENIED)', async () => {
    const res = await request(app.getHttpServer())
      .post('/branches')
      .set(cashierHeaders())
      .send({ code: 'X-99', name: 'Cabang Ilegal' })
      .expect(403);
    expect(res.body.error.code).toBe('PERMISSION_DENIED');
  });

  it('Cashier TIDAK dapat mengubah role anggota', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/members/${cashierMembershipId}`)
      .set(cashierHeaders())
      .send({ roleId: roleIds['Owner'] })
      .expect(403);
    expect(res.body.error.code).toBe('PERMISSION_DENIED');
  });

  it('Cashier TIDAK dapat melihat daftar role', async () => {
    const res = await request(app.getHttpServer()).get('/roles').set(cashierHeaders()).expect(403);
    expect(res.body.error.code).toBe('PERMISSION_DENIED');
  });

  it('Owner dapat mengubah role anggota dan tercatat di audit log', async () => {
    await request(app.getHttpServer())
      .patch(`/members/${cashierMembershipId}`)
      .set(authed(owner))
      .send({ roleId: roleIds['Manager'] })
      .expect(200);

    const audit = await request(app.getHttpServer())
      .get('/audit-logs?action=member.updated')
      .set(authed(owner))
      .expect(200);
    expect(audit.body.data.length).toBeGreaterThanOrEqual(1);
    expect(audit.body.data[0].entityId).toBe(cashierMembershipId);
  });

  it('Owner terakhir tidak dapat diturunkan (LAST_OWNER)', async () => {
    const members = await request(app.getHttpServer())
      .get('/members')
      .set(authed(owner))
      .expect(200);
    const ownerMembership = members.body.find(
      (m: { role: { name: string } }) => m.role.name === 'Owner',
    );
    const res = await request(app.getHttpServer())
      .patch(`/members/${ownerMembership.membershipId}`)
      .set(authed(owner))
      .send({ roleId: roleIds['Staff'] })
      .expect(409);
    expect(res.body.error.code).toBe('LAST_OWNER');
  });
});
