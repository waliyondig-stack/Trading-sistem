'use client';

import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/app-shell';
import { apiFetch, ApiError } from '@/lib/api';

interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  user: { name: string; email: string } | null;
}

interface AuditResponse {
  data: AuditRow[];
  meta: { page: number; pageSize: number; total: number };
}

const dateFormat = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Jakarta',
});

export default function AktivitasPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => apiFetch<AuditResponse>('/audit-logs?page=1&pageSize=50'),
  });

  const forbidden = error instanceof ApiError && error.status === 403;

  return (
    <AppShell>
      <h1 className="text-xl font-bold text-slate-900">Aktivitas</h1>
      <p className="mt-1 text-sm text-slate-500">Jejak audit tindakan penting pada tenant Anda.</p>

      {isLoading && (
        <div className="mt-6 space-y-2" aria-busy="true">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-200" />
          ))}
        </div>
      )}

      {isError && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          {forbidden
            ? 'Anda tidak memiliki izin untuk melihat audit log. Hubungi pemilik usaha Anda.'
            : `Gagal memuat aktivitas: ${error instanceof Error ? error.message : 'kesalahan tidak dikenal'}`}
        </div>
      )}

      {data &&
        (data.data.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
            Belum ada aktivitas tercatat.
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Waktu (WIB)</th>
                  <th className="px-4 py-3">Aksi</th>
                  <th className="px-4 py-3">Entitas</th>
                  <th className="px-4 py-3">Pengguna</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                      {dateFormat.format(new Date(row.createdAt))}
                    </td>
                    <td className="px-4 py-3 font-medium">{row.action}</td>
                    <td className="px-4 py-3 text-slate-500">{row.entityType}</td>
                    <td className="px-4 py-3 text-slate-500">{row.user?.name ?? 'Sistem'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </AppShell>
  );
}
