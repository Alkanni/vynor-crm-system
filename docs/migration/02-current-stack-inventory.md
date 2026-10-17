# 02 — Inventaris Stack Saat Ini

> **Pembaruan rencana eksekusi (17 Oktober 2026):** bagian audit/baseline asli adalah catatan historis pada commit `565e8e4`. Bagian tambahan setelahnya adalah **spesifikasi pelaksanaan yang diusulkan**, bukan bukti bahwa implementasi, keputusan owner, CI, deployment, atau migrasi database baru sudah dilakukan. Baca `agent/00-START-HERE.md` sebelum menugaskan AI Agent.

Sumber: `package.json` di setiap workspace, `pnpm-lock.yaml`, konfigurasi, dan pembacaan kode pada commit `565e8e4`. Versi yang tercantum adalah versi yang dideklarasikan.

## 1. Stack per lapisan

### 1.1 Bahasa dan toolchain

| Komponen        | Saat ini                                                                                           | Catatan                                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Bahasa          | TypeScript 5.8.3 (pnpm catalog)                                                                    | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, target ES2024, `NodeNext` |
| Runtime         | Node.js 24.19.0 (`.node-version`, `.nvmrc`, `engines`)                                             |                                                                                                                       |
| Package manager | pnpm 11.25.0 (workspace, `shared-workspace-lockfile`, `strict-peer-dependencies`, `engine-strict`) |                                                                                                                       |
| Monorepo        | Turborepo 2.11.3                                                                                   | Task: `build`, `dev`, `typecheck`, `lint`, `db:generate`                                                              |
| Lint / format   | ESLint 10.11 + typescript-eslint 8.70, Prettier 3.9.8                                              | Aturan `no-restricted-imports` menjaga batas paket ↔ app                                                              |
| Test            | Vitest 5.0.1 (root config + alias ke `src`), Playwright 1.63 (1 spec)                              | `fileParallelism: false` karena test integrasi berbagi satu database                                                  |
| Dev runner      | `tsc-watch` (api/worker), `next dev` (web), `tsx` (skrip)                                          | `tsx` sengaja tidak dipakai untuk Nest karena esbuild tidak meng-emit decorator metadata                              |

### 1.2 Frontend (`apps/web`)

| Komponen       | Saat ini                                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| Framework      | Next.js 16.3.6 (App Router, `output: 'standalone'`)                                                         |
| UI library     | React 19.3.0                                                                                                |
| Routing        | File-based App Router (`src/app/**/page.tsx`), `next/link`, `next/navigation`                               |
| Server state   | TanStack Query 5.103                                                                                        |
| Local state    | Zustand 5.0 (`lib/store/ui-store.ts`)                                                                       |
| Styling        | Tailwind CSS 4.3 (`@tailwindcss/postcss`), design token CSS di `globals.css`, `clsx` + `tailwind-merge`     |
| Komponen       | Primitif buatan sendiri di `components/ui` (Button, Dialog, Dropdown, Toast, dll.). **Tanpa** Radix/shadcn. |
| Ikon           | lucide-react                                                                                                |
| Auth client    | `@supabase/supabase-js` 2.117, dev-session lewat API, mode demo/preview                                     |
| API client     | `fetch` wrapper sendiri (`lib/api/api-client.ts`) dengan envelope dari `@vynor/contracts`                   |
| Realtime       | `socket.io-client` 4.8 (namespace `/realtime`)                                                              |
| Lain-lain      | `pdfjs-dist` 5.7 (ekstraksi teks PDF untuk knowledge AI Agent di browser)                                   |
| Proteksi route | `middleware.ts` (cek keberadaan cookie)                                                                     |

### 1.3 Backend (`apps/api`, `apps/worker`)

