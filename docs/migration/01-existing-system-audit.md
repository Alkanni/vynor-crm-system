# 01 — Audit Sistem yang Ada

> **Pembaruan rencana eksekusi (17 Oktober 2026):** bagian audit/baseline asli adalah catatan historis pada commit `565e8e4`. Bagian tambahan setelahnya adalah **spesifikasi pelaksanaan yang diusulkan**, bukan bukti bahwa implementasi, keputusan owner, CI, deployment, atau migrasi database baru sudah dilakukan. Baca `agent/00-START-HERE.md` sebelum menugaskan AI Agent.

Tanggal audit: 2026-10-17
Repositori: `/home/acgix/vynor-crm` (remote `git@github.com:Alkanni/vynor-crm-system.git`)
Commit yang diaudit: `565e8e4` (branch `main` lokal)
Status: **Fase analisis. Belum ada kode aplikasi yang diubah.**

Dokumen terkait:

| No  | Dokumen                                                            | Isi                                       |
| --- | ------------------------------------------------------------------ | ----------------------------------------- |
| 01  | Dokumen ini                                                        | Inspeksi repositori, baseline, temuan     |
| 02  | [02-current-stack-inventory.md](02-current-stack-inventory.md)     | Stack dan dependensi saat ini             |
| 03  | [03-feature-inventory.md](03-feature-inventory.md)                 | Inventaris fitur beserta statusnya        |
| 04  | [04-architecture-gap-analysis.md](04-architecture-gap-analysis.md) | Perbandingan stack saat ini dengan target |
| 05  | [05-target-architecture.md](05-target-architecture.md)             | Blueprint arsitektur target               |
| 06  | [06-migration-roadmap.md](06-migration-roadmap.md)                 | Work unit, urutan, risiko, rollback       |
| 07  | [07-database-migration-plan.md](07-database-migration-plan.md)     | Dampak dan prosedur database              |

Dokumen 08–10 (execution log, hasil regresi, laporan akhir) baru dibuat saat implementasi berjalan.

---

## 1. Ruang lingkup audit

Yang diaudit adalah monorepo TypeScript **VYNOR CRM** di direktori kerja sesi ini.

Di mesin yang sama ada aplikasi lain yang **tidak** diaudit:

- `/home/acgix/VYNOR` adalah fork Chatwoot (Ruby on Rails, Vue, Sidekiq). Container-nya `vynor-rails-1` dan `vynor-sidekiq-1` sedang berjalan. Riwayat commit repo ini menyebutnya "initial VYNOR app", yang menjadi referensi UI.
- `/home/acgix/chatwoot` adalah instalasi Chatwoot lain.

