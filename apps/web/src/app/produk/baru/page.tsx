'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { btnPrimary, btnSecondary, inputCls } from '@/components/states';
import { apiFetch, ApiError } from '@/lib/api';

interface CategoryRow {
  id: string;
  name: string;
}

export default function ProdukBaruPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiFetch<CategoryRow[]>('/categories'),
  });

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const f = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      name: f.get('name'),
      categoryId: f.get('categoryId') || undefined,
      productType: f.get('productType'),
      brand: f.get('brand') || undefined,
      defaultUnit: f.get('defaultUnit') || 'pcs',
      description: f.get('description') || undefined,
    };
    const sku = String(f.get('internalSku') ?? '').trim();
    if (sku) {
      body.variants = [
        {
          name: String(f.get('variantName') || f.get('name')),
          internalSku: sku,
          barcode: String(f.get('barcode') ?? '').trim() || undefined,
          costAmount: Number(f.get('costAmount') || 0),
          sellingPrice: Number(f.get('sellingPrice') || 0),
          unit: String(f.get('defaultUnit') || 'pcs'),
        },
      ];
    }
    try {
      const created = await apiFetch<{ id: string }>('/products', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      router.push(`/produk/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan produk.');
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <h1 className="text-xl font-bold text-slate-900">Buat Produk</h1>
      <form onSubmit={onSubmit} className="mt-6 max-w-2xl space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-500">Informasi produk</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="name" className="text-xs font-medium text-slate-500">
                Nama produk *
              </label>
              <input id="name" name="name" required className={inputCls} />
            </div>
            <div>
              <label htmlFor="categoryId" className="text-xs font-medium text-slate-500">
                Kategori
              </label>
              <select id="categoryId" name="categoryId" className={inputCls}>
                <option value="">Tanpa kategori</option>
                {categories.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="productType" className="text-xs font-medium text-slate-500">
                Tipe produk
              </label>
              <select
                id="productType"
                name="productType"
                defaultValue="PHYSICAL"
                className={inputCls}
              >
                <option value="PHYSICAL">Fisik</option>
                <option value="SERVICE">Jasa</option>
                <option value="DIGITAL">Digital</option>
                <option value="BUNDLE">Bundle (placeholder)</option>
              </select>
            </div>
            <div>
              <label htmlFor="brand" className="text-xs font-medium text-slate-500">
                Merek
              </label>
              <input id="brand" name="brand" className={inputCls} />
            </div>
            <div>
              <label htmlFor="defaultUnit" className="text-xs font-medium text-slate-500">
                Satuan default
              </label>
              <input id="defaultUnit" name="defaultUnit" defaultValue="pcs" className={inputCls} />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="description" className="text-xs font-medium text-slate-500">
                Deskripsi
              </label>
              <textarea id="description" name="description" rows={3} className={inputCls} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-1 text-sm font-semibold text-slate-500">Variasi pertama (opsional)</h2>
          <p className="mb-3 text-xs text-slate-400">
            Isi SKU untuk langsung membuat satu variasi. Variasi lain dapat ditambah di halaman
            detail.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="internalSku" className="text-xs font-medium text-slate-500">
                SKU internal
              </label>
              <input
                id="internalSku"
                name="internalSku"
                className={inputCls}
                placeholder="KOPI-GAYO-250"
              />
            </div>
            <div>
              <label htmlFor="variantName" className="text-xs font-medium text-slate-500">
                Nama variasi
              </label>
              <input id="variantName" name="variantName" className={inputCls} />
            </div>
            <div>
              <label htmlFor="barcode" className="text-xs font-medium text-slate-500">
                Barcode
              </label>
              <input id="barcode" name="barcode" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="costAmount" className="text-xs font-medium text-slate-500">
                  Harga pokok (Rp)
                </label>
                <input
                  id="costAmount"
                  name="costAmount"
                  type="number"
                  min={0}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="sellingPrice" className="text-xs font-medium text-slate-500">
                  Harga jual (Rp)
                </label>
                <input
                  id="sellingPrice"
                  name="sellingPrice"
                  type="number"
                  min={0}
                  className={inputCls}
                />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? 'Menyimpan…' : 'Simpan Produk'}
          </button>
          <button type="button" className={btnSecondary} onClick={() => router.back()}>
            Batal
          </button>
        </div>
      </form>
    </AppShell>
  );
}
