# AI Tool Catalog

Katalog internal tool yang boleh diakses AI Assistant (dibangun Fase 6). Setiap tool membungkus application service yang sudah tenant-scoped + permission-checked — AI tidak pernah menyentuh database langsung.

## Konvensi tool

- Nama: `get_*` (read-only), `draft_*` (Level 3), `execute_*` (Level 4, selalu lewat approval).
- Input/output berupa JSON schema ketat.
- Setiap pemanggilan membawa `tenantId` + `userId` dari sesi (bukan dari model) dan dicatat di `AiRun.toolCalls`.
- Tool read-only mengembalikan metadata: `periode`, `sumber`, `dataDiperbaruiPada`, dan `dataCukup: boolean`.

## Tool Fase 6 (read-only, MVP)

| Tool                     | Menjawab                        | Sumber data                      | Permission efektif   |
| ------------------------ | ------------------------------- | -------------------------------- | -------------------- |
| `get_sales_summary`      | Berapa omzet hari ini/periode X | Order (paid), per branch         | `dashboard.read`     |
| `get_order_count`        | Berapa order hari ini           | Order                            | `dashboard.read`     |
| `get_top_products`       | Produk apa yang paling laku     | OrderLine agregat                | `dashboard.read`     |
| `get_critical_stock`     | Produk apa yang stoknya kritis  | InventoryBalance vs safety stock | `warehouse.read`     |
| `get_unmatched_payments` | Pembayaran apa yang belum cocok | Payment (reconciliation queue)   | `audit.read`/finance |

## Tool terencana (Fase 7+)

`draft_purchase_order`, `draft_payment_reminder`, `draft_stock_adjustment`, `draft_customer_message`, `execute_approved_action` (satu-satunya jalur eksekusi; memverifikasi `ApprovalRequest` berstatus `approved`).

## Aturan jawaban

1. Selalu sebutkan rentang waktu dan sumber data.
2. Bila `dataCukup=false` → sampaikan data tidak cukup; dilarang menebak angka.
3. Angka ditampilkan dalam format id-ID / IDR.
4. Konteks percakapan tidak boleh membawa data tenant lain (conversation terikat tenant).
