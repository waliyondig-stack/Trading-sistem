# Deteksi Duplikat & Manual Merge Pelanggan

## Normalisasi identitas

- Telepon Indonesia → E.164 `+62…` (`normalizePhoneId`): menerima `08…`, `62…`, `+62…`, dengan spasi/tanda hubung.
- Email → trim + lowercase (`normalizeEmail`).
- Nilai ternormalisasi dipakai untuk pencocokan; nilai asli tetap disimpan sebagai `displayValue`.

## Deteksi duplikat (deterministik, tanpa AI)

Berjalan otomatis setelah create/update pelanggan dan penambahan identitas. Skor dapat dijelaskan dan alasannya disimpan pada kandidat:

| Sinyal                          | Skor | Jenis      |
| ------------------------------- | ---- | ---------- |
| Identitas kanal eksternal sama  | 100  | Kuat/pasti |
| Telepon ternormalisasi sama     | 80   | Kuat       |
| Email ternormalisasi sama       | 80   | Kuat       |
| Nama mirip (≥60% token overlap) | 20   | Pendukung  |
| Nama perusahaan mirip           | 10   | Pendukung  |
| Kota alamat utama sama          | 10   | Pendukung  |

Kandidat (`CustomerMergeCandidate`, status `PENDING`) hanya dibuat bila skor ≥ 60 — **nama mirip saja tidak pernah cukup**. **Tidak ada merge otomatis**; seluruh merge manual.

## Alur manual merge

1. Buka `/pelanggan/duplikat` → daftar kandidat (skor + alasan). Review: `CONFIRMED_DUPLICATE` / `REJECTED` / `IGNORED` (permission `customer.merge.review`, audit `customer.merge_candidate_reviewed`).
2. **Tinjau & Merge** → pilih customer master (target), pilih field yang diambil dari source (`keepFromSource`).
3. `POST /customers/merge/preview` — perbandingan field per field + jumlah identitas/alamat yang akan pindah. **Tidak mengubah data.**
4. Isi alasan → `POST /customers/merge/execute` (permission `customer.merge.execute`).

## Jaminan eksekusi

Eksekusi berjalan dalam **satu transaksi**:

- strategi field diterapkan ke target;
- identitas source dipindah ke target (duplikat persis dihapus — nilainya tetap ada di snapshot);
- seluruh alamat dipindah (primary source diturunkan bila target sudah punya);
- source ditandai `MERGED` + `mergedIntoId` — **tidak dihapus permanen**;
- kandidat pasangan tsb ditandai `CONFIRMED_DUPLICATE`;
- `CustomerMergeHistory` menyimpan `snapshotBefore` lengkap (source & target, termasuk identitas/alamat), strategi, pelaku, alasan — cukup untuk investigasi & pemulihan manual;
- audit `customer.merged` tercatat.

Konflik identitas: identitas `VERIFIED` tidak boleh terpasang pada dua customer aktif (`409 IDENTITY_CONFLICT`) — resolusinya lewat proses merge, bukan penimpaan.

Undo otomatis belum tersedia (by design Fase 2); pemulihan manual memakai `snapshotBefore`.
