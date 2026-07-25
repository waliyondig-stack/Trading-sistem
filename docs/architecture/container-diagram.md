# Container Diagram

```mermaid
flowchart LR
  subgraph Client
    WEB["apps/web<br/>Next.js PWA<br/>(Bahasa Indonesia, mobile-first)"]
  end

  subgraph Server["Modular Monolith"]
    API["apps/api<br/>NestJS REST + Swagger<br/>Guard: JWT → AccessGuard (default deny)"]
    WORKER["apps/worker<br/>Outbox dispatcher + BullMQ consumer"]
  end

  subgraph Data
    PG[("PostgreSQL<br/>satu database, tenant-scoped rows")]
    REDIS[("Redis<br/>BullMQ queues")]
    S3[("Object storage S3-compatible<br/>(mulai Fase 2)")]
  end

  WEB -- "HTTPS + Bearer JWT + x-tenant-id" --> API
  API -- Prisma --> PG
  API -- "OutboxEvent (transaksi sama)" --> PG
  WORKER -- "poll outbox (pg)" --> PG
  WORKER -- "publish/consume domain-events" --> REDIS
  API -.-> S3
```

## Alasan bentuk

- **Modular monolith** (ADR-001): satu deployable `api`, batas modul ditegakkan lewat struktur module NestJS + kepemilikan tabel + domain event.
- **Transactional outbox** (ADR-001/004): mutasi + event ditulis dalam satu transaksi; worker mempublikasikan asinkron → modul dapat dipecah menjadi service tanpa mengubah semantik event.
- **Worker terpisah proses** agar beban background (sync, retry, notifikasi) tidak mengganggu latensi API.
