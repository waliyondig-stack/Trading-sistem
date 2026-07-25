'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge } from '@flowniaga/ui';
import { AppShell } from '@/components/app-shell';
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@/components/states';
import { apiFetch } from '@/lib/api';

interface CustomerRow {
  id: string;
  displayName: string;
  type: 'INDIVIDUAL' | 'BUSINESS';
  status: 'ACTIVE' | 'INACTIVE' | 'MERGED';
  primaryPhone: string | null;
  primaryEmail: string | null;
  hasPendingDuplicate: boolean;
  _count: { identities: number; addresses: number };
}

interface CustomerList {
  data: CustomerRow[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export default function PelangganPage() {
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (search) params.set('search', search);
  if (type) params.set('type', type);
  if (status) params.set('status', status);

  const query = useQuery({
    queryKey: ['customers', search, type, status, page],
    queryFn: () => apiFetch<CustomerList>(`/customers?${params.toString()}`),
  });

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">Pelanggan</h1>
        <div className="flex gap-2">
          <Link href="/pelanggan/duplikat" className={btnSecondary}>
            Kandidat Duplikat
          </Link>
          <Link href="/pelanggan/baru" className={btnPrimary}>
            + Buat Pelanggan
          </Link>
        </div>
      </div>

      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(searchInput);
        }}
      >
        <div className="min-w-48 flex-1">
          <label htmlFor="cari" className="text-xs font-medium text-slate-500">
            Cari (nama/telepon/email)
          </label>
          <input
            id="cari"
            className={inputCls}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="mis. 0812… atau budi@…"
          />
        </div>
        <div>
          <label htmlFor="tipe" className="text-xs font-medium text-slate-500">
            Tipe
          </label>
          <select
            id="tipe"
            className={inputCls}
            value={type}
            onChange={(e) => {
              setPage(1);
              setType(e.target.value);
            }}
          >
            <option value="">Semua</option>
            <option value="INDIVIDUAL">Perorangan</option>
            <option value="BUSINESS">Bisnis</option>
          </select>
        </div>
        <div>
          <label htmlFor="status" className="text-xs font-medium text-slate-500">
            Status
          </label>
          <select
            id="status"
            className={inputCls}
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value="">Aktif & Nonaktif</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Nonaktif</option>
            <option value="MERGED">Sudah digabung</option>
          </select>
        </div>
        <button type="submit" className={btnSecondary}>
          Terapkan
        </button>
      </form>

      {query.isLoading && <LoadingRows />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}

      {query.data &&
        (query.data.data.length === 0 ? (
          <EmptyState title="Belum ada pelanggan." hint="Buat pelanggan pertama Anda." />
        ) : (
          <>
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Nama</th>
                    <th className="px-4 py-3">Telepon</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Tipe</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.data.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/pelanggan/${c.id}`}
                          className="font-medium text-slate-900 hover:underline"
                        >
                          {c.displayName}
                        </Link>
                        {c.hasPendingDuplicate && (
                          <span className="ml-2">
                            <Badge tone="warning">Duplikat?</Badge>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{c.primaryPhone ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{c.primaryEmail ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {c.type === 'INDIVIDUAL' ? 'Perorangan' : 'Bisnis'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          tone={
                            c.status === 'ACTIVE'
                              ? 'success'
                              : c.status === 'MERGED'
                                ? 'warning'
                                : 'neutral'
                          }
                        >
                          {c.status === 'ACTIVE'
                            ? 'Aktif'
                            : c.status === 'MERGED'
                              ? 'Digabung'
                              : 'Nonaktif'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
              <span>
                {query.data.meta.total} pelanggan — halaman {query.data.meta.page}/
                {query.data.meta.totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  className={btnSecondary}
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Sebelumnya
                </button>
                <button
                  className={btnSecondary}
                  disabled={page >= query.data.meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Berikutnya
                </button>
              </div>
            </div>
          </>
        ))}
    </AppShell>
  );
}
