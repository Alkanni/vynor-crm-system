# 01 — Register Keputusan dan Persetujuan Manusia

> **Status 2026-10-17:** DEC-01..09 **RESOLVED** oleh owner (DEC-07 = DEFER). Semua `GATE-*` masih **PENDING**. Eksekusi WU-00 diotorisasi owner pada 2026-10-17 (VYN-00-01, lalu VYN-00-02 atas instruksi terpisah, lalu commit dan PR atas persetujuan owner). Rekomendasi AI/konsultan bukan persetujuan. File ini adalah register keputusan manusia untuk WU-00 dan gerbang berikutnya. Jangan mengisi nama/tanggal palsu. Tanda tangan/komentar PR atau pesan owner yang dapat dirujuk boleh menjadi bukti; lampirkan URL/ID di sini.

## Ringkasan status (diisi owner)

| ID             | Item                                              | Gate sebelum           | Status owner                       | Bukti persetujuan                       |
| -------------- | ------------------------------------------------- | ---------------------- | ---------------------------------- | --------------------------------------- |
| DEC-01         | Repositori yang dimigrasikan                      | WU-00                  | **RESOLVED — APPROVE REKOMENDASI** | Chat owner 2026-10-17 (sesi `89bf14a1`) |
| DEC-02         | Transport background job                          | WU-05a                 | **RESOLVED — APPROVE REKOMENDASI** | Chat owner 2026-10-17 (sesi `89bf14a1`) |
| DEC-03         | Frontend router                                   | WU-06a                 | **RESOLVED — APPROVE REKOMENDASI** | Chat owner 2026-10-17 (sesi `89bf14a1`) |
| DEC-04         | Redis dan kegagalan koneksi                       | WU-04                  | **RESOLVED — APPROVE REKOMENDASI** | Chat owner 2026-10-17 (sesi `89bf14a1`) |
| DEC-05         | Penyedia autentikasi                              | WU-08                  | **RESOLVED — APPROVE REKOMENDASI** | Chat owner 2026-10-17 (sesi `89bf14a1`) |
| DEC-06         | Teknologi yang ditunda                            | WU-00                  | **RESOLVED — APPROVE REKOMENDASI** | Chat owner 2026-10-17 (sesi `89bf14a1`) |
| DEC-07         | Inbound media S3 dan antivirus                    | WU-09                  | **RESOLVED — DEFER WU-09**         | Chat owner 2026-10-17 (sesi `89bf14a1`) |
| DEC-08         | Lokasi compose/Dockerfile final                   | WU-01                  | **RESOLVED — APPROVE REKOMENDASI** | Chat owner 2026-10-17 (sesi `89bf14a1`) |
| DEC-09         | Strategi PR dan merge                             | WU-00                  | **RESOLVED — APPROVE REKOMENDASI** | Chat owner 2026-10-17 (sesi `89bf14a1`) |
| GATE-DB-DROP   | Persetujuan DROP SCHEMA pgboss                    | WU-05c                 | **PENDING**                        | —                                       |
| GATE-DB-FK     | Persetujuan perubahan FK CASCADE ke RESTRICT      | UNPLANNED              | **PENDING**                        | —                                       |
| GATE-ENV       | Perubahan database selain database test           | ANY_NON_TEST_DB        | **PENDING**                        | —                                       |
| GATE-AUTH-LIVE | Uji login Supabase asli sebelum hardening/cutover | WU-06d / WU-08 enforce | **PENDING**                        | —                                       |
| GATE-CUTOVER   | Persetujuan cutover dan drain pg-boss             | WU-05b                 | **PENDING**                        | —                                       |

## Panduan keputusan

Untuk **DEC-01–DEC-09**, owner harus menyatakan pilihan eksplisit. `DEC-07 = DEFER WU-09` adalah pilihan sah dan menutup keputusan tanpa mengizinkan WU-09. Untuk **GATE-DB-DROP / GATE-DB-FK / GATE-ENV / GATE-CUTOVER / GATE-AUTH-LIVE**, izin harus diberikan lagi ketika kondisi yang relevan benar-benar tiba; jangan otomatis disahkan oleh keputusan awal.

