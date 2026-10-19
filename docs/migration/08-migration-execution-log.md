# 08 — Log Eksekusi Migrasi

> Log ini **append-only**, dibuat dari `agent/templates/08-migration-execution-log.template.md` saat WU-00 berjalan. Isinya hanya hasil yang benar-benar dijalankan. Perintah yang belum dijalankan diberi label `NOT RUN` atau `PROPOSED`. Hasil tes rinci ada di `09-regression-test-results.md`.

## WU-00 — 2026-10-17

### VYN-00-01 — Kunci persetujuan, amankan dokumen, audit state Git (`DONE`)

- **Owner approval dan referensi keputusan:**
  - DEC-01..09 RESOLVED; DEC-07 = DEFER (`agent/01-DECISION-REGISTER.md`).
  - Chat owner "WU-00 DISETUJUI — X1–X7 DEFAULT — DB NON-TEST DILARANG".
  - VYN-00-01 diterima owner secara operasional dan ditetapkan `DONE`; status Kanban `IN_REVIEW` disetujui.
  - Semua `GATE-*` PENDING.
- **Branch, base/head SHA, perubahan file:** branch `docs/migration-plan` di worktree `.claude/worktrees/docs-migration-plan`, dibuat `--no-track` dari `origin/main` `1d6b578`. Head = base; belum ada commit. Perubahan hanya di `docs/migration/**` (untracked).
- **Input dan kondisi awal (checkout utama, `main` @ `565e8e4`):**
  - 48 dokumen tracked (`docs/adr/*`, `docs/*.md`) terhapus dari working tree; folder `docs/` lama berada di Trash dengan isi identik HEAD.
  - Tujuh dokumen `01..07` asli tertimpa versi paket v1.1; aslinya masih ada di Trash dengan hash = `source_sha256` manifest.
  - Paket handoff ada sebagai file untracked.
  - `origin/main` 3 commit di depan `main`.
- **Perintah nyata dijalankan + output:**
  - Backup ke `~/vynor-migration-backup-2026-10-17/` (lokal, di luar repo), lalu `sha256sum -c` lolos untuk semua file.
  - `git restore --source=HEAD --worktree --pathspec-from-file` untuk tepat 48 path; `git hash-object` = blob HEAD untuk 48/48.
  - `git fetch origin`: `origin/main` tetap `1d6b578`.
  - `git worktree add --no-track -b docs/migration-plan`. Worktree terpisah dipakai karena checkout utama sedang dipakai dua sesi Claude Code lain.
  - `prettier --write 'docs/migration/**'` lalu `--check`: PASS. Token huruf/angka identik sebelum dan sesudah; JSON identik secara semantik.
- **Perubahan dan alasan teknis:**
  - Format Prettier pada 53 file paket, supaya `pnpm format:check` CI lulus.
  - Perbaikan inkonsistensi di `06-migration-roadmap.md`, `agent/00-START-HERE.md`, `agent/01-DECISION-REGISTER.md`, `agent/06-PACKAGE-INTEGRITY-CHECK.md`, Kanban, JSON, dan tiket VYN-00-01. Isinya: tindakan WU-00, dependensi WU-03/09/10/11 diselaraskan dengan JSON kanonis, peta folder, dan batas berlaku manifest.
  - Keputusan arsitektur tidak diubah.
- **Gate & dependency diperiksa:** DEC-01..09 RESOLVED; `GATE-ENV` tidak diberikan (DB non-test dilarang).
- **Risiko, rollback, dampak data:**
  - Tidak ada perubahan kode atau DB.
  - Rollback dilakukan owner: hapus worktree/branch `docs/migration-plan`, lalu pulihkan dari backup.
  - Salinan lama `docs/migration/` (belum diformat) dan dua file root paket tetap dipertahankan di checkout utama atas instruksi owner.
- **Link PR/CI dan status review:** belum ada PR (instruksi owner).
- **Masalah terbuka / NOT VERIFIED:** —

### VYN-00-02 — Baseline pada base aktual dan inisialisasi log 08/09 (`DONE`)

- **Owner approval:** chat owner "VYN-00-01 DITERIMA SECARA OPERASIONAL — LANJUTKAN VYN-00-02". Yang diizinkan:
  - format check, lint, typecheck, build, dan tes terhadap `vynor_test` saja;
  - pemulihan seed;
  - log 08/09;
  - analisis dampak WU-05a.

  Yang dilarang: commit, push, PR, merge, perubahan `main`, WU-01, perubahan schema DB, dan menghapus/melemahkan tes.

- **Commit yang diuji:** `1d6b578b17582057f2342eabe0e8e7a6459f5a40` (= `origin/main`). Tree = commit tersebut + `docs/migration/**` untracked (dokumen saja). `git diff HEAD` = 0 file.
- **Environment (tanpa secret):** Node 24.19.0, pnpm 11.25.0 (`install --frozen-lockfile --prefer-offline`: 417 paket dari store, 0 unduhan, lockfile tidak berubah), turbo 2.11.3, Prettier 3.9.8. PostgreSQL di container `vynor-postgres` (pgvector pg16) pada `localhost:5434`, database **`vynor_test`**.
- **Guard database sebelum tes:**
  - Konsumen URL DB yang dipetakan: `TEST_DATABASE_URL || DATABASE_URL` (`createTestPrismaClient`, spec pg-boss), `DATABASE_URL`/`DIRECT_URL` (Prisma), dan `SHADOW_DATABASE_URL` (hanya `db:migrate:diff`, tidak dijalankan).
  - Worktree tidak memiliki file `.env`, dan shell tidak membawa variabel DB.
  - File env di scratchpad menolak semua nilai selain `localhost:5434/vynor_test`. Uji negatif membuktikan `vynor_crm`, `vynor`, `vynor_test_x`, dan variabel kosong ditolak.
  - Verifikasi runtime lewat tiga jalur. Satu: `prisma migrate status` menampilkan `PostgreSQL database "vynor_test" … at "localhost:5434"`. Dua: Prisma client worktree, untuk `DATABASE_URL`, `DIRECT_URL`, dan `TEST_DATABASE_URL`, menampilkan `current_database() = vynor_test`. Tiga: `system_identifier` = 7689052853146714150, sama dengan `docker exec vynor-postgres`.
  - Env proses API smoke (`/proc/<pid>/environ`) juga menunjuk `vynor_test`.
- **Perintah nyata + hasil:** lihat tabel di `09-regression-test-results.md`. Ringkasnya:
  - format, lint 17/17, typecheck 11/11, dan build 11/11: PASS, semuanya tanpa cache turbo;
  - `pnpm test`: 29 file / 182 tes PASS;
  - verifikasi API, web, infra (11 cek), dan DB (50 cek): PASS;
  - smoke API: PASS.
- **Catatan pelaksanaan:**
  - Run `format:check` pertama gagal pada 3 file dokumen yang baru diedit (tabel status). Setelah `prettier --write 'docs/migration/**'`, hasilnya PASS. Kode aplikasi tidak disentuh.
  - Run `lint` pertama memakai **cache turbo bersama antar-worktree** (16/17 replay), sehingga dibuang. Semua hasil turbo yang dicatat berasal dari `--cache=local:,remote:` (0 cache). Efek sampingnya: run pertama itu memperbarui 16 manifest di `.turbo/cache` checkout utama (di-ignore git). Run tanpa cache tidak menulis apa pun.
  - `pnpm install` dari store tidak men-generate Prisma client, sehingga `pnpm --filter @vynor/database db:generate` dijalankan dulu. Langkah ini tidak menyentuh DB.
