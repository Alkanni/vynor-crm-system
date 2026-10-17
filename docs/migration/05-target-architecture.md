# 05 — Blueprint Arsitektur Target

> **Pembaruan rencana eksekusi (17 Oktober 2026):** bagian audit/baseline asli adalah catatan historis pada commit `565e8e4`. Bagian tambahan setelahnya adalah **spesifikasi pelaksanaan yang diusulkan**, bukan bukti bahwa implementasi, keputusan owner, CI, deployment, atau migrasi database baru sudah dilakukan. Baca `agent/00-START-HERE.md` sebelum menugaskan AI Agent.

Blueprint ini diturunkan dari hasil audit, bukan dari struktur referensi yang disalin mentah. Prinsipnya: **pertahankan yang sudah sesuai, ubah hanya yang memang berbeda dari target, dan jangan membuat modul untuk fitur yang belum ada.**

## 1. Topologi runtime target

```text
                         Provider eksternal
     (WhatsApp Cloud, Messenger, Instagram, Telegram, LINE, IMAP/SMTP, Custom API)
                │ webhook / polling                       ▲ send API
                ▼                                         │
┌──────────────────────────── Caddy (TLS, header keamanan, batas body) ───────────────────────────┐
│  /            → file statis SPA (apps/web build Vite), fallback index.html                      │
│  /api/*       → api:3001          /socket.io/*, /realtime/* → api:3001                          │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
                │                                          │
                ▼                                          │
┌─────────────────────────── apps/api (NestJS, N instance) ───────────────────────────┐
│ REST /api/v1 + OpenAPI (Zod) │ Webhook ingress │ Webchat publik │ Socket.IO gateway  │
│ Guard: OIDC JWT → ActorContext (RBAC, workspace) │ Idempotency + rate limit (Redis)  │
│ Tulis domain + outbox_events + pg_notify dalam SATU transaksi Postgres               │
└───────────────┬──────────────────────────────────────────────────▲──────────────────┘
                │ SQL                                              │ LISTEN realtime
                ▼                                                  │
┌──────────────── PostgreSQL 16 (+pgvector) ────────────────┐      │
│ domain, outbox_events, provider_events, audit_logs         │──────┘ NOTIFY setelah COMMIT
└───────────────▲───────────────────────────────────────────┘
                │ claim SKIP LOCKED / update status
┌───────────────┴──────────── apps/worker (NestJS, N instance) ─────────────────────────┐
│ OutboxDispatcher → BullMQ.add(jobId = outbox-<id>)                                    │
│ Consumer: webhooks.process, messages.outbound (+ queue baru saat fitur dibangun)     │
│ Polling IMAP/Telegram (lease per channel) │ Rekonsiliasi PENDING │ Heartbeat          │
└───────────────┬──────────────────────────────────────────────────────────────────────┘
                ▼
        Redis 7 (AOF, noeviction): job BullMQ, idempotency key, rate limit
        Object storage S3 (MinIO/RustFS lokal; S3/R2 di cloud): attachment
        Opsional: OTel Collector → Prometheus → Grafana
```

Yang **tidak** berubah dari arsitektur sekarang: modular monolith dengan dua deployable backend, outbox Postgres sebagai sumber kebenaran event, relay realtime `LISTEN/NOTIFY`, dan adapter channel yang stateless.

## 2. Struktur repositori target

```text
vynor-crm/
├── apps/
│   ├── web/                    React 19 + Vite + TypeScript (SPA)
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── public/             font, brand-assets, runtime-config.js (diisi saat deploy)
│   │   └── src/
│   │       ├── main.tsx        bootstrap: QueryProvider, AuthProvider, RouterProvider
│   │       ├── router.tsx      definisi route (pemetaan 1:1 dari src/app/**)
│   │       ├── routes/         isi halaman yang dipindah dari src/app/**/page.tsx
│   │       ├── components/     (tetap)
│   │       ├── hooks/          (tetap)
│   │       ├── lib/            (tetap) + lib/navigation.ts (pembungkus Link/useRouter)
│   │       └── env.ts          dari window.__VYNOR_CONFIG__ / import.meta.env
│   ├── api/                    NestJS (tetap; modul di §3)
│   └── worker/                 NestJS (tetap; queue/ diganti BullMQ)
├── packages/
│   ├── contracts/              (tetap) + generator OpenAPI dari Zod
│   ├── database/               (tetap)
│   ├── channel-adapters/       (tetap)
│   ├── storage/                (tetap)
│   ├── observability/          (tetap) + otel.ts, metrics.ts
│   └── shared/                 (tetap) + util Redis bersama bila dipakai api dan worker
├── infrastructure/
│   ├── docker/                 Lokasi Dockerfile kanonis; compose di root bila DEC-08 disetujui
│   ├── caddy/Caddyfile
│   ├── observability/          prometheus.yml, dashboard Grafana (opsional)
│   └── scripts/
├── docs/
│   ├── adr/                    + ADR baru: AD-015 BullMQ, AD-016 Vite SPA, AD-017 Redis
│   └── migration/              dokumen ini
├── docker-compose.yml            Compose kanonis di root bila DEC-08 disetujui
├── .github/workflows/
├── package.json, pnpm-workspace.yaml, turbo.json
```