**Arti kolom "Gate sebelum":** WU paling awal yang secara teknis bergantung pada keputusan tersebut. Sesuai `06-migration-roadmap.md` §8.1 dan Kanban §4, **kesembilan DEC tetap wajib ditutup sebelum WU-00** (terpenuhi 2026-10-17).

**Dua level status:** keputusan `RESOLVED` ≠ izin menjalankan PR apa pun; masih perlu dependency teknis dan approval per lingkungan. `APPROVED` untuk WU-00 adalah approval roadmap/dokumen; bukan izin drop schema, kerja produksi atau merge otomatis.

## Rincian keputusan satu per satu

### DEC-01 — Repositori yang dimigrasikan

**Rekomendasi teknis (belum diputuskan):** Hanya /home/acgix/vynor-crm (monorepo TypeScript), bukan /home/acgix/VYNOR Rails/Chatwoot.

**Keputusan owner:** `APPROVE REKOMENDASI`

**Tanggal & approver:** Owner (pengguna sesi; git user `Alkanni`), 2026-10-17

**Dasar/evidence/komentar:** Pesan owner di chat Claude Code, sesi `89bf14a1-529b-42f0-a8c8-4a68063b2b36`: "DEC-01..09 setuju rekomendasi, DEC-07 = DEFER"

**Berlaku sebelum:** `WU-00`

### DEC-02 — Transport background job

**Rekomendasi teknis (belum diputuskan):** BullMQ + Redis, outbox PostgreSQL tetap sumber kebenaran.

**Keputusan owner:** `APPROVE REKOMENDASI`

**Tanggal & approver:** Owner (pengguna sesi; git user `Alkanni`), 2026-10-17

**Dasar/evidence/komentar:** Pesan owner di chat Claude Code, sesi `89bf14a1-529b-42f0-a8c8-4a68063b2b36`: "DEC-01..09 setuju rekomendasi, DEC-07 = DEFER"

**Berlaku sebelum:** `WU-05a`

### DEC-03 — Frontend router

**Rekomendasi teknis (belum diputuskan):** React + Vite + React Router; URL, UX dan perilaku dipertahankan.

**Keputusan owner:** `APPROVE REKOMENDASI`

**Tanggal & approver:** Owner (pengguna sesi; git user `Alkanni`), 2026-10-17

**Dasar/evidence/komentar:** Pesan owner di chat Claude Code, sesi `89bf14a1-529b-42f0-a8c8-4a68063b2b36`: "DEC-01..09 setuju rekomendasi, DEC-07 = DEFER"

**Berlaku sebelum:** `WU-06a`

### DEC-04 — Redis dan kegagalan koneksi

**Rekomendasi teknis (belum diputuskan):** Redis wajib staging/production, AOF everysec, noeviction; Idempotency-Key dan webchat rate limiter fail closed ketika tidak tersedia.

**Keputusan owner:** `APPROVE REKOMENDASI`

**Tanggal & approver:** Owner (pengguna sesi; git user `Alkanni`), 2026-10-17

**Dasar/evidence/komentar:** Pesan owner di chat Claude Code, sesi `89bf14a1-529b-42f0-a8c8-4a68063b2b36`: "DEC-01..09 setuju rekomendasi, DEC-07 = DEFER"

**Berlaku sebelum:** `WU-04`

### DEC-05 — Penyedia autentikasi

**Rekomendasi teknis (belum diputuskan):** Supabase Auth tetap; verifier OIDC generik dengan pemeriksaan iss/aud/JWKS bertahap.

**Keputusan owner:** `APPROVE REKOMENDASI`

**Tanggal & approver:** Owner (pengguna sesi; git user `Alkanni`), 2026-10-17

