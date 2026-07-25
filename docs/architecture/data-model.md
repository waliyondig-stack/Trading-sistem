# Data Model

Skema Fase 1 sudah terimplementasi di `apps/api/prisma/schema.prisma`. ERD di bawah mencakup **model Fase 1 (implemented)** dan **model target MVP** (Fase 2–6, dicantumkan agar desain konsisten).

## Prinsip

- Setiap tabel bisnis punya `tenantId` + index (kecuali entitas global: `User`, `Permission`).
- Soft delete (`deletedAt`) untuk data bisnis; tidak ada hard delete.
- Uang: integer rupiah (`BigInt`) atau `Decimal` — bukan float.
- Timestamp UTC (`createdAt`, `updatedAt`).
- Stok dikelola lewat **inventory ledger append-only**, bukan update saldo langsung (ADR-003).
- Idempotency: `Order` punya unique `(tenantId, channelId, externalOrderId)` dan `(tenantId, idempotencyKey)`.

## ERD — Fase 1 (implemented)

```mermaid
erDiagram
  Tenant ||--o{ LegalEntity : has
  Tenant ||--o{ Branch : has
  Tenant ||--o{ Warehouse : has
  Tenant ||--o{ Membership : has
  Tenant ||--o{ Role : has
  Tenant ||--o{ AuditLog : has
  Tenant ||--o{ OutboxEvent : has
  LegalEntity ||--o{ Branch : "optional"
  Branch ||--o{ Warehouse : has
  Branch ||--o{ MembershipBranchAccess : scoped
  User ||--o{ Membership : joins
  User ||--o{ RefreshToken : sessions
  User ||--o{ AuditLog : acts
  Role ||--o{ Membership : grants
  Role ||--o{ RolePermission : maps
  Permission ||--o{ RolePermission : maps
  Membership ||--o{ MembershipBranchAccess : limits

  Tenant { uuid id PK  string name  string slug UK  enum status  datetime deletedAt }
  LegalEntity { uuid id PK  uuid tenantId FK  string name  bool isDefault }
  Branch { uuid id PK  uuid tenantId FK  string code  string name  uuid legalEntityId FK }
  Warehouse { uuid id PK  uuid tenantId FK  uuid branchId FK  string code  string name }
  User { uuid id PK  string email UK  string passwordHash  enum status }
  RefreshToken { uuid id PK  uuid userId FK  string tokenHash UK  datetime expiresAt  datetime revokedAt }
  Role { uuid id PK  uuid tenantId FK  string name  bool isSystem }
  Permission { string code PK  string description }
  Membership { uuid id PK  uuid tenantId FK  uuid userId FK  uuid roleId FK  enum status  bool allBranches }
  AuditLog { uuid id PK  uuid tenantId FK  uuid userId FK  string action  string entityType  json before  json after  string correlationId }
  OutboxEvent { uuid id PK  uuid tenantId FK  string eventType  json payload  enum status }
```

Constraint penting Fase 1: `Tenant.slug` unique; `Branch/Warehouse (tenantId, code)` unique; `Membership (tenantId, userId)` unique; `Role (tenantId, name)` unique; index `AuditLog (tenantId, createdAt)` dan `(tenantId, entityType, entityId)`; index `OutboxEvent (status, createdAt)`.

## ERD — Target MVP (Fase 2–6)

```mermaid
erDiagram
  Product ||--o{ ProductVariant : has
  Category ||--o{ Product : classifies
  Product ||--o{ ChannelListing : "listed as"
  Channel ||--o{ ChannelAccount : accounts
  ChannelAccount ||--o{ ChannelListing : owns
  Customer ||--o{ CustomerIdentity : "channel identity"
  Customer ||--o{ CustomerAddress : addresses
  Customer ||--o{ Order : places
  Channel ||--o{ Order : originates
  Order ||--o{ OrderLine : contains
  Order ||--o{ OrderStatusHistory : tracks
  Order ||--o{ Fulfillment : "fulfilled by"
  Order ||--o{ Invoice : billed
  Invoice ||--o{ PaymentAllocation : "paid via"
  Payment ||--o{ PaymentAllocation : allocates
  Payment }o--|| Settlement : settled
  ProductVariant ||--o{ InventoryLedgerEntry : moves
  Warehouse ||--o{ InventoryLedgerEntry : at
  ProductVariant ||--o{ InventoryBalance : balance
  Warehouse ||--o{ InventoryBalance : at
  Order ||--o{ InventoryReservation : reserves
  ChannelAccount ||--o{ ConnectorSyncJob : syncs
  ConnectorSyncJob ||--o{ ConnectorEvent : produces
  WorkflowRule ||--o{ ApprovalRequest : triggers
  AiConversation ||--o{ AiRun : runs

  Order { uuid id PK  uuid tenantId  uuid branchId  uuid channelId  string externalOrderId  string idempotencyKey  bigint totalAmount }
  Payment { uuid id PK  uuid tenantId  string provider  string externalRef  bigint grossAmount  bigint feeAmount  bigint netAmount  enum reconciliationStatus }
  InventoryLedgerEntry { uuid id PK  uuid tenantId  uuid warehouseId  uuid variantId  enum entryType  bigint quantity  string reason  uuid refId }
  InventoryBalance { uuid id PK  uuid tenantId  uuid warehouseId  uuid variantId  bigint physical  bigint reserved  bigint available }
  ApprovalRequest { uuid id PK  uuid tenantId  string type  enum status  json beforeSnapshot  json afterSnapshot  uuid requesterId  uuid approverId }
  AiRun { uuid id PK  uuid tenantId  uuid userId  string promptVersion  json toolCalls  json output  float confidence  enum approvalStatus }
```

Jenis `InventoryLedgerEntry.entryType`: `RECEIPT`, `RESERVATION`, `RESERVATION_RELEASE`, `SALE`, `FULFILLMENT_ISSUE`, `RETURN`, `TRANSFER_OUT`, `TRANSFER_IN`, `ADJUSTMENT`, `DAMAGE`, `EXPIRY`.

Saldo stok yang diturunkan: physical, reserved, available (= physical − reserved), incoming, in-transit, damaged, returned, safety stock.