| Komponen          | Saat ini                                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework         | NestJS 12.0.3                                                                                                                                                                  |
| HTTP adapter      | Express (`@nestjs/platform-express`), `rawBody: true`, body limit JSON 5 MB, `trust proxy`                                                                                     |
| Pola arsitektur   | Modular monolith, 2 deployable: API dan worker (AD-001)                                                                                                                        |
| API               | REST di bawah `/api/v1`, envelope `{ data, meta }`, error format RFC 7807 lewat `ApiExceptionFilter`, cursor pagination                                                        |
| Validasi          | `ZodValidationPipe` dengan skema dari `@vynor/contracts` (Zod 4.6)                                                                                                             |
| OpenAPI           | Dokumen OpenAPI 3 ditulis tangan, disajikan di `GET /api/v1/openapi.json`                                                                                                      |
| Autentikasi       | JWT Supabase Auth: HS256 (`SUPABASE_JWT_SECRET`), lalu JWKS (`jose` 6.2). Dev-session lokal (HS256, issuer `vynor-dev-session`).                                               |
| Otorisasi         | RBAC di tabel internal: role → permission (`resource:action`), wildcard `*` untuk SUPER_ADMIN, workspace dari header `x-workspace-id`/slug yang divalidasi terhadap membership |
| Audit             | Tabel `audit_logs`, ditulis dalam transaksi domain                                                                                                                             |
| Idempotency       | Header `Idempotency-Key` lewat interceptor dengan store **in-memory**                                                                                                          |
| Realtime          | `@nestjs/websockets` + Socket.IO 4.8, relay `LISTEN/NOTIFY` Postgres lewat `pg` 8.23                                                                                           |
| Background job    | **pg-boss 12.33** (Postgres, schema `pgboss`) + transactional outbox                                                                                                           |
| Scheduler         | `setInterval` di service worker (outbox poll 1 dtk, lease recovery 30 dtk, rekonsiliasi pesan tertahan 60 dtk, discovery polling 5 dtk)                                        |
| Logging           | Pino 10 JSON dengan redaction dan correlation ID                                                                                                                               |
| Error tracking    | Hanya scrubber Sentry. SDK tidak terpasang.                                                                                                                                    |
| Metrics / tracing | Tidak ada                                                                                                                                                                      |

### 1.4 Data dan penyimpanan

| Komponen       | Saat ini                                                                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database       | PostgreSQL 16 (`pgvector/pgvector:pg16`), kompatibel dengan Supabase (pooled `DATABASE_URL` dan `DIRECT_URL`)                                       |
| Ekstensi       | `vector` (pgvector), `uuid-ossp`. pgvector diaktifkan tetapi belum dipakai.                                                                         |
| ORM            | Prisma 6.4.1 (`prisma-client-js`, `previewFeatures = postgresqlExtensions`)                                                                         |
| SQL manual     | `$queryRaw` untuk claim outbox (`FOR UPDATE SKIP LOCKED`), lease recovery, dan `pg_notify`                                                          |
| Migrasi        | Prisma Migrate, 7 migrasi, forward-only, drift check di CI (`migrate diff` dengan shadow schema)                                                    |
| ID             | CUID (default Prisma) untuk entitas; UUIDv7 untuk outbox, provider event, dan message                                                               |
| Cache          | **Tidak ada**                                                                                                                                       |
| Object storage | Klien S3 SigV4 buatan sendiri (`packages/storage`, tanpa AWS SDK). Di compose dijalankan MinIO (`minio/minio:latest`) dengan nama service `rustfs`. |

### 1.5 Integrasi channel (`packages/channel-adapters`)

| Provider             | Inbound                                                            | Outbound            | Dependensi                                            |
| -------------------- | ------------------------------------------------------------------ | ------------------- | ----------------------------------------------------- |
| WhatsApp Cloud API   | Webhook (HMAC `X-Hub-Signature-256`, handshake `hub.verify_token`) | Graph API           | `fetch`                                               |
| Messenger, Instagram | Webhook Meta                                                       | Graph API           | `fetch`                                               |
| Telegram Bot         | Webhook (`secret_token`) atau polling `getUpdates`                 | Bot API             | `fetch`                                               |
| Email                | Polling IMAP                                                       | SMTP                | `imapflow` 2.0.6, `mailparser` 3.9, `nodemailer` 10.0 |
| LINE                 | Webhook (HMAC)                                                     | Messaging API       | `fetch`                                               |
| Web Live Chat        | Widget publik (`/api/v1/webchat/:key`)                             | Polling dari widget | —                                                     |
| Custom API           | Webhook HMAC                                                       | HTTP callback       | `fetch`                                               |

### 1.6 Infrastruktur dan DevOps

