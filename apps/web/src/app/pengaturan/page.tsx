'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge, Card } from '@flowniaga/ui';
import { AppShell } from '@/components/app-shell';
import { apiFetch, session } from '@/lib/api';

interface MeResponse {
  user: { id: string; name: string; email: string };
  memberships: {
    membershipId: string;
    tenantId: string;
    tenantName: string;
    roleName: string;
  }[];
}

export default function PengaturanPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<MeResponse>('/auth/me'),
  });

  const activeTenant = session.tenantId;

  return (
    <AppShell>
      <h1 className="text-xl font-bold text-slate-900">Pengaturan</h1>

      {isLoading && (
        <div className="mt-6 h-32 animate-pulse rounded-xl bg-slate-200" aria-busy="true" />
      )}

      {data && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card title="Profil">
            <p className="font-medium">{data.user.name}</p>
            <p className="text-sm text-slate-500">{data.user.email}</p>
          </Card>
          <Card title="Tenant Anda">
            <ul className="space-y-2">
              {data.memberships.map((m) => (
                <li key={m.membershipId} className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{m.tenantName}</p>
                    <p className="text-xs text-slate-500">{m.roleName}</p>
                  </div>
                  {m.tenantId === activeTenant ? (
                    <Badge tone="success">Aktif</Badge>
                  ) : (
                    <button
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs hover:bg-slate-100"
                      onClick={() => {
                        session.setTenant(m.tenantId);
                        void refetch();
                        window.location.reload();
                      }}
                    >
                      Pilih
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
