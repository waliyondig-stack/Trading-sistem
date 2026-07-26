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

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'INACTIVE';
  productType: string;
  brand: string | null;
  category: { id: string; name: string } | null;
  _count: { variants: number };
}

interface CategoryRow {
  id: string;
  name: string;
}

interface ProductList {
  data: ProductRow[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export default function ProdukPage() {
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (search) params.set('search', search);
  if (categoryId) params.set('categoryId', categoryId);
  if (status) params.set('status', status);

  const query = useQuery({
    queryKey: ['products', search, categoryId, status, page],
    queryFn: () => apiFetch<ProductList>(`/products?${params.toString()}`),
  });
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiFetch<CategoryRow[]>('/categories'),
  });

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">Produk</h1>
        <div className="flex gap-2">
          <Link href="/produk/import" className={btnSecondary}>
            Import CSV
          </Link>
          <Link href="/produk/baru" className={btnPrimary}>
            + Buat Produk
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
            Cari (nama/SKU/barcode)
          </label>
          <input
            id="cari"
            className={inputCls}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="mis. KOPI-GAYO-250"
          />
        </div>
        <div>
          <label htmlFor="kategori" className="text-xs font-medium text-slate-500">
            Kategori
          </label>
          <select
            id="kategori"
            className={inputCls}
            value={categoryId}
            onChange={(e) => {
              setPage(1);
              setCategoryId(e.target.value);
            }}
          >
            <option value="">Semua</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
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
            <option value="">Semua</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Nonaktif</option>
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
          <EmptyState
            title="Belum ada produk."
            hint="Buat produk pertama Anda atau gunakan Import CSV."
          />
        ) : (
          <>
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Nama</th>
                    <th className="px-4 py-3">Kategori</th>
                    <th className="px-4 py-3">Tipe</th>
                    <th className="px-4 py-3">Variasi</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.data.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/produk/${p.id}`}
                          className="font-medium text-slate-900 hover:underline"
                        >
                          {p.name}
                        </Link>
                        {p.brand && <span className="ml-2 text-xs text-slate-400">{p.brand}</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{p.category?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{p.productType}</td>
                      <td className="px-4 py-3">{p._count.variants}</td>
                      <td className="px-4 py-3">
                        <Badge tone={p.status === 'ACTIVE' ? 'success' : 'neutral'}>
                          {p.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
              <span>
                {query.data.meta.total} produk — halaman {query.data.meta.page}/
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