- **Dampak data (`vynor_test`):**
  - Sebelum: hanya schema `public`, 7 migrasi; `workspaces=1`, `user_profiles=0`, `memberships=0`, `outbox_events=1`. Seed admin **sudah tidak ada sebelum sesi ini**.
  - Urutan mengikuti CI: seed → `pnpm test` → seed ulang (pemulihan, `pnpm --filter @vynor/database db:seed`).
  - Sesudah: schema `public` saja, 7 migrasi, `workspaces=2`, `user_profiles=2`, `memberships=2`, seed admin ada.
  - Workspace ke-2 adalah residu "Committed Workspace" yang dibuat salah satu tes pada setiap run (perilaku tes yang sudah ada).
  - Spec pg-boss membuat lalu men-drop schema sementaranya sendiri (`pgboss_start_retry_test`).
  - Tidak ada migrasi dan tidak ada perubahan schema oleh agent.
- **Observasi DB lain:**
  - `pg_stat_database.xact_commit` naik di `vynor` dan `vynor_crm` selama sesi, tetapi `tup_inserted/updated/deleted` tetap 0 (tidak ada penulisan).
  - Penghitung juga naik saat agent diam (45 detik tanpa koneksi dari agent: `vynor` +9, `vynor_crm` +2).
  - Penyebab di `vynor` adalah healthcheck container (`pg_isready -U postgres -d vynor` setiap 5 detik). Penyebab di `vynor_crm` adalah koneksi eksternal berumur sangat singkat yang tidak teridentifikasi dan bukan dari proses sesi ini.
- **Gate & dependency diperiksa:** VYN-00-01 `DONE`; `GATE-ENV` tetap PENDING (tidak ada akses DB non-test).
- **Risiko, rollback, dampak data:** tidak ada perubahan kode atau schema. Data `vynor_test` sudah di-seed ulang. Rollback dokumen: hapus `08`/`09` dari branch sebelum commit.
- **Link PR/CI dan status review:** belum ada commit/PR (instruksi owner). CI GitHub **NOT VERIFIED** sampai PR WU-00 dibuat.
- **Masalah terbuka / NOT RUN (dengan alasan):**
  - `pnpm audit --prod`: NOT RUN (butuh akses jaringan ke registry; tidak termasuk izin VYN-00-02).
  - `pnpm --filter @vynor/database db:migrate:diff`: NOT RUN (membuat/mereset shadow schema `vynor_test?schema=shadow` = perubahan schema). Drift DB vs migrasi sudah dicek read-only dengan `migrate status`.
  - Smoke runtime worker (`node apps/worker/dist/main.js`): NOT RUN (pg-boss akan membuat schema `pgboss` di `vynor_test` = perubahan schema). Perilaku start-retry/timeout dan heartbeat tercakup oleh spec integrasi yang PASS.
  - E2E Playwright dan `docker compose up`: NOT RUN (lingkup WU-03/WU-01).

### Temuan baru (NEW FINDING) dari VYN-00-02

Fakta audit historis di `01..07` **tidak** diubah. Delta dicatat di sini.

