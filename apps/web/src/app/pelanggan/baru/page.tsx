'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { btnPrimary, btnSecondary, inputCls } from '@/components/states';
import { apiFetch, ApiError } from '@/lib/api';

export default function PelangganBaruPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const f = new FormData(e.currentTarget);
    try {
      const created = await apiFetch<{ id: string; duplicateCandidatesCreated: number }>(
        '/customers',
        {
          method: 'POST',
          body: JSON.stringify({
            displayName: f.get('displayName'),
            type: f.get('type'),
            primaryPhone: String(f.get('primaryPhone') ?? '').trim() || undefined,
            primaryEmail: String(f.get('primaryEmail') ?? '').trim() || undefined,
            companyName: String(f.get('companyName') ?? '').trim() || undefined,
            notes: String(f.get('notes') ?? '').trim() || undefined,
          }),
        },
      );
      if (created.duplicateCandidatesCreated > 0) {
        alert(
          `Perhatian: terdeteksi ${created.duplicateCandidatesCreated} kemungkinan duplikat. Periksa menu Kandidat Duplikat.`,
        );
      }
      router.push(`/pelanggan/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan pelanggan.');
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <h1 className="text-xl font-bold text-slate-900">Buat Pelanggan</h1>
      <form onSubmit={onSubmit} className="mt-6 max-w-xl space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="displayName" className="text-xs font-medium text-slate-500">
                Nama tampilan *
              </label>
              <input id="displayName" name="displayName" required className={inputCls} />
            </div>
            <div>
              <label htmlFor="type" className="text-xs font-medium text-slate-500">
                Tipe
              </label>
              <select id="type" name="type" defaultValue="INDIVIDUAL" className={inputCls}>
                <option value="INDIVIDUAL">Perorangan</option>
                <option value="BUSINESS">Bisnis</option>
              </select>
            </div>
            <div>
              <label htmlFor="companyName" className="text-xs font-medium text-slate-500">
                Nama perusahaan
              </label>
              <input id="companyName" name="companyName" className={inputCls} />
            </div>
            <div>
              <label htmlFor="primaryPhone" className="text-xs font-medium text-slate-500">
                Telepon (dinormalisasi otomatis)
              </label>
              <input
                id="primaryPhone"
                name="primaryPhone"
                className={inputCls}
                placeholder="0812-3456-7890"
              />
            </div>
            <div>
              <label htmlFor="primaryEmail" className="text-xs font-medium text-slate-500">
                Email
              </label>
              <input id="primaryEmail" name="primaryEmail" type="email" className={inputCls} />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="notes" className="text-xs font-medium text-slate-500">
                Catatan
              </label>
              <textarea id="notes" name="notes" rows={3} className={inputCls} />
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
            {saving ? 'Menyimpan…' : 'Simpan Pelanggan'}
          </button>
          <button type="button" className={btnSecondary} onClick={() => router.back()}>
            Batal
          </button>
        </div>
      </form>
    </AppShell>
  );
}
