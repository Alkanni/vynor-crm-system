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
