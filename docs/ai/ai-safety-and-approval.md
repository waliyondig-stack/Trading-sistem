# AI Safety & Approval

AI Orchestrator dibangun mulai Fase 6, namun kebijakan keamanannya mengikat sejak sekarang.

## Empat level otomatisasi

| Level | Nama        | Contoh                                                           | Syarat                                                                                                           |
| ----- | ----------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1     | Informasi   | Omzet hari ini, stok kritis, pembayaran belum cocok              | Read-only via internal tool ber-otorisasi                                                                        |
| 2     | Rekomendasi | Saran reorder, deteksi anomali, prediksi stok habis              | Level 1 + penjelasan dasar data                                                                                  |
| 3     | Draft       | Draft PO, draft invoice, draft pesan pelanggan, draft adjustment | Draft tidak pernah tereksekusi otomatis                                                                          |
| 4     | Execute     | Menjalankan tindakan yang disetujui                              | Kebijakan tenant mengizinkan + risiko rendah + permission user cukup + approval bila diperlukan + tercatat penuh |

## Larangan keras (tanpa rule + approval eksplisit)

AI dilarang: mengarang angka; mengakses tenant lain; menghapus data permanen; memindahkan uang; refund; mengubah harga massal; mengirim kampanye massal; keputusan HR; pembelian besar.

## Arsitektur keamanan

1. **Provider abstraction** — domain tidak bergantung pada satu penyedia AI; fallback saat provider gagal.
2. **Tool-based access only** — AI hanya mengambil data lewat internal tool yang menjalankan authorization yang sama dengan REST API (tenant context + permission). **Tidak ada akses database bebas.**
3. **Structured output + schema validation** — output AI divalidasi terhadap schema sebelum dipakai.
4. **Citation wajib** — setiap jawaban menyertakan rentang waktu, sumber data, waktu data diperbarui; bila query kosong → jawab "data tidak cukup", bukan mengarang.
5. **AI run log** — setiap run menyimpan: tenant, user, conversation, prompt version, tool calls, data source, structured output, confidence, approval status, executed action, timestamp, error (model `AiRun`).
6. **Approval framework** — tindakan Level 3→4 melewati `ApprovalRequest` (`pending/approved/rejected/cancelled/expired`) dengan requester, approver, reason, comment, before/after snapshot, final status, timestamp.
7. **Evaluation dataset** — pertanyaan/jawaban kanonik untuk regresi kualitas sebelum rilis perubahan prompt.

## Workflow & approval (Fase 7)

Model aturan: `WHEN event IF condition THEN action|draft REQUIRE approval-policy`. Contoh: stok < minimum → draft reorder; diskon > batas → approval Owner; adjustment > batas → approval Manager; connector gagal berulang → alert.
