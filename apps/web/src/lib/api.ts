'use client';

/**
 * Klien API sederhana untuk Fase 1.
 * Token & tenant aktif disimpan di localStorage (MVP; akan dievaluasi
 * ulang ke httpOnly cookie pada fase hardening).
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const TOKEN_KEY = 'flowniaga.accessToken';
const REFRESH_KEY = 'flowniaga.refreshToken';
const TENANT_KEY = 'flowniaga.tenantId';

export const session = {
  get accessToken() {
    return typeof window === 'undefined' ? null : localStorage.getItem(TOKEN_KEY);
  },
  get refreshToken() {
    return typeof window === 'undefined' ? null : localStorage.getItem(REFRESH_KEY);
  },
  get tenantId() {
    return typeof window === 'undefined' ? null : localStorage.getItem(TENANT_KEY);
  },
  save(tokens: { accessToken: string; refreshToken: string }, tenantId?: string) {
    localStorage.setItem(TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
    if (tenantId) localStorage.setItem(TENANT_KEY, tenantId);
  },
  setTenant(tenantId: string) {
    localStorage.setItem(TENANT_KEY, tenantId);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(TENANT_KEY);
  },
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const token = session.accessToken;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const tenantId = session.tenantId;
  if (tenantId) headers.set('x-tenant-id', tenantId);

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = body?.error ?? {};
    throw new ApiError(res.status, err.code ?? 'UNKNOWN', err.message ?? 'Terjadi kesalahan.');
  }
  return body as T;
}
