'use client';

import { ApiError } from '@/lib/api';

/** State standar halaman: loading, empty, error, unauthorized. */

export function LoadingRows({ count = 5 }: { count?: number }) {
  return (
    <div className="mt-6 space-y-2" aria-busy="true" aria-label="Memuat data">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-200" />
      ))}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
      <p className="font-medium text-slate-700">{title}</p>
      {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (error instanceof ApiError && error.status === 403) {
    return (
      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        <p className="font-medium">Akses ditolak</p>
        <p className="mt-1">
          Anda tidak memiliki izin untuk fitur ini. Hubungi pemilik usaha bila membutuhkan akses.
        </p>
      </div>
    );
  }
  return (
    <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
      <p className="font-medium">Terjadi kesalahan.</p>
      <p className="mt-1">{error instanceof Error ? error.message : 'Kesalahan tidak dikenal.'}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-lg bg-rose-600 px-3 py-1.5 text-white hover:bg-rose-500"
        >
          Coba lagi
        </button>
      )}
    </div>
  );
}

export const inputCls =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200';
export const btnPrimary =
  'rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60';
export const btnSecondary =
  'rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60';