| ID    | Temuan                                                                                                                                                                                                                                                                                                                                                                                                          | Dampak / tindak lanjut                                                                                                                                                       |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NF-01 | Base aktual `1d6b578` = audit `565e8e4` + 3 commit worker (`af9fc8c` #59, `4b99d2d` #61, `1d6b578` #63). Baseline tes berubah dari 28 file / 176 tes menjadi **29 file / 182 tes**: +5 tes di `pg-boss-start-retry.integration.spec.ts` (baru) dan +1 di `worker-heartbeat.integration.spec.ts`.                                                                                                                | Baseline acuan migrasi berikutnya = 182/29 pada `1d6b578`, bukan 176/28.                                                                                                     |
| NF-02 | Kontrak `PgBossService` melebar: start pertama ditunggu, kegagalan di-retry di latar (5 s → ×2 → maks 60 s), start yang macet dianggap gagal setelah 30 s (`PG_BOSS_START_TIMEOUT_MS`) dan instance-nya dibuang, `work()` yang dipanggil saat queue mati ditunda lalu didaftarkan setelah start (mengembalikan `false`), `sendJob` melempar error saat tidak berjalan, dan `onModuleDestroy` membatalkan retry. | Wajib dipertahankan oleh `QueueService` BullMQ di WU-05a; lihat analisis di bawah.                                                                                           |
| NF-03 | Heartbeat worker kini mensyaratkan `PgBossService.isRunning()` selain ping DB. `WorkerHeartbeatService`, `OutboxDispatcherService`, `InboundProcessorService`, dan `OutboundDispatcherService` meng-inject **kelas konkret** `PgBossService`.                                                                                                                                                                   | WU-05a perlu token/abstraksi transport (atau penggantian kelas yang terkontrol) dan definisi sehat selama dual-transport.                                                    |
| NF-04 | F-01 masih ada pada `1d6b578`: runtime `GET /health/live` = 404, `GET /api/v1/health/live` = 200. Healthcheck worker di **kedua** salinan compose/Dockerfile ikut diubah oleh #59, jadi duplikasinya masih ada.                                                                                                                                                                                                 | WU-01 tetap diperlukan; DEC-08 (compose root, Dockerfile `infrastructure/docker/`) relevan.                                                                                  |
| NF-05 | Pernyataan audit "semua route web statis" kurang tepat: `next build` menandai `/ai-agent/[agentId]` sebagai `ƒ` (dinamis). Route ini sudah ada sejak `104bb74` (2026-09-29), jadi juga ada pada `565e8e4`. Ini bukan regresi.                                                                                                                                                                                   | Tidak mengubah rencana WU-06 (route berparameter menjadi route klien React Router). Koreksi kalimat audit diusulkan lewat catatan ini, bukan dengan mengedit fakta historis. |
| NF-06 | Turbo 2.11 memakai cache bersama antar-worktree, sehingga `pnpm lint/typecheck/build` lokal dapat hanya me-replay hasil lama.                                                                                                                                                                                                                                                                                   | Baseline lokal harus memakai `turbo run <task> --cache=local:,remote:` (atau `--force`) dan mencatat jumlah `Cached`.                                                        |
| NF-07 | `vynor_test` ditemukan dengan seed sudah terhapus sebelum sesi ini, dan satu tes meninggalkan residu workspace "Committed Workspace" pada setiap run.                                                                                                                                                                                                                                                           | Sebelum smoke `dev-session`, selalu jalankan `db:seed`. Residu ini perilaku tes yang sudah ada dan tidak diubah.                                                             |

#### Analisis dampak tiga commit terhadap WU-05a (VYN-05A-01..03)

1. **Startup retry:** BullMQ/ioredis memiliki reconnect sendiri, tetapi WU-05a harus membuktikan perilaku yang setara dengan NF-02. Ketika Redis tidak tersedia saat boot, worker tetap boot dan `isRunning()` = `false`. Handler yang didaftarkan sebelum siap harus tersubscribe setelah koneksi pulih, tanpa duplikasi consumer.
2. **Timeout:** padanan `PG_BOSS_START_TIMEOUT_MS` diperlukan untuk koneksi/inisialisasi Redis yang menggantung, misalnya batas waktu `waitUntilReady`, dan setiap instance yang ditinggalkan harus ditutup.
3. **Produser gagal cepat:** dispatcher hanya boleh menandai outbox `COMPLETED` setelah job benar-benar diterima, dan tidak meng-claim apa pun saat queue mati (`isRunning()` diperiksa di `outbox-dispatcher.service.ts`). Koneksi produser BullMQ karena itu harus menolak perintah saat terputus (tanpa offline queue). Tanpa ini, `Queue.add` dapat tertahan di memori dan melanggar kontrak "`sendJob` melempar saat tidak berjalan".
4. **Heartbeat:** definisi target "DB ping **dan** Redis ping **dan** worker BullMQ berjalan" (05 §3.2) sejalan dengan arah #59. Untuk fase dual-transport 05a (produser BullMQ + consumer drain pg-boss), owner perlu memutuskan apakah kegagalan start pg-boss drain membuat container `unhealthy`.
5. **Tes:** lima tes `pg-boss-start-retry` dan tes heartbeat terkait pg-boss tidak boleh sekadar dihapus di WU-05b. Tes padanan untuk BullMQ (Redis mati saat boot, koneksi menggantung, shutdown saat retry) wajib ada lebih dulu.
6. **Status:** awalnya usulan (`PROPOSED`). Atas persetujuan owner (2026-10-17, finalisasi WU-00), butir 1–5 dimasukkan ke input, aksi, output, dan acceptance VYN-05A-01/02/03 dan VYN-05B-02. Implementasi BullMQ **belum** dimulai. Kriteria heartbeat dual-transport (butir 4) tetap menunggu keputusan owner, dan tercatat sebagai input VYN-05A-02.

### Finalisasi WU-00 — koreksi dokumen, validasi, commit, dan PR

- **Owner approval:** chat owner "VYN-00-02 DITERIMA — FINALISASI WU-00 DAN SIAPKAN PULL REQUEST". Yang diizinkan:
  - koreksi dokumentasi route Next.js;
  - sinkronisasi tiket WU-05a;
  - validasi akhir;
  - VYN-00-02 `DONE`;
  - commit dokumen saja, push branch `docs/migration-plan`, dan PR ke `main`.

  Yang dilarang: merge, WU-01, perubahan kode, schema, atau konfigurasi deployment, perubahan checkout `main`, dan penghapusan backup, Trash, atau salinan lama.

- **Koreksi NF-05:**
  - Klaim "semua route statis" dikoreksi dengan catatan berlabel di 01 §4 dan §6.3, 02 §2.2, dan 04 §2.2. Angka baseline historis (build 11/11, dan seterusnya) dipertahankan.
  - Baris pemetaan `/ai-agent/[agentId]` → `/ai-agent/:agentId` ditambahkan di 05 §4.1.
  - Kebutuhan verifikasi dicatat di 06 WU-03/WU-06, VYN-03-04, VYN-06B-01, VYN-06B-03, dan VYN-06C-02.
  - Bukti teknis: halaman `'use client'` + `useParams`, tanpa `generateStaticParams`, data server, cookie, header, atau server action. Tidak ada hambatan nyata, sehingga DEC-03 (Vite + React Router) tidak berubah.
- **Sinkronisasi WU-05a (NF-02/NF-03):**
  - VYN-05A-01 kini mencakup startup retry, timeout, producer fail-fast, deferred handler registration, token DI transport untuk empat consumer, graceful shutdown, dan matriks kesetaraan pg-boss ↔ BullMQ.
  - VYN-05A-02 mencakup kriteria heartbeat dual-transport (menunggu keputusan owner).
  - VYN-05A-03 mencakup fault injection untuk heartbeat dan claim saat Redis tidak siap.
  - VYN-05B-02 mewajibkan test pengganti sebelum test pg-boss dihapus.
  - 05 §3.2, 06 WU-05, dan Kanban §8 diselaraskan. Tidak ada implementasi.
- **Koreksi konten akibat Prettier (temuan saat validasi):** pada VYN-00-01, Prettier mengubah dua item teks biasa yang memuat `*`/`__` menjadi emphasis. Item VYN-01-02 (input path Dockerfile) dan VYN-06B-02 (aksi `window.__VYNOR_CONFIG__`) terdampak, di tiket maupun Kanban. Keduanya dipulihkan sebagai code span di JSON, tiket, dan Kanban. Pemindaian seluruh `docs/migration/**` tidak menemukan perubahan isi lain, selain emphasis `*teks*` → `_teks_` yang setara.
- **Status:** VYN-00-01 dan VYN-00-02 `DONE` (diterima owner); WU-00 `IN_REVIEW` (PR). WU-00 menjadi `DONE` hanya setelah owner merge.
- **Validasi sebelum commit:** lihat `09-regression-test-results.md` bagian finalisasi.
- **Commit dan PR:** commit dokumen pada `docs/migration-plan` (base `1d6b578`); SHA commit dan URL PR tercatat di deskripsi PR dan laporan agent, karena commit tidak dapat memuat SHA-nya sendiri. Merge oleh owner.

### Pasca-merge WU-00 — 2026-10-17

- PR #64 di-merge owner ke `main` sebagai `07e77482c9447ef9d6b0a15949e6dedc03a85cf0`. Verifikasi pasca-merge (sesi `89bf14a1`): 61 file `docs/migration/**` identik dengan head PR; CI pada commit merge 4/4 lolos.
- Owner menetapkan WU-00 `DONE` dan WU-01 `READY`, lalu `IN_PROGRESS` saat implementasi dimulai (chat "WU-01 — RANCANGAN DISETUJUI DENGAN KOREKSI — IMPLEMENTASI TAHAP 1").

## WU-01 — 2026-10-17

### Tahap 1 — konfigurasi, skrip, CI, dan dokumen (VYN-01-01..03 `IN_PROGRESS`)

- **Owner approval:** chat owner "WU-01 — RANCANGAN DISETUJUI DENGAN KOREKSI — IMPLEMENTASI TAHAP 1".
  - Keputusan: F-01 prioritas **P0**, risiko implementasi WU-01 **HIGH**; `container_name` di compose default dipertahankan; smoke memakai overlay dengan project terisolasi `vynor-wu01-smoke`; salinan dokumen lama di checkout utama tidak dipindah atau dihapus.
  - Koreksi wajib A–F: healthcheck Caddy, image MinIO, isolasi Compose, runner, CI, dokumentasi.
  - Diizinkan: perubahan konfigurasi, Dockerfile, skrip verifikasi, overlay, runner, workflow CI, dan dokumen di worktree WU-01 baru; pemeriksaan read-only, `docker compose config`, format, lint, typecheck, build, dan pull image MinIO/mc yang terverifikasi.
  - Belum diizinkan: `docker compose up`/`down`; membuat/menghapus container, network, atau volume; migrasi Prisma, seed, atau test yang memodifikasi DB; compose pada project default; commit/push/PR; perubahan checkout utama; penghapusan backup atau salinan lama.
- **Branch, base/head SHA:** `fix/wu-01-compose-health` di worktree `.claude/worktrees/wu-01-compose-health`, dibuat dari `origin/main` `07e7748`. Upstream dilepas (`git branch --unset-upstream`) supaya push tidak pernah jatuh ke `main`. Head = base; belum ada commit. Checkout utama tidak diubah (`main` @ `565e8e4`, file untracked tetap).
- **Perubahan file:**
  - VYN-01-01: `docker-compose.yml` (probe api `/api/v1/health/live`; probe caddy HTTPS + root CA internal), `infrastructure/docker/Dockerfile.api` (`HEALTHCHECK`), `infrastructure/caddy/Caddyfile` (rewrite `/health/*` → `/api/v1/health/*`).
  - VYN-01-02 (DEC-08): `build.dockerfile` → `infrastructure/docker/Dockerfile.*`; hapus `apps/{api,worker,web}/Dockerfile` dan `infrastructure/docker/docker-compose.yml` (identik byte-per-byte dengan versi kanonis); matrix `.github/workflows/container-security.yml`.
  - VYN-01-03 (baru): `infrastructure/docker/compose.smoke.yml`, `infrastructure/docker/smoke.env`, `infrastructure/scripts/compose-smoke.sh`, `infrastructure/scripts/compose-smoke-guard.mts`, `.github/workflows/compose-smoke.yml`.
  - `infrastructure/scripts/verify-infrastructure.ts`: 11 → 18 cek, termasuk uji negatif probe dan guard.
  - Dokumen: `docs/infrastructure-and-deployment.md`, `docs/health-checks-and-probes.md`, 06 §3/§7, Kanban, JSON, VYN-01-01..03, `agent/00-START-HERE.md`, 08, 09.
- **Temuan:**
  - **F-02 terkonfirmasi (statis):** `caddy adapt --validate` (biner v2.8.4 dari image `caddy:2.8-alpine`, dijalankan offline dengan data dir di scratchpad) menunjukkan satu-satunya listener `:443` (`automatic_https.disable_redirects`). Healthcheck lama `http://localhost:80/health/live` tidak mungkin sehat, terlepas dari F-01.
  - **Alat healthcheck Caddy:** image berisi busybox `wget` + `ssl_client` (Alpine 3.20.4, OpenSSL 3: `SSL_CTX_set_default_verify_paths`, `SSL_set1_host`), tanpa `curl`. `SSL_CERT_FILE=/data/caddy/pki/authorities/local/root.crt` membuat probe memverifikasi rantai sertifikat dan hostname terhadap CA internal Caddy. Pengecualian verifikasi tidak diperlukan. Path root CA dibuktikan dari `caddy adapt --validate` (`$XDG_DATA_HOME/caddy/pki/authorities/local/root.crt`, dan `XDG_DATA_HOME=/data` di image).
  - **NF-08 (baru) — image MinIO tidak tersedia, pin BLOCKED:** `docker.io/minio/minio` dan `docker.io/minio/mc` tidak ada lagi di Docker Hub (Hub API 404; manifest registry 401 dengan token anonim; namespace `minio` tidak lagi memuat kedua repo). `quay.io/minio/{minio,mc}` menolak pull anonim (401). Tidak ada tag/digest yang dapat diverifikasi, sehingga sesuai koreksi B bagian pin dihentikan. Image lokal `minio/minio:latest` (label `RELEASE.2025-09-07T16-13-09Z`, `sha256:14cea493…`) **tidak** dipakai sebagai pengganti. `minio/mc` tidak ada di lokal. Dampak: `rustfs`/`rustfs-init` tidak dapat di-pull di mesin atau runner CI baru, sehingga smoke tahap 2 dan job CI `compose-smoke` akan gagal pada pull sampai owner memutuskan image storage.
  - **Hash `postgres` default tidak berubah:** `docker compose --project-name vynor-wu01-smoke -f <file> config --hash postgres` (env `POSTGRES_PORT=5434` saja) = `b1738eb760aac67d20255a8fe9cfe5d5e7da295add5ec26fe4f6489740770e5c` untuk `origin/main`, untuk branch, dan sama dengan label `com.docker.compose.config-hash` container live `vynor-postgres`.
- **Perintah nyata dijalankan + output:**
  - `git fetch origin`; `gh pr view 64`: `MERGED`, merge commit `07e7748`.
  - Registry (read-only): `docker buildx imagetools inspect`, Docker Hub API, dan registry v2 Docker Hub/Quay (hasil di atas). Tidak ada `docker pull`.
  - `docker save caddy:2.8-alpine` dan `docker save minio/minio:latest` ke scratchpad (tanpa container), lalu inspeksi berkas: `minio` memuat `curl` dan `mc`, jadi healthcheck `rustfs` valid.
  - `docker compose --project-name vynor-wu01-smoke … config --format json` (default dan default+overlay, env disanitasi): PASS.
  - `pnpm format:check`, `pnpm lint` (17/17), `pnpm build` (11/11), `pnpm typecheck` (11/11), `pnpm infra:verify` (18/18, dua peringatan `[BLOCKED]` MinIO), ESLint dan `tsc --strict` untuk skrip infra: PASS (rincian di 09).
  - `infrastructure/scripts/compose-smoke.sh preflight` dengan `TMPDIR` di scratchpad: PASS, termasuk uji negatif (lihat 09).
  - Snapshot state Docker sebelum dan sesudah seluruh tahap 1 (39 container, 33 volume, 18 network, 47 image, metadata `vynor-postgres`): identik.
- **NOT RUN (menunggu persetujuan tahap 2):** `compose up`/`down`, build image, migrate/seed `vynor_test` smoke, `pnpm test`, smoke HTTP, `shellcheck` (tidak tersedia lokal; dijalankan job CI), job CI `compose-smoke` (belum ada push).
- **Keputusan yang dibutuhkan owner (NF-08):** pengganti image storage untuk service `rustfs`/`rustfs-init`. Opsi yang perlu diverifikasi sebelum dipilih: (a) image RustFS resmi (sesuai nama service dan AD-010; perubahan perilaku storage); (b) fork/mirror MinIO komunitas atau Chainguard (digest saja, provenance perlu ditinjau); (c) build image MinIO dari source di repo ini (beban pemeliharaan); (d) memisahkan storage dari smoke (deviasi dari "semua container sehat"). Tidak ada opsi yang dipilih atau di-pull.
- **Rencana tahap 2 (PROPOSED, butuh persetujuan):** lihat `docs/infrastructure-and-deployment.md` §6 dan laporan agent.
- **Status:** VYN-01-01..03 `IN_PROGRESS`. Tidak ada commit atau PR.

### Tahap 2 — NF-08 (PGSTY Silo) dan smoke terisolasi (VYN-01-01..03 `IN_REVIEW`)

- **Owner approval:** chat owner "WU-01 — TAHAP 1 DITERIMA, LANJUTKAN PENYELESAIAN NF-08 DAN SMOKE TERISOLASI".
  - Tahap 1 diterima dengan status `PASS WITH NOTES`.
  - NF-08: opsi (b) PGSTY Silo, hanya `docker.io/pgsty/silo:RELEASE.2026-10-15T00-00-00Z`, dipakai lewat digest registry yang terverifikasi.
  - Izin runtime terbatas: satu rangkaian smoke lewat runner `vynor-wu01-smoke` setelah preflight dan cek ownership lulus; migrate/seed/test hanya di `127.0.0.1:55432/vynor_test` setelah identitas instance diverifikasi; teardown hanya resource smoke, tanpa menghapus image.
  - Tetap dilarang: database/container/volume aktif, compose default, commit/push/PR/merge.
- **Verifikasi image (read-only, sebelum pull):**
  - `docker buildx imagetools inspect` dan registry v2 Docker Hub: index OCI `sha256:aaac6bce13eb99316b3c88bd20143fc3c38ab607585256a411a095c44ee57f62` (sha256 byte manifest = `Docker-Content-Digest`). Platform `linux/amd64` `sha256:1c210bc1…` (hash byte cocok) dan `linux/arm64` `sha256:87585bb7…`, plus attestation.
  - Config amd64 `sha256:77c299e4…`: label `org.opencontainers.image.version=RELEASE.2026-10-15T00-00-00Z`, source `github.com/pgsty/silo` revision `7a3ca0f8…`, lisensi AGPL-3.0-or-later, basis UBI9-micro.
  - Isi image: `silo`, `mcli` (+ symlink `mc`), `curl`, `/bin/sh`. Entrypoint menerjemahkan `server …`/`minio …` menjadi `silo …`. Biner memuat `/minio/health/live`, `--console-address`, `MINIO_ROOT_USER/PASSWORD`; `mcli` memuat `alias set` dan `mb --ignore-existing` (dicek lewat `strings`, tanpa menjalankan biner).
  - `docker pull docker.io/pgsty/silo:RELEASE.2026-10-15T00-00-00Z@sha256:aaac6bce…`: satu-satunya pull.
- **Perubahan:**
  - Service `rustfs` dan `rustfs-init` memakai `x-storage-image` (tag + digest). `rustfs-init` memakai `mcli` dengan `set -eu`, `mb --ignore-existing` dan `stat` untuk kedua bucket. Skrip lama mengakhiri dengan `exit 0` sehingga kegagalan tersembunyi; skrip baru gagal bila bucket tidak ada.
  - Kontrak S3 aplikasi, nama service, endpoint `http://rustfs:9000`, port, variabel `MINIO_ROOT_*`, volume, dan healthcheck `curl …/minio/health/live` tidak berubah.
  - Runner: build `@vynor/storage`; `rustfs-init` dijalankan dua kali pada container yang sama (keduanya harus exit 0); `check` menambah health storage dan round trip S3 lewat client aplikasi (`infrastructure/scripts/compose-smoke-s3.mts`), lalu pembersihan prefix `wu01-smoke/` dengan `mcli`.
  - Mula-mula image dan provisioning hanya ada di overlay smoke. Setelah smoke PASS keduanya dipindah ke `docker-compose.yml`, dan overlay kembali hanya berisi isolasi. Config smoke hasil render setelah pemindahan **identik** (`name`, `services`, `volumes`, `networks`) dengan `compose.rendered.json` yang diuji. Hash `postgres` default tetap `b1738eb7…` (= label container live). Compose default tidak dijalankan.
  - `infra:verify` menjadi 19 cek: storage harus tepat referensi Silo ber-digest, `rustfs-init` harus idempoten dan tidak menyembunyikan kegagalan, dan runner harus menjalankan cek S3. Peringatan `[BLOCKED]` hilang.
- **Percobaan smoke 1 (berhenti, bukan kegagalan WU-01):**
  - Preflight, guard, identitas PostgreSQL smoke dan 7 migrasi berhasil.
  - Seed gagal: `tsx` membuat socket IPC di bawah `TMPDIR`, dan `TMPDIR` yang diarahkan agent ke scratchpad sesi melebihi batas path unix socket (`listen EINVAL …/tsx-1000/<pid>.pipe`).
  - Stack parsial (1 container, 1 volume, 1 network smoke) dihapus dengan `compose-smoke.sh down` (ownership dicek), lalu `postflight` PASS. Batas panjang `TMPDIR` dicatat di `docs/infrastructure-and-deployment.md` §6.1.
- **Percobaan smoke 2 (`TMPDIR` default, artefak di scratchpad sesi):**
  - Preflight PASS; PostgreSQL smoke terverifikasi: `/vynor-wu01-smoke-postgres-1`, hanya volume smoke, satu-satunya publisher `127.0.0.1:55432`, `current_database()=vynor_test`, `system_identifier` sama dari dalam container dan dari koneksi host, tanpa DB `vynor`/`vynor_crm`.
  - `migrate deploy` (7 migrasi) dan seed PASS pada instance tersebut.
  - `rustfs-init` run 1 dan run 2 exit 0; kedua bucket memiliki satu timestamp pembuatan.
  - `up --build --wait`: 6 service `running healthy restarts=0`. Log healthcheck: API `200 OK`; Caddy `Connecting to localhost ([::1]:443) … remote file exists` (HTTPS terverifikasi CA internal); storage `curl` exit 0.
  - `check` pertama: semua PASS kecuali round trip S3 → **NF-09** (di bawah). Cek S3 diselaraskan dengan kontrak yang dipakai aplikasi, lalu `check` diulang pada stack yang sama: **semua PASS** (lihat 09).
  - Bukti tambahan: readiness API 200 (DB smoke `UP`); TLS Caddy `ssl_verify_result=0`, issuer `Caddy Local Authority - ECC Intermediate`; semua port hanya `127.0.0.1`; 0 log level error/fatal.
  - `logs`, `down` (7 container, 4 volume, 1 network, semua `vynor-wu01-smoke`), dan `postflight` PASS: snapshot `vynor-postgres` identik, tidak ada resource smoke tersisa.
- **State Docker sebelum vs sesudah tahap 2:** container, volume, network dan metadata `vynor-postgres` identik. Image bertambah sesuai izin dan sengaja dibiarkan: `pgsty/silo@sha256:aaac6bce…` (pull) serta `vynor-wu01-smoke-{api,worker,web}:latest` (build smoke).
- **NF-09 (baru, di luar scope WU-01, terbuka):** `@vynor/storage` (`packages/storage/src/s3-adapter.ts`) menandatangani `stat`/`get`/`delete` dengan payload hash `UNSIGNED-PAYLOAD`, tetapi tidak mengirim header `x-amz-content-sha256`. Server keluarga MinIO lalu memakai hash payload kosong → `403 SignatureDoesNotMatch`. Bukti (`s3-sigv4-diagnosis.txt`):
  - client aplikasi: `put` OK, signed download 200, `stat`/`get` 403;
  - request mentah dengan header yang ditandatangani: HEAD 200, GET 200, DELETE 204, HEAD sesudah delete 404;
  - tanpa header dengan hash payload kosong: 200.

  Ini bug client, bukan inkompatibilitas Silo, dan akan sama terjadi pada MinIO asli. API dan worker saat ini hanya memanggil `createSignedDownload`, jadi bug ini laten. Perlu tiket terpisah.

- **Status:** VYN-01-01..03 `IN_REVIEW` (acceptance lokal PASS). WU-01 `IN_PROGRESS` sampai PR dibuat. Tidak ada commit, push, atau PR.

### Finalisasi WU-01 — commit, CI, dan PR

- **Owner approval:** chat owner "WU-01 DITERIMA — LANJUTKAN COMMIT, CI, DAN PULL REQUEST" (status `PASS WITH NOTES`):
  - VYN-01-01..03 diterima (`DONE`);
  - NF-08 selesai (PGSTY Silo);
  - NF-09 dicatat sebagai bug terbuka di backlog (Kanban §1B), tidak diperbaiki di WU-01;
  - smoke lokal tidak diulang kecuali konfigurasi runtime berubah.

  Diizinkan: commit Conventional Commits, push branch, PR ke `main`, memantau CI (`compose-smoke`, `shellcheck`), dan perbaikan yang hanya terkait WU-01. Dilarang: merge, compose default lokal, perubahan container/volume/database aktif, pembersihan backup atau salinan lama, perbaikan NF-09, dan memulai WU-02.

- **Pemeriksaan sebelum commit:** `git fetch origin`: `origin/main` = merge-base = `07e7748` (memuat WU-00). Setelah itu `pnpm format:check`, `git diff --check`, `infra:verify`, konsistensi JSON ↔ tiket ↔ Kanban, dan pemeriksaan scope (hasilnya di laporan PR).
- **Status:** WU-01 `IN_REVIEW` (PR). SHA commit, URL PR, dan hasil CI tercatat di deskripsi PR dan laporan agent, karena commit tidak dapat memuat SHA-nya sendiri. Merge hanya oleh owner.

### Pasca-merge WU-01 — 2026-10-17 (dicatat 2026-10-19)

- **Merge:** PR #65 di-merge owner ke `main` pada 2026-10-17 07:51 UTC sebagai `aa745900d364ca978aa4d63048ad75a4f275ab9b` (squash dari `833be1f` + `303f122`). `git fetch origin`: `origin/main` = `aa74590`.
- **CI pada commit merge (semua `success`):** CI Quality Gate & Verification (Application Verification Suites, Migration Drift & Schema Invariants, Code Quality, Vitest), Compose Smoke (isolated) (`vynor-wu01-smoke`, `vynor_test`), Container Security, Vulnerability Scan & SBOM (api, web, worker; push dan run terjadwal 2026-10-18). Tidak ada kegagalan material.
- **Status:** WU-01 `DONE`; VYN-01-01..03 `DONE`.

## WU-02 — 2026-10-17 s.d. 2026-10-19

### Implementasi (VYN-02-01, VYN-02-02)

- **Owner approval:** chat owner "WU-01 DONE — MULAI WU-02" (2026-10-17). Scope hanya VYN-02-01 dan VYN-02-02; tanpa audit ulang WU-00/WU-01, tanpa perluasan scope, tanpa NF-09; tidak boleh pull di checkout utama; PR terpisah ke `main`, tanpa merge.
- **Branch, base/head SHA:** `fix/wu-02-security-patches` di worktree `.claude/worktrees/wu-02-security-patches`, dibuat dari `origin/main` `aa74590`. Checkout utama tidak diubah (`main` @ `565e8e4`, file untracked tetap).
- **Baseline audit (sebelum perubahan):** `pnpm audit --prod` = 9 advisory (1 low, 4 moderate, 4 high): `pdfjs-dist` (GHSA-hq66-cqwq-w95j, high), `next` (GHSA-cjq9-62q9-8jv4 high + 4 moderate + 1 low), dan transitif lewat `next`: `sharp` (GHSA-wq5f-xc86-pv6w, high) serta `source-map-js` (GHSA-68fv-2mgg-jv7q, high). Rincian di 09.
- **VYN-02-01:**
  - `next` 16.3.6 → 16.3.8 (patch, tetap 16.x sampai WU-06d) dan `pdfjs-dist` ^5.7.284 → ^6.4.299 (patched ≥ 6.2.108). `isEvalSupported:false` tidak diperlukan.
  - pnpm mempertahankan `sharp@0.35.4` dan `source-map-js@1.2.1` dari lockfile lama karena masih memenuhi rentang. Keduanya dinaikkan secara terarah di lockfile ke 0.35.5 dan 1.2.2, tanpa `overrides`.
  - Diff lockfile hanya memuat paket-paket itu: `next`/`@next/*`, `pdfjs-dist` dengan optional dependency `@napi-rs/canvas` 0.1.100 → 1.0.11, `sharp`/`@img/sharp-*` dan libvips 1.3.3 → 1.3.4, `source-map-js`, serta link importer `socket.io-client` di `apps/api`.
  - `extract-file-text.ts`: pdfjs 6 menghapus `PDFDocumentProxy.destroy()` (typing 6.4.299 hanya punya `cleanup()`). Pembersihan sekarang lewat `loadingTask.destroy()`, yang juga membersihkan file yang gagal dimuat.
  - Test baru `apps/web/tests/unit/extract-file-text.spec.ts` (4 test, fixture PDF dibangun di test).
- **VYN-02-02:**
  - `realtime.gateway.ts`: `cors: { origin: '*' }` diganti `cors.origin` + `allowRequest` dari `apps/api/src/realtime/realtime-origin.ts`. Daftar origin dibaca dari `CORS_ALLOWED_ORIGINS` (env API tervalidasi) lewat `parseCorsAllowedOrigins`, helper yang juga dipakai REST di `main.ts`.
  - Origin asing ditolak sebelum handshake; tanpa Origin tetap wajib JWT.
  - Test baru `apps/api/tests/realtime-origin.integration.spec.ts` (11 test, server dan client Socket.IO asli, tanpa DB). `socket.io-client` ^4.8.3 ditambahkan sebagai devDependency `apps/api`.
  - Komentar `CORS_ALLOWED_ORIGINS` di `.env.example` dan `apps/api/.env.example`.
- **Catatan proses:** sesi implementasi berhenti saat mencoba uji PDF opsional di browser pane, tanpa laporan akhir. Perubahan masih belum di-commit di worktree. Laporan status 2026-10-19 merangkum kondisinya, lalu owner memberi instruksi finalisasi.

### Finalisasi WU-02 — validasi, commit, dan PR (2026-10-19)

- **Owner approval:** chat owner "WU-02 — FINALISASI DAN BUAT PULL REQUEST".
  - Status: WU-01 `DONE`, WU-02 `IN_PROGRESS`, VYN-02-01..02 sesuai hasil validasi.
  - Validasi wajib: `format:check`, `lint`, `typecheck`, `build`, web `verify`, `test` hanya di instance test terverifikasi, dan `audit --prod`.
  - Diizinkan: commit, push, PR ke `main`, menunggu CI.
  - Dilarang: NF-09, perubahan Docker Compose atau konfigurasi WU-01, memulai WU-03, merge, dan perubahan checkout utama atau database aktif.
- **Validasi:** semua PASS (tabel di 09).
  - `format:check` pertama gagal pada `apps/api/tests/realtime-origin.integration.spec.ts`, file WU-02. File itu dirapikan dengan Prettier, lalu PASS.
  - `lint` dan `typecheck` diulang dengan `--force` (tanpa cache turbo).
- **Database:** `pnpm test` dengan env file ber-guard (menolak URL selain `localhost:5434/vynor_test`).
  - `prisma migrate status`: datasource `vynor_test` di `localhost:5434`, 7 migrasi, up to date.
  - Seed sebelum dan sesudah test.
  - `pg_stat_database` sebelum/sesudah: `tup_inserted`/`tup_updated`/`tup_deleted` untuk `vynor` dan `vynor_crm` tetap 0; semua tulisan ada di `vynor_test`.
- **NOT RUN:**
  - Upload knowledge PDF di browser (opsional menurut owner; keterbatasan dicatat di VYN-02-01).
  - Golden path E2E (WU-03).
  - Compose smoke lokal (compose dan konfigurasi WU-01 tidak berubah; job CI `compose-smoke` tetap berjalan pada PR).
- **Status:** WU-02 `IN_PROGRESS`; VYN-02-01..02 `IN_REVIEW` (acceptance otomatis PASS). SHA commit, URL PR, dan hasil CI tercatat di deskripsi PR dan laporan agent, karena commit tidak dapat memuat SHA-nya sendiri. Merge hanya oleh owner.

### Pasca-merge WU-02 — 2026-10-19

- **Merge:** PR #66 di-merge owner ke `main` pada 2026-10-19 04:00 UTC (atas instruksi owner "merge #66", squash) sebagai `f21f01211073252cb5e2871bbadd1845af025eb8`; tree identik dengan head PR `2085578`. `git fetch origin`: `origin/main` = `f21f012`.
- **CI pada commit merge (semua `success`):** CI Quality Gate & Verification, Container Security, Vulnerability Scan & SBOM, Compose Smoke (isolated).
- **Status:** WU-02 `DONE`; VYN-02-01..02 `DONE` (dicatat dalam PR WU-03, seperti WU-01 dicatat dalam PR WU-02).

## WU-03 — 2026-10-19

### Implementasi dan validasi (VYN-03-01..05)

- **Owner approval:** chat owner "WU-02 selesai — lanjutkan WU-03" (2026-10-19).
  - Verifikasi PR #66 sudah merged dan tersedia di `origin/main`, lalu tandai WU-02 `DONE`.
  - Kerjakan WU-03 di worktree dan branch baru dari `origin/main`, mengikuti tiket dan acceptance criteria tanpa memperluas scope atau mengulang audit WU sebelumnya.
  - Hanya database pengujian terverifikasi.
  - PR terpisah setelah test lulus; tanpa merge oleh agent.
- **Branch, base SHA:** `test/wu-03-characterization-e2e` di worktree `.claude/worktrees/wu-03-characterization-e2e`, dibuat dari `origin/main` `f21f012`. Checkout utama tidak diubah.
- **Database:** `vynor_test` untuk `pnpm test` (env file ber-guard yang menolak URL selain `localhost:5434/vynor_test`) dan `vynor_e2e` untuk `pnpm test:e2e` (guard harness: hanya `vynor_e2e`/`vynor_test`/`vynor_shadow`). `pg_stat_database` untuk `vynor` dan `vynor_crm` tetap 0 insert/update/delete.
- **VYN-03-01 (harness):** stack E2E di `apps/web/playwright.config.ts`: guard DB → prepare (migrate, truncate `public` + `pgboss.job`, seed, fixture tenant kedua dan workspace screenshot) → stub provider → API dan worker dari `dist` → `next build` + `next start` → browser container Playwright 1.63.0 ber-digest. Stub meniru WhatsApp Cloud (success/transient/permanent, webhook dan receipt bertanda tangan, replay, log panggilan). Dokumentasi: `apps/web/tests/e2e/README.md`. Devdependency `@vynor/database` (workspace) ditambahkan ke `apps/web`.
- **VYN-03-02 / VYN-03-03 (karakterisasi HTTP/service):** 5 spec baru (`conversations`, `webchat`, `media`, `idempotency` di `apps/api/tests`, `channel-polling` di `apps/worker/tests`), 46 test, dengan server HTTP yang disusun seperti `main.ts`. Tidak ada kode produksi yang berubah.
- **VYN-03-04 (E2E):** `golden-path` (6), `channels` (1), `tenant-isolation` (2), `screenshots` (21, 21 PNG baseline). `auth-smoke` (4, sudah ada): test shell preview kini membuat request API gagal secara eksplisit, karena stack E2E sekarang menjalankan API sungguhan; assertion tidak berubah.
- **VYN-03-05 (CI):** job `e2e-golden-path` di `ci.yml` menjalankan `pnpm test:e2e` dua kali berturut-turut, mengunggah laporan HTML selalu dan trace/screenshot/diff bila gagal; `retries: 0`.
- **Catatan proses:**
  - Run-server Playwright di container mengabaikan SIGTERM yang diteruskan docker, sehingga container tertinggal setelah run (ditemukan saat run berurutan). Diperbaiki dengan `support/browser-server.sh`, yang menghapus container saat dihentikan dan menghapus sisa run yang terputus sebelum start.
  - Satu assertion waktu di test polling baru (toleransi 50 ms) gagal di run penuh. Diganti batas eksak, bukan dilonggarkan, dan satu `setTimeout` di test yang sama diganti pemeriksaan deterministik.
- **Validasi:** semua PASS (tabel di 09).

### Temuan baru (NEW FINDING) dari WU-03

Bug riil yang direkam test karakterisasi apa adanya. Semuanya **di luar scope migrasi** dan **tidak diperbaiki** di WU-03; perbaikan menunggu keputusan owner sebagai tiket terpisah.

| ID    | Temuan                                                                                                                                                                                                                                                                                                                                            | Bukti (test)                                                                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| NF-10 | Unassign (`PATCH /conversations/:id` dengan `assigneeMembershipId: null`) menulis assignee **lama** ke `afterState` audit `conversation.updated`, karena `afterState` memakai `data.assigneeMembershipId ?? conversation.assigneeMembershipId`. Percakapannya sendiri benar ter-unassign; hanya jejak audit yang salah. Dampak: integritas audit. | `conversations-http.integration.spec.ts` › assigns, self-assigns and unassigns                    |
| NF-11 | `IdempotencyInterceptor` tidak memeriksa payload: key yang dipakai ulang dengan body berbeda mendapat respons pertama (`201`, `x-idempotent-replay: true`) dan payload baru dibuang diam-diam. Praktik umum (draft IETF Idempotency-Key) menolaknya dengan 422.                                                                                   | `idempotency-http.integration.spec.ts` › replays the first response even when the payload differs |
| NF-12 | Scope key idempotency adalah workspace + method + path + key, bukan user: user lain di workspace yang sama dengan key yang sama menerima respons tersimpan milik user pertama. Kemungkinannya kecil karena key dibuat acak oleh klien.                                                                                                            | `idempotency-http.integration.spec.ts` › scopes keys to the workspace                             |
| NF-13 | `GET /media/:messageId` menjawab error dengan body `{ code, message }`, bukan envelope error standar API (`statusCode`, `correlationId`, `timestamp`) seperti endpoint lain.                                                                                                                                                                      | `media-http.integration.spec.ts` › answers 403 MEDIA_LINK_INVALID                                 |

Perilaku yang terekam tetapi **bukan bug** (baseline untuk WU-04..06): store idempotency dan rate limiter webchat in-memory per proses (dijadwalkan pindah ke Redis di WU-04, DEC-04); Inbox membuka percakapan baru secara otomatis sementara tab default "Mine" kosong; `/analytics` merender halaman Reports; pengiriman pesan tidak diaudit; status `PENDING` tidak membutuhkan `conversation:close`; `POST /conversations/:id/read` cukup dengan `conversation:read`; `next start` memperingatkan konfigurasi `output: standalone`.

- **Status:** WU-03 `IN_PROGRESS`; VYN-03-01..05 `IN_REVIEW` (acceptance PASS lokal). SHA commit, URL PR, dan hasil CI tercatat di deskripsi PR dan laporan agent, karena commit tidak dapat memuat SHA-nya sendiri. Merge hanya oleh owner.

### Pasca-merge WU-03 — 2026-10-19

- **Merge:** PR #67 di-merge owner (Alkanni) ke `main` pada 2026-10-19 05:55 UTC (squash) sebagai `69fd238d8fd11af93ddc402212064039777b3547`; tree identik dengan head PR `9247269`. `git fetch origin`: `origin/main` = `69fd238`.
- **CI:** pada PR 10/10 check hijau, termasuk E2E Playwright (diverifikasi owner). Pada commit merge semua job hijau: CI Quality Gate & Verification (lima job, termasuk `E2E Golden Path, Channels & Screenshot Baseline`), Container Security (api/worker/web), Compose Smoke (isolated).
- **Status:** WU-03 `DONE`; VYN-03-01..05 `DONE` (dicatat dalam PR WU-04, seperti WU-02 dicatat dalam PR WU-03). NF-10..13 tetap backlog atas instruksi owner; auto-fix tidak diaktifkan; screenshot baseline tidak diubah.

## WU-04 — 2026-10-19

### Implementasi dan validasi (VYN-04-01..03)

- **Owner approval:** chat owner 2026-10-19 setelah verifikasi PR #67: setelah merge dikonfirmasi, verifikasi `origin/main`, perbarui WU-03 menjadi `DONE`, lalu lanjutkan WU-04 sesuai roadmap; NF-10..13 tetap backlog; tanpa memperluas scope atau mengubah screenshot baseline; tanpa merge oleh agent. DEC-04 sudah RESOLVED (APPROVE REKOMENDASI, 2026-10-17).
- **Konflik sumber yang diputuskan owner (aturan 02: STOP, tampilkan, minta keputusan):** aksi VYN-04-02 "fingerprint payload" dan acceptance "konflik payload ditolak" sama dengan perbaikan NF-11, sedangkan instruksi terbaru meminta NF-10..13 tetap backlog. Jawaban owner (2026-10-19): **ikuti tiket**. NF-11 ditutup oleh VYN-04-02 (422 `IDEMPOTENCY_KEY_REUSED`); NF-12 (scope per workspace) tetap backlog, sehingga "actor seperlunya" di tiket tidak diterapkan. Jawaban kedua: commit, push dan PR ke `main` diizinkan setelah semua validasi lulus.
- **Branch, base SHA:** `feat/wu-04-redis-shared-state` di worktree `.claude/worktrees/wu-04-redis-shared-state`, dibuat dari `origin/main` `69fd238`; upstream dilepas supaya push tidak jatuh ke `main`. Checkout utama tidak diubah.
- **Database dan Redis:** `pnpm test` hanya pada `localhost:5434/vynor_test` (env file ber-guard) dan Redis sekali pakai `vynor-wu04-test-redis` (127.0.0.1:56379, `--tmpfs /data`, image yang sama dengan compose); `pnpm test:e2e` pada `vynor_e2e` dan DB 1 Redis yang sama. Port 6379 di mesin ini dipakai proyek lain (`gesit-redis`) dan tidak disentuh. `pg_stat_database` untuk `vynor` dan `vynor_crm` tetap 0 insert/update/delete.
- **VYN-04-01 (infrastruktur, env, health):**
  - Compose: service `redis` dengan image `docker.io/library/redis:7.4.11-alpine@sha256:858f009f9709ce576febc734aa78b8f6d624b82571f9ddb6bda4377c833b3499` (index multi-arch diverifikasi dengan `docker buildx imagetools inspect`, dipull dengan digest), `--appendonly yes --appendfsync everysec --maxmemory ${REDIS_MAXMEMORY:-256mb} --maxmemory-policy noeviction --requirepass ${REDIS_PASSWORD:-vynor_redis_dev_secret}`, volume `redis_data:/data`, health check `redis-cli` terautentikasi, **tanpa port publish** (hanya `vynor-network`). API: `REDIS_URL` dan `depends_on: redis (service_healthy)`. Hash config service `postgres` tidak berubah (`b1738eb7…`, sama dengan label container live).
  - Env (`@vynor/contracts`): `REDIS_URL` (redis:// atau rediss://) wajib; `SHARED_STATE_STORE=memory` hanya bila `APP_ENV` local/test **dan** `NODE_ENV` development/test (APP_ENV default-nya `local`, jadi NODE_ENV ikut diperiksa). Store memory harus dipilih eksplisit; tanpa keduanya API menolak start.
  - API: `RedisModule` global (`apps/api/src/redis/`): klien ioredis 6.0.0 fail-fast (`enableOfflineQueue: false`, `maxRetriesPerRequest: 0`, `commandTimeout` 2 s, reconnect backoff ≤ 2 s tanpa batas), store idempotency dan rate limit (Redis atau memory), `RedisHealthIndicator`. Startup menunggu koneksi pertama ≤ 5 s lalu tetap start dengan readiness `DOWN`. Readiness dan `/health` kini memuat `redis`.
  - Smoke: overlay mereset `container_name`/`restart` untuk `redis`; guard mewajibkan Redis tanpa port, password placeholder, dan URL Redis ke `redis:6379`, serta menolak password URL yang bukan placeholder; runner menambah `check_redis` (CONFIG GET, NOAUTH tanpa password, readiness, kunci yang tertulis ke AOF lalu SIGKILL, start ulang, kunci masih ada, readiness kembali 200).
  - `infra:verify` 18 → 21 cek (image Redis ber-digest, kebijakan Redis, Redis di job CI Vitest dan E2E) dengan uji mutasi; CI: service Redis (image ber-digest yang sama) di job `automated-tests` (`TEST_REDIS_URL`) dan `e2e-golden-path` (`E2E_REDIS_URL`).
- **VYN-04-02 (idempotency):** claim/complete/release atomik dengan Lua dan lease, TTL in-flight 60 s dan completed 24 jam, fingerprint SHA-256 query + body (key objek diurutkan), replay, 409 in-flight lintas instance, 422 payload lain, 503 fail closed sebelum handler bila Redis tidak terjangkau. Key `vynor:idem:<workspaceId>:<sha256(method path key)>`. `error-catalog.ts`: `IDEMPOTENCY_KEY_REUSED` 409 → 422. Dokumentasi TTL, replay dan failure modes: `docs/idempotency-policy.md` §3, §5, §6.
- **VYN-04-03 (rate limit webchat):** counter di Redis (`INCR` + `PEXPIRE` atomik), window dan batas tidak berubah, key `vynor:rl:<scope>:<sha256(ip:widgetKey)>`, 503 fail closed saat Redis down. Harness E2E: guard `E2E_REDIS_URL` (hanya Redis lokal), `apiEnv` meneruskan `REDIS_URL`, spec baru `stack-readiness.spec.ts`.
- **Tes yang berubah (bukan dilonggarkan):** `idempotency-http` test NF-11 kini mengharapkan 422 (keputusan owner) dan test NF-12 memakai payload yang sama, supaya NF-12 tetap terkarakterisasi (payload berbeda → 422 juga diuji); lima spec yang tidak memakai store memilih `SHARED_STATE_STORE=memory` secara eksplisit; `health-controller` memakai indikator tanpa Redis. Tidak ada test yang dihapus dan baseline screenshot tidak berubah.
- **Validasi:** semua PASS (tabel di 09). Kontrol negatif: spec dua instance dengan store memory → 6 dari 7 test lintas instance FAIL.
- **Catatan proses:**
  - Smoke run pertama gagal karena dua bug di bagian Redis runner yang baru: `compose port` mencetak `:0` untuk port yang tidak dipublikasikan, dan `compose up --wait` setelah `docker kill` melihat container masih `Running` (kill belum selesai), sehingga Redis tidak di-start ulang. Diperbaiki dengan `docker wait`, `compose start redis` dan menunggu status `healthy`. Kunci memang sudah ada di AOF sebelum kill.
  - Saat run pertama masih berjalan, runner disunting; bash membaca skrip secara bertahap, sehingga sisa `all` mencetak pesan yang salah ("stack kept", `status: unbound variable`). Teardown dan postflight tetap lulus; diperiksa terpisah bahwa tidak ada container, volume atau network smoke tersisa dan `vynor-postgres` live tidak berubah (StartedAt, restart 0, hash `b1738eb7…`). Run berikutnya tidak menyentuh runner selama berjalan.
  - Log smoke menunjukkan API tidak mencatat outage: reconnect ke container yang di-start ulang langsung berhasil tanpa event `error`. Klien kini mencatat `… is unreachable; reconnecting` sekali per outage (event `reconnecting`, tidak muncul saat `quit`) dan `Reconnected …` saat pulih; ada test-nya. Seluruh validasi diulang pada tree akhir.

### Temuan baru (NEW FINDING) dari WU-04

| ID    | Temuan                                                                                                                                                                                                                                                                                                          | Tindak lanjut                                                        |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| NF-14 | Katalog error dan OpenAPI tidak sama dengan respons: request in-flight dijawab `409 IDEMPOTENCY_CONFLICT`, sedangkan katalog mendaftarkan `IDEMPOTENCY_IN_FLIGHT`; skema OpenAPI `ReadinessReport` menyebut `dependencies`, sedangkan respons memakai `checks`. Kode respons tidak diubah (dikunci test WU-03). | Di luar scope; tiket terpisah atau WU-07 (OpenAPI dari kontrak Zod). |

Status NF-11: **ditutup** oleh VYN-04-02 (keputusan owner 2026-10-19). NF-10, NF-12 dan NF-13 tetap backlog.

### Catatan rollout WU-04

- Setiap environment API wajib `REDIS_URL` (atau, hanya untuk satu proses local/test, `SHARED_STATE_STORE=memory`); tanpa itu API berhenti saat start dengan pesan yang menjelaskan keduanya. Ini juga berlaku untuk `.env` developer dan run lokal yang sudah ada.
- Password Redis dengan karakter khusus harus di-URL-encode di `REDIS_URL`. `REDIS_PASSWORD` di compose default-nya placeholder dev, seperti kredensial compose lain.
- Selama Redis down: request ber-`Idempotency-Key` dan endpoint webchat publik dijawab 503, readiness `DOWN`; request lain tetap dilayani.
- Lisensi: Redis 7.4 berlisensi RSALv2/SSPLv1 (bukan OSI); 7.2.16 (BSD-3) juga masih dirilis bila owner memerlukan lisensi OSI. Worker belum memakai Redis (mulai WU-05a).
- **Status:** WU-04 `IN_PROGRESS`; VYN-04-01..03 `IN_REVIEW`. SHA commit, URL PR dan hasil CI tercatat di deskripsi PR dan laporan agent, karena commit tidak dapat memuat SHA-nya sendiri. Merge hanya oleh owner.
