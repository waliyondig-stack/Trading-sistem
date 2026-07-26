/**
 * Konfigurasi brand aplikasi.
 *
 * "FlowNiaga" adalah nama kerja. Seluruh identitas merek (nama, tagline,
 * domain, email) diganti melalui environment variable — bukan dengan
 * mengubah logika aplikasi.
 */
export interface BrandConfig {
  /** Nama aplikasi yang ditampilkan ke pengguna. */
  appName: string;
  /** Tagline singkat. */
  tagline: string;
  /** Locale default aplikasi. */
  defaultLocale: string;
  /** Timezone default untuk tampilan (penyimpanan tetap UTC). */
  defaultTimezone: string;
  /** Mata uang default. */
  defaultCurrency: string;
}

export function getBrandConfig(env: Record<string, string | undefined> = process.env): BrandConfig {
  return {
    appName: env.APP_NAME ?? env.NEXT_PUBLIC_APP_NAME ?? 'FlowNiaga',
    tagline: env.APP_TAGLINE ?? 'Sistem Operasi Bisnis Omnichannel',
    defaultLocale: env.APP_LOCALE ?? 'id-ID',
    defaultTimezone: env.APP_TIMEZONE ?? 'Asia/Jakarta',
    defaultCurrency: env.APP_CURRENCY ?? 'IDR',
  };
}

/** Format angka rupiah (nilai disimpan sebagai integer rupiah, bukan float). */
export function formatIdr(amount: number | bigint, locale = 'id-ID'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}