**Dasar/evidence/komentar:** Pesan owner di chat Claude Code, sesi `89bf14a1-529b-42f0-a8c8-4a68063b2b36`: "DEC-01..09 setuju rekomendasi, DEC-07 = DEFER"

**Berlaku sebelum:** `WU-08`

### DEC-06 — Teknologi yang ditunda

**Rekomendasi teknis (belum diputuskan):** Tunda Fastify, shadcn/Radix, Socket.IO Redis adapter, Prisma 7, Keycloak.

**Keputusan owner:** `APPROVE REKOMENDASI`

**Tanggal & approver:** Owner (pengguna sesi; git user `Alkanni`), 2026-10-17

**Dasar/evidence/komentar:** Pesan owner di chat Claude Code, sesi `89bf14a1-529b-42f0-a8c8-4a68063b2b36`: "DEC-01..09 setuju rekomendasi, DEC-07 = DEFER"

**Berlaku sebelum:** `WU-00`

### DEC-07 — Inbound media S3 dan antivirus

**Rekomendasi teknis (belum diputuskan):** WU-09 ditunda sampai model keamanan disetujui; bila dikerjakan utamakan pemindaian sungguhan (mis. ClamAV) daripada menandai unscanned media CLEAN.

**Keputusan owner:** `DEFER (WU-09 tetap tidak aktif; sesuai rekomendasi)`

**Tanggal & approver:** Owner (pengguna sesi; git user `Alkanni`), 2026-10-17

**Dasar/evidence/komentar:** Pesan owner di chat Claude Code, sesi `89bf14a1-529b-42f0-a8c8-4a68063b2b36`: "DEC-01..09 setuju rekomendasi, DEC-07 = DEFER"

**Berlaku sebelum:** `WU-09`

### DEC-08 — Lokasi compose/Dockerfile final

**Rekomendasi teknis (belum diputuskan):** Compose root repository, Dockerfile di infrastructure/docker, tanpa duplikat.

**Keputusan owner:** `APPROVE REKOMENDASI`

**Tanggal & approver:** Owner (pengguna sesi; git user `Alkanni`), 2026-10-17

**Dasar/evidence/komentar:** Pesan owner di chat Claude Code, sesi `89bf14a1-529b-42f0-a8c8-4a68063b2b36`: "DEC-01..09 setuju rekomendasi, DEC-07 = DEFER"

**Berlaku sebelum:** `WU-01`

### DEC-09 — Strategi PR dan merge

**Rekomendasi teknis (belum diputuskan):** Satu PR per WU ke main (WU-05a/b/c dan WU-06a/b/c/d masing-masing PR); owner merge. Tidak memakai branch integrasi.

**Keputusan owner:** `APPROVE REKOMENDASI`

**Tanggal & approver:** Owner (pengguna sesi; git user `Alkanni`), 2026-10-17

**Dasar/evidence/komentar:** Pesan owner di chat Claude Code, sesi `89bf14a1-529b-42f0-a8c8-4a68063b2b36`: "DEC-01..09 setuju rekomendasi, DEC-07 = DEFER"

**Berlaku sebelum:** `WU-00`

### GATE-DB-DROP — Persetujuan DROP SCHEMA pgboss

**Rekomendasi teknis (belum diputuskan):** Tidak diizinkan oleh persetujuan roadmap umum; memerlukan persetujuan khusus setelah backup dan dry-run restore.

**Keputusan owner:** `[BELUM DIISI / APPROVE REKOMENDASI / PILIH ALTERNATIF / DEFER]`

**Tanggal & approver:** `[BELUM DIISI]`

**Dasar/evidence/komentar:** `[BELUM DIISI]`

**Berlaku sebelum:** `WU-05c`

### GATE-DB-FK — Persetujuan perubahan FK CASCADE ke RESTRICT

**Rekomendasi teknis (belum diputuskan):** Di luar roadmap default. Jangan dijalankan tanpa ticket dan persetujuan terpisah.

**Keputusan owner:** `[BELUM DIISI / APPROVE REKOMENDASI / PILIH ALTERNATIF / DEFER]`

