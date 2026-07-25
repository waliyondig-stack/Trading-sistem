'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge, Card } from '@flowniaga/ui';
import { AppShell } from '@/components/app-shell';
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@/components/states';
import { apiFetch, ApiError, formatTanggal } from '@/lib/api';

interface CandidateCustomer {
  id: string;
  displayName: string;
  primaryPhone: string | null;
  primaryEmail: string | null;
  status: string;
}

interface Candidate {
  id: string;
  score: number;
  reasons: { code: string; detail: string; score: number }[];
  status: string;
  customerA: CandidateCustomer;
  customerB: CandidateCustomer;
}

interface MergePreview {
  source: CandidateCustomer & { identityCount: number; addressCount: number };
  target: CandidateCustomer & { identityCount: number; addressCount: number };
  comparison: Record<string, { source: unknown; target: unknown; result: unknown }>;
  willMove: { identities: number; redundantIdentities: number; addresses: number };
}

interface HistoryRow {
  id: string;
  performedAt: string;
  reason: string;
  source: { id: string; displayName: string };
  target: { id: string; displayName: string };
}

export default function DuplikatPage() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Candidate | null>(null);
  const [targetId, setTargetId] = useState<string>('');
  const [keepFromSource, setKeepFromSource] = useState<string[]>([]);
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const candidates = useQuery({
    queryKey: ['merge-candidates'],
    queryFn: () => apiFetch<Candidate[]>('/customers/merge-candidates'),
  });
  const history = useQuery({
    queryKey: ['merge-history'],
    queryFn: () => apiFetch<HistoryRow[]>('/customers/merge-history'),
  });

  const fail = (err: unknown) =>
    setError(err instanceof ApiError ? err.message : 'Terjadi kesalahan.');

  const openCandidate = (c: Candidate) => {
    setActive(c);
    setTargetId(c.customerA.id);
    setKeepFromSource([]);
    setPreview(null);
    setReason('');
    setError(null);
  };

  const doPreview = async () => {
    if (!active) return;
    setBusy(true);
    setError(null);
    const sourceId = targetId === active.customerA.id ? active.customerB.id : active.customerA.id;
    try {
      const result = await apiFetch<MergePreview>('/customers/merge/preview', {
        method: 'POST',
        body: JSON.stringify({
          targetCustomerId: targetId,
          sourceCustomerId: sourceId,
          keepFromSource,
        }),
      });
      setPreview(result);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const doExecute = async () => {
    if (!active || !preview) return;
    if (!reason.trim()) {
      setError('Alasan merge wajib diisi.');
      return;
    }
    if (!confirm('Jalankan merge? Pelanggan source akan ditandai sebagai digabung.')) return;
    setBusy(true);
    setError(null);
    const sourceId = targetId === active.customerA.id ? active.customerB.id : active.customerA.id;
    try {
      await apiFetch('/customers/merge/execute', {
        method: 'POST',
        body: JSON.stringify({
          targetCustomerId: targetId,
          sourceCustomerId: sourceId,
          keepFromSource,
          reason,
        }),
      });
      setActive(null);
      setPreview(null);
      void qc.invalidateQueries({ queryKey: ['merge-candidates'] });
      void qc.invalidateQueries({ queryKey: ['merge-history'] });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const review = async (candidateId: string, status: string) => {
    try {
      await apiFetch(`/customers/merge-candidates/${candidateId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      void qc.invalidateQueries({ queryKey: ['merge-candidates'] });
      if (active?.id === candidateId) setActive(null);
    } catch (err) {
      fail(err);
    }
  };

  const mergeableFields = ['displayName', 'primaryPhone', 'primaryEmail', 'companyName', 'notes'];

  return (
    <AppShell>
      <h1 className="text-xl font-bold text-slate-900">Kandidat Duplikat Pelanggan</h1>
      <p className="mt-1 text-sm text-slate-500">
        Deteksi deterministik (telepon/email/identitas kanal sama). Merge selalu manual dan
        tercatat.
      </p>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      {candidates.isLoading && <LoadingRows count={3} />}
      {candidates.isError && (
        <ErrorState error={candidates.error} onRetry={() => candidates.refetch()} />
      )}
      {candidates.data &&
        (candidates.data.length === 0 ? (
          <EmptyState
            title="Tidak ada kandidat duplikat tertunda."
            hint="Kandidat muncul otomatis saat data pelanggan cocok pada sinyal kuat."
          />
        ) : (
          <div className="mt-4 space-y-3">
            {candidates.data.map((c) => (
              <Card key={c.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm">
                    <p className="font-medium">
                      {c.customerA.displayName} ⟷ {c.customerB.displayName}{' '}
                      <Badge tone={c.score >= 80 ? 'danger' : 'warning'}>Skor {c.score}</Badge>
                    </p>
                    <ul className="mt-1 text-xs text-slate-500">
                      {c.reasons.map((r, i) => (
                        <li key={i}>
                          • {r.detail} (+{r.score})
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex gap-2">
                    <button className={btnPrimary} onClick={() => openCandidate(c)}>
                      Tinjau & Merge
                    </button>
                    <button className={btnSecondary} onClick={() => review(c.id, 'REJECTED')}>
                      Bukan duplikat
                    </button>
                    <button className={btnSecondary} onClick={() => review(c.id, 'IGNORED')}>
                      Abaikan
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ))}

      {active && (
        <Card title="Perbandingan & Merge" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2">
            {[active.customerA, active.customerB].map((cust) => (
              <label
                key={cust.id}
                className={`cursor-pointer rounded-xl border p-4 text-sm ${
                  targetId === cust.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200'
                }`}
              >
                <input
                  type="radio"
                  name="target"
                  className="mr-2"
                  checked={targetId === cust.id}
                  onChange={() => {
                    setTargetId(cust.id);
                    setPreview(null);
                  }}
                />
                <span className="font-medium">{cust.displayName}</span>
                {targetId === cust.id && <Badge tone="success">Master (dipertahankan)</Badge>}
                <p className="mt-1 text-slate-500">Telepon: {cust.primaryPhone ?? '—'}</p>
                <p className="text-slate-500">Email: {cust.primaryEmail ?? '—'}</p>
              </label>
            ))}
          </div>

          <fieldset className="mt-4">
            <legend className="text-xs font-medium text-slate-500">
              Ambil field berikut dari pelanggan yang DIGABUNGKAN (source):
            </legend>
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              {mergeableFields.map((fld) => (
                <label key={fld} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={keepFromSource.includes(fld)}
                    onChange={(e) => {
                      setKeepFromSource((prev) =>
                        e.target.checked ? [...prev, fld] : prev.filter((x) => x !== fld),
                      );
                      setPreview(null);
                    }}
                  />
                  {fld}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-4 flex gap-2">
            <button className={btnSecondary} disabled={busy} onClick={doPreview}>
              {busy && !preview ? 'Memuat…' : 'Lihat Preview Hasil'}
            </button>
            <button className={btnSecondary} onClick={() => setActive(null)}>
              Tutup
            </button>
          </div>

          {preview && (
            <div className="mt-4 rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-700">Preview hasil merge</h3>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="uppercase text-slate-500">
                    <tr>
                      <th className="py-1 pr-4">Field</th>
                      <th className="py-1 pr-4">Source</th>
                      <th className="py-1 pr-4">Target</th>
                      <th className="py-1">Hasil</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(preview.comparison)
                      .filter(([, v]) => v.source !== null || v.target !== null)
                      .map(([field, v]) => (
                        <tr key={field} className="border-t border-slate-100">
                          <td className="py-1 pr-4 font-medium">{field}</td>
                          <td className="py-1 pr-4 text-slate-500">{String(v.source ?? '—')}</td>
                          <td className="py-1 pr-4 text-slate-500">{String(v.target ?? '—')}</td>
                          <td className="py-1 font-medium">{String(v.result ?? '—')}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Akan dipindahkan: {preview.willMove.identities} identitas (
                {preview.willMove.redundantIdentities} redundan), {preview.willMove.addresses}{' '}
                alamat.
              </p>
              <div className="mt-3">
                <label htmlFor="reason" className="text-xs font-medium text-slate-500">
                  Alasan merge *
                </label>
                <input
                  id="reason"
                  className={inputCls}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="mis. Nomor telepon sama, dikonfirmasi pelanggan yang sama"
                />
              </div>
              <button className={`mt-3 ${btnPrimary}`} disabled={busy} onClick={doExecute}>
                {busy ? 'Menjalankan…' : 'Konfirmasi Merge'}
              </button>
            </div>
          )}
        </Card>
      )}

      <Card title="Riwayat merge" className="mt-6">
        {history.data && history.data.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {history.data.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="font-medium">{h.source.displayName}</span> →{' '}
                  <span className="font-medium">{h.target.displayName}</span>
                  <span className="ml-2 text-xs text-slate-400">{h.reason}</span>
                </span>
                <time className="text-xs text-slate-400">{formatTanggal(h.performedAt)}</time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Belum ada riwayat merge.</p>
        )}
      </Card>
    </AppShell>
  );
}
