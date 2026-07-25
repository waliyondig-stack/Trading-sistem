'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NAV_ITEMS } from '@/lib/nav';
import { session } from '@/lib/api';

/** Kerangka aplikasi: sidebar (desktop) + bottom sheet nav (mobile). */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'FlowNiaga';

  useEffect(() => {
    if (!session.accessToken) {
      router.replace('/masuk');
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Memuat…
      </div>
    );
  }

  const logout = () => {
    session.clear();
    router.replace('/masuk');
  };

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4 md:flex">
        <div className="mb-6 px-2 text-lg font-bold text-slate-900">{appName}</div>
        <nav aria-label="Navigasi utama" className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                  active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={logout}
          className="mt-4 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
        >
          Keluar
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <span className="font-bold">{appName}</span>
          <button onClick={logout} className="text-sm text-slate-500">
            Keluar
          </button>
        </header>
        <main className="flex-1 p-4 pb-24 md:p-8 md:pb-8">{children}</main>
        <nav
          aria-label="Navigasi bawah"
          className="fixed inset-x-0 bottom-0 flex justify-around border-t border-slate-200 bg-white py-2 md:hidden"
        >
          {NAV_ITEMS.slice(0, 5).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center px-2 text-[11px] ${
                pathname === item.href ? 'font-semibold text-slate-900' : 'text-slate-500'
              }`}
            >
              <span aria-hidden className="text-base">
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
