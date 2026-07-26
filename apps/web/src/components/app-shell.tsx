'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { NAV_ITEMS } from '@/lib/nav';
import { apiFetch, ApiError, logout, session } from '@/lib/api';

interface MeResponse {
  user: { id: string; name: string; email: string };
  memberships: { tenantId: string; tenantName: string; roleName: string; permissions: string[] }[];
}

/** Kerangka aplikasi: autentikasi via cookie session (ADR-005), sidebar + nav mobile. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'FlowNiaga';

  const { data, isLoading, error } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<MeResponse>('/auth/me'),
    retry: false,
    staleTime: 60_000,
  });

  const unauthorized = error instanceof ApiError && error.status === 401;

  useEffect(() => {
    if (unauthorized) router.replace('/masuk');
  }, [unauthorized, router]);

  useEffect(() => {
    if (data && !session.tenantId && data.memberships[0]) {
      session.setTenant(data.memberships[0].tenantId);
    }
  }, [data]);

  if (isLoading || unauthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Memuat…
      </div>
    );
  }

  const doLogout = async () => {
    await logout();
    router.replace('/masuk');
  };

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4 md:flex">
        <div className="mb-6 px-2 text-lg font-bold text-slate-900">{appName}</div>
        <nav aria-label="Navigasi utama" className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
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
        <div className="mt-4 border-t border-slate-100 pt-3">
          {data && (
            <p className="mb-2 truncate px-2 text-xs text-slate-400" title={data.user.email}>
              {data.user.name}
            </p>
          )}
          <button
            onClick={doLogout}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            Keluar
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <span className="font-bold">{appName}</span>
          <button onClick={doLogout} className="text-sm text-slate-500">
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
