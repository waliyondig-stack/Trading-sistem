'use client';

/**
 * Klien API FlowNiaga (ADR-005).
 *
 * Autentikasi memakai cookie httpOnly yang diset server — TIDAK ADA token di
 * localStorage/sessionStorage. JavaScript hanya membaca cookie CSRF
 * (non-httpOnly) untuk double-submit pada request mutasi.
 * Yang disimpan di localStorage hanya tenant aktif (bukan rahasia).
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const TENANT_KEY = 'flowniaga.tenantId';
const CSRF_COOKIE = 'fn_csrf';

export const session = {
  get tenantId() {
    return typeof window === 'undefined' ? null : localStorage.getItem(TENANT_KEY);
  },
  setTenant(tenantId: string) {
    localStorage.setItem(TENANT_KEY, tenantId);
  },
  clearTenant() {
    localStorage.removeItem(TENANT_KEY);
  },
};

function readCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const method = (init.method ?? 'GET').toUpperCase();
  if (!(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const tenantId = session.tenantId;
  if (tenantId) headers.set('x-tenant-id', tenantId);
  if (MUTATING.has(method)) {
    const csrf = readCsrfToken();
    if (csrf) headers.set('x-csrf-token', csrf);
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = body?.error ?? {};
    throw new ApiError(res.status, err.code ?? 'UNKNOWN', err.message ?? 'Terjadi kesalahan.');
  }
  return body as T;
}

export async function logout(): Promise<void> {
  try {
    await apiFetch('/auth/logout', { method: 'POST', body: JSON.stringify({}) });
  } finally {
    session.clearTenant();
  }
}

export const formatRupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);

export const formatTanggal = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(iso));
