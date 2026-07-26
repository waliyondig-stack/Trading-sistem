'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { apiFetch, ApiError, session } from '@/lib/api';
import { btnPrimary, inputCls } from '@/components/states';

const daftarSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.string().email('Email tidak valid'),
  password: z.string().min(8, 'Kata sandi minimal 8 karakter'),
  tenantName: z.string().min(2, 'Nama usaha minimal 2 karakter'),
});

type DaftarForm = z.infer<typeof daftarSchema>;

interface RegisterResponse {
  tenantId: string;
  user: { id: string; name: string; email: string };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40);
}

export default function DaftarPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DaftarForm>({ resolver: zodResolver(daftarSchema) });

  const onSubmit = async (values: DaftarForm) => {
    setServerError(null);
    const base = slugify(values.tenantName) || 'usaha';
    // Sufiks acak menghindari tabrakan slug antar pendaftar.
    const tenantSlug = `${base}-${Math.random().toString(36).slice(2, 6)}`.slice(0, 64);
    try {
      const res = await apiFetch<RegisterResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ ...values, tenantSlug }),
      });
      session.setTenant(res.tenantId);
      router.push('/');
    } catch (err) {
      setServerError(
        err instanceof ApiError ? err.message : 'Tidak dapat terhubung ke server. Coba lagi.',
      );
    }
  };

  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'FlowNiaga';

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Daftar — {appName}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Buat akun pemilik dan usaha baru Anda dalam satu langkah.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700">
              Nama lengkap
            </label>
            <input id="name" autoComplete="name" className={inputCls} {...register('name')} />
            {errors.name && (
              <p role="alert" className="mt-1 text-xs text-rose-600">
                {errors.name.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="tenantName" className="block text-sm font-medium text-slate-700">
              Nama usaha
            </label>
            <input
              id="tenantName"
              className={inputCls}
              placeholder="mis. Toko Berkah Jaya"
              {...register('tenantName')}
            />
            {errors.tenantName && (
              <p role="alert" className="mt-1 text-xs text-rose-600">
                {errors.tenantName.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className={inputCls}
              {...register('email')}
            />
            {errors.email && (
              <p role="alert" className="mt-1 text-xs text-rose-600">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Kata sandi
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              className={inputCls}
              {...register('password')}
            />
            {errors.password && (
              <p role="alert" className="mt-1 text-xs text-rose-600">
                {errors.password.message}
              </p>
            )}
          </div>

          {serverError && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {serverError}
            </p>
          )}

          <button type="submit" disabled={isSubmitting} className={`w-full ${btnPrimary}`}>
            {isSubmitting ? 'Memproses…' : 'Daftar & Mulai'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Sudah punya akun?{' '}
          <Link href="/masuk" className="font-medium text-sky-600 hover:underline">
            Masuk
          </Link>
        </p>
      </div>
    </main>
  );
}
