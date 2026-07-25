# Domain Boundaries (Bounded Context)

20 bounded context direncanakan; Fase 1 mengimplementasikan yang dicetak tebal.

| #   | Context                   | Kepemilikan data utama                                                                           | Status                                                |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| 1   | **Identity & Access**     | User, RefreshToken, Role, Permission                                                             | ✅                                                    |
| 2   | **Organization & Tenant** | Tenant, LegalEntity, Branch, Warehouse, Membership                                               | ✅                                                    |
| 3   | **Catalog / PIM**         | Product, ProductVariant, Category, ChannelListing, CatalogImportJob                              | ✅ (Fase 2)                                           |
| 4   | **Customer & CRM**        | Customer, CustomerIdentity, CustomerAddress, MergeCandidate/History                              | ✅ (Fase 2)                                           |
| 5   | Channel & Integration Hub | Channel (✅ dasar, dimiliki Catalog sementara), ChannelAccount, ConnectorSyncJob, ConnectorEvent | Fase 5                                                |
| 6   | Order Management          | Order, OrderLine, OrderStatusHistory, Fulfillment                                                | Fase 3                                                |
| 7   | Inventory & Warehouse     | InventoryLedgerEntry, InventoryBalance, InventoryReservation                                     | Fase 3                                                |
| 8   | Pricing & Promotion       | PriceList, Promotion                                                                             | Fase 3+                                               |
| 9   | Payment & Reconciliation  | Payment, PaymentAllocation, Settlement                                                           | Fase 4                                                |
| 10  | Invoicing & Finance       | Invoice                                                                                          | Fase 4                                                |
| 11  | Procurement & Supplier    | PurchaseOrder, Supplier                                                                          | Fase 7+                                               |
| 12  | Operations & Work Order   | WorkOrder                                                                                        | Fase 8                                                |
| 13  | Marketing                 | Campaign                                                                                         | Fase 7+                                               |
| 14  | Human Resources           | (ditunda)                                                                                        | Fase 9+                                               |
| 15  | Workflow & Approval       | WorkflowRule, ApprovalRequest                                                                    | Fase 7 (ApprovalRequest dipakai lebih awal di Fase 3) |
| 16  | Notification              | Notification                                                                                     | Fase 7                                                |
| 17  | AI Orchestrator           | AiConversation, AiRun                                                                            | Fase 6                                                |
| 18  | Analytics                 | read model / materialized view                                                                   | Fase 6+                                               |
| 19  | **Audit & Compliance**    | AuditLog                                                                                         | ✅                                                    |
| 20  | Industry Pack             | konfigurasi per industri                                                                         | Fase 8                                                |

## Aturan antar-modul

1. Setiap modul **memiliki** tabelnya; modul lain dilarang menulis tabel tersebut secara langsung.
2. Komunikasi antar modul: pemanggilan application service (dalam proses) atau **domain event** via transactional outbox.
3. Semua query modul wajib **tenant-scoped** (`tenantId` pada `where`).
4. Authorization dideklarasikan per endpoint (`@RequirePermissions`); tidak ada endpoint tenant tanpa deklarasi (default deny oleh `AccessGuard`).
5. Modul infrastruktur global: `PrismaModule`, `AuditModule`, `OutboxModule` (`@Global` di NestJS).
