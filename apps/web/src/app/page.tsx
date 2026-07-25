'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge, Card } from '@flowniaga/ui';
import { AppShell } from '@/components/app-shell';
import { apiFetch } from '@/lib/api';

interface DashboardSummary {
  tenant: { id: string; name: string; slug: string };
  generatedAt: string;
  counts: { branches: number; warehouses: number; activeMembers: number };
  metrics: {
    revenueToday: number | null;
    newOrdersToday: number | null;
    criticalStockItems: number | null;
    unmatchedPayments: number | null;
    note: string;
  };
  recentActivity: {
    id: string;
    action: string;
    entityType: string;
    createdAt: string;
    user: { name: string } | null;
  }[];
}

const dateFormat = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Jakarta',
});

export default function RingkasanPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => apiFetch<DashboardSummary>('/dashboard/summary'),
  });

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Ringkasan</h1>
        {data && <Badge tone="success">{data.tenant.name}</Badge>}
      </div>

      {isLoading && (
        <div className="mt-8 grid gap-4 md:grid-cols-3" aria-busy="true">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-200" />
          ))}
        </div>
      )}

      {isError && (
        <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          <p className="font-medium">Gagal memuat ringkasan.</p>
          <p className="mt-1">
            {error instanceof Error ? error.message : 'Kesalahan tidak dikenal.'}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-3 rounded-lg bg-rose-600 px-3 py-1.5 text-white hover:bg-rose-500"
          >
            Coba lagi
          </button>
        </div>
      )}

      {data && (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Card title="Cabang">
              <p className="text-3xl font-bold">{data.counts.branches}</p>
            </Card>
            <Card title="Gudang">
              <p className="text-3xl font-bold">{data.counts.warehouses}</p>
            </Card>
            <Card title="Anggota aktif">
              <p className="text-3xl font-bold">{data.counts.activeMembers}</p>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Card title="Metrik bisnis">
              <p className="text-sm text-slate-500">{data.metrics.note}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-400">
                <span>Omzet hari ini: —</span>
                <span>Pesanan baru: —</span>
                <span>Stok kritis: —</span>
                <span>Pembayaran mismatch: —</span>
              </div>
            </Card>
            <Card title="Aktivitas terakhir">
              {data.recentActivity.length === 0 ? (
                <p className="text-sm text-slate-500">Belum ada aktivitas tercatat.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.recentActivity.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        <span className="font-medium">{a.action}</span>
                        {a.user ? ` — ${a.user.name}` : ''}
                      </span>
                      <time className="shrink-0 text-xs text-slate-400" dateTime={a.createdAt}>
                        {dateFormat.format(new Date(a.createdAt))}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <p className="mt-4 text-xs text-slate-400">
            Data per {dateFormat.format(new Date(data.generatedAt))} WIB
          </p>
        </>
      )}
    </AppShell>
  );
}
