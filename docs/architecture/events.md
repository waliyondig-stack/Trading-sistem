# Domain Events

Domain event ditulis lewat **transactional outbox** (`OutboxService.emit`, tabel `OutboxEvent`) dalam transaksi yang sama dengan mutasi datanya, lalu dipublikasikan asinkron oleh `apps/worker` ke queue BullMQ `domain-events`.

## Konvensi

- Nama event: `<entity>.<past-tense>` huruf kecil, contoh `tenant.created`, `branch.created`.
- Payload: JSON kecil berisi ID dan field kunci — konsumen mengambil detail dari sumber data bila perlu.
- Event selalu membawa `tenantId` (nullable hanya untuk event sistem).
- Konsumen wajib idempotent (event bisa terkirim ulang; at-least-once delivery).

## Event Fase 1

| Event            | Emitter              | Payload              |
| ---------------- | -------------------- | -------------------- |
| `tenant.created` | AuthService.register | `{ tenantId, slug }` |
| `branch.created` | BranchService.create | `{ branchId }`       |

## Event terencana (Fase 2+)

`product.created/updated`, `product.imported`, `customer.merged`, `order.created/status-changed/cancelled`, `inventory.reserved/released/issued/adjusted`, `payment.recorded/matched/mismatched`, `connector.sync-failed`, `approval.requested/decided`, `ai.action-drafted/executed`.

## Lifecycle outbox

`PENDING → PROCESSED` (worker berhasil publish) atau `FAILED` (setelah retry habis — akan ditambah dead-letter handling di Fase 5). Kolom `attempts` menghitung percobaan.