Catatan:

- Paket `packages/config` **tidak** dibuat. Skema env sudah ada di `packages/contracts/src/env`, dan memindahkannya hanya relokasi tanpa manfaat.
- Direktori `tests/` di root **tidak** dibuat. Test tetap di tiap paket; test E2E ada di `apps/web/tests/e2e`.
- Lokasi `docker-compose.yml` final (root atau `infrastructure/docker/`) perlu dipilih owner. Rekomendasi: compose tetap di root (memudahkan `docker compose up`), Dockerfile di `infrastructure/docker/`.

## 3. Modul backend

### 3.1 Modul API yang sudah ada (dipertahankan)

| Modul           | Tanggung jawab                                                  | Data yang dimiliki                                                                | Antarmuka publik                                           | Dependensi                               | Event                                                        | Otorisasi                              |
| --------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------ | -------------------------------------- |
| `iam`           | Verifikasi token, ActorContext, guard, policy                   | Membaca `user_profiles`, `workspace_memberships`, `roles`, `permissions`, `teams` | `AuthGuard`, `PermissionGuard`, `PolicyService`, dekorator | database, contracts                      | —                                                            | —                                      |
| `auth`          | `/auth/me`, dev-session lokal                                   | —                                                                                 | REST                                                       | iam                                      | —                                                            | Terautentikasi / publik (dev)          |
| `audit`         | Mencatat audit dalam transaksi                                  | `audit_logs`                                                                      | `AuditService.recordForActor(actor, entry, tx?)`           | database                                 | —                                                            | Internal                               |
| `channels`      | Connect, reconnect, test, hapus channel; daftar member          | `provider_accounts`, `provider_account_members`                                   | REST `/channels`, `/workspace/members`                     | channel-adapters, shared (cipher), audit | `channel.*` (NOTIFY)                                         | `integration:read/manage`, `user:read` |
| `webhooks`      | Ingress webhook: validasi, journal, ACK                         | `provider_events` (tulis)                                                         | REST publik `/webhooks/:provider/:key`                     | channels (runtime), database             | outbox `webhook.*`                                           | Signature provider                     |
| `webchat`       | Widget publik, sesi pengunjung, pesan                           | via journal                                                                       | REST publik `/webchat/:key/*`                              | channels, Redis (rate limit)             | outbox `webhook.*`                                           | Token pengunjung + rate limit          |
| `conversations` | Daftar/detail conversation, assign, status, kirim, retry, media | `conversations`, `messages` (perintah agent)                                      | REST `/conversations`, `/messages`, `/media`               | channels (runtime), audit                | outbox `message.outbound.requested`; NOTIFY `conversation.*` | `conversation:*`, `message:*`          |
| `storage`       | Presigned download attachment                                   | `attachments` (baca)                                                              | REST `/attachments/:id/download-url`                       | storage, audit                           | —                                                            | `message:read` + workspace             |
| `realtime`      | Gateway Socket.IO, relay NOTIFY                                 | —                                                                                 | Namespace `/realtime`                                      | iam                                      | `resync`, `conversation.*`                                   | JWT handshake, room per workspace      |
| `health`        | Liveness, readiness, indikator                                  | —                                                                                 | `/health/*`                                                | observability                            | —                                                            | Publik                                 |
| `openapi`       | Dokumen OpenAPI dan katalog error                               | —                                                                                 | `/openapi.json`, `/error-catalog`                          | contracts                                | —                                                            | Publik                                 |
| `config`        | Env tervalidasi                                                 | —                                                                                 | Token DI `API_ENV`                                         | contracts                                | —                                                            | —                                      |

Modul baru yang ditambahkan **oleh migrasi**: `redis` (global, menyediakan klien dan health indicator) dan `metrics` (endpoint `/metrics`, WU-10).

