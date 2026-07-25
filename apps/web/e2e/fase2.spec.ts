/**
 * E2E kritis Fase 2: login, buat produk, CSV import preview,
 * buat pelanggan, lihat kandidat duplikat, manual merge.
 * Berjalan serial — skenario akhir bergantung data skenario sebelumnya.
 */
import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const stamp = Date.now().toString().slice(-8);
const dupPhone = `08129${stamp.slice(0, 7)}`;

async function login(page: import('@playwright/test').Page) {
  await page.goto('/masuk');
  await page.getByLabel('Email').fill('owner@demo.flowniaga.local');
  await page.getByLabel('Kata sandi').fill('Demo1234!');
  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect(page.getByRole('heading', { name: 'Ringkasan' })).toBeVisible({ timeout: 15_000 });
}

test('login dengan akun demo menampilkan dashboard', async ({ page }) => {
  await login(page);
  await expect(page.getByText('PT Demo Flow Niaga').first()).toBeVisible();
});

test('membuat produk baru dengan variasi', async ({ page }) => {
  await login(page);
  await page.goto('/produk/baru');
  await page.getByLabel('Nama produk *').fill(`Produk E2E ${stamp}`);
  await page.getByLabel('SKU internal').fill(`E2E-SKU-${stamp}`);
  await page.getByLabel('Harga jual (Rp)').fill('123000');
  await page.getByRole('button', { name: 'Simpan Produk' }).click();
  await expect(page.getByRole('heading', { name: `Produk E2E ${stamp}` })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(`E2E-SKU-${stamp}`).first()).toBeVisible();
});

test('CSV import menampilkan preview dengan validasi per baris', async ({ page }) => {
  await login(page);
  await page.goto('/produk/import');
  const csv = [
    'product_name,category,variant_name,internal_sku,barcode,cost_amount,selling_price,unit,status',
    `Produk CSV E2E,Kategori E2E,Var CSV,E2E-CSV-${stamp},,10000,20000,pcs,ACTIVE`,
    ',Kategori E2E,Tanpa Nama,E2E-CSV-ERR-${stamp},,10000,20000,pcs,ACTIVE',
  ].join('\n');
  await page.getByLabel('File CSV').setInputFiles({
    name: 'produk-e2e.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv, 'utf8'),
  });
  await page.getByRole('button', { name: 'Unggah & Preview' }).click();
  await expect(page.getByText('1 valid')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('1 error')).toBeVisible();
  await expect(page.getByText('Nama produk wajib diisi.')).toBeVisible();
});

test('membuat pelanggan baru (telepon dinormalisasi)', async ({ page }) => {
  await login(page);
  await page.goto('/pelanggan/baru');
  await page.getByLabel('Nama tampilan *').fill(`Pelanggan E2E ${stamp}`);
  await page.getByLabel('Telepon (dinormalisasi otomatis)').fill(dupPhone);
  await page.getByRole('button', { name: 'Simpan Pelanggan' }).click();
  await expect(page.getByRole('heading', { name: `Pelanggan E2E ${stamp}` })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(`+628129${stamp.slice(0, 7)}`).first()).toBeVisible();
});

test('duplikat pelanggan terdeteksi dan tampil di halaman kandidat', async ({ page }) => {
  await login(page);
  // Buat pelanggan kedua dengan telepon sama → kandidat duplikat.
  await page.goto('/pelanggan/baru');
  page.once('dialog', (d) => void d.accept());
  await page.getByLabel('Nama tampilan *').fill(`Pelanggan E2E Dup ${stamp}`);
  await page.getByLabel('Telepon (dinormalisasi otomatis)').fill(dupPhone);
  await page.getByRole('button', { name: 'Simpan Pelanggan' }).click();
  await expect(page.getByRole('heading', { name: `Pelanggan E2E Dup ${stamp}` })).toBeVisible({
    timeout: 15_000,
  });

  await page.goto('/pelanggan/duplikat');
  // Urutan pasangan (A ⟷ B) mengikuti sort UUID — cek kartu yang memuat keduanya.
  const card = page.locator('section', { hasText: `Pelanggan E2E Dup ${stamp}` }).first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card.getByText(`Pelanggan E2E ${stamp}`, { exact: false }).first()).toBeVisible();
  await expect(card.getByText('Nomor telepon ternormalisasi sama').first()).toBeVisible();
});

test('manual merge: preview lalu eksekusi dengan alasan', async ({ page }) => {
  await login(page);
  await page.goto('/pelanggan/duplikat');
  const candidateCard = page.locator('section', { hasText: `Pelanggan E2E Dup ${stamp}` }).first();
  await candidateCard.getByRole('button', { name: 'Tinjau & Merge' }).click();

  await expect(page.getByText('Perbandingan & Merge')).toBeVisible();
  await page.getByRole('button', { name: 'Lihat Preview Hasil' }).click();
  await expect(page.getByText('Preview hasil merge')).toBeVisible({ timeout: 15_000 });

  await page.getByLabel('Alasan merge *').fill('E2E: nomor telepon sama, pelanggan yang sama.');
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Konfirmasi Merge' }).click();

  // Kandidat hilang dari daftar dan muncul di riwayat merge.
  await expect(
    page
      .locator('section')
      .filter({ hasText: 'Riwayat merge' })
      .getByText(`Pelanggan E2E Dup ${stamp}`),
  ).toBeVisible({ timeout: 15_000 });
});
