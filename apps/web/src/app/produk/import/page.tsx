'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge, Card } from '@flowniaga/ui';
import { AppShell } from '@/components/app-shell';
import { btnPrimary, btnSecondary } from '@/components/states';
import { API_URL, apiFetch, ApiError } from '@/lib/api';

interface PreviewRow {
  row: number;
  values: Record<string, string>;
  errors: { field?: string; code: string; message: string }[];
  duplicateInFile: boolean;
}

interface PreviewResult {
  jobId: string;
  fileName: string;
  totalRows: number;
  headers: string[];
  globalErrors: string[];
  summary: { validRows: number; invalidRows: number; duplicateInFileRows: number };
  preview: PreviewRow[];
}

interface JobStatus {
  jobId: string;
  fileName: string;
  status: string;
  totalRows: number;
  createdRows: number;
  updatedRows: number;
  failedRows: number;
  skippedRows: number;
  processedRows: number;
  errorCount: number;
}

export default function ImportPage() {
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const status = useQuery({
    queryKey: ['import-status', jobId],
    enabled: !!jobId,
    refetchInterval: (q) =>
      q.state.data && ['COMPLETED', 'FAILED'].includes(q.state.data.status) ? false : 1500,
    queryFn: () => apiFetch<JobStatus>(`/catalog-imports/${jobId}`),
  });

  const upload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    setJobId(null);
    const form = new FormData(e.currentTarget);
    try {
      const result = await apiFetch<PreviewResult>('/catalog-imports', {
        method: 'POST',
        body: form,
      });
      setPreview(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengunggah file.');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!preview) return;
    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch<JobStatus>(`/catalog-imports/${preview.jobId}/confirm`, {
        method: 'POST',
        headers: { 'idempotency-key': `web-${preview.jobId}` },
      });
      setJobId(res.jobId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengkonfirmasi import.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <h1 className="text-xl font-bold text-slate-900">Import Produk (CSV)</h1>
      <p className="mt-1 text-sm text-slate-500">
        Unggah file CSV, periksa preview & error per baris, lalu konfirmasi. Template:{' '}
        <code className="rounded bg-slate-100 px-1">
          product_name, category, variant_name, internal_sku, barcode, cost_amount, selling_price,
          unit, status
        </code>
      </p>

      <Card title="1. Unggah file" className="mt-6 max-w-2xl">
        <form onSubmit={upload} className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            aria-label="File CSV"
            className="text-sm"
          />
          <button type="submit" disabled={busy} className={btnPrimary}>
            {busy && !preview ? 'Memproses…' : 'Unggah & Preview'}
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-400">
          Maks. 2 MB / 5.000 baris. Preview tidak menyimpan data.
        </p>
      </Card>

      {error && (
        <p
          role="alert"
          className="mt-4 max-w-2xl rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          {error}
        </p>
      )}

      {preview && !jobId && (
        <Card title={`2. Preview — ${preview.fileName}`} className="mt-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge tone="neutral">{preview.totalRows} baris</Badge>
            <Badge tone="success">{preview.summary.validRows} valid</Badge>
            <Badge tone="danger">{preview.summary.invalidRows} error</Badge>
            <Badge tone="warning">{preview.summary.duplicateInFileRows} duplikat dalam file</Badge>
          </div>
          {preview.globalErrors.length > 0 && (
            <div className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
              {preview.globalErrors.map((g, i) => (
                <p key={i}>{g}</p>
              ))}
            </div>
          )}
          <div className="mt-4 max-h-96 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">product_name</th>
                  <th className="px-3 py-2">internal_sku</th>
                  <th className="px-3 py-2">selling_price</th>
                  <th className="px-3 py-2">Validasi</th>
                </tr>
              </thead>
              <tbody>
                {preview.preview.map((r) => (
                  <tr key={r.row} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-400">{r.row}</td>
                    <td className="px-3 py-2">{r.values.product_name ?? ''}</td>
                    <td className="px-3 py-2 font-mono">{r.values.internal_sku ?? ''}</td>
                    <td className="px-3 py-2">{r.values.selling_price ?? ''}</td>
                    <td className="px-3 py-2">
                      {r.errors.length === 0 && !r.duplicateInFile ? (
                        <Badge tone="success">OK</Badge>
                      ) : r.duplicateInFile ? (
                        <Badge tone="warning">Duplikat</Badge>
                      ) : (
                        <span className="text-rose-600">
                          {r.errors.map((e) => e.message).join('; ')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={confirm}
              disabled={busy || preview.globalErrors.length > 0}
              className={btnPrimary}
            >
              {busy ? 'Menjalankan…' : '3. Konfirmasi & Jalankan Import'}
            </button>
            <button onClick={() => setPreview(null)} className={btnSecondary}>
              Batalkan
            </button>
          </div>
        </Card>
      )}

      {jobId && status.data && (
        <Card title="Hasil import" className="mt-4 max-w-2xl">
          <p className="text-sm">
            Status:{' '}
            <Badge
              tone={
                status.data.status === 'COMPLETED'
                  ? 'success'
                  : status.data.status === 'FAILED'
                    ? 'danger'
                    : 'warning'
              }
            >
              {status.data.status}
            </Badge>{' '}
            — {status.data.processedRows}/{status.data.totalRows} baris diproses
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600 md:grid-cols-4">
            <li>Dibuat baru: {status.data.createdRows}</li>
            <li>Diperbarui: {status.data.updatedRows}</li>
            <li>Gagal: {status.data.failedRows}</li>
            <li>Dilewati: {status.data.skippedRows}</li>
          </ul>
          {status.data.errorCount > 0 && (
            <a
              className="mt-3 inline-block text-sm text-sky-600 hover:underline"
              href={`${API_URL}/catalog-imports/${jobId}/errors.csv`}
            >
              Unduh error report (CSV)
            </a>
          )}
        </Card>
      )}
    </AppShell>
  );
}