### 3.2 Worker

| Area             | Tanggung jawab                                    | Perubahan                                                                                                                                                                                                                                                                              |
| ---------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `queue/`         | Transport job                                     | `PgBossService` → `QueueService` (BullMQ) dengan kontrak yang sama: `work()`, `send()`, `isRunning()`; ditambah perilaku sejak `1d6b578`: start retry + timeout, handler `work()` tertunda, `send()` gagal cepat, token DI transport, graceful shutdown (`08` NF-02/NF-03, VYN-05A-01) |
| `outbox/`        | Claim outbox, kirim ke queue, lease recovery, DLQ | Hanya pemanggilan `sendJob` (dedup lewat `jobId`)                                                                                                                                                                                                                                      |
| `processing/`    | Consumer inbound dan outbound                     | `job.retryCount/retryLimit` → `job.attemptsMade/opts.attempts`                                                                                                                                                                                                                         |
| `conversations/` | Ingest Conversation Core                          | Tetap                                                                                                                                                                                                                                                                                  |
| `polling/`       | IMAP / Telegram                                   | Tetap                                                                                                                                                                                                                                                                                  |
| `health/`        | Heartbeat                                         | Syarat sehat: DB ping **dan** Redis ping **dan** worker BullMQ berjalan                                                                                                                                                                                                                |

### 3.3 Modul domain untuk fitur yang belum ada (backlog produk, bukan migrasi)

Modul berikut **tidak** dibuat oleh migrasi. Batasnya ditetapkan sekarang supaya fitur baru tidak bertabrakan kepemilikan data:

| Modul                                        | Data yang akan dimiliki                                           | Bergantung pada                                | Catatan                                                                                                                 |
| -------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `contacts`                                   | `contacts`, `contact_identities` (CRUD, merge, tag, custom field) | audit                                          | Saat ini ditulis oleh ingest worker. Setelah modul ini ada, ingest memanggil service-nya, bukan menulis tabel langsung. |
| `crm` (lead, deal, pipeline, activity, task) | Tabel baru                                                        | contacts                                       | Satu modul dulu; dipecah hanya bila membesar                                                                            |
| `tickets`                                    | Tabel baru (SLA, eskalasi)                                        | conversations, contacts                        |                                                                                                                         |
| `campaigns` (broadcast, blast, template)     | Tabel baru                                                        | channels, contacts, queue `campaigns.dispatch` | Butuh BullMQ dan rate limit                                                                                             |
| `automation`                                 | Tabel baru (rule)                                                 | conversations, contacts                        |                                                                                                                         |
| `reporting`                                  | Read model / SQL agregat                                          | Semua (read-only)                              | SQL teroptimasi; tidak menulis domain                                                                                   |
| `notifications`                              | Tabel baru                                                        | —                                              | Event `notification.created`                                                                                            |
| `ai`                                         | Tabel AI agent, run, knowledge (+pgvector)                        | conversations (AD-011)                         | Konfigurasi dipindah dari `localStorage` ke server                                                                      |

Aturan ketergantungan: modul hanya mengakses tabel milik modul lain lewat service publik modul tersebut, tidak lewat Prisma langsung. Pengecualian yang sudah ada dan dipertahankan sementara: ingest worker menulis `contacts`/`conversations`/`messages` secara langsung, karena logika Conversation Core memang berada di sana.

## 4. Frontend

### 4.1 Pemetaan Next.js → Vite

