'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge, Card } from '@flowniaga/ui';
import { AppShell } from '@/components/app-shell';
import { ErrorState, LoadingRows, btnPrimary, btnSecondary, inputCls } from '@/components/states';
import { apiFetch, ApiError, formatRupiah } from '@/lib/api';

interface Variant {
  id: string;
  name: string;
  internalSku: string;
  barcode: string | null;
  unit: string;
  costAmount: number;
  sellingPrice: number;
  status: 'ACTIVE' | 'INACTIVE';
}

interface ProductDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  productType: string;
  brand: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  defaultUnit: string;
  category: { id: string; name: string } | null;
  variants: Variant[];
}

interface ChannelRow {
  id: string;
  name: string;
  type: string;
}

interface ListingRow {
  id: string;
  externalSku: string;
  listingName: string;
  listingStatus: string;
  channel: { id: string; name: string; type: string };
  variant: { id: string; internalSku: string };
}

interface ListingList {
  data: ListingRow[];
}

export default function ProdukDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const product = useQuery({
    queryKey: ['product', id],
    queryFn: () => apiFetch<ProductDetail>(`/products/${id}`),
  });
  const channels = useQuery({
    queryKey: ['channels'],
    queryFn: () => apiFetch<ChannelRow[]>('/channels'),
  });
  const variantIds = product.data?.variants.map((v) => v.id) ?? [];
  const listings = useQuery({
    queryKey: ['listings', id, variantIds.length],
    enabled: variantIds.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        variantIds.map((vid) =>
          apiFetch<ListingList>(`/channel-listings?productVariantId=${vid}&pageSize=50`),
        ),
      );
      return results.flatMap((r) => r.data);
    },
  });

  const notify = (msg: string) => {
    setError(null);
    setMessage(msg);
    setTimeout(() => setMessage(null), 4000);
  };
  const fail = (err: unknown) =>
    setError(err instanceof ApiError ? err.message : 'Terjadi kesalahan.');

  const updateVariant = useMutation({
    mutationFn: ({ variantId, data }: { variantId: string; data: Record<string, unknown> }) =>
      apiFetch(`/variants/${variantId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['product', id] });
      notify('Variasi diperbarui.');
    },
    onError: fail,
  });

  const archiveProduct = useMutation({
    mutationFn: () => apiFetch(`/products/${id}`, { method: 'DELETE' }),
    onSuccess: () => router.push('/produk'),
    onError: fail,
  });

  const addVariant = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    try {
      await apiFetch(`/products/${id}/variants`, {
        method: 'POST',
        body: JSON.stringify([
          {
            name: f.get('name'),
            internalSku: f.get('internalSku'),
            barcode: String(f.get('barcode') ?? '').trim() || undefined,
            costAmount: Number(f.get('costAmount') || 0),
            sellingPrice: Number(f.get('sellingPrice') || 0),
          },
        ]),
      });
      form.reset();
      void qc.invalidateQueries({ queryKey: ['product', id] });
      notify('Variasi ditambahkan.');
    } catch (err) {
      fail(err);
    }
  };

  const addListing = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    try {
      await apiFetch('/channel-listings', {
        method: 'POST',
        body: JSON.stringify({
          channelId: f.get('channelId'),
          productVariantId: f.get('productVariantId'),
          externalSku: f.get('externalSku'),
          listingName: f.get('listingName'),
        }),
      });
      form.reset();
      void qc.invalidateQueries({ queryKey: ['listings', id] });
      void listings.refetch();
      notify('Mapping kanal dibuat.');
    } catch (err) {
      fail(err);
    }
  };

  return (
    <AppShell>
      {product.isLoading && <LoadingRows />}
      {product.isError && <ErrorState error={product.error} onRetry={() => product.refetch()} />}
      {product.data && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{product.data.name}</h1>
              <p className="text-sm text-slate-500">
                {product.data.category?.name ?? 'Tanpa kategori'} · {product.data.productType} ·{' '}
                <Badge tone={product.data.status === 'ACTIVE' ? 'success' : 'neutral'}>
                  {product.data.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}
                </Badge>
              </p>
            </div>
            <button
              className={btnSecondary}
              onClick={() => {
                if (confirm('Arsipkan produk ini? Produk tidak akan tampil pada daftar.')) {
                  archiveProduct.mutate();
                }
              }}
            >
              Arsipkan
            </button>
          </div>

          {message && (
            <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {message}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}

          <Card title="Variasi" className="mt-6">
            {product.data.variants.length === 0 ? (
              <p className="text-sm text-slate-500">Belum ada variasi.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">SKU</th>
                      <th className="py-2 pr-4">Nama</th>
                      <th className="py-2 pr-4">Barcode</th>
                      <th className="py-2 pr-4">Harga pokok</th>
                      <th className="py-2 pr-4">Harga jual</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {product.data.variants.map((v) => (
                      <tr key={v.id} className="border-t border-slate-100">
                        <td className="py-2 pr-4 font-mono text-xs">{v.internalSku}</td>
                        <td className="py-2 pr-4">{v.name}</td>
                        <td className="py-2 pr-4 text-slate-500">{v.barcode ?? '—'}</td>
                        <td className="py-2 pr-4">{formatRupiah(v.costAmount)}</td>
                        <td className="py-2 pr-4">{formatRupiah(v.sellingPrice)}</td>
                        <td className="py-2 pr-4">
                          <Badge tone={v.status === 'ACTIVE' ? 'success' : 'neutral'}>
                            {v.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                        </td>
                        <td className="py-2 text-right">
                          <button
                            className="text-xs text-sky-600 hover:underline"
                            onClick={() => {
                              const harga = prompt('Harga jual baru (Rp):', String(v.sellingPrice));
                              if (harga !== null && /^\d+$/.test(harga)) {
                                updateVariant.mutate({
                                  variantId: v.id,
                                  data: { sellingPrice: Number(harga) },
                                });
                              }
                            }}
                          >
                            Ubah harga
                          </button>
                          <button
                            className="ml-3 text-xs text-slate-500 hover:underline"
                            onClick={() =>
                              updateVariant.mutate({
                                variantId: v.id,
                                data: { status: v.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' },
                              })
                            }
                          >
                            {v.status === 'ACTIVE' ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <form
              onSubmit={addVariant}
              className="mt-4 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-5"
            >
              <input
                name="internalSku"
                required
                placeholder="SKU *"
                className={inputCls}
                aria-label="SKU"
              />
              <input
                name="name"
                required
                placeholder="Nama variasi *"
                className={inputCls}
                aria-label="Nama variasi"
              />
              <input
                name="barcode"
                placeholder="Barcode"
                className={inputCls}
                aria-label="Barcode"
              />
              <input
                name="costAmount"
                type="number"
                min={0}
                placeholder="Harga pokok"
                className={inputCls}
                aria-label="Harga pokok"
              />
              <div className="flex gap-2">
                <input
                  name="sellingPrice"
                  type="number"
                  min={0}
                  placeholder="Harga jual"
                  className={inputCls}
                  aria-label="Harga jual"
                />
                <button type="submit" className={btnPrimary}>
                  +
                </button>
              </div>
            </form>
          </Card>

          <Card title="Pemetaan kanal (channel listing)" className="mt-4">
            {listings.data && listings.data.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">Kanal</th>
                      <th className="py-2 pr-4">SKU eksternal</th>
                      <th className="py-2 pr-4">Nama listing</th>
                      <th className="py-2 pr-4">SKU internal</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listings.data.map((l) => (
                      <tr key={l.id} className="border-t border-slate-100">
                        <td className="py-2 pr-4">{l.channel.name}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{l.externalSku}</td>
                        <td className="py-2 pr-4">{l.listingName}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{l.variant.internalSku}</td>
                        <td className="py-2">{l.listingStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Belum ada pemetaan kanal.</p>
            )}

            <form
              onSubmit={addListing}
              className="mt-4 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-5"
            >
              <select name="channelId" required className={inputCls} aria-label="Kanal">
                <option value="">Pilih kanal *</option>
                {channels.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select name="productVariantId" required className={inputCls} aria-label="Variasi">
                <option value="">Pilih variasi *</option>
                {product.data.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.internalSku}
                  </option>
                ))}
              </select>
              <input
                name="externalSku"
                required
                placeholder="SKU eksternal *"
                className={inputCls}
                aria-label="SKU eksternal"
              />
              <input
                name="listingName"
                required
                placeholder="Nama listing *"
                className={inputCls}
                aria-label="Nama listing"
              />
              <button type="submit" className={btnPrimary}>
                Tambah Mapping
              </button>
            </form>
          </Card>
        </>
      )}
    </AppShell>
  );
}