| Komponen      | Saat ini                                                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Container     | Dockerfile multi-stage per app (non-root UID 1001). Diduplikasi di `infrastructure/docker/`.                                                                                    |
| Compose       | postgres, minio (`rustfs`), minio-init, api, worker, web, caddy                                                                                                                 |
| Reverse proxy | Caddy 2.8 (TLS internal/ACME, security header, batas body per path)                                                                                                             |
| CI            | `ci.yml`: format, lint, typecheck, build; drift migrasi plus `db:verify`; skrip verifikasi; Vitest dengan service Postgres. `container-security.yml`: build image, Trivy, SBOM. |
| Deployment    | Belum ada konfigurasi deployment selain compose                                                                                                                                 |
| Secret        | Env var tervalidasi Zod saat boot (`validateEnv`), `.env.example` per app, `.env*` di-ignore                                                                                    |

## 2. Klasifikasi dependensi

Keterangan: **KEEP** tetap, **UPGRADE** naikkan versi, **REPLACE** ganti, **REMOVE** hapus, **DEFER** tunda keputusan.

### 2.1 Root dan tooling

| Dependensi                                                  | Versi                             | Keputusan | Alasan                              |
| ----------------------------------------------------------- | --------------------------------- | --------- | ----------------------------------- |
| typescript                                                  | 5.8.3                             | KEEP      | Kompatibel dengan seluruh stack     |
| turbo                                                       | 2.11.3                            | KEEP      | Sudah sesuai target                 |
| vitest                                                      | ^5.0.1                            | KEEP      | Sesuai target                       |
| eslint, typescript-eslint, prettier, eslint-config-prettier | —                                 | KEEP      |                                     |
| tsx                                                         | ^4.23.15 (root) dan 4.23.15 (api) | KEEP      | Satukan ke satu spesifier (catalog) |
| @types/node                                                 | `26.6.2` dan `^26.6.2` campur     | KEEP      | Satukan lewat catalog               |

### 2.2 Frontend

| Dependensi                         | Versi         | Keputusan                   | Alasan                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------- | ------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| next                               | 16.3.6        | **REPLACE** → Vite + router | Target React + Vite. Aplikasi sudah SPA (semua route statis kecuali `/ai-agent/[agentId]`, yang dirender dinamis tanpa data server; koreksi 2026-10-17, lihat 01 §6.3). Lima dari sembilan advisory berasal dari `next` beserta dependensi transitifnya (`sharp`, `source-map-js`). Sebelum migrasi selesai: **UPGRADE ke ≥16.3.8**. |
| react, react-dom                   | 19.3.0        | KEEP                        |                                                                                                                                                                                                                                                                                                                                      |
| @tanstack/react-query              | 5.x           | KEEP                        | Sesuai target                                                                                                                                                                                                                                                                                                                        |
| zustand                            | 5.x           | KEEP                        | Sesuai target                                                                                                                                                                                                                                                                                                                        |
| tailwindcss, @tailwindcss/postcss  | 4.3           | KEEP                        | Sesuai target. Untuk Vite dapat beralih ke `@tailwindcss/vite`.                                                                                                                                                                                                                                                                      |
| autoprefixer                       | 10.6          | **REMOVE**                  | Tidak dipakai di `postcss.config.mjs`. Tailwind 4 sudah menangani prefix.                                                                                                                                                                                                                                                            |
| postcss                            | 8.5           | KEEP/REMOVE                 | Tidak diperlukan lagi kalau memakai `@tailwindcss/vite`                                                                                                                                                                                                                                                                              |
| @supabase/supabase-js              | 2.117         | KEEP                        | Auth provider tetap Supabase (lihat 04)                                                                                                                                                                                                                                                                                              |
| socket.io-client                   | 4.8           | KEEP                        |                                                                                                                                                                                                                                                                                                                                      |
| lucide-react, clsx, tailwind-merge | —             | KEEP                        |                                                                                                                                                                                                                                                                                                                                      |
| pdfjs-dist                         | 5.7.284       | **UPGRADE** ≥6.2.108        | Advisory high (eksekusi JS dari PDF berbahaya)                                                                                                                                                                                                                                                                                       |
| @playwright/test                   | 1.63          | KEEP                        | `webServer` diganti ke `vite preview` setelah migrasi                                                                                                                                                                                                                                                                                |
| Radix UI / shadcn/ui               | — (belum ada) | **DEFER**                   | Primitif yang ada sudah berfungsi. Menggantinya berarti mengubah tampilan, sementara redesign di luar scope. Bisa diadopsi bertahap per komponen untuk aksesibilitas.                                                                                                                                                                |

### 2.3 Backend

