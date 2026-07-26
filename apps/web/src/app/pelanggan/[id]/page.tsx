'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge, Card } from '@flowniaga/ui';
import { AppShell } from '@/components/app-shell';
import { ErrorState, LoadingRows, btnPrimary, inputCls } from '@/components/states';
import { apiFetch, ApiError } from '@/lib/api';

interface Identity {
  id: string;
  identityType: string;
  displayValue: string;
  normalizedValue: string;
  verificationStatus: string;
  isPrimary: boolean;
  channel: { id: string; name: string } | null;
}

interface Address {
  id: string;
  label: string;
  recipientName: string;
  addressLine: string;
  city: string;
  province: string;
  isPrimary: boolean;
}

interface CustomerDetail {
  id: string;
  displayName: string;
  type: string;
  status: string;
  primaryPhone: string | null;
  primaryEmail: string | null;
  companyName: string | null;
  notes: string | null;
  consentStatus: string;
  identities: Identity[];
  addresses: Address[];
  pendingDuplicateCount: number;
  mergedInto: { id: string; displayName: string } | null;
}

export default function PelangganDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['customer', id],
    queryFn: () => apiFetch<CustomerDetail>(`/customers/${id}`),
  });

  const notify = (msg: string) => {
    setError(null);
    setMessage(msg);
    setTimeout(() => setMessage(null), 4000);
  };
  const fail = (err: unknown) =>
    setError(err instanceof ApiError ? err.message : 'Terjadi kesalahan.');

  const addIdentity = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    try {
      await apiFetch(`/customers/${id}/identities`, {
        method: 'POST',
        body: JSON.stringify({
          identityType: f.get('identityType'),
          value: f.get('value'),
        }),
      });
      form.reset();
      void qc.invalidateQueries({ queryKey: ['customer', id] });
      notify('Identitas ditambahkan.');
    } catch (err) {
      fail(err);
    }
  };

  const addAddress = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    try {
      await apiFetch(`/customers/${id}/addresses`, {
        method: 'POST',
        body: JSON.stringify({
          label: f.get('label') || 'Utama',
          recipientName: f.get('recipientName'),
          addressLine: f.get('addressLine'),
          city: f.get('city'),
          province: f.get('province'),
          isPrimary: true,
        }),
      });
      form.reset();
      void qc.invalidateQueries({ queryKey: ['customer', id] });
      notify('Alamat ditambahkan.');
    } catch (err) {
      fail(err);
    }
  };

  return (
    <AppShell>
      {query.isLoading && <LoadingRows />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {query.data && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{query.data.displayName}</h1>
              <p className="mt-1 text-sm text-slate-500">
                {query.data.type === 'INDIVIDUAL' ? 'Perorangan' : 'Bisnis'} ·{' '}
                <Badge
                  tone={
                    query.data.status === 'ACTIVE'
                      ? 'success'
                      : query.data.status === 'MERGED'
                        ? 'warning'
                        : 'neutral'
                  }
                >
                  {query.data.status}
                </Badge>
              </p>
            </div>
            {query.data.pendingDuplicateCount > 0 && (
              <Link
                href="/pelanggan/duplikat"
                className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-200"
              >
                ⚠ {query.data.pendingDuplicateCount} kandidat duplikat — tinjau
              </Link>
            )}
          </div>

          {query.data.mergedInto && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Pelanggan ini telah digabung ke{' '}
              <Link
                className="font-medium underline"
                href={`/pelanggan/${query.data.mergedInto.id}`}
              >
                {query.data.mergedInto.displayName}
              </Link>
              .
            </p>
          )}
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

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card title="Kontak">
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Telepon</dt>
                  <dd>{query.data.primaryPhone ?? '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Email</dt>
                  <dd>{query.data.primaryEmail ?? '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Perusahaan</dt>
                  <dd>{query.data.companyName ?? '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Consent</dt>
                  <dd>{query.data.consentStatus}</dd>
                </div>
              </dl>
              {query.data.notes && (
                <p className="mt-3 text-sm text-slate-500">{query.data.notes}</p>
              )}
            </Card>

            <Card title="Identitas kanal">
              {query.data.identities.length === 0 ? (
                <p className="text-sm text-slate-500">Belum ada identitas.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {query.data.identities.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-2">
                      <span>
                        <span className="font-mono text-xs text-slate-400">{i.identityType}</span>{' '}
                        {i.displayValue}
                        {i.channel && (
                          <span className="text-xs text-slate-400"> ({i.channel.name})</span>
                        )}
                      </span>
                      <span className="flex gap-1">
                        {i.isPrimary && <Badge tone="neutral">Utama</Badge>}
                        <Badge tone={i.verificationStatus === 'VERIFIED' ? 'success' : 'neutral'}>
                          {i.verificationStatus === 'VERIFIED' ? 'Terverifikasi' : 'Belum'}
                        </Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <form
                onSubmit={addIdentity}
                className="mt-4 flex gap-2 border-t border-slate-100 pt-3"
              >
                <select name="identityType" className={inputCls} aria-label="Tipe identitas">
                  <option value="PHONE">Telepon</option>
                  <option value="EMAIL">Email</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="MARKETPLACE_ACCOUNT">Akun Marketplace</option>
                  <option value="MANUAL_REFERENCE">Referensi Manual</option>
                </select>
                <input
                  name="value"
                  required
                  placeholder="Nilai"
                  className={inputCls}
                  aria-label="Nilai identitas"
                />
                <button type="submit" className={btnPrimary}>
                  +
                </button>
              </form>
            </Card>

            <Card title="Alamat" className="lg:col-span-2">
              {query.data.addresses.length === 0 ? (
                <p className="text-sm text-slate-500">Belum ada alamat.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {query.data.addresses.map((a) => (
                    <li key={a.id} className="rounded-lg border border-slate-100 p-3">
                      <p className="font-medium">
                        {a.label} — {a.recipientName}{' '}
                        {a.isPrimary && <Badge tone="neutral">Utama</Badge>}
                      </p>
                      <p className="text-slate-500">
                        {a.addressLine}, {a.city}, {a.province}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <form
                onSubmit={addAddress}
                className="mt-4 grid gap-2 border-t border-slate-100 pt-3 md:grid-cols-5"
              >
                <input
                  name="label"
                  placeholder="Label (Utama)"
                  className={inputCls}
                  aria-label="Label"
                />
                <input
                  name="recipientName"
                  required
                  placeholder="Nama penerima *"
                  className={inputCls}
                  aria-label="Nama penerima"
                />
                <input
                  name="addressLine"
                  required
                  placeholder="Alamat *"
                  className={inputCls}
                  aria-label="Alamat"
                />
                <input
                  name="city"
                  required
                  placeholder="Kota *"
                  className={inputCls}
                  aria-label="Kota"
                />
                <div className="flex gap-2">
                  <input
                    name="province"
                    required
                    placeholder="Provinsi *"
                    className={inputCls}
                    aria-label="Provinsi"
                  />
                  <button type="submit" className={btnPrimary}>
                    +
                  </button>
                </div>
              </form>
            </Card>
          </div>
        </>
      )}
    </AppShell>
  );
}