| Next.js (sekarang)                                                                         | Vite (target)                                                                                                                                                              |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/layout.tsx` + `metadata`                                                          | `index.html` (title, meta, ikon) + `main.tsx` (provider)                                                                                                                   |
| `src/app/**/page.tsx`                                                                      | `src/routes/**` + entri di `router.tsx` (path URL sama persis)                                                                                                             |
| `src/app/ai-agent/[agentId]/page.tsx` (segmen dinamis, `ƒ` di `next build`, `useParams`)   | Route berparameter `/ai-agent/:agentId` + `useParams` dari `lib/navigation.ts`; tanpa SSR. Deep link/refresh diverifikasi di WU-03 dan WU-06 (koreksi 2026-10-17, 01 §6.3) |
| `src/app/loading.tsx`, `error.tsx`                                                         | `Suspense` fallback dan `errorElement` route                                                                                                                               |
| `next/link`                                                                                | `Link` dari `lib/navigation.ts` (membungkus React Router)                                                                                                                  |
| `next/navigation` (`useRouter`, `usePathname`, `useSearchParams`, `useParams`, `redirect`) | Pembungkus di `lib/navigation.ts`                                                                                                                                          |
| `middleware.ts` (cookie + correlation ID)                                                  | `RequireAuth` route guard berbasis `AuthContext`. Correlation ID dibuat di `api-client.ts`.                                                                                |
| `NEXT_PUBLIC_*` (inline saat build)                                                        | `window.__VYNOR_CONFIG__` dari `runtime-config.js` (diisi saat container start), fallback `import.meta.env.VITE_*` untuk dev; tetap divalidasi `PublicWebEnvSchema`        |
| `output: 'standalone'` + `node server.js`                                                  | `vite build` → `dist/` disajikan Caddy                                                                                                                                     |
| `next start` di Playwright                                                                 | `vite preview`                                                                                                                                                             |

Router yang direkomendasikan: **React Router** (library mode, `createBrowserRouter`). Konsepnya paling sedikit dan pemetaannya ke struktur `app/` sederhana. Alternatifnya TanStack Router (type-safe, integrasi dengan TanStack Query); bisa dipilih bila owner menginginkannya.

### 4.2 Struktur fitur

Struktur `components/<area>` dan `lib/<area>` yang ada sudah berorientasi fitur (inbox, channels, ai-agent, broadcast, blast). Folder **tidak** dipindah ke `features/` di migrasi ini, karena itu relokasi file tanpa manfaat fungsional dan akan membesarkan diff. Bila diinginkan, lakukan sebagai refactor terpisah setelah Vite stabil.

### 4.3 Auth di frontend

- Token tetap dikelola `supabase-js` (atau dev-session di lokal). Cookie `vynor_session` dihapus.
- `RequireAuth` mengarahkan ke `/login?returnUrl=…` bila tidak ada sesi, sama seperti middleware sekarang.
- Mode preview/demo dipertahankan apa adanya (perilaku yang sudah ada).

## 5. Background processing

| Aspek             | Desain                                                                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sumber kebenaran  | `outbox_events` (Postgres), ditulis dalam transaksi domain                                                                                            |
| Transport         | BullMQ, satu queue per `QUEUE_NAMES` (nama tetap sama)                                                                                                |
| Dedup             | `jobId = outbox-<eventId>`; handler idempoten                                                                                                         |
| Retry             | `attempts = retryLimit + 1`, exponential backoff dengan jitter (`DEFAULT_JOB_RETRY_POLICY`)                                                           |
| Klasifikasi gagal | Tetap: error provider `retryable` → throw (BullMQ retry); permanen → tandai domain `FAILED` dan job selesai                                           |
| Dead letter       | Domain: `outbox_events.DEAD_LETTER`, `messages.FAILED`, `provider_events.FAILED`. Transport: failed set BullMQ dengan retensi sesuai `retentionDays`. |
| Monitoring        | Metrik queue (waiting, active, failed, delayed) via `/metrics`; Bull Board opsional di belakang auth admin                                            |
| Shutdown          | `worker.close()` menunggu job aktif; dispatcher berhenti claim lebih dulu                                                                             |

## 6. Realtime

Desain sekarang dipertahankan: autentikasi JWT di handshake, room `workspace:<id>` dan `conversation:<id>`, instruksi `resync` saat connect atau join, dan klien melakukan refetch REST (event hanya berfungsi sebagai petunjuk). Perubahan: CORS gateway dibatasi ke `CORS_ALLOWED_ORIGINS`. Event tambahan (`notification.created`, `agent.presence.changed`) ditambahkan saat fiturnya dibangun.

## 7. Keamanan

| Area             | Target                                                                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Token            | Verifier OIDC generik: `issuer`, `audience`, dan JWKS dapat dikonfigurasi (default Supabase); HS256 secret tetap didukung; issuer dev-session hanya diterima di `local`/`test` |
| Tenant isolation | Tidak berubah. Ditambah: key Redis selalu diberi prefix workspace (`idem:<workspaceId>:<key>`), dan job membawa `workspaceId` di envelope (sudah ada).                         |
| Webhook          | Tidak berubah                                                                                                                                                                  |
| Secret           | Tetap env tervalidasi. `REDIS_URL` wajib di staging dan production.                                                                                                            |
| Frontend         | Tanpa token di cookie. CSP untuk SPA statis didefinisikan di Caddy.                                                                                                            |

## 8. Kontrak operasional yang harus dibuktikan per vertical slice

Blueprint pada §1–7 adalah **target usulan**, bukan status runtime yang telah dicapai. File sistem dan service persisnya harus diperiksa pada branch aktual. Saat `DEC-08` disetujui, satu `docker-compose.yml` di root dan Dockerfile kanonis di `infrastructure/docker/` adalah satu-satunya sumber; file duplikat dipangkas di WU-01 secara terkontrol. Aturan ini menyelesaikan kontradiksi gambar pohon awal dengan catatan §2.

| Slice         | Jalur yang dapat dilihat pengguna/operasi                                                      | Batas tetap                                          | Bukti verifikasi                             |
| ------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------- |
| Health        | `docker compose up --build --wait` → API health 200 → worker dan Caddy siap                    | `/api/v1` tetap prefix API                           | Cek health container dan curl melalui proxy  |
| Inbound       | Signed webhook → `provider_events` → outbox PG → BullMQ → worker → Inbox dan `resync` realtime | Signature, dedup, tenant scoping, ACK cepat          | Playwright E2E + inspeksi DB sandbox         |
| Outbound      | Composer → `messages.PENDING` + outbox → queue → Graph stub → status SENT/receipt              | Domain status monoton; satu workspace                | UI, API, queue, DB dan mock request count    |
| Redis state   | Request idempotent di instance A → replay di B, webchat 429 konsisten                          | Atomic locking/replay/TTL, fail closed sesuai DEC-04 | Dua API instance, outage/reconnect           |
| Static web    | Deep link `/inbox` lewat Caddy → SPA → API/socket sehat                                        | Tidak ada kebutuhan Node SSR, aset hashed cache      | Browser refresh, origin, CSP dan screenshot  |
| Auth          | Supabase client / dev-session → API JWT verifier → RBAC/ActorContext                           | `iss/aud` hanya enforced bila siap                   | Unit kontrak + test login live di gate owner |
| Observability | Webhook → worker → send → trace/log dan metrics privat                                         | Redaction Pino; tidak ada endpoint metrics publik    | Correlation trace ID dan dashboard internal  |

### 8.1 Pemulihan antrean dan redis

Redis dikonfigurasi AOF `everysec` dan `noeviction`, tetapi masih ada failure window. `outbox_events` di PostgreSQL adalah basis rekonsiliasi, **bukan** asumsi bahwa Redis selalu menyimpan semua job. Jika worker/produser Redis down, readiness merepresentasikan kegagalan, dan pengiriman ulang hanya setelah pengecekan dampak domain. `removeOnComplete` menyebabkan jobId lama dapat dipakai lagi; domain/database tetap harus menolak efek bisnis ganda.

Di WU-05a, pisahkan **producer transport baru** dengan **consumer drain legacy** sehingga tidak terjadi dua produser aktif yang mengambil event outbox yang sama. Sebelum WU-05b, buktikan tidak ada job pg-boss dalam state `created`/`retry`/`active` untuk tiap environment yang diizinkan. WU-05c tidak otomatis terjadi dan butuh izin destruktif tersendiri.

### 8.2 Kontrak runtime web statis

`runtime-config.js` hanya boleh memuat konfigurasi publik (contoh origin API, URL project Supabase dan anon/public key yang disetujui). Jangan menulis `SUPABASE_JWT_SECRET`, service role key, encryption master key, token channel, atau kredensial DB ke web bundle maupun log. Validasi schema `PublicWebEnvSchema` tetap. Route auth klien memberi pengalaman pengguna, tetapi RBAC di API tetap gerbang keamanan sesungguhnya. Logout/refresh dan akses langsung deep link harus diuji.

**Worker metrics:** worker berjalan sebagai Nest application context tanpa listener HTTP; WU-10 wajib memilih jalur scrape privat/collector yang nyata, bukan mengasumsikan endpoint HTTP worker sudah ada. Endpoint `/metrics` API juga tidak boleh diproxy publik oleh Caddy.

### 8.3 Stabilitas kontrak dan persetujuan

Tidak mengubah: struktur payload REST `/api/v1`, Socket.IO event `conversation.*`, contract Zod, policy RBAC, foreign key domain, UUIDv7 dan dedup provider. Perubahan skema `public` bukan bagian WU wajib. Semua keputusan arsitektur masih menunggu `DEC-01..09`, dan deployment di luar lingkungan test hanya dengan gate environment. Lihat `agent/03-EXECUTION-RUNBOOK.md`.