Kalau yang dimaksud dengan "aplikasi yang ada" ternyata fork Rails tersebut, atau migrasi data/fitur dari sana ke repo ini, rencananya akan sangat berbeda. Ini perlu dikonfirmasi (lihat [06 §6](06-migration-roadmap.md#6-persetujuan-yang-dibutuhkan)).

## 2. Status Git

| Item                   | Kondisi                                                                                                                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch aktif           | `main`                                                                                                                                                                                                            |
| Working tree           | Bersih (tidak ada perubahan yang belum di-commit)                                                                                                                                                                 |
| Terhadap `origin/main` | Tertinggal 1 commit: `af9fc8c fix(worker): heartbeat also requires a running pg-boss (#59)`. Commit ini fast-forward dan hanya menyentuh health check worker. Belum di-pull, karena audit tidak mengubah apa pun. |
| Worktree lain          | `.claude/worktrees/compassionate-mendeleev-1690b1` (`fix/pg-boss-start-retry`) dan `.claude/worktrees/confident-kepler-47f3b5` (detached). Keduanya milik sesi lain dan tidak disentuh.                           |
| Kebijakan PR           | PR menuju `main` (tidak ada `develop`). Owner yang melakukan merge.                                                                                                                                               |

## 3. Struktur repositori

```text
vynor-crm/
├── apps/
│   ├── api/        NestJS 12 (Express): REST /api/v1, webhook, Socket.IO gateway   ~7,6k LOC
│   ├── web/        Next.js 16 App Router, React 19 (praktis SPA; lihat §6.3)         ~21k LOC
│   └── worker/     NestJS application context: pg-boss, outbox dispatcher, polling ~3,1k LOC
├── packages/
│   ├── contracts/        Zod: API, env, IAM, jobs, channel, realtime, storage      ~3,7k LOC
│   ├── database/         Prisma 6.4 schema, 7 migrasi, outbox, journal, test utils ~1,9k LOC
│   ├── channel-adapters/ WhatsApp Cloud, Telegram, Email (IMAP/SMTP), Messenger,
│   │                     Instagram, LINE, Webchat, Custom API                      ~6,5k LOC
│   ├── storage/          Klien S3 SigV4 buatan sendiri, kebijakan object key       ~0,8k LOC
│   ├── observability/    Pino logger, redaction, health helper, Sentry scrubber    ~0,5k LOC
│   ├── shared/           CredentialCipher (AES-GCM envelope)                       ~0,3k LOC
│   └── ai/               KOSONG (`export {}`), tidak diimpor siapa pun
├── infrastructure/
│   ├── caddy/Caddyfile
│   ├── docker/           Duplikat persis dari docker-compose.yml + Dockerfile per app
│   └── scripts/verify-infrastructure.ts
├── docs/                 32 dokumen + 14 ADR (AD-001 s.d. AD-014)
├── .github/workflows/    ci.yml, container-security.yml
├── docker-compose.yml    postgres(pgvector), minio ("rustfs"), api, worker, web, caddy
├── issue.md              Rencana UI/UX (181 KB)
├── turbo.json, pnpm-workspace.yaml, tsconfig.base.json, eslint.config.mjs, vitest.config.mts
└── dist/                 Direktori kosong (ignored)
```

Pengamatan struktur:

- Struktur `apps/` dan `packages/` **sudah sama** dengan struktur referensi target (§6.1 prompt). Tidak perlu restrukturisasi besar.
- `docker-compose.yml` identik dengan `infrastructure/docker/docker-compose.yml`. `apps/*/Dockerfile` identik dengan `infrastructure/docker/Dockerfile.*`. Duplikasi ini rawan drift.
- `packages/ai` adalah paket kosong yang tetap ikut di-build dan di-lint.
- Test diletakkan di masing-masing paket (`apps/*/tests`, `packages/*/tests`). Tidak ada direktori `tests/` di root, dan memang tidak perlu.

## 4. Baseline (dijalankan 2026-10-17 pada `565e8e4`)

Semua perintah dijalankan dari root repo. Test dan smoke test hanya memakai database `vynor_test` (localhost:5434), dengan env file yang menolak URL selain `vynor_test`.

| Pemeriksaan            | Perintah                                             | Hasil                                                                                                                                                                                                                                               |
| ---------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime                | `node --version`, `pnpm --version`                   | Node 24.19.0, pnpm 11.25.0                                                                                                                                                                                                                          |
| Build                  | `pnpm build`                                         | **PASS**: 11/11 task. Semua route web di-prerender statis (`○`); hanya middleware yang dinamis. _Koreksi 2026-10-17: kecuali `/ai-agent/[agentId]` (`ƒ`, dinamis); lihat §6.3._                                                                     |
| Typecheck              | `pnpm typecheck`                                     | **PASS**: 11/11                                                                                                                                                                                                                                     |
| Lint                   | `pnpm lint`                                          | **PASS**: 17/17                                                                                                                                                                                                                                     |
| Format                 | `pnpm format:check`                                  | **PASS**                                                                                                                                                                                                                                            |
| Migrasi                | `prisma migrate status` (vynor_test)                 | 7 migrasi, skema up to date                                                                                                                                                                                                                         |
| Unit + integrasi       | `pnpm test` (Vitest 5)                               | **PASS**: 28 file, 176 test, 11,4 detik                                                                                                                                                                                                             |
| Verifikasi API         | `pnpm --filter @vynor/api verify`                    | **PASS**                                                                                                                                                                                                                                            |
| Verifikasi web         | `pnpm --filter @vynor/web verify`                    | **PASS**                                                                                                                                                                                                                                            |
| Verifikasi infra       | `pnpm infra:verify`                                  | **PASS**: 11 cek. Cek ini statis dan tidak menangkap bug health check di §5.1.                                                                                                                                                                      |
| Invarian skema         | `pnpm --filter @vynor/database db:verify`            | **PASS**                                                                                                                                                                                                                                            |
| Smoke API (runtime)    | `node apps/api/dist/main.js` port 3399, `vynor_test` | **PASS**: `POST /auth/dev-session` → token, `GET /auth/me` 200 (SUPER_ADMIN, 29 permission), `/channels`, `/conversations`, `/workspace/members` 200, tanpa token 401, conversation milik workspace lain/tidak dikenal 404, `/openapi.json` 25 path |
| Smoke worker (runtime) | `node apps/worker/dist/main.js`, `vynor_test`        | **PASS**: pg-boss start, outbox dispatcher berjalan, heartbeat ditulis, 0 log error                                                                                                                                                                 |
| Advisory dependensi    | `pnpm audit --prod`                                  | **9 advisory, semuanya di `apps/web`**: 4 high (pdfjs-dist, sharp via next, source-map-js via next, SSRF next image), 4 moderate, 1 low. Backend 0 advisory.                                                                                        |
| E2E                    | `pnpm test:e2e`                                      | **Tidak dijalankan**. Hanya ada 1 spec smoke auth dan tidak masuk CI.                                                                                                                                                                               |

Catatan: test suite menghapus user seed di `vynor_test`, sehingga `vynor_test` di-seed ulang sebelum smoke test. Database `vynor` dan `vynor_crm` tidak disentuh.

## 5. Temuan

### 5.1 Bug yang terverifikasi

| ID   | Temuan                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Bukti                                                                       | Dampak                                                                                                                                                                              |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-01 | **Health check container API memanggil path yang salah.** API memakai global prefix `api/v1` ([main.ts:28](../../apps/api/src/main.ts)), tetapi `HEALTHCHECK` di [apps/api/Dockerfile:63](../../apps/api/Dockerfile) dan healthcheck compose di [docker-compose.yml:118](../../docker-compose.yml) memanggil `/health/live`. Caddy meneruskan `/health/*` apa adanya ([Caddyfile:98](../../infrastructure/caddy/Caddyfile)), dan healthcheck caddy ([docker-compose.yml:217](../../docker-compose.yml)) memakai path yang sama. | Runtime: `GET /health/live` → **404**, `GET /api/v1/health/live` → **200**. | Di `docker compose up`, `api` tidak pernah healthy. `worker`, `web`, dan `caddy` menunggu `service_healthy`, jadi tidak pernah start. **Stack Docker Compose tidak bisa berjalan.** |

### 5.2 Risiko keamanan

| ID   | Temuan                                                                                                                           | Lokasi                                                                                                                                                                     | Catatan                                                                                                                                                     |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S-01 | `pdfjs-dist` < 6.2.108: eksekusi JavaScript saat membuka PDF berbahaya (high)                                                    | `apps/web` (ekstraksi teks knowledge AI Agent di browser)                                                                                                                  | Upgrade atau set `isEvalSupported: false`.                                                                                                                  |
| S-02 | Next.js 16.3.6: SSRF image optimization (high), cache poisoning SSG/ISR (moderate)                                               | `apps/web`                                                                                                                                                                 | Patch ke ≥16.3.8. Advisory ini hilang setelah migrasi ke Vite.                                                                                              |
| S-03 | Socket.IO gateway `cors: { origin: '*' }`                                                                                        | [realtime.gateway.ts:24](../../apps/api/src/realtime/realtime.gateway.ts)                                                                                                  | Risiko rendah karena handshake wajib membawa JWT, tetapi sebaiknya dibatasi ke `CORS_ALLOWED_ORIGINS` seperti REST.                                         |
| S-04 | Verifikasi JWT tidak memeriksa `iss`, hanya `aud = authenticated`                                                                | [jwt-verifier.service.ts](../../apps/api/src/iam/jwt-verifier.service.ts)                                                                                                  | Token apa pun yang ditandatangani `SUPABASE_JWT_SECRET` diterima, termasuk token `vynor-dev-session`. Dev-session sendiri dibatasi ke `APP_ENV=local/test`. |
| S-05 | Access token disalin ke cookie `vynor_session` (non-HttpOnly, 7 hari) hanya supaya middleware Next bisa mengecek _keberadaannya_ | [auth-context.tsx:184](../../apps/web/src/lib/auth/auth-context.tsx), [middleware.ts:53](../../apps/web/src/middleware.ts)                                                 | Proteksi route di middleware hanya kosmetik; otorisasi sebenarnya ada di backend (AD-007). Cookie ini ikut terkirim di setiap request ke origin web.        |
| S-06 | Idempotency store dan rate limiter webchat disimpan di memori proses                                                             | [idempotency.interceptor.ts:29](../../apps/api/src/common/interceptors/idempotency.interceptor.ts), [webchat.service.ts:16](../../apps/api/src/webchat/webchat.service.ts) | Dengan lebih dari satu instance API, `Idempotency-Key` dan rate limit tidak konsisten, dan state hilang saat restart.                                       |

### 5.3 Utang teknis dan ketidaksesuaian dokumentasi

| ID   | Temuan                                                                                                                                                                                                                                                                                                                                                                                   |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-01 | AD-013 menyatakan OpenAPI "generated automatically from Zod contracts". Kenyataannya dokumen OpenAPI ditulis tangan ([openapi.document.ts](../../apps/api/src/openapi/openapi.document.ts), [channel-paths.ts](../../apps/api/src/openapi/channel-paths.ts)). Endpoint webhook, webchat, dan media tidak terdokumentasi.                                                                 |
| D-02 | Dokumen Phase 0 menyebut Redis "operational". Tidak ada service Redis di compose dan tidak ada klien Redis di kode. `REDIS_URL` hanya ada sebagai env opsional yang tidak dipakai.                                                                                                                                                                                                       |
| D-03 | Service compose bernama `rustfs` tetapi image-nya `minio/minio:latest`. `minio/mc:latest` juga tidak di-pin, jadi build tidak reproducible.                                                                                                                                                                                                                                              |
| D-04 | Tabel `attachments` dan endpoint `GET /attachments/:id/download-url` ada, tetapi **tidak ada kode yang pernah menulis** ke tabel itu. Media inbound tidak disimpan ke object storage; media di-proxy langsung dari provider lewat URL bertanda tangan ([media.controller.ts](../../apps/api/src/conversations/media.controller.ts)). Begitu provider menghapus media, riwayatnya hilang. |
| D-05 | `@sentry/*` tidak terpasang. `packages/observability/src/sentry` hanya berisi fungsi scrubber. Tidak ada metrics (Prometheus) maupun tracing (OpenTelemetry).                                                                                                                                                                                                                            |
| D-06 | `ChannelRuntimeService` (api) dan `WorkerChannelRuntime` (worker) adalah dua implementasi plumbing adapter yang mirip. "Conversation Core" tersebar di `apps/api/src/conversations` (perintah agent) dan `apps/worker/src/conversations` (ingest).                                                                                                                                       |
| D-07 | `consumer.apply(...).forRoutes('*')` memicu peringatan `LegacyRouteConverter` path-to-regexp v8 saat boot ([app.module.ts:34](../../apps/api/src/app.module.ts)).                                                                                                                                                                                                                        |
| D-08 | Env `NEXT_PUBLIC_*` di service `web` pada compose tidak berpengaruh, karena Next meng-inline nilai itu saat build dan Dockerfile web tidak meneruskannya sebagai build arg.                                                                                                                                                                                                              |
| D-09 | Relasi `onDelete: Cascade` dari `workspaces` dan `provider_accounts` ke `conversations` dan `messages`. Aplikasi memakai soft-delete, tetapi satu `DELETE` manual pada `provider_accounts` akan menghapus seluruh riwayat percakapan channel itu.                                                                                                                                        |

### 5.4 Kekuatan yang perlu dipertahankan

- **Keandalan pesan sudah matang.** Ada journal `provider_events` dengan unique key dedup, transactional outbox dengan `SKIP LOCKED` dan lease recovery, handler idempoten, status pengiriman monoton, rekonsiliasi pesan yang tertahan `PENDING`, dan klasifikasi error provider. Semuanya punya test integrasi.
- **Identitas customer sudah dipisah dari identitas channel** (`contacts` dan `contact_identities`). Ini sesuai dengan prinsip §9.8 prompt.
- **Tenant isolation**: `workspaceId` ada di setiap tabel domain dan diturunkan dari `ActorContext`, bukan dari input klien. Room Socket.IO juga dicek terhadap workspace (test realtime).
- **Kredensial channel dienkripsi** (envelope AES-GCM, `ENCRYPTION_MASTER_KEY`). Webhook diverifikasi lewat tanda tangan dan key yang tidak bisa ditebak.
- **Realtime multi-instance tanpa Redis**: Postgres `NOTIFY` dikirim di dalam transaksi, lalu setiap instance API `LISTEN` dan meneruskan ke room lokalnya.
- 14 ADR, CI dengan drift check migrasi, dan TypeScript strict di semua paket.

## 6. Ringkasan analisis kode

### 6.1 Backend (`apps/api`)

Modul NestJS: `config`, `iam` (AuthGuard dan PermissionGuard global), `audit`, `health`, `storage`, `realtime`, `openapi`, `auth`, `channels`, `webhooks`, `webchat`, `conversations`.

Alur utama:

1. **Request terautentikasi**: `AuthGuard` memverifikasi JWT (HS256 secret, lalu JWKS Supabase). `ActorContextService` memuat profil, membership, role, permission, dan team dari Postgres. `PermissionGuard` mengecek `@RequirePermissions`, dan setiap penolakan dicatat ke audit log.
2. **Balasan agent**: `POST /conversations/:id/messages` menyimpan `messages` (PENDING) dan `outbox_events` (`message.outbound.requested`) dalam satu transaksi, lalu mengirim `pg_notify`.
3. **Webhook**: `POST /webhooks/:provider/:webhookKey` mencari channel lewat key, memvalidasi tanda tangan adapter, menyimpan journal `provider_events` beserta outbox `webhook.*`, lalu langsung mengirim ACK 200. Tidak ada pemrosesan sinkron.

### 6.2 Worker (`apps/worker`)

- `OutboxDispatcherService`: setiap 1 detik meng-claim outbox `PENDING` dan mengirimnya ke pg-boss dengan `singletonKey = outbox:<id>`. Lease recovery berjalan setiap 30 detik. Setelah 5 kali gagal, event masuk `DEAD_LETTER`.
- `InboundProcessorService` (`vynor.webhooks.process`): normalisasi lewat adapter, lalu `ConversationIngestService` membuat atau memperbarui contact, identity, conversation, dan message, termasuk auto-assign ke agent dengan beban paling ringan dan penerapan receipt secara monoton.
- `OutboundDispatcherService` (`vynor.messages.outbound`): mengirim lewat adapter. Error transient di-retry; percobaan terakhir menandai pesan `FAILED`. Pesan yang tertahan `PENDING` lebih dari 15 menit otomatis ditandai gagal.
- `ChannelPollingService`: polling IMAP dan Telegram dengan lease per channel.
- `WorkerHeartbeatService`: file heartbeat untuk healthcheck container.

### 6.3 Frontend (`apps/web`)

- 79 dari 93 file `.tsx` bertanda `'use client'`. Halaman tanpa direktif itu hanyalah wrapper tipis.
- Fitur khusus Next.js yang dipakai: `next/navigation` (10 file), `next/link` (9 file), `middleware.ts` (cek keberadaan cookie dan correlation ID), `metadata` di root layout, dan `output: 'standalone'`. Tidak ada Server Actions, route handler, SSR data fetching, atau ISR.
- Hasil `next build`: **semua route statis**. Secara arsitektur aplikasi ini adalah SPA yang di-hosting oleh server Next.
  - **Koreksi 2026-10-17 (VYN-00-02, `08` NF-05):** `next build` menandai `/ai-agent/[agentId]` sebagai `ƒ` (dynamic rendering) karena segmennya dinamis tanpa `generateStaticParams`. Route ini sudah ada sejak `104bb74`, jadi juga ada pada `565e8e4`. Halamannya `'use client'` dan hanya memakai `useParams`, tanpa data server, cookie, header, `fetch` server, atau server action, sehingga kesimpulan "praktis SPA" dan keputusan Vite (DEC-03) tetap berlaku. Perilakunya diverifikasi di WU-03 (VYN-03-04) dan WU-06 (VYN-06B-01, VYN-06B-03, VYN-06C-02).
- Server state memakai TanStack Query 5, state UI memakai Zustand 5, realtime memakai `socket.io-client`, auth memakai `@supabase/supabase-js`. UI primitives dibuat sendiri dengan Tailwind 4 (tanpa Radix/shadcn).
- **Hanya Login, Inbox, dan Channels yang memanggil API.** Contacts, Tickets, Campaigns/Broadcast, Blast, Automations, Templates, Reports, Dashboard, Settings (roles/teams/audit/integrations), dan AI Agent memakai data contoh. AI Agent menyimpan konfigurasinya di `localStorage`.
- Ada "preview mode": kalau API tidak terjangkau, UI membuat actor SUPER_ADMIN palsu dengan data contoh. Ini hanya tampilan; backend tetap menolak request tanpa token valid.

### 6.4 Domain CRM

Di database hanya ada `contacts` dan `contact_identities`. **Tidak ada** model atau API untuk lead, deal, pipeline, activity, task, note, custom field, ticket, campaign, template, automation, maupun report. Katalog permission juga tidak punya `ticket:*`, `deal:*`, atau `lead:*`. Rinciannya ada di [03-feature-inventory.md](03-feature-inventory.md).

## 7. Kesimpulan audit

1. Repo ini **sudah memakai sebagian besar target core stack**: TypeScript, NestJS, PostgreSQL, Prisma, Socket.IO, Docker, pnpm, Turborepo, GitHub Actions, TanStack Query, Zustand, Tailwind, dan Zod.
2. Selisih nyata terhadap target ada di empat area: **frontend Next.js (target React + Vite)**, **pg-boss (target BullMQ + Redis)**, **Redis yang belum ada**, dan **observability (OpenTelemetry/Prometheus)**. Ditambah dua penyempurnaan: OpenAPI yang di-generate dari Zod dan verifier OIDC yang memeriksa issuer.
3. Sebagian besar fitur CRM **belum diimplementasikan**. Membangunnya adalah pekerjaan produk, bukan migrasi, dan sebaiknya dilakukan di atas stack target setelah fondasinya siap.
4. Ada satu bug terverifikasi yang memblokir deployment Docker (F-01) dan sembilan advisory dependensi di frontend.

## 8. Addendum eksekusi: status handoff dan batas audit

Bagian 1–7 tetap menjadi **bukti audit tanggal 17 Oktober 2026 terhadap commit `565e8e4`**. Status Git pada §2 berlaku saat inspeksi tersebut, bukan jaminan status repo pada sesi AI Agent berikutnya. Sesudah audit, tujuh dokumen `docs/migration/01–07` dilaporkan sebagai untracked di `main`; `dist/` dibangun ulang tetapi di-ignore, dan `vynor_test` di-seed ulang. **Jangan menyimpulkan ada perubahan kode aplikasi** dari peristiwa ini.

| Area          | Fakta awal yang harus dijaga                                                                                   | Verifikasi ulang saat mulai                                                                                 | Batas tindakan                                                                              |
| ------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Sumber kode   | Repo TS `/home/acgix/vynor-crm`, bukan fork Rails                                                              | `pwd`, `git remote -v`, `git rev-parse HEAD`                                                                | `DEC-01` wajib sebelum WU-00                                                                |
| Git           | Audit pada `565e8e4`; `origin/main` saat audit lebih maju satu commit                                          | `git status --porcelain=v1`, `git fetch origin`, `git log --oneline main..origin/main`, `git worktree list` | Jangan `reset --hard`, `clean -fd`, overwrite dokumen untracked, atau ubah worktree lain    |
| Baseline      | 176 tes/28 file; lint/typecheck/build/format PASS pada saat audit                                              | Jalankan ulang dan simpan log baseline di branch yang disetujui                                             | Temuan baru = `NEW FINDING`, bukan edit hasil audit lama                                    |
| Data          | `vynor_test` satu-satunya DB untuk test dan smoke awal; `vynor_e2e`/`vynor_shadow` untuk kebutuhan yang sesuai | Verifikasi nama database dalam URL **sebelum** menjalankan perintah                                         | `vynor` dan `vynor_crm` dilarang untuk eksperimen; staging/production butuh gate tersendiri |
| Provider      | Provider nyata serta Supabase asli tidak diverifikasi                                                          | Pertahankan status `NOT VERIFIED` sampai ada bukti                                                          | Test otomatis memakai stub/mock; jangan kirim pesan sungguhan                               |
| Infrastruktur | `docker compose up` terhalang health path 404                                                                  | WU-01 harus membuktikan runtime Compose sehat, bukan hanya parse berkas                                     | Jangan tulis klaim healthy sampai `up --wait` benar-benar lulus                             |

### 8.1 Batas bukti yang tidak boleh disalahartikan

- Test unit/integrasi baseline **bukan** pengganti E2E Inbox dan Channels, yang masih belum teruji otomatis pada audit.
- Smoke `dev-session` **bukan** bukti login Supabase live berhasil.
- `pnpm infra:verify` PASS **bukan** bukti Docker dapat mencapai keadaan healthy.
- Keberadaan `attachments` dan klien S3 **bukan** bukti media inbound telah dipersist.
- `outbox_events` adalah sumber kebenaran pesan; Redis/BullMQ hanya lapisan transport yang diusulkan, bukan pengganti transaksi domain.

### 8.2 Peta bukti → perbaikan → ticket

| Temuan                                | Masuk pekerjaan                   | Evidence akhir yang diharapkan                                                    |
| ------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------- |
| F-01 healthcheck 404                  | WU-01 / VYN-01-01..03             | Compose `healthy`, probe lewat Caddy 200, pemeriksaan statis mendeteksi regresi   |
| S-01, S-02 advisory; S-03 CORS        | WU-02 / VYN-02-01..02             | Audit prod tanpa HIGH, tes PDF dan origin websocket                               |
| Tes HTTP/Channels/Inbox tidak lengkap | WU-03 / VYN-03-01..05             | Golden path otomatis serta screenshot baseline di CI                              |
| S-06 state in-memory                  | WU-04 / VYN-04-01..03             | Dua API berbagi Redis; outage diuji                                               |
| Risiko transit antrean                | WU-05a/b / VYN-05A-01..VYN-05B-02 | Inbound/outbound, retry, crash, drain, rekonsiliasi teruji                        |
| Regresi Next → Vite                   | WU-06a..d                         | Semua URL, session guard, Inbox/Channels dan static Caddy teruji                  |
| D-01 OpenAPI tidak lengkap            | WU-07                             | Contract-test route ↔ spec di CI                                                  |
| S-04 verifier issuer                  | WU-08                             | Validasi `iss/aud` dan gate Supabase asli sebelum enforce                         |
| D-05 metrics/tracing kosong           | WU-10                             | Trace golden path dan `/metrics` privat                                           |
| D-04 media tak persisten              | WU-09 **opsional**                | Media bertahan setelah sumber provider menghilang; kebijakan scan telah disetujui |

### 8.3 Protokol perubahan temuan

Setiap AI Agent wajib mengutip lokasi file/tes aktual dan commit HEAD yang ia periksa. Bila tidak sama dengan baseline, tulis delta di `08-migration-execution-log.md` setelah WU-00 dibuka, dan eskalasi bila delta mengubah dependensi, risiko, atau scope. **Jangan mengarang hasil tes atau mengubah fakta audit historis.**

**Rujukan pelaksanaan:** `06-migration-roadmap.md` §7–10, `07-database-migration-plan.md` §8, serta `agent/KANBAN_VERTICAL_SLICE_VYNOR.md` dan `agent/VYNOR_AGENT_TASKS.json`.