**Tanggal & approver:** `[BELUM DIISI]`

**Dasar/evidence/komentar:** `[BELUM DIISI]`

**Berlaku sebelum:** `UNPLANNED`

### GATE-ENV — Perubahan database selain database test

**Rekomendasi teknis (belum diputuskan):** Jangan sentuh vynor, vynor_crm, staging maupun production tanpa otorisasi per environment dan prosedur backup.

**Keputusan owner:** `[BELUM DIISI / APPROVE REKOMENDASI / PILIH ALTERNATIF / DEFER]`

**Tanggal & approver:** `[BELUM DIISI]`

**Dasar/evidence/komentar:** `[BELUM DIISI]`

**Berlaku sebelum:** `ANY_NON_TEST_DB`

### GATE-AUTH-LIVE — Uji login Supabase asli sebelum hardening/cutover

**Rekomendasi teknis (belum diputuskan):** Validasi alur login/logout dan token asli dalam environment yang disetujui; jangan nyalakan enforce issuer di production tanpa bukti.

**Keputusan owner:** `[BELUM DIISI / APPROVE REKOMENDASI / PILIH ALTERNATIF / DEFER]`

**Tanggal & approver:** `[BELUM DIISI]`

**Dasar/evidence/komentar:** `[BELUM DIISI]`

**Berlaku sebelum:** `WU-06d / WU-08 enforce`

### GATE-CUTOVER — Persetujuan cutover dan drain pg-boss

**Rekomendasi teknis (belum diputuskan):** Bukti job aktif/created/retry telah nol per environment, rollback diuji, owner menyetujui cutover.

**Keputusan owner:** `[BELUM DIISI / APPROVE REKOMENDASI / PILIH ALTERNATIF / DEFER]`

**Tanggal & approver:** `[BELUM DIISI]`

**Dasar/evidence/komentar:** `[BELUM DIISI]`

**Berlaku sebelum:** `WU-05b`

## Konfirmasi akhir sebelum WU-00

- [x] DEC-01–DEC-09 masing-masing bernilai tegas (2026-10-17); pilihan yang berbeda dari rekomendasi dicatat sebagai change request pada roadmap bila memengaruhi dependency.
- [x] Bukti dan waktu persetujuan owner tersedia (bukan hanya checkbox auto-generated): pesan chat owner 2026-10-17, sesi `89bf14a1-529b-42f0-a8c8-4a68063b2b36`.
- [x] Scope repo TS dan larangan DB non-test dikonfirmasi. _(Dikonfirmasi owner 2026-10-17: scope TS lewat DEC-01; "DB NON-TEST DILARANG", yaitu `vynor`, `vynor_crm`, staging dan production tidak boleh disentuh. `GATE-ENV` tetap PENDING, tidak diberikan.)_
- [x] Agent membuat laporan `REVIEW_ONLY` untuk WU-00-01, dan owner mengotorisasi eksekusi khusus WU-00. _(Laporan REVIEW_ONLY VYN-00-01 selesai 2026-10-17. Owner kemudian menulis "WU-00 DISETUJUI — X1–X7 DEFAULT — DB NON-TEST DILARANG" di chat sesi `89bf14a1-529b-42f0-a8c8-4a68063b2b36`: eksekusi VYN-00-01 saja; commit/PR menunggu review owner; baseline VYN-00-02 menunggu instruksi terpisah. Kemudian owner menerima VYN-00-01 dan VYN-00-02 dan menyetujui commit, push, dan PR WU-00.)_

**Status dokumen saat dibuat:** DRAFT, BELUM DISETUJUI.

**Status per 2026-10-17:** DEC-01..09 RESOLVED; GATE-\* PENDING; WU-00 `IN_REVIEW`, diajukan sebagai PR (VYN-00-01 `DONE` dan diterima owner; VYN-00-02 `DONE` dan diterima owner; owner menyetujui commit, push branch, dan PR WU-00 ke `main`; merge tetap oleh owner).