| Dependensi                                           | Versi    | Keputusan             | Alasan                                                                                                                                     |
| ---------------------------------------------------- | -------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| @nestjs/common, core, websockets, platform-socket.io | 12.0.3   | KEEP                  | Sesuai target                                                                                                                              |
| @nestjs/platform-express                             | 12.0.3   | KEEP                  | Fastify **DEFER**; alasannya ada di 04 §3                                                                                                  |
| @nestjs/platform-express (di worker)                 | 12.0.3   | **REMOVE** (kandidat) | Worker memakai `createApplicationContext` dan tidak membuka HTTP server. Perlu dipastikan tidak ada import tidak langsung sebelum dihapus. |
| pg-boss                                              | 12.33    | **REPLACE** → BullMQ  | Target core stack. Lihat 04 §2 untuk justifikasi dan alternatifnya.                                                                        |
| bullmq, ioredis                                      | — (baru) | Tambah (WU-05)        | Versi stabil yang kompatibel dengan Node 24 dan Redis 7, ditentukan saat implementasi                                                      |
| socket.io                                            | 4.8      | KEEP                  |                                                                                                                                            |
| jose                                                 | 6.2      | KEEP                  | Cukup untuk verifikasi OIDC (JWKS dan issuer)                                                                                              |
| pg                                                   | 8.23     | KEEP                  | Koneksi `LISTEN` relay realtime                                                                                                            |
| zod                                                  | 4.6      | KEEP                  | Juga dipakai untuk generate JSON Schema/OpenAPI (`z.toJSONSchema`)                                                                         |
| rxjs, reflect-metadata                               | —        | KEEP                  | Kebutuhan NestJS                                                                                                                           |
| pino                                                 | 10       | KEEP                  | Logging terpusat sesuai target                                                                                                             |
| imapflow, mailparser, nodemailer                     | —        | KEEP                  | Adapter email yang berfungsi                                                                                                               |
| @opentelemetry/*, prom-client                        | — (baru) | Tambah (WU-10)        | Observability target                                                                                                                       |

### 2.4 Data

| Dependensi                   | Versi | Keputusan               | Alasan                                                                                                                                                                |
| ---------------------------- | ----- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| prisma, @prisma/client       | 6.4.1 | KEEP, upgrade **DEFER** | Berfungsi dan sudah teruji. Upgrade mayor ke Prisma 7 (perubahan generator dan driver adapter) dijadikan work unit tersendiri setelah migrasi utama, bukan bersamaan. |
| @paralleldrive/cuid2, uuidv7 | —     | KEEP                    |                                                                                                                                                                       |

### 2.5 Paket internal

| Paket                   | Keputusan             | Alasan                                                                                                   |
| ----------------------- | --------------------- | -------------------------------------------------------------------------------------------------------- |
| @vynor/contracts        | KEEP                  | Sumber kebenaran kontrak (Zod)                                                                           |
| @vynor/database         | KEEP                  |                                                                                                          |
| @vynor/channel-adapters | KEEP                  | Batas adapter sudah sesuai §9.7 prompt                                                                   |
| @vynor/storage          | KEEP                  | Klien S3 ringan tanpa AWS SDK; cukup untuk kebutuhan sekarang                                            |
| @vynor/observability    | KEEP + perluas        | Tempat logger, OTel, dan metrics                                                                         |
| @vynor/shared           | KEEP                  |                                                                                                          |
| @vynor/ai               | **REMOVE** atau DEFER | Kosong dan tidak diimpor. Hapus sampai pekerjaan AI backend benar-benar dimulai (perlu keputusan owner). |

## 3. Database lokal di mesin ini

Container `vynor-postgres` (port 5434):

| Database                    | Kegunaan                                               | Aturan                                                |
| --------------------------- | ------------------------------------------------------ | ----------------------------------------------------- |
| `vynor`                     | DB dev lama, skema parsial, tanpa `_prisma_migrations` | **Jangan disentuh**                                   |
| `vynor_crm`                 | Live run lokal                                         | **Jangan dipakai untuk test atau migrasi eksperimen** |
| `vynor_test`                | Test otomatis dan smoke test                           | Satu-satunya target `pnpm test`                       |
| `vynor_e2e`, `vynor_shadow` | E2E dan shadow migrasi                                 |                                                       |

Tidak ada informasi mengenai database staging atau production. Rencana ini tidak menyentuh database selain `vynor_test`, `vynor_e2e`, dan `vynor_shadow` tanpa persetujuan terpisah.

## 4. Stack target dan penguncian perubahan untuk AI Agent

Inventaris pada §1–3 adalah snapshot dependency di commit audit, **bukan** dependency manifest terkini. Saat mengerjakan tiket, agent mengecek `package.json` dan `pnpm-lock.yaml` pada HEAD terbaru terlebih dahulu. Pemilihan versi baru harus diverifikasi kompatibilitasnya saat PR dibuat; angka minimum versi pada rencana awal bukan jaminan semua advisory masih tertutup.

| Layer         | Baseline audit                                        | Tujuan yang disetujui **setelah DEC**                               | Tiket                             | Tidak boleh berubah tanpa pekerjaan terpisah       |
| ------------- | ----------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------- |
| Web           | Next.js App Router, React 19, TanStack Query, Zustand | React 19 + Vite + React Router, deploy SPA statis                   | WU-02 (patch sementara), WU-06a–d | API contract, tampilan visual, URL, tenant context |
| Job           | pg-boss + transactional outbox PG                     | BullMQ Redis untuk transport saja; outbox PG tetap                  | WU-05a/b                          | Domain state machine, pengurutan/receipt, dedup    |
| Shared state  | Idempotency dan rate limit in-memory                  | Redis 7 persisten AOF/noeviction, TTL, key tenant-safe, fail-closed | WU-04                             | Aturan response API terdokumentasi dan audit       |
| Auth          | Supabase JWT, issuer belum diverifikasi               | Supabase dipertahankan; verifier `iss/aud/JWKS` generik             | WU-08                             | Membership, RBAC, access policy                    |
| Spec API      | Skema Zod + OpenAPI manual                            | Schema Zod → OpenAPI 3.1 + contract-test                            | WU-07                             | Endpoint tidak diganti sekadar menyesuaikan spec   |
| Observability | Pino saja                                             | Metrics privat, tracing OTel dengan Pino trace ID                   | WU-10                             | Data pribadi/secrets tetap direduksi/redacted      |
| Database      | PG 16, Prisma 6, tabel `public` 19                    | Tetap; **tidak ada schema `public` berubah dalam WU wajib**         | WU-05c / WU-09 **opsional**       | Skema, relasi, DB mesin selain test tanpa izin     |

### 4.1 Matriks dependensi yang penting

- `@vynor/contracts`: sumber kebenaran DTO dan job envelope; jangan pindahkan ke paket konfigurasi baru dalam migrasi.
- `@vynor/database`: semua tabel domain/outbox/journal tetap; kustom SQL concurrency harus punya regression test.
- `@vynor/channel-adapters`: graph provider stub dipakai pada E2E, bukan akses live.
- `@vynor/storage`: existing client; perubahan penulisan attachment hanya jika WU-09 dipilih.
- `@vynor/observability`: perluasan log, metrics, tracing tanpa mengurangi redaction.

### 4.2 Aturan upgrade keamanan WU-02

Pada PR WU-02 audit ulang dependensi **yang benar-benar terinstal pada HEAD**. Jalankan `pnpm audit --prod`, identifikasi advisory aktual, lakukan mitigasi minimum yang teruji. Target versi seperti Next ≥16.3.8 dan pdfjs-dist ≥6.2.108 berasal dari penilaian audit, bukan pin akhir yang harus dipaksakan tanpa uji. Catat alasan jika suatu advisory memerlukan penanganan berbeda (misalnya upgrade mayor PDF worker). Jangan menghapus fitur knowledge PDF agar pipeline test menjadi hijau.

### 4.3 Kontrak ketersediaan infrastruktur

Redis digunakan oleh API dan worker setelah WU-04/05; `REDIS_URL` tidak boleh secara diam-diam fallback ke memori di staging/production. BullMQ perlu koneksi produser yang gagal cepat, koneksi worker yang dapat reconnect, AOF dan `noeviction`; konfirmasi konfigurasi nyata saat start. `noeviction` tidak berarti memori tak terbatas, jadi kapasitas dan alarm tetap diperlukan. CI wajib menjalankan Redis untuk regresi yang menyentuhnya. Redis adapter Socket.IO tetap **DEFER** karena relay PostgreSQL yang sudah bekerja.

**Rujukan:** `04-architecture-gap-analysis.md` §6; `05-target-architecture.md` §8; `06-migration-roadmap.md` §7, dan `agent/01-DECISION-REGISTER.md`.
