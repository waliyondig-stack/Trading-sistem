'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { apiFetch, ApiError, session } from '@/lib/api';

const loginSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(1, 'Kata sandi wajib diisi'),
});

type LoginForm = z.infer<typeof loginSchema>;

interface LoginResponse {
  user: { id: string; name: string; email: string };
  memberships: { tenantId: string; tenantName: string; roleName: string }[];
}

export default function MasukPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginForm) => {
    setServerError(null);
    try {
      // Session diset server sebagai cookie httpOnly; hanya tenant aktif yang disimpan.
      const res = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      const tenantId = res.memberships[0]?.tenantId;
      if (tenantId) session.setTenant(tenantId);
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
        <h1 className="text-2xl font-bold text-slate-900">{appName}</h1>
        <p className="mt-1 text-sm text-slate-500">Masuk untuk mengelola bisnis Anda.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
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
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
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

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {isSubmitting ? 'Memproses…' : 'Masuk'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Belum punya akun?{' '}
          <Link href="/daftar" className="font-medium text-sky-600 hover:underline">
            Daftar usaha baru
          </Link>
        </p>
      </div>
    </main>
  );
}
