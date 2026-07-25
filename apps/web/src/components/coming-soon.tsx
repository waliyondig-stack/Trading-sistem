import { AppShell } from './app-shell';

/** Empty state untuk modul yang menyusul di fase berikutnya. */
export function ComingSoon({ title, phase }: { title: string; phase: string }) {
  return (
    <AppShell>
      <h1 className="text-xl font-bold text-slate-900">{title}</h1>
      <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <span aria-hidden className="text-4xl">
          🚧
        </span>
        <p className="mt-4 font-medium text-slate-700">Modul {title} sedang disiapkan.</p>
        <p className="mt-1 text-sm text-slate-500">
          Fitur ini hadir pada {phase} sesuai peta jalan pengembangan.
        </p>
      </div>
    </AppShell>
  );
}
