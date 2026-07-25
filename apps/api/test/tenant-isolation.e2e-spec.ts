/**
 * Acceptance test kritis: isolasi antar-tenant.
 * - Tenant A tidak dapat membaca data Tenant B (dan sebaliknya).
 * - Tenant A tidak dapat mengubah data Tenant B.
 * - Percobaan akses lintas tenant ditolak backend, bukan frontend.
 */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { authed, createTestApp, registerTenant, TenantFixture } from './helpers';

describe('Tenant isolation', () => {
  let app: INestApplication;
  let tenantA: TenantFixture;
  let tenantB: TenantFixture;
  let branchAId: string;

  beforeAll(async () => {
    app = await createTestApp();
    tenantA = await registerTenant(app, 'isoa');
    tenantB = await registerTenant(app, 'isob');
    const res = await request(app.getHttpServer())
      .post('/branches')
      .set(authed(tenantA))
      .send({ code: 'A-01', name: 'Cabang Milik A' })
      .expect(201);
    branchAId = res.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('Tenant B tidak melihat cabang Tenant A', async () => {
    const res = await request(app.getHttpServer())
      .get('/branches')
      .set(authed(tenantB))
      .expect(200);
    const ids = res.body.map((b: { id: string }) => b.id);
    expect(ids).not.toContain(branchAId);
  });

  it('User B ditolak saat memakai header tenant A (403 TENANT_ACCESS_DENIED)', async () => {
    const res = await request(app.getHttpServer())
      .get('/branches')
      .set({ Authorization: `Bearer ${tenantB.accessToken}`, 'x-tenant-id': tenantA.tenantId })
      .expect(403);
    expect(res.body.error.code).toBe('TENANT_ACCESS_DENIED');
  });

  it('User B tidak dapat membaca detail cabang Tenant A lewat tenant sendiri (404)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/branches/${branchAId}`)
      .set(authed(tenantB))
      .expect(404);
    expect(res.body.error.code).toBe('BRANCH_NOT_FOUND');
  });

  it('User B tidak dapat mengubah cabang Tenant A', async () => {
    // Lewat tenant B sendiri: entity tidak ditemukan (tenant scope di query).
    await request(app.getHttpServer())
      .patch(`/branches/${branchAId}`)
      .set(authed(tenantB))
      .send({ name: 'Dibajak' })
      .expect(404);
    // Lewat header tenant A: membership tidak ada → ditolak.
    await request(app.getHttpServer())
      .patch(`/branches/${branchAId}`)
      .set({ Authorization: `Bearer ${tenantB.accessToken}`, 'x-tenant-id': tenantA.tenantId })
      .send({ name: 'Dibajak' })
      .expect(403);
    // Data asli tidak berubah.
    const res = await request(app.getHttpServer())
      .get(`/branches/${branchAId}`)
      .set(authed(tenantA))
      .expect(200);
    expect(res.body.name).toBe('Cabang Milik A');
  });

  it('Dashboard tenant B tidak menghitung data tenant A', async () => {
    const res = await request(app.getHttpServer())
      .get('/dashboard/summary')
      .set(authed(tenantB))
      .expect(200);
    expect(res.body.tenant.id).toBe(tenantB.tenantId);
    expect(res.body.counts.branches).toBe(0);
  });

  it('Audit log tenant A mencatat pembuatan cabang (critical action)', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit-logs')
      .set(authed(tenantA))
      .expect(200);
    const actions = res.body.data.map((r: { action: string }) => r.action);
    expect(actions).toContain('branch.created');
    expect(actions).toContain('tenant.created');
  });

  it('Audit log tenant A tidak bocor ke tenant B', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit-logs')
      .set(authed(tenantB))
      .expect(200);
    const entityIds = res.body.data.map((r: { entityId: string | null }) => r.entityId);
    expect(entityIds).not.toContain(branchAId);
  });
});
