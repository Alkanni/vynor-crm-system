# VYNOR CRM — Kanban Migrasi Berbasis Vertical Slice

> **Status per 19 Oktober 2026:** DEC-01..09 diputuskan owner (lihat `01-DECISION-REGISTER.md`); WU-00 `DONE` (PR #64 di-merge owner sebagai `07e7748`); WU-01 `DONE` (PR #65 di-merge owner sebagai `aa74590`, 2026-10-17; VYN-01-01..03 `DONE`); WU-02 `IN_PROGRESS` (VYN-02-01..02 `IN_REVIEW`; PR dari branch `fix/wu-02-security-patches` menunggu review dan merge owner); WU lain masih perencanaan.
> **Sumber:** `../01`–`../07` audit/migration yang sudah diperbarui; commit audit `565e8e4`, baseline historis 176 test. Jangan menganggap audit commit sama dengan `origin/main` terbaru.

## Sasaran dan batas

Migrasikan perubahan stack minimum secara aman tanpa mengganti arsitektur modular monolith, DB PostgreSQL 16/Prisma, transactional outbox, RBAC tenant-scoped, adapter provider, event Socket.IO atau UI visual. Hasil dianggap selesai jika golden path bisnis tetap bekerja di stack target, tes regresi otomatis hijau, operasi container sehat, dan rollback dipraktikkan/didokumentasikan.

**Di luar scope:** Contacts API, Ticket/Deal/Campaign, Reports, backend AI Agent, redesign UI, Prisma 7, Fastify, Keycloak, Redis Socket.IO adapter. Semua status ini tetap sebagai backlog produk atau teknologi ditunda (03 §3; 06 §5).

## 1. Board Kanban (level PR/WU)

### 1A. Swimlane x status (snapshot awal)

| Swimlane                | **BLOCKED** (approval / dependencies) | **READY** | **IN PROGRESS**                               | **IN REVIEW** | **DONE**                                                                                 | **DEFERRED** |
| ----------------------- | ------------------------------------- | --------- | --------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------- | ------------ |
| Keputusan & fondasi     | WU-03                                 | —         | WU-02 (risiko HIGH; PR menunggu review owner) | —             | WU-00 (PR #64, 2026-10-17); WU-01 (PR #65, 2026-10-17); DEC-01..09 (RESOLVED 2026-10-17) | —            |
| State & antrean         | WU-04; WU-05a; WU-05b                 | —         | —                                             | —             | —                                                                                        | WU-05c       |
| Frontend                | WU-06a; WU-06b; WU-06c; WU-06d        | —         | —                                             | —             | —                                                                                        | —            |
| Kontrak & autentikasi   | WU-07; WU-08                          | —         | —                                             | —             | —                                                                                        | —            |
| Reliability & penutupan | WU-10; WU-11                          | —         | —                                             | —             | —                                                                                        | WU-09        |

**Aturan pergerakan:** `BLOCKED → READY` setelah dependency + approval; `READY → IN PROGRESS` ketika branch PR dibuka; `IN PROGRESS → IN REVIEW` setelah DoD dan test; `IN REVIEW → DONE` hanya sesudah owner merge/sign-off. Jangan menandai `DONE` saat AI baru membuat commit. **WIP limit disarankan:** maksimum satu WU berisiko HIGH/CRITICAL dalam implementasi pada satu waktu; pekerjaan docs/test independen boleh paralel setelah WU-03.

### 1B. Backlog dan urutan prioritas

| Kolom                          | Work unit / vertical slice                                                                                                             | Kondisi perpindahan                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **MENUNGGU KEPUTUSAN (human)** | Gate 9 keputusan DEC-01 s.d. DEC-09 — **selesai 2026-10-17**                                                                           | Owner menetapkan scope, queue, router, Redis, auth, defer list, media, compose, alur PR |
| **SIAP DIAMBIL SETELAH GATE**  | **WU-00**: baseline/branch/docs — **DONE 2026-10-17 (PR #64 di-merge owner)**                                                          | DEC-01 s.d. DEC-09 approved dan dokumen untracked aman                                  |
| **BACKLOG — PRIORITAS P0**     | WU-01 health Docker — **DONE 2026-10-17 (PR #65 di-merge owner)**; WU-02 CVE & CORS — **IN PROGRESS (PR)**; WU-03 characterization E2E | WU-00 merged; WU-03 setelah WU-01 (WU-02 boleh paralel)                                 |
| **BACKLOG — PRIORITAS P1**     | WU-04 Redis → WU-05a BullMQ expand → WU-05b contract                                                                                   | WU-03 golden path hijau; DEC-02/04 dan cutover gate                                     |
| **BACKLOG — PRIORITAS P1**     | WU-06a nav → 06b Vite router → 06c Caddy static → 06d hapus Next                                                                       | WU-03 hijau, DEC-03; auth Supabase live sebelum 06d production                          |
| **BACKLOG — INDEPENDEN**       | WU-07 OpenAPI; WU-08 OIDC                                                                                                              | Boleh paralel setelah WU-03 (jaga konflik env/contracts)                                |
| **BACKLOG — AKHIR**            | WU-10 observability → WU-11 cleanup/report                                                                                             | 10 setelah 05b, 11 setelah 05b/06d/07/08/10                                             |
| **OPTIONAL / DITAHAN**         | WU-09 media S3; WU-05c DROP pgboss; perubahan FK                                                                                       | DEC-07 / persetujuan destruktif dan environment secara terpisah                         |
| **BACKLOG — BUG TERBUKA**      | NF-09: `@vynor/storage` `stat`/`get`/`delete` tanpa header `x-amz-content-sha256` (403 di storage keluarga MinIO; laten)               | Di luar WU-01 (keputusan owner 2026-10-17); butuh tiket terpisah dan persetujuan owner  |

**Arti status:** `WAITING_APPROVAL` = hanya owner boleh membuka gerbang; `IN_REVIEW` = hasil tiket menunggu review owner (disetujui owner sebagai status Kanban, 2026-10-17); `BLOCKED_DEPENDENCY` = belum boleh dieksekusi; `DEFERRED_OPTIONAL`/`DEFERRED_APPROVAL` = di luar migrasi default. Per 2026-10-19 WU-00 dan WU-01 `DONE` (PR #64 dan #65 di-merge owner); WU-02 `IN_PROGRESS` (PR menunggu review dan merge owner).

## 2. Peta dependensi dan potensi paralel

```text
GATE-0 (keputusan manusia)
   └─ WU-00 ─┬─ WU-01 ─┬─ WU-03 ─┬─ WU-04 ─ WU-05a ─ WU-05b ─┬─ WU-10
            │         │         │                            ├─ WU-09 (optional)
            └─ WU-02  │         │                            └─ WU-05c (approval/drop)
                      │         ├─ WU-06a ─ 06b ─ 06c ─ 06d
                      │         ├─ WU-07 (parallel)
                      │         └─ WU-08 (parallel; live-auth gate)
                      └─────────┘
WU-11 setelah WU-05b, WU-06d, WU-07, WU-08, WU-10 (WU-09 / 05c tidak memblokir)
```

**PR boundary:** satu WU = satu PR ke `main` dengan pengecualian yang _sudah direncanakan_: 05a, 05b, 05c dan 06a, 06b, 06c, 06d masing-masing PR. AI Agent mengusulkan PR; hanya owner yang merge.

## 3. Daftar keputusan / approval

| ID             | Keputusan                                         | Default yang direkomendasikan                                                                                                                       | Diperlukan sebelum     |
| -------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| DEC-01         | Repositori yang dimigrasikan                      | Hanya /home/acgix/vynor-crm (monorepo TypeScript), bukan /home/acgix/VYNOR Rails/Chatwoot.                                                          | WU-00                  |
| DEC-02         | Transport background job                          | BullMQ + Redis, outbox PostgreSQL tetap sumber kebenaran.                                                                                           | WU-05a                 |
| DEC-03         | Frontend router                                   | React + Vite + React Router; URL, UX dan perilaku dipertahankan.                                                                                    | WU-06a                 |
| DEC-04         | Redis dan kegagalan koneksi                       | Redis wajib staging/production, AOF everysec, noeviction; Idempotency-Key dan webchat rate limiter fail closed ketika tidak tersedia.               | WU-04                  |
| DEC-05         | Penyedia autentikasi                              | Supabase Auth tetap; verifier OIDC generik dengan pemeriksaan iss/aud/JWKS bertahap.                                                                | WU-08                  |
| DEC-06         | Teknologi yang ditunda                            | Tunda Fastify, shadcn/Radix, Socket.IO Redis adapter, Prisma 7, Keycloak.                                                                           | WU-00                  |
| DEC-07         | Inbound media S3 dan antivirus                    | WU-09 ditunda sampai model keamanan disetujui; bila dikerjakan utamakan pemindaian sungguhan (mis. ClamAV) daripada menandai unscanned media CLEAN. | WU-09                  |
| DEC-08         | Lokasi compose/Dockerfile final                   | Compose root repository, Dockerfile di infrastructure/docker, tanpa duplikat.                                                                       | WU-01                  |
| DEC-09         | Strategi PR dan merge                             | Satu PR per WU ke main (WU-05a/b/c dan WU-06a/b/c/d masing-masing PR); owner merge. Tidak memakai branch integrasi.                                 | WU-00                  |
| GATE-DB-DROP   | Persetujuan DROP SCHEMA pgboss                    | Tidak diizinkan oleh persetujuan roadmap umum; memerlukan persetujuan khusus setelah backup dan dry-run restore.                                    | WU-05c                 |
| GATE-DB-FK     | Persetujuan perubahan FK CASCADE ke RESTRICT      | Di luar roadmap default. Jangan dijalankan tanpa ticket dan persetujuan terpisah.                                                                   | UNPLANNED              |
| GATE-ENV       | Perubahan database selain database test           | Jangan sentuh vynor, vynor_crm, staging maupun production tanpa otorisasi per environment dan prosedur backup.                                      | ANY_NON_TEST_DB        |
| GATE-AUTH-LIVE | Uji login Supabase asli sebelum hardening/cutover | Validasi alur login/logout dan token asli dalam environment yang disetujui; jangan nyalakan enforce issuer di production tanpa bukti.               | WU-06d / WU-08 enforce |
| GATE-CUTOVER   | Persetujuan cutover dan drain pg-boss             | Bukti job aktif/created/retry telah nol per environment, rollback diuji, owner menyetujui cutover.                                                  | WU-05b                 |

**Jangan menganggap rekomendasi = keputusan.** Per 2026-10-17 DEC-01..09 RESOLVED (DEC-07 = DEFER) dengan bukti di `01-DECISION-REGISTER.md`; semua `GATE-*` masih PENDING. Keputusan WU-09 bisa tetap deferred tanpa menghambat WU wajib. Penggantian aturan FK adalah pekerjaan terpisah, bukan bagian default.

## 4. Definition of Ready / Definition of Done (semua AI Agent)

**Definition of Ready**

- [ ] Seluruh DEC-01 s.d. DEC-09 ditetapkan owner sebelum WU-00 sesuai roadmap 06 §6; perubahan keputusan setelah itu melalui change request.
- [ ] Work unit dependencies berstatus DONE dan keputusan yang terkait sudah di-approve tertulis.
- [ ] Working tree/branch diverifikasi, dokumen untracked dilindungi, base SHA tercatat, tidak mengganggu worktree lain.
- [ ] Lingkungan uji terisolasi tersedia; hanya database vynor_test/vynor_e2e/vynor_shadow boleh dipakai otomatis.
- [ ] Golden path WU-03 tersedia untuk WU-04/05/06/07/08/10; tanpa bukti karakterisasi jangan memulai perubahan berisiko.

**Definition of Done**

- [ ] Satu PR scoped ke work unit / subunit dan CI wajib hijau: format, lint, typecheck, build, unit/integrasi, infra verify; E2E setelah WU-03.
- [ ] Perjalanan pengguna vertical slice lulus melalui API + DB + worker + UI bila relevan, bukan unit test saja.
- [ ] Bukti perintah, jumlah test, SHA, diff, risiko, rollout/rollback, hasil data check dicatat dalam 08 dan 09.
- [ ] Tidak ada weakening/penghapusan test; exception diberi issue dan persetujuan owner.
- [ ] Approval owner untuk merge/rollout, dan persetujuan khusus terpisah untuk tindakan destruktif atau DB non-test.

## 5. Tiket detail untuk AI Agent

Gunakan setiap tiket sebagai unit tugas. Semua input adalah referensi yang HARUS DIBACA/DITEMUKAN dalam repo sesungguhnya. Jangan mengarang output atau menandai selesai tanpa bukti. Pekerjaan dalam satu WU dikirim sebagai satu PR; urutan tiket di bawah menjadi checklist PR.

### WU-00 — Persiapan, keputusan, baseline Git

**Status:** `DONE` (PR #64 di-merge owner sebagai `07e7748`, 2026-10-17; status awal `WAITING_APPROVAL`) · **Risiko:** LOW · **Depends:** gerbang persetujuan (terpenuhi) · **Gates:** DEC-01, DEC-02, DEC-03, DEC-04, DEC-05, DEC-06, DEC-07, DEC-08, DEC-09

**Vertical slice:** Audit -> keputusan -> branch aman -> dokumen & baseline dapat direview

**DONE WHEN (WU):** Dokumen 01-07 tercatat dalam PR, 08/09 diinisialisasi, kondisi Git aman dan baseline bisa direproduksi.

**Rollback WU:** Tutup PR dokumen; tidak memodifikasi kode/DB.

#### VYN-00-01 — Kunci persetujuan, amankan tujuh dokumen, dan audit state Git

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** —; **Gates tambahan:** —.

**INPUT**

- Keputusan DEC-01 s.d. DEC-09 dari owner (pilihan defer berlaku untuk DEC-07)
- docs/migration/01–07 yang belum di-commit
- git status, git worktree list, origin/main dan audit commit 565e8e4

**TUGAS / AKSI**

- [ ] Catat hasil keputusan eksplisit di docs/migration/08 atau decision record.
- [ ] Simpan aman tujuh dokumen sebelum operasi branch; lakukan git fetch dan inspeksi perbedaan origin/main tanpa membuang file untracked.
- [ ] Buat branch khusus dari basis origin/main terbaru dengan dokumen tetap utuh; jangan ganggu dua worktree sesi lain.

**OUTPUT / DELIVERABLE**

- Decision record dengan nilai dan approver
- Branch WU-00 serta daftar file yang terjaga
- Bukti git status, base commit, diff yang diharapkan

**ACCEPTANCE CRITERIA**

- [ ] Tidak ada dokumen hilang/tertimpa; tidak ada file aplikasi berubah.
- [ ] Tidak ada reset --hard, clean -fd, rebase/commit pada main atau perubahan worktree lain.

**BUKTI VERIFIKASI**

- `git status --short`
- `git log -1 --oneline`
- `git worktree list`

#### VYN-00-02 — PR baseline audit dan inisialisasi log eksekusi/regresi

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** VYN-00-01; **Gates tambahan:** —.

**INPUT**

- Branch aman dari VYN-00-01
- 7 dokumen audit
- Baseline 176 test, 28 file, 11/11 build/typecheck pada 565e8e4

**TUGAS / AKSI**

- [ ] Masukkan dokumen 01–07 dalam PR dokumen saja.
- [ ] Buat 08-migration-execution-log.md dan 09-regression-test-results.md dengan template per WU: SHA, input, perintah, output, delta, risiko, rollback, approval.
- [ ] Catat baseline audit dan jika base berubah, jalankan ulang pipeline dasar pada commit aktual.

**OUTPUT / DELIVERABLE**

- PR WU-00 dan link/bukti CI
- 08 log dan 09 hasil regresi
- Baseline yang merujuk base SHA sebenarnya

**ACCEPTANCE CRITERIA**

- [ ] CI format/lint lulus; baseline terdokumentasi tanpa mengklaim test baru.
- [ ] Owner mereview dan melakukan merge; AI tidak auto-merge.

**BUKTI VERIFIKASI**

- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`

### WU-01 — Docker/Caddy benar-benar sehat

**Status:** `DONE` (PR #65 di-merge owner sebagai `aa74590`, 2026-10-17; VYN-01-01..03 `DONE`) · **Prioritas:** P0 (bug F-01) · **Risiko implementasi:** HIGH · **Depends:** WU-00 (`DONE`) · **Gates:** DEC-08 (RESOLVED)

**Vertical slice:** docker compose up -> health API 200 -> worker/web/caddy siap

**DONE WHEN (WU):** Semua container yang memiliki healthcheck sehat di compose dan infra:verify menangkap path rusak.

**Rollback WU:** Revert PR setelah memeriksa state dan efek samping; catat di execution log.

#### VYN-01-01 — Perbaiki health probe API dan route kesehatan di Caddy

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** —; **Gates tambahan:** —.

**INPUT**

- audit F-01: /health/live=404, /api/v1/health/live=200
- audit F-02: healthcheck Caddy memanggil `http://localhost:80`, padahal Caddy hanya listen di `:443` (`auto_https disable_redirects`)
- `infrastructure/docker/Dockerfile.api` (kanonis per DEC-08; duplikat `apps/api/Dockerfile` dihapus)
- docker-compose.yml
- infrastructure/caddy/Caddyfile
- `apps/api/src/main.ts` (prefix global `api/v1`) dan `apps/api/src/health/health.controller.ts`

**TUGAS / AKSI**

- [x] Ubah path HEALTHCHECK API/container/compose menjadi /api/v1/health/live.
- [x] Pertahankan `/api/v1/health/live` sebagai endpoint kanonis; rewrite kompatibilitas `/health/*` ke `/api/v1/health/*` di Caddy tanpa mengubah global API prefix.
- [x] Probe Caddy lewat HTTPS dengan verifikasi sertifikat terhadap root CA internal Caddy (`TLS_MODE` internal); jangan mensyaratkan HTTP port 80 tanpa listener HTTP eksplisit dan jangan melemahkan verifikasi TLS.
- [x] Tambahkan test skrip infra untuk mencegah probe salah muncul kembali, termasuk uji negatif.

**OUTPUT / DELIVERABLE**

- Probe Caddy/API konsisten
- Test regresi path probe
- Rewrite kompatibilitas `/health/*` di Caddy

**ACCEPTANCE CRITERIA**

- [x] Probe API dan Caddy terhadap path final 200.
- [x] infra:verify gagal bila probe kembali memakai path yang menghasilkan 404.
- [x] Probe Caddy memakai HTTPS dengan verifikasi sertifikat; tanpa `--no-check-certificate`, `-k` atau `--insecure`.

**BUKTI VERIFIKASI**

- `pnpm infra:verify`
- `curl -f http://127.0.0.1:<SMOKE_API_PORT>/api/v1/health/live`
- `curl -f --cacert <root CA internal Caddy> --resolve localhost:<SMOKE_CADDY_HTTPS_PORT>:127.0.0.1 https://localhost:<SMOKE_CADDY_HTTPS_PORT>/api/v1/health/live`

#### VYN-01-02 — Satu sumber compose/Dockerfile serta pin image

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** VYN-01-01; **Gates tambahan:** —.

**INPUT**

- DEC-08 disetujui
- docker-compose.yml dan infrastructure/docker/docker-compose.yml
- `apps/*/Dockerfile` dan `infrastructure/docker/Dockerfile.*`
- referensi path di CI dan docs
- Registry `docker.io/pgsty/silo:RELEASE.2026-10-15T00-00-00Z` (keputusan owner untuk NF-08): tag/manifest digest dan platform harus terverifikasi di registry, bukan image ID lokal
- Label `com.docker.compose.config-hash` container live `vynor-postgres` (hanya `docker inspect`)

**TUGAS / AKSI**

- [x] Pertahankan hanya lokasi compose/Dockerfile yang disetujui, adaptasikan build context dan path referensi.
- [x] Ganti image MinIO/mc yang tidak lagi dipublikasikan (NF-08) dengan `docker.io/pgsty/silo` sesuai keputusan owner; pin ke tag dan digest index terverifikasi di registry (platform cocok), bukan latest dan bukan image ID lokal; provisioning bucket memakai `mcli` secara idempoten.
- [x] Perbarui skrip dan dokumen deployment; jaga konfigurasi secret dan volume tetap setara.
- [x] Jangan ubah blok service `postgres` default dan pertahankan `container_name` default, agar container live tidak di-recreate.

**OUTPUT / DELIVERABLE**

- Satu sumber konfigurasi; image versi deterministik
- Diff compose valid; docs diperbarui

**ACCEPTANCE CRITERIA**

- [x] docker compose config berhasil; tidak ada copy duplikat tertinggal.
- [x] Volumes dan network tetap terdefinisi; tidak ada database atau bucket production tersentuh.
- [x] Hash konfigurasi service `postgres` default identik sebelum dan sesudah perubahan.

**BUKTI VERIFIKASI**

- `docker compose --project-name vynor-wu01-smoke -f docker-compose.yml config`
- `pnpm infra:verify`

#### VYN-01-03 — Smoke compose hidup penuh dari state test

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** VYN-01-02; **Gates tambahan:** —.

**INPUT**

- Compose hasil VYN-01-02
- Konfigurasi docker khusus test/local
- API, worker, web, caddy
- `infrastructure/docker/compose.smoke.yml` dan `infrastructure/docker/smoke.env`
- `infrastructure/scripts/compose-smoke.sh` dan `infrastructure/scripts/compose-smoke-guard.mts`

**TUGAS / AKSI**

- [x] Build dan jalankan compose di lingkungan aman; hindari bind ke database live.
- [x] Jalankan semua perintah compose lewat runner ber-guard: project `vynor-wu01-smoke` eksplisit, env disanitasi dengan allowlist, lock anti-paralel, `container_name` di-reset, volume dan network baru, port host hanya `127.0.0.1`, DB `vynor_test` pada PostgreSQL smoke.
- [x] Sebelum migrate/seed, verifikasi host, port, database aktual dan identitas instance PostgreSQL smoke.
- [x] Periksa semua healthcheck serta permintaan API via Caddy, web dan worker heartbeat.
- [x] Simpan log diagnostic; tambahkan job CI `compose-smoke` terisolasi (timeout, cleanup, tanpa secret) yang tidak mengeksekusi migrasi di DB live.
- [x] Teardown hanya resource yang terbukti milik project smoke (tanpa `--rmi`); postflight memastikan `vynor-postgres` tidak berubah.

**OUTPUT / DELIVERABLE**

- Bukti container healthy dan smoke HTTP
- PR WU-01 dengan test pencegah regresi
- Runner smoke ber-guard dan job CI `compose-smoke`

**ACCEPTANCE CRITERIA**

- [x] Worker, web, caddy start dan servis yang mensyaratkan healthy benar-benar berjalan.
- [x] GET /api/v1/health/live melalui Caddy 200; infra:verify menangkap typo path.
- [x] Postflight: metadata `vynor-postgres` identik dan tidak ada resource `vynor-wu01-smoke` tersisa.
- [x] Storage (Silo) sehat; `rustfs-init` membuat kedua bucket secara idempoten; client S3 aplikasi berhasil put dan signed download di kedua bucket.

**BUKTI VERIFIKASI**

- `infrastructure/scripts/compose-smoke.sh preflight`
- `infrastructure/scripts/compose-smoke.sh all`
- `pnpm infra:verify`

### WU-02 — Patch CVE web & Socket.IO CORS

**Status:** `IN_PROGRESS` (PR ke `main` menunggu review owner; VYN-02-01..02 `IN_REVIEW`) · **Risiko:** HIGH · **Depends:** WU-00 (`DONE`) · **Gates:** —

**Vertical slice:** PDF knowledge diproses aman; websocket dari origin sah dapat terhubung

**DONE WHEN (WU):** Audit tanpa HIGH dan tes PDF/CORS lulus dengan pengalaman web tidak berubah.

**Rollback WU:** Revert PR setelah memeriksa state dan efek samping; catat di execution log.

#### VYN-02-01 — Patch Next sementara dan mitigasi pdfjs-dist

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** —; **Gates tambahan:** —.

**INPUT**

- apps/web/package.json dan pnpm-lock.yaml
- 9 advisory audit dengan 4 high
- apps/web/src/lib/ai-agents/extract-file-text.ts

**TUGAS / AKSI**

- [x] Perbarui Next ke versi patched yang kompatibel sampai 06d, serta pdfjs ke versi aman yang lolos validasi; bila upgrade PDF gagal, pertimbangkan isEvalSupported:false yang diuji dan dicatat.
- [x] Verifikasi parsing PDF knowledge AI Agent dengan fixture aman; jangan redesign UI.
- [x] Uji audit dependensi dan rekam advisory yang tersisa.

**OUTPUT / DELIVERABLE**

- Lockfile/dependency aman dan bukti ekstraksi PDF
- Laporan audit sebelum/sesudah

**ACCEPTANCE CRITERIA**

- [x] Tidak ada advisory HIGH di pnpm audit --prod.
- [x] Ekstraksi PDF berfungsi; golden path yang sudah ada tidak rusak.

**BUKTI VERIFIKASI**

- `pnpm audit --prod`
- `pnpm --filter @vynor/web verify`
- `pnpm test`

#### VYN-02-02 — Batasi CORS Socket.IO sesuai origin terizin

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** VYN-02-01; **Gates tambahan:** —.

**INPUT**

- apps/api/src/realtime/realtime.gateway.ts
- CORS_ALLOWED_ORIGINS di konfigurasi
- Test handshake JWT/realtime saat ini

**TUGAS / AKSI**

- [x] Ganti CORS origin wildcard dengan daftar yang divalidasi.
- [x] Tambahkan test origin diizinkan/ditolak, termasuk reconnect socket.
- [x] Pastikan handshake tetap wajib JWT dan scope workspace tetap bekerja.

**OUTPUT / DELIVERABLE**

- Gateway dengan CORS sempit dan test
- PR WU-02 serta bukti security gate

**ACCEPTANCE CRITERIA**

- [x] Origin disetujui berhasil connect; origin asing ditolak.
- [x] Handshake unauthenticated tetap gagal, tanpa regresi API REST.

**BUKTI VERIFIKASI**

- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm audit --prod`

### WU-03 — Characterization test dan golden path E2E

**Status:** `BLOCKED_DEPENDENCY` · **Risiko:** CRITICAL · **Depends:** WU-00, WU-01 · **Gates:** —

**Vertical slice:** Login -> signed webhook -> inbox -> reply -> mocked Graph API -> receipt/retry/assignment

**DONE WHEN (WU):** Golden path dan Channels E2E hijau di CI sebelum ganti queue atau frontend; screenshot baseline tersedia.

**Rollback WU:** Revert PR setelah memeriksa state dan efek samping; catat di execution log.

#### VYN-03-01 — Fixture isolasi DB E2E dan stub Graph API

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** —; **Gates tambahan:** —.

**INPUT**

- vynor_e2e (bukan vynor_crm atau vynor)
- apps/web/playwright.config.ts
- META_GRAPH_API_BASE_URL dan adapter channel
- fixture seed & tanda tangan webhook

**TUGAS / AKSI**

- [ ] Siapkan lifecycle DB e2e yang repeatable dengan guard URL test; reset hanya database aman.
- [ ] Jalankan API, worker, web serta stub Graph API lokal yang dapat mensimulasikan success/transient/permanent + receipt.
- [ ] Buat fixture tenant kedua untuk uji isolasi dan helper webhook bertanda tangan.

**OUTPUT / DELIVERABLE**

- Harness e2e/seed idempotent
- Stub provider dengan log panggilan/retry
- Dokumentasi cara menjalankan secara lokal dan CI

**ACCEPTANCE CRITERIA**

- [ ] Tidak ada request provider live; fixture repeatable pada dua run berturut-turut.
- [ ] Guard menolak database selain vynor_e2e/vynor_test/shadow.

**BUKTI VERIFIKASI**

- `pnpm test:e2e`

**Catatan:** Uji hanya di DB isolasi. Jangan mengambil credential nyata.

#### VYN-03-02 — Characterization API Conversations end-to-end HTTP

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** VYN-03-01; **Gates tambahan:** —.

**INPUT**

- apps/api/src/conversations/*
- kontrak /conversations/* dan /messages/:id/retry
- fixture dua workspace dari VYN-03-01

**TUGAS / AKSI**

- [ ] Tambahkan test HTTP list/filter/cursor/detail conversation.
- [ ] Uji send, retry, private note, assign, resolve/reopen, read serta audit logs.
- [ ] Assert tenant cross-access 404/403 sesuai perilaku saat ini; rekam perbedaan sebagai bug, jangan ubah test agar lulus.

**OUTPUT / DELIVERABLE**

- HTTP integration specs baru
- Evidence kode sebelum migrasi terkarakterisasi

**ACCEPTANCE CRITERIA**

- [ ] Response dan efek DB/audit sesuai kontrak eksisting.
- [ ] Kasus unauthorized/tenant isolation terverifikasi; test lulus terhadap pg-boss/Next sekarang.

**BUKTI VERIFIKASI**

- `pnpm test`

#### VYN-03-03 — Characterization webchat, media, idempotency & polling

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** VYN-03-01; **Gates tambahan:** —.

**INPUT**

- apps/api/src/webchat/*
- /media/:messageId?exp&sig
- IdempotencyInterceptor
- apps/worker/src/polling/channel-polling.service.ts

**TUGAS / AKSI**

- [ ] Test webchat sesi/pesan/429; signature media valid, tamper dan expired.
- [ ] Test Idempotency-Key: replay respons, konflik payload, dua request in-flight.
- [ ] Test polling IMAP/Telegram: lease, backoff dan release saat error.

**OUTPUT / DELIVERABLE**

- HTTP/service test untuk celah audit
- Daftar bug temuan yang terpisah dari migration scope

**ACCEPTANCE CRITERIA**

- [ ] Kondisi edge menghasilkan response konsisten dengan baseline; bug riil dilaporkan, tidak disamarkan.
- [ ] Tidak ada test yang dihapus atau dipermudah hanya demi hijau.

**BUKTI VERIFIKASI**

- `pnpm test`

#### VYN-03-04 — Golden path Inbox, reply, dedup, retries dan Channels UI

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** VYN-03-02, VYN-03-03; **Gates tambahan:** —.

**INPUT**

- VYN-03-01/02/03
- 20 route frontend
- Playwright dan seed dev-session
- stub Graph API
- Route dinamis `/ai-agent/[agentId]` (`ƒ` pada `next build`; `'use client'` + `useParams`, tanpa data server; 08 NF-05)

**TUGAS / AKSI**

- [ ] Playwright: login dev-session -> Inbox, webhook signed -> journal/outbox/pg-boss/worker -> message tampak.
- [ ] Replay webhook tidak menggandakan contact/conversation/message; reply agent mencapai stub, SENT/DELIVERED/READ monoton; transient sukses setelah retry, permanent -> FAILED + retry tombol.
- [ ] E2E Channels connect ke stub, kanal terlihat; assign/resolve/reopen tercatat.
- [ ] Ambil screenshot baseline stabil semua route relevan dengan fonts/viewport/mock time deterministik.
- [ ] Karakterisasi `/ai-agent/[agentId]`: buka langsung (deep link) dan refresh untuk agentId yang ada dan yang tidak dikenal; catat perilaku apa adanya dan sertakan dalam screenshot baseline.

**OUTPUT / DELIVERABLE**

- Golden path Playwright dan Channels E2E
- Screenshot baseline versioned serta jejak request provider stub

**ACCEPTANCE CRITERIA**

- [ ] E2E baseline lulus terhadap implementasi SEBELUM BullMQ dan Vite.
- [ ] Inbox dan Channels terhubung API nyata/stub provider, bukan hanya mock UI.
- [ ] Screenshot dapat direproduksi tanpa toleransi visual yang tidak terdokumentasi.
- [ ] Perilaku `/ai-agent/[agentId]` (deep link, refresh, agentId tidak dikenal) terekam sebagai baseline E2E dan screenshot pada Next sebelum WU-06.

**BUKTI VERIFIKASI**

- `pnpm test:e2e`

#### VYN-03-05 — Pasang CI E2E dan anti-flaky gate

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** VYN-03-04; **Gates tambahan:** —.

**INPUT**

- VYN-03-04
- github workflow ci.yml
- PostgreSQL service dan browser Playwright

**TUGAS / AKSI**

- [ ] Tambahkan job CI untuk seed DB terisolasi, API, worker, web, stub provider, Playwright.
- [ ] Gunakan polling kondisi/response, bukan fixed sleep; lampirkan trace/screenshot ketika gagal.
- [ ] Pastikan rerun dua kali stabil; dokumen 09 memuat perintah dan hasil.

**OUTPUT / DELIVERABLE**

- Workflow CI E2E dengan artefak kegagalan
- PR WU-03, baseline characterization disetujui

**ACCEPTANCE CRITERIA**

- [ ] Dua run e2e berturut-turut hijau; regressions tetap wajib sebelum WU-05/06.
- [ ] Tidak ada flaky test yang dihapus/sembunyikan.

**BUKTI VERIFIKASI**

- `pnpm test`
- `pnpm test:e2e`
- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`

### WU-04 — Redis untuk state lintas instance

**Status:** `BLOCKED_DEPENDENCY` · **Risiko:** HIGH · **Depends:** WU-03 · **Gates:** DEC-04

**Vertical slice:** Request dua API -> idempotency/rate limit konsisten -> fail closed saat Redis down

**DONE WHEN (WU):** Golden path tetap hijau, uji dua instance berhasil, Redis siap di test/CI dan non-test diwajibkan.

**Rollback WU:** Revert PR setelah memeriksa state dan efek samping; catat di execution log.

#### VYN-04-01 — Operasionalkan Redis persisten dan dependency health

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** —; **Gates tambahan:** —.

**INPUT**

- DEC-04
- compose/CI
- env schemas @vynor/contracts
- health API/worker

**TUGAS / AKSI**

- [ ] Tambah Redis 7 dipin, AOF everysec, maxmemory-policy noeviction, volume, config+auth private network.
- [ ] Sediakan redis client/module dan REDIS_URL wajib staging/production; in-memory fallback HANYA local/test secara eksplisit.
- [ ] Readiness API memeriksa Redis; bootstrap dan CI fail jelas saat misconfig.

**OUTPUT / DELIVERABLE**

- Service Redis dan validasi env
- Health indicator + CI service
- Bukti CONFIG GET dan persistence

**ACCEPTANCE CRITERIA**

- [ ] Redis restart mempertahankan key persisten sesuai kebijakan; config AOF/noeviction tervalidasi.
- [ ] Non-test tanpa REDIS_URL gagal startup/readiness sesuai kebijakan.

**BUKTI VERIFIKASI**

- `docker compose config`
- `pnpm test`
- `pnpm infra:verify`

#### VYN-04-02 — Idempotency Redis atomik pada dua instance

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** VYN-04-01; **Gates tambahan:** —.

**INPUT**

- IdempotencyInterceptor existing
- Redis client dari VYN-04-01
- HTTP tests VYN-03-03
- ActorContext/workspace dari JWT

**TUGAS / AKSI**

- [ ] Implementasikan claim/finalize atomic, TTL, fingerprint payload, replay response, perlakuan in-flight lintas dua instance.
- [ ] Nama key mencakup workspace + scope endpoint/actor seperlunya; jangan bocorkan token/PII di Redis key/log.
- [ ] Fail closed 503 saat Redis down, tanpa menjalankan mutasi berisiko.

**OUTPUT / DELIVERABLE**

- Store Redis lintas instance dengan tests race
- Dokumentasi TTL, response replay, dan failure modes

**ACCEPTANCE CRITERIA**

- [ ] Replay dari instance B konsisten dengan hasil instance A; konflik payload ditolak.
- [ ] Simultaneous requests tidak menimbulkan double side effect; Redis down menghasilkan 503.

**BUKTI VERIFIKASI**

- `pnpm test`

#### VYN-04-03 — Rate limit webchat lintas instance dan recovery Redis

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** VYN-04-02; **Gates tambahan:** —.

**INPUT**

- WebchatService limiter in-memory
- Redis dari VYN-04-01
- Webchat test VYN-03-03

**TUGAS / AKSI**

- [ ] Pindahkan token/counter webchat ke Redis dengan operasi atomic + TTL dan identitas yang tidak bergantung pada memory proses.
- [ ] Test 429 benar dengan dua API; saat Redis down fail closed sesuai DEC-04, readiness menjadi not ready.
- [ ] Uji reconnect dan pastikan golden path tetap lulus.

**OUTPUT / DELIVERABLE**

- Rate limiter Redis dengan test dua instance
- PR WU-04 dengan failure/recovery evidence

**ACCEPTANCE CRITERIA**

- [ ] Batas yang sama berlaku lintas instance; 429 tidak dapat dilewati dengan berpindah API.
- [ ] Saat Redis unavailable tidak ada bypass tak sengaja; golden path tetap hijau.

**BUKTI VERIFIKASI**

- `pnpm test`
- `pnpm test:e2e`
- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`

### WU-05a — BullMQ expand + drain pg-boss

**Status:** `BLOCKED_DEPENDENCY` · **Risiko:** CRITICAL · **Depends:** WU-03, WU-04 · **Gates:** DEC-02

**Vertical slice:** Webhook -> Postgres outbox -> BullMQ -> worker -> inbox/reply; job lama pg-boss selesai

**DONE WHEN (WU):** Alur inbound/outbound BullMQ lulus fault injection dan provider stub; pg-boss tidak menerima job baru.

**Rollback WU:** Bila 5a gagal, hentikan producer baru, periksa antrian BullMQ dan outbox yang belum berdampak. Susun rencana replay berbasis identitas event dan status domain; jalankan UPDATE hanya setelah review, dan untuk DB non-test wajib izin owner/DBA (07 §4.1).

#### VYN-05A-01 — Adapter BullMQ dan kontrak job aman

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** —; **Gates tambahan:** —.

**INPUT**

- DEC-02
- PgBossService dan consumer existing
- @vynor/contracts/jobs & DEFAULT_JOB_RETRY_POLICY
- Redis persisten WU-04
- `PgBossService` pada `1d6b578` (#59, #61, #63): start retry 5 s → ×2 → maks 60 s, `PG_BOSS_START_TIMEOUT_MS` 30 s, `work()` tertunda, `sendJob` melempar saat tidak berjalan (08 NF-02)
- `pg-boss-start-retry.integration.spec.ts` (5 tes) dan `worker-heartbeat.integration.spec.ts` (08 NF-01)
- Empat consumer yang meng-inject kelas konkret `PgBossService`: `OutboxDispatcherService`, `InboundProcessorService`, `OutboundDispatcherService`, `WorkerHeartbeatService` (08 NF-03)

**TUGAS / AKSI**

- [ ] Buat QueueService BullMQ tanpa mengubah outbox_events di PostgreSQL.
- [ ] Gunakan jobId deterministik tanpa karakter colon, contohnya outbox-<eventId>; jangan mengandalkan dedup setelah removeOnComplete.
- [ ] Pertahankan jumlah attempt, klasifikasi retryable vs permanent, retensi dan graceful shutdown; atur Queue producer fail-fast dan Worker reconnect.
- [ ] Startup retry: boot hanya menunggu percobaan inisialisasi pertama; bila Redis belum siap, worker tetap boot dengan `isRunning()` = `false` dan mencoba ulang di latar dengan backoff setara (5 s, ×2, maks 60 s) sampai berhasil atau shutdown; setiap kegagalan dicatat dengan nomor percobaan.
- [ ] Timeout: inisialisasi yang menggantung (mis. `waitUntilReady`) dianggap gagal setelah batas setara `PG_BOSS_START_TIMEOUT_MS` (30 s); koneksi atau instance yang ditinggalkan ditutup tanpa menahan boot atau shutdown.
- [ ] Producer fail-fast: koneksi `Queue` produser tanpa offline queue sehingga `send()` melempar saat Redis terputus; dispatcher tidak meng-claim outbox saat `isRunning()` = `false`, dan outbox `COMPLETED` hanya setelah BullMQ menerima job.
- [ ] Deferred handler registration: `work()` yang dipanggil sebelum siap disimpan dan didaftarkan tepat sekali setelah siap (mengembalikan `false` saat ditunda), tanpa consumer ganda setelah reconnect.
- [ ] Dependency injection: perkenalkan token/abstraksi transport untuk keempat consumer agar implementasi pg-boss dan BullMQ dapat ditukar tanpa mengubah perilaku consumer.
- [ ] Graceful shutdown: `onModuleDestroy` membatalkan retry tertunda, menghentikan claim dispatcher lebih dulu, menunggu job aktif (`worker.close()`) dengan batas waktu, lalu menutup koneksi; percobaan inisialisasi yang masih berjalan menutup instance-nya sendiri.

**OUTPUT / DELIVERABLE**

- Queue adapter + test job ID, retry, retensi
- Catatan compatibility dan desain replay
- Matriks kesetaraan perilaku pg-boss (#59, #61, #63) ↔ BullMQ

**ACCEPTANCE CRITERIA**

- [ ] Test dengan Redis nyata membuktikan id aman, dedup saat job masih ada, retry dan error classification.
- [ ] Tidak ada perubahan skema public atau model domain.
- [ ] Test BullMQ dengan Redis nyata atau proxy terkontrol mencakup padanan kelima skenario `pg-boss-start-retry`: jadwal backoff, Redis tidak tersedia saat boot lalu pulih, inisialisasi menggantung → timeout dan retry, handler tertunda terdaftar tepat sekali, shutdown saat retry tertunda atau berjalan.
- [ ] `send()` melempar saat Redis terputus tanpa job tertahan di offline queue; selama `isRunning()` = `false` outbox tetap `PENDING` tanpa menambah `retryCount`.
- [ ] Keempat consumer memakai token transport; seluruh test pg-boss yang ada tetap hijau di 5a.
- [ ] Graceful shutdown menunggu job aktif dan tidak meninggalkan koneksi Redis atau proses yang terbuka.

**BUKTI VERIFIKASI**

- `pnpm test`

**Catatan:** Job ID target pada dokumen 04–06 sudah dikoreksi menjadi `outbox-<id>`; cek dokumentasi resmi BullMQ. Retensi dapat menghapus efek dedup ID, sehingga invariant domain tetap wajib.

#### VYN-05A-02 — Expand side-by-side tanpa job baru di pg-boss

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** VYN-05A-01; **Gates tambahan:** —.

**INPUT**

- QueueService VYN-05A-01
- outbox dispatcher dan 2 consumer
- mode drain pg-boss + test E2E WU-03
- Keputusan owner tentang kriteria heartbeat selama dual-transport, dicatat di 08 sebelum implementasi (08 NF-03)

**TUGAS / AKSI**

- [ ] Arahkan enqueue baru Postgres outbox -> BullMQ; tetap jalankan consumer pg-boss hanya untuk job lama.
- [ ] Pasang mekanisme observasi backlog old/new, tidak memasang dua consumer untuk event sama tanpa guard domain.
- [ ] Uji inbound/outbound/receipt/assignment lewat API+worker+stub; dapatkan bukti tidak ada kehilangan atau duplikasi entity domain.
- [ ] Worker heartbeat dual-transport: tulis heartbeat hanya bila DB ping dan BullMQ siap; terapkan perlakuan kegagalan start pg-boss drain sesuai keputusan owner (unhealthy, atau degraded yang tercatat di log).

**OUTPUT / DELIVERABLE**

- Worker dual-transport transisi dan progress drain
- Golden path dan bukti outbox per status

**ACCEPTANCE CRITERIA**

- [ ] pg-boss tidak lagi menerima job baru setelah cutover 5a.
- [ ] Inbound dan outbound BullMQ menghasilkan status/domain yang sama dengan baseline.
- [ ] Heartbeat dan healthcheck container mengikuti kriteria yang diputuskan owner; diuji untuk BullMQ tidak siap dan pg-boss drain gagal start.

**BUKTI VERIFIKASI**

- `pnpm test`
- `pnpm test:e2e`

#### VYN-05A-03 — Fault injection, pemulihan job, dan beban 1.000 webhook

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** VYN-05A-02; **Gates tambahan:** —.

**INPUT**

- VYN-05A-02
- Postgres outbox validation SQL DB §5
- Redis AOF/noeviction
- Provider stub yang mencatat panggilan

**TUGAS / AKSI**

- [ ] Simulasikan crash setelah BullMQ add tetapi sebelum outbox COMPLETED; crash worker saat active job; Redis outage/reconnect; shutdown graceful.
- [ ] Uji 1.000 webhook menjadi 1.000 pesan tanpa duplikasi DB; cek status monoton, ordering domain per conversation dan retry.
- [ ] Periksa failure window Redis persistence: bila outbox COMPLETED tetapi job hilang, desain & uji rekonsiliasi/alert + runbook tanpa otomatis menyentuh production.
- [ ] Uji Redis mati saat boot dan koneksi menggantung pada worker yang sudah berjalan: heartbeat menjadi stale (container `unhealthy`) lalu pulih tanpa restart, dan dispatcher tidak meng-claim selama tidak siap.

**OUTPUT / DELIVERABLE**

- Fault-injection suites dan laporan queue reconciliation
- Dokumen risiko at-least-once, ordering serta recovery

**ACCEPTANCE CRITERIA**

- [ ] Tidak ada kehilangan domain event pada fault cases yang diuji.
- [ ] Pengiriman ke provider eksternal tidak diklaim exactly-once bila provider tidak mendukung idempotency; risiko dijelaskan.
- [ ] Golden path E2E dan worker heartbeats tetap lulus.
- [ ] Selama Redis/BullMQ tidak siap tidak ada heartbeat baru dan tidak ada outbox `COMPLETED` tanpa job yang diterima; keduanya normal kembali setelah pulih.

**BUKTI VERIFIKASI**

- `pnpm test`
- `pnpm test:e2e`
- `pnpm --filter @vynor/database db:verify`

**Catatan:** Penguatan tambahan: AOF everysec bukan jaminan nol kehilangan; outbox COMPLETED tetapi Redis kehilangan job memerlukan prosedur deteksi/recovery.

### WU-05b — BullMQ contract / hapus dependensi pg-boss

**Status:** `BLOCKED_DEPENDENCY` · **Risiko:** CRITICAL · **Depends:** WU-05a · **Gates:** GATE-CUTOVER

**Vertical slice:** Job lama nol -> transport lama ditutup -> worker baru tetap sehat

**DONE WHEN (WU):** Query pgboss.job nol pada setiap environment yang disetujui, dependency pg-boss dihapus, golden path hijau.

**Rollback WU:** Revert kode hanya setelah status job di BullMQ dan pgboss direkonsiliasi; skema pgboss masih ada. Jangan lakukan replay serampangan yang dapat mengirim ulang pesan ke provider.

#### VYN-05B-01 — Gate drain pg-boss per environment dan rencana cutover

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** —; **Gates tambahan:** —.

**INPUT**

- PR WU-05a sudah merge
- GATE-CUTOVER oleh owner
- query pgboss.job WHERE state IN (created,retry,active)
- backup/rollback plan DB §4.1

**TUGAS / AKSI**

- [ ] Jalankan SELECT read-only backlog per queue/environment yang DIIZINKAN; simpan timestamp dan counts.
- [ ] Pastikan 0 pending/running/ retry dan tak ada producer lama; tangani job buntu tanpa delete sembarang.
- [ ] Minta owner menyetujui cutover berdasarkan bukti dan rencana rollback.

**OUTPUT / DELIVERABLE**

- Berita acara drain, count tiap environment
- Approval cutover eksplisit

**ACCEPTANCE CRITERIA**

- [ ] Query mengembalikan 0 row untuk state aktif/retry di setiap environment target.
- [ ] Tidak ada DELETE, DROP, UPDATE outbox atau production tanpa approval.

**BUKTI VERIFIKASI**

- `SELECT name,state,count(*) FROM pgboss.job WHERE state IN ('created','retry','active') GROUP BY name,state;`

#### VYN-05B-02 — Contract: lepas pg-boss sambil mempertahankan skema

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** VYN-05B-01; **Gates tambahan:** —.

**INPUT**

- VYN-05B-01
- worker queue/outbox, lockfile, env, ADR & docs
- Redis & E2E WU-03

**TUGAS / AKSI**

- [ ] Hapus package/import/PG_BOSS_* dan mode drain; jangan drop schema pgboss.
- [ ] Perbarui heartbeat worker, runbook queue, recovery Redis dan ADR relevan.
- [ ] Jalankan seluruh gate CI termasuk golden path setelah kontraksi.
- [ ] Sebelum menghapus pg-boss, pastikan padanan BullMQ untuk `pg-boss-start-retry` dan test heartbeat pg-boss sudah lulus di 5a; ganti, jangan sekadar hapus test.

**OUTPUT / DELIVERABLE**

- PR WU-05b, worker hanya BullMQ
- Docs dan rollback procedure

**ACCEPTANCE CRITERIA**

- [ ] Tidak ada referensi runtime pg-boss, kecuali dokumentasi historis/migrasi.
- [ ] Schema pgboss masih ada; golden path, crash recovery & tests hijau.
- [ ] Cakupan start retry, timeout, deferred handler, heartbeat dan graceful shutdown dibuktikan test BullMQ; setiap test pg-boss yang dihapus dipetakan ke penggantinya di 08/09.

**BUKTI VERIFIKASI**

- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`

### WU-05c — DROP skema pgboss (opsional, destruktif)

**Status:** `DEFERRED_APPROVAL` · **Risiko:** CRITICAL · **Depends:** WU-05b · **Gates:** GATE-DB-DROP, GATE-ENV

**Vertical slice:** Backup -> uji restore -> drop schema -> validasi -> rollback siap

**DONE WHEN (WU):** Hanya bila disetujui tertulis; skema benar-benar tidak dipakai, backup sudah teruji, post-check lulus.

**Rollback WU:** Gunakan pg_restore dari dump skema pgboss yang sudah diuji di database sementara; tindakan destruktif, hanya setelah persetujuan tertulis dan rencana maintenance disetujui.

#### VYN-05C-01 — Backup-restore teruji lalu DROP SCHEMA pgboss (opsional)

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** —; **Gates tambahan:** —.

**INPUT**

- GATE-DB-DROP tertulis; GATE-ENV tiap database non-test
- WU-05b terverifikasi
- DB §3.1 dan §5 queries
- akses DBA/owner

**TUGAS / AKSI**

- [ ] Backup pgboss schema dengan pg_dump -Fc -n pgboss, uji pg_restore ke DB sementara dan validasi count.
- [ ] Preflight daftar dependensi schema; inspeksi manual setiap objek CASCADE sebelum perintah destruktif.
- [ ] Hanya operator berizin mengeksekusi DROP SCHEMA dan validasi pasca-operasi.

**OUTPUT / DELIVERABLE**

- Backup dan bukti restore+count
- Catatan persetujuan per environment
- Post-migration integrity report

**ACCEPTANCE CRITERIA**

- [ ] Tidak ada aksi sebelum approval; restore di DB sementara lulus.
- [ ] Schema dihapus tanpa memengaruhi schema public; rollback teruji.

**BUKTI VERIFIKASI**

- `pg_dump -Fc -n pgboss <db> > <backup.dump>`
- `pg_restore -l <backup.dump>`

**Catatan:** AI Agent hanya menyiapkan runbook/PR; owner/operator menjalankan operasi destruktif saat approval khusus.

### WU-06a — Lapisan navigasi kompatibel (masih Next)

**Status:** `BLOCKED_DEPENDENCY` · **Risiko:** MEDIUM · **Depends:** WU-03 · **Gates:** DEC-03

**Vertical slice:** User navigasi Inbox/Channels -> adaptor -> route lama tetap bekerja

**DONE WHEN (WU):** Semua penggunaan next/link/navigation melalui wrapper; URL/screenshot dan E2E belum berubah.

**Rollback WU:** Revert PR setelah memeriksa state dan efek samping; catat di execution log.

#### VYN-06A-01 — Navigasi wrapper tanpa mengubah Next

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** —; **Gates tambahan:** —.

**INPUT**

- DEC-03
- 18 file pengguna next/link/navigation (audit)
- 20 URL & screenshot baseline WU-03

**TUGAS / AKSI**

- [ ] Buat lib/navigation.ts membungkus Link, useRouter, usePathname, useParams, useSearchParams, redirect sesuai kebutuhan aktual.
- [ ] Ubah pemanggil untuk menggunakan wrapper; jangan pindahkan halaman atau bundler.
- [ ] Uji browser history, back, query parameters, deep links, route auth di Next.

**OUTPUT / DELIVERABLE**

- PR WU-06a; satu titik migrasi navigation
- Golden path + visual diff baseline

**ACCEPTANCE CRITERIA**

- [ ] Semua URL/UX sama, Next masih bisa build.
- [ ] No unapproved layout/style change; tests/screenshot hijau.

**BUKTI VERIFIKASI**

- `pnpm --filter @vynor/web verify`
- `pnpm test:e2e`
- `pnpm typecheck`

### WU-06b — Bootstrap Vite, router, auth & config

**Status:** `BLOCKED_DEPENDENCY` · **Risiko:** HIGH · **Depends:** WU-06a · **Gates:** —

**Vertical slice:** Login -> protected routes -> 20 URL -> Inbox/Channels pada Vite

**DONE WHEN (WU):** 20 URL kompatibel; golden path + screenshot baseline lulus di vite preview; public env dapat dikonfigurasi runtime.

**Rollback WU:** Revert PR setelah memeriksa state dan efek samping; catat di execution log.

#### VYN-06B-01 — Vite bootstrap, React Router, dan seluruh route

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** —; **Gates tambahan:** —.

**INPUT**

- WU-06a merged
- apps/web/src/app/* dan layout
- route inventory 20 halaman
- tailwind 4, TanStack Query, Zustand
- Baseline WU-03 untuk route dinamis `/ai-agent/[agentId]` (08 NF-05)

**TUGAS / AKSI**

- [ ] Tambah vite.config.ts, index.html, main.tsx, router.tsx; pasang provider + errorElement/Suspense.
- [ ] Pindahkan page wrappers ke routes/ sambil memakai komponen/hook asli dan mempertahankan URL persis.
- [ ] Alihkan lib/navigation.ts ke React Router; no redesign.
- [ ] Petakan `/ai-agent/[agentId]` ke route berparameter React Router `/ai-agent/:agentId` dengan `useParams` lewat `lib/navigation.ts`; tanpa SSR atau loader server.

**OUTPUT / DELIVERABLE**

- Vite SPA build bisa dijalankan
- Route parity matrix 20 lama-vs-baru

**ACCEPTANCE CRITERIA**

- [ ] Seluruh 20 route dimuat dalam preview dengan URL yang sama.
- [ ] TanStack Query/Zustand/realtime tetap berfungsi; build/typecheck lulus.
- [ ] `/ai-agent/:agentId` dimuat lewat deep link dan refresh di `vite preview` dengan perilaku sama seperti baseline WU-03, termasuk agentId tidak dikenal.

**BUKTI VERIFIKASI**

- `pnpm --filter @vynor/web verify`
- `pnpm build`
- `pnpm typecheck`

#### VYN-06B-02 — Session guard dan konfigurasi web saat runtime

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** VYN-06B-01; **Gates tambahan:** —.

**INPUT**

- AuthContext Supabase/dev-session + preview mode
- middleware.ts dan cookie non-HttpOnly
- NEXT_PUBLIC_*
- PublicWebEnvSchema

**TUGAS / AKSI**

- [ ] Implementasikan RequireAuth dan returnUrl (backend tetap otoritatif); simpan token mengikuti supabase-js bukan cookie baru.
- [ ] Implementasikan `window.__VYNOR_CONFIG__` dari `runtime-config.js`, fallback `import.meta.env.VITE_*` untuk dev; validasi env; jangan masukkan secret.
- [ ] Pertahankan kemampuan preview yang ada dan buat test langsung bahwa mode connected tetap memakai API.

**OUTPUT / DELIVERABLE**

- Auth & runtime config porting dengan test
- Dokumen konfigurasi deployment SPA

**ACCEPTANCE CRITERIA**

- [ ] Unauthenticated protected route diarahkan login dengan returnUrl benar.
- [ ] Public config dapat diubah tanpa rebuild container; tidak ada token disalin ke cookie baru.

**BUKTI VERIFIKASI**

- `pnpm test:e2e`
- `pnpm typecheck`

#### VYN-06B-03 — Pembuktian visual & alur connected di vite preview

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** VYN-06B-02; **Gates tambahan:** —.

**INPUT**

- VYN-06B-01/02
- E2E + screenshot WU-03
- stub Graph API

**TUGAS / AKSI**

- [ ] Jalankan suite pada vite preview (bukan Next).
- [ ] Bandingkan screenshot route termasuk Inbox/Channels, dokumentasikan toleransi piksel yang disetujui.
- [ ] Periksa login, navigation back/deep link, Inbox/Channels connected, reply dan socket reconnect.
- [ ] Sertakan `/ai-agent/<agentId>` (agentId ada dan tidak dikenal) dalam perbandingan screenshot dan uji deep link.

**OUTPUT / DELIVERABLE**

- Perbandingan screenshot baseline dan diff
- PR WU-06b yang dapat direview

**ACCEPTANCE CRITERIA**

- [ ] Golden path+Channels E2E lulus di vite preview.
- [ ] Perubahan visual hanya toleransi terdokumentasi; tidak ada issue layout terbuka.

**BUKTI VERIFIKASI**

- `pnpm test:e2e`
- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`

### WU-06c — Serving SPA statis di Docker/Caddy

**Status:** `BLOCKED_DEPENDENCY` · **Risiko:** HIGH · **Depends:** WU-06b · **Gates:** —

**Vertical slice:** Deep link /inbox -> Caddy -> SPA statis -> API + realtime tetap dapat diakses

**DONE WHEN (WU):** Container web Node tidak dibutuhkan, deep link refresh 200, API/socket/webhook dan asset cache benar.

**Rollback WU:** Revert PR setelah memeriksa state dan efek samping; catat di execution log.

#### VYN-06C-01 — Bangun artefak SPA ke Caddy, bukan web Node

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** —; **Gates tambahan:** —.

**INPUT**

- Vite dist/ dari WU-06b
- DEC-08 tentang compose/Dockerfile
- Caddyfile + docker compose

**TUGAS / AKSI**

- [ ] Buat build stage yang memproduksi aset Vite dan mengeksposnya ke Caddy (multi-stage image/copy artefak; tidak membutuhkan Node runtime web).
- [ ] Atur try_files {path} /index.html hanya untuk route SPA; jangan fallback untuk /api, webhook atau socket.
- [ ] Terapkan cache immutable untuk aset ber-hash, no-cache untuk index dan runtime config, security headers/CSP yang kompatibel.

**OUTPUT / DELIVERABLE**

- Docker/Caddy konfigurasi serving SPA
- Dokumen caching & deployment assets

**ACCEPTANCE CRITERIA**

- [ ] Tidak ada container Node untuk web di runtime final.
- [ ] Fallback tidak menyebabkan endpoint /api/404 palsu; dist dapat disajikan Caddy.

**BUKTI VERIFIKASI**

- `docker compose config`
- `pnpm infra:verify`

#### VYN-06C-02 — Smoke jaringan: deep link, websocket, health & assets

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** VYN-06C-01; **Gates tambahan:** —.

**INPUT**

- VYN-06C-01
- Golden path WU-03
- compose environment TEST
- deep links protected routes

**TUGAS / AKSI**

- [ ] Build dan jalankan compose clean dalam lingkungan test.
- [ ] Test refresh /inbox, /channels, login redirect, path API /api/v1, /socket.io atau /realtime, status health dan webhook.
- [ ] Periksa cache headers, MIME/JS, security policy dan runtime-config dalam 2 env berbeda.
- [ ] Uji refresh deep link route berparameter `/ai-agent/<agentId>` lewat SPA fallback Caddy: 200 `index.html` dan halaman ter-render seperti baseline; `/api`, `/socket.io` dan webhook tidak jatuh ke `index.html`.

**OUTPUT / DELIVERABLE**

- Compose smoke evidence + PR WU-06c
- Screenshot browser saat serving Caddy

**ACCEPTANCE CRITERIA**

- [ ] Semua route penting bekerja via Caddy; runtime config berubah tanpa rebuild.
- [ ] Golden path tetap hijau dari image container, bukan hanya vite preview.
- [ ] Deep link `/ai-agent/<agentId>` mengembalikan 200 lewat Caddy dan me-render halaman yang sama dengan baseline WU-03.

**BUKTI VERIFIKASI**

- `docker compose up --build --wait`
- `pnpm test:e2e`
- `pnpm infra:verify`

### WU-06d — Hapus Next/cookie dan validasi cutover

**Status:** `BLOCKED_DEPENDENCY` · **Risiko:** HIGH · **Depends:** WU-06c · **Gates:** GATE-AUTH-LIVE

**Vertical slice:** Login nyata -> semua route berfungsi tanpa middleware/cookie Next

**DONE WHEN (WU):** Tidak ada import/dependency Next, cookie token lama hilang, test regresi hijau; bukti auth Supabase asli sebelum cutover production.

**Rollback WU:** Revert PR setelah memeriksa state dan efek samping; catat di execution log.

#### VYN-06D-01 — Hapus Next, middleware, access-token cookie

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** —; **Gates tambahan:** —.

**INPUT**

- VYN-06C-02
- apps/web/package.json, lockfile
- Next middleware.ts, next-env.d.ts, next.config.ts
- auth-context.tsx

**TUGAS / AKSI**

- [ ] Hapus imports/asset server khusus Next dan paketnya; sesuaikan ESLint/Turbo outputs.
- [ ] Hilangkan mekanisme cookie vynor_session non-HttpOnly yang hanya dipakai Next; pastikan token tidak digandakan ke cookie JS.
- [ ] Uji CSP, local preview, query/deep link, websocket setelah pembersihan.

**OUTPUT / DELIVERABLE**

- Aplikasi web Vite-only, dependency tree bersih
- Security verification token/cookie

**ACCEPTANCE CRITERIA**

- [ ] Tidak ada import Next/dependency next; bundle produksi jalan.
- [ ] Cookie vynor_session tidak dibuat aplikasi; backend RBAC tetap wajib.

**BUKTI VERIFIKASI**

- `pnpm audit --prod`
- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`

#### VYN-06D-02 — Gate login Supabase asli dan final regressions

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** VYN-06D-01; **Gates tambahan:** GATE-AUTH-LIVE.

**INPUT**

- GATE-AUTH-LIVE hasil tes owner (tidak ada Supabase project saat audit)
- Golden path test dengan dev-session
- PR WU-06d

**TUGAS / AKSI**

- [ ] Di environment aman yang disetujui, uji auth Supabase email/password, refresh token, logout, protected route, dan API/WS authorization.
- [ ] Ulangi E2E via vite preview dan Docker; periksa screenshots 20 route dan 0 advisory Next.
- [ ] Jika provider asli tak tersedia, tandai NOT VERIFIED dan jangan klaim cutover production siap; minta sign-off owner.

**OUTPUT / DELIVERABLE**

- Bukti Supabase live atau blocker eksplisit
- Regression sign-off untuk WU-06d

**ACCEPTANCE CRITERIA**

- [ ] Token Supabase sah diterima sesuai perilaku sebelum migrasi; issuer salah/expired ditolak menurut tahap auth.
- [ ] Tidak ada regresi Inbox/Channels; owner menyetujui release jika tes live lulus.

**BUKTI VERIFIKASI**

- `pnpm test:e2e`
- `pnpm test`
- `pnpm audit --prod`

### WU-07 — OpenAPI dari Zod & contract tests

**Status:** `BLOCKED_DEPENDENCY` · **Risiko:** MEDIUM · **Depends:** WU-03 · **Gates:** —

**Vertical slice:** HTTP route -> schema Zod -> OpenAPI 3.1 -> contract test di CI

**DONE WHEN (WU):** Semua route termasuk publik terdokumentasi dan CI mendeteksi drift.

**Rollback WU:** Revert PR setelah memeriksa state dan efek samping; catat di execution log.

#### VYN-07-01 — Generator schema OpenAPI dari Zod

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** —; **Gates tambahan:** —.

**INPUT**

- @vynor/contracts Zod 4
- apps/api/src/openapi/*.ts
- route definitions NestJS
- existing RFC7807/envelope

**TUGAS / AKSI**

- [ ] Generate komponen schema JSON Schema/OpenAPI 3.1 dari sumber Zod; pertahankan metadata path declarative.
- [ ] Pertahankan format error, auth, pagination, dan envelope sesuai API berjalan; tidak mengubah business controllers.
- [ ] Hapus definisi duplikat manual hanya setelah contract test membandingkan hasil.

**OUTPUT / DELIVERABLE**

- Generator deterministik dan artefak openapi
- Test schema generasi

**ACCEPTANCE CRITERIA**

- [ ] OpenAPI 3.1 valid dan build deterministik.
- [ ] Skema input/output bukan salinan tulisan tangan yang drift.

**BUKTI VERIFIKASI**

- `pnpm test`
- `pnpm build`

#### VYN-07-02 — Coverage setiap route dan contract test CI

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** VYN-07-01; **Gates tambahan:** —.

**INPUT**

- VYN-07-01
- controller webhooks, webchat, media dan lainnya
- API test VYN-03-02/03

**TUGAS / AKSI**

- [ ] Dokumentasikan semua route publik/private, path params, HTTP methods dan mekanisme security.
- [ ] Tulis contract tests: route Nest ↔ spec dua arah, sample response terhadap schema, validasi spec OpenAPI 3.1.
- [ ] Perbarui AD-013 agar sesuai perilaku aktual dan cek 100% route coverage.

**OUTPUT / DELIVERABLE**

- openapi.json lengkap dan tests drift CI
- PR WU-07 + perubahan ADR

**ACCEPTANCE CRITERIA**

- [ ] CI gagal bila controller punya route tanpa spec atau sebaliknya.
- [ ] Endpoint webhook/webchat/media terwakili lengkap.

**BUKTI VERIFIKASI**

- `pnpm test`
- `pnpm --filter @vynor/api verify`

### WU-08 — OIDC issuer/audience enforcement bertahap

**Status:** `BLOCKED_DEPENDENCY` · **Risiko:** HIGH · **Depends:** WU-03 · **Gates:** DEC-05

**Vertical slice:** Login -> JWT iss/aud/JWKS diverifikasi -> akses RBAC tetap benar

**DONE WHEN (WU):** Token issuer asing ditolak saat enforce, dev-session lokal valid, mode enforce production ditahan sampai tes live.

**Rollback WU:** Revert PR setelah memeriksa state dan efek samping; catat di execution log.

#### VYN-08-01 — Verifier OIDC iss/aud/JWKS dengan mode log-only

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** —; **Gates tambahan:** —.

**INPUT**

- DEC-05
- JWTVerifier saat ini HS256/JWKS Supabase
- auth env schemas + dev-session test
- golden path WU-03

**TUGAS / AKSI**

- [ ] Tambah AUTH_ISSUER, AUTH_AUDIENCE, AUTH_JWKS_URL, AUTH_ENFORCE_ISSUER dan safe defaults.
- [ ] Mulai mode log-only untuk issuer tidak sesuai; enforcer menolak issuer asing.
- [ ] Batasi vynor-dev-session ke local/test, jangan buka bypass di staging/production.

**OUTPUT / DELIVERABLE**

- Verifier dengan unit tests mixed issuer/algorithm/audience
- Konfigurasi rollout dan log teredaksi

**ACCEPTANCE CRITERIA**

- [ ] Mode enforce menolak wrong-issuer, expired, invalid aud/JWKS; dev-session prod ditolak.
- [ ] Golden path dev-session lokal tetap hijau.

**BUKTI VERIFIKASI**

- `pnpm test`
- `pnpm typecheck`

#### VYN-08-02 — Rollout bertahap dan validasi issuer dengan Supabase asli

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** VYN-08-01; **Gates tambahan:** GATE-AUTH-LIVE.

**INPUT**

- VYN-08-01
- GATE-AUTH-LIVE
- hasil log-only di staging yang disetujui
- dokumen auth flows

**TUGAS / AKSI**

- [ ] Verifikasi token asli Supabase di QA/staging, cek issuer/aud/JWKS dan refresh.
- [ ] Aktifkan AUTH_ENFORCE_ISSUER hanya setelah log aman, approval owner, dan siapkan toggle rollback tanpa deploy.
- [ ] Perbarui docs auth, keputusan OIDC, serta hasil regression.

**OUTPUT / DELIVERABLE**

- Laporan evidence auth live
- PR WU-08 + rollout/rollback playbook

**ACCEPTANCE CRITERIA**

- [ ] User asli tetap login ketika issuer enforcement hidup; wrong-issuer ditolak.
- [ ] Jika tidak ada project Supabase, enforcement deployment BLOCKED, bukan dianggap lulus.

**BUKTI VERIFIKASI**

- `pnpm test`
- `pnpm test:e2e`

### WU-10 — OTel, metrics dan Grafana

**Status:** `BLOCKED_DEPENDENCY` · **Risiko:** MEDIUM · **Depends:** WU-05b · **Gates:** —

**Vertical slice:** Webhook -> job -> send -> trace dan metrik muncul di dashboard internal

**DONE WHEN (WU):** Trace end-to-end dan dashboard dapat ditelusuri; endpoint metrics tidak terekspos publik.

**Rollback WU:** Revert PR setelah memeriksa state dan efek samping; catat di execution log.

#### VYN-10-01 — Tracing/metrics internal untuk API dan worker

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** —; **Gates tambahan:** —.

**INPUT**

- @vynor/observability (Pino existing)
- apps/api/main.ts dan apps/worker/main.ts
- Redis/pg & BullMQ
- Caddy route policies

**TUGAS / AKSI**

- [ ] Pasang OpenTelemetry HTTP/pg/ioredis, trace context ke Pino, manual span outbox/consumer/provider.
- [ ] Tambahkan prom-client untuk HTTP, queue states, outbox, provider error categories, active socket.
- [ ] Pilih transport scrape worker yang sesuai karena worker tidak memiliki HTTP server (private listener atau collector); metrics tidak boleh publik.

**OUTPUT / DELIVERABLE**

- SDK + metrics dengan redact PII
- Endpoint/transport scrape privat untuk API & worker
- Test metrik synthetic

**ACCEPTANCE CRITERIA**

- [ ] Tidak ada secret/token/PII bocor dalam label log/trace metrics.
- [ ] Endpoint /metrics tidak dapat diakses dari internet/Caddy publik.

**BUKTI VERIFIKASI**

- `pnpm test`
- `pnpm typecheck`

#### VYN-10-02 — Golden trace webhook hingga status delivery di dashboard

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** VYN-10-01; **Gates tambahan:** —.

**INPUT**

- VYN-10-01
- observability compose profile
- WU-03 golden path & worker BullMQ

**TUGAS / AKSI**

- [ ] Tambah Prometheus/Grafana (profil opsional) dan konfigurasi scrape aman.
- [ ] Jalankan satu golden path, periksa trace ID menghubungkan webhook, outbox, BullMQ, adapter dan status SENT.
- [ ] Buat dashboard queue depth/retry/DLQ/error provider/HTTP latency dan basic alert/runbook.

**OUTPUT / DELIVERABLE**

- Dashboard dasar + screenshot query/trace
- PR WU-10 dan runbook incident

**ACCEPTANCE CRITERIA**

- [ ] Trace golden path terlihat lintas proses; metrics berubah sesuai fixture.
- [ ] observability bisa dimatikan tanpa mengganggu core runtime.

**BUKTI VERIFIKASI**

- `docker compose --profile observability config`
- `pnpm test:e2e`

### WU-09 — Persist media inbound ke object storage (opsional)

**Status:** `DEFERRED_OPTIONAL` · **Risiko:** HIGH · **Depends:** WU-05b · **Gates:** DEC-07

**Vertical slice:** Media webhook -> worker fetch -> scan/storage -> attachment -> unduh meski URL provider 404

**DONE WHEN (WU):** Gambar tetap terunduh dari storage setelah provider menghapusnya, hanya file aman yang bisa didownload.

**Rollback WU:** Revert kode aplikasi; biarkan kolom nullable additive tidak digunakan. Jangan hapus data/objek media atau schema tanpa persetujuan terpisah.

#### VYN-09-01 — Keputusan scan media dan migrasi DB additive

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** —; **Gates tambahan:** —.

**INPUT**

- DEC-07 (ClamAV/tanpa-scan/tunda)
- DB §3.2 attachments.message_id
- storage authorizeSignedDownload hanya CLEAN
- izin DB test

**TUGAS / AKSI**

- [ ] Jangan lanjut tanpa keputusan scanner; dokumentasikan trust boundary, MIME, ukuran maksimal, redaksi/log, scanning timeout dan quarantine.
- [ ] Jika disetujui, tambahkan nullable attachments.message_id, FK SET NULL, indeks dan query mismatch tenant.
- [ ] Siapkan verifikasi backup/migrate terhadap DB test dan strategi rollback dengan kolom dibiarkan.

**OUTPUT / DELIVERABLE**

- Design decision keamanan & migration SQL reviewed
- Additive Prisma migration + test referential integrity

**ACCEPTANCE CRITERIA**

- [ ] Tidak ada media tanpa scan yang salah dilabel CLEAN kecuali owner menyetujui risk acceptance eksplisit.
- [ ] Migrasi menambah kolom tanpa drop data; workspace_id attachment == workspace message.

**BUKTI VERIFIKASI**

- `pnpm --filter @vynor/database db:verify`
- `pnpm test`

#### VYN-09-02 — Unduh media provider, scan, simpan S3 lalu tampilkan

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** VYN-09-01; **Gates tambahan:** —.

**INPUT**

- VYN-09-01
- existing packages/storage & MinIO
- worker job media.ingest dari event
- API /media/:messageId
- provider stub image/404

**TUGAS / AKSI**

- [ ] Saat inbound media diterima, jadwalkan media.ingest secara idempoten untuk unduh dengan batas ukuran/timeout/MIME & SSRF guard.
- [ ] Scan/karantina sesuai keputusan owner, simpan object storage dan tautan attachments.message_id atomik secara logis.
- [ ] Baca media dari storage jika CLEAN/authorized, fallback provider untuk media lama yang belum dimigrasi.

**OUTPUT / DELIVERABLE**

- Worker media ingest + storage API refactor
- MinIO integration/E2E provider 404 regression

**ACCEPTANCE CRITERIA**

- [ ] Media dapat dibuka setelah stub provider dihapus/404.
- [ ] Tidak ada download cross-tenant atau unscanned/quarantined; retries tak membuat attachment duplikat.

**BUKTI VERIFIKASI**

- `pnpm test`
- `pnpm test:e2e`
- `pnpm --filter @vynor/database db:verify`

### WU-11 — Cleanup, ADR dan laporan akhir

**Status:** `BLOCKED_DEPENDENCY` · **Risiko:** LOW · **Depends:** WU-05b, WU-06d, WU-07, WU-08, WU-10 · **Gates:** —

**Vertical slice:** Build bersih -> docs sesuai runtime -> regresi final -> owner sign-off

**DONE WHEN (WU):** Tidak ada dependensi unused, ADR diperbarui, laporan 08-10 dan hasil final disetujui.

**Rollback WU:** Revert PR setelah memeriksa state dan efek samping; catat di execution log.

#### VYN-11-01 — Hapus artifact/dependency mati tanpa merusak runtime

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** —; **Gates tambahan:** —.

**INPUT**

- paket @vynor/ai kosong
- autoprefixer yang tidak dipakai
- @nestjs/platform-express di worker kandidat
- LegacyRouteConverter warning
- kode final WU-05b,06d

**TUGAS / AKSI**

- [ ] Konfirmasi dengan grep/import graph setiap kandidat benar-benar unused lalu bersihkan secara sempit.
- [ ] Benahi forRoutes wildcard warning tanpa mengubah coverage guards; hapus hanya dependensi tak terpakai.
- [ ] Tata ulang scripts/cache outputs bila perlu, tanpa refactor besar atau redesign.

**OUTPUT / DELIVERABLE**

- PR cleanup kecil & bukti import graph
- Build tanpa warning teridentifikasi

**ACCEPTANCE CRITERIA**

- [ ] Build/lint/typecheck/test/golden path tetap lulus.
- [ ] Tidak ada paket terhapus yang ternyata dipakai UI atau worker.

**BUKTI VERIFIKASI**

- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`

#### VYN-11-02 — ADR, regression matrix, final handoff dan readiness report

**Pemilik:** AI Agent (kecuali tindakan berizin yang dilakukan owner/operator). **Depends (intra-WU):** VYN-11-01; **Gates tambahan:** —.

**INPUT**

- Semua WU wajib selesai
- 08 execution log, 09 regression results
- AD-015 BullMQ/AD-016 Vite/AD-017 Redis
- temuan audit dan deferred backlog

**TUGAS / AKSI**

- [ ] Sinkronkan README, infra docs, auth docs, background job docs, target architecture sesuai implementasi aktual.
- [ ] Buat 10-migration-final-report.md: daftar WU, SHA PR, hasil uji, risiko, rollback, known gaps, pending verification, approvals.
- [ ] Pisahkan backlog fitur CRM & WU-09/05c/FK sebagai tickets baru tanpa mengklaim selesai.

**OUTPUT / DELIVERABLE**

- 10 final report serta ADR & README akurat
- Sign-off review owner

**ACCEPTANCE CRITERIA**

- [ ] Semua mandatory CI & E2E lulus; exceptions eksplisit (terutama live Supabase).
- [ ] Tidak ada klaim implementasi Contacts/Tickets/Campaigns/AI backend baru.

**BUKTI VERIFIKASI**

- `pnpm format:check`
- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`

## 6. Golden path wajib (regresi vertikal)

1. Dev-session lokal → login → Inbox. Untuk production cutover, login Supabase asli diperiksa terpisah.
2. Webhook Meta bertanda tangan → journal `provider_events` → outbox Postgres → queue → worker → contact/conversation/message → Inbox/realtime.
3. Webhook identik diulang → tidak ada duplikasi domain.
4. Agent membalas di UI → outbox → queue → Graph API stub → SENT → DELIVERED → READ tanpa status mundur.
5. Assign, resolve, reopen → sistem timeline dan audit log benar.
6. Transient provider error → retry/sukses; permanent error → FAILED/retry UI.
7. Isolasi dua workspace, signature invalid, token invalid, idempotency collision dan Redis unavailable diperiksa di unit/integrasi yang relevan.

## 7. Invarian, pemeriksaan database, dan area STOP

- **Invarian:** transaksi tulis domain + outbox + pg_notify; outbox Postgres sumber kebenaran; dedup provider_events; pesan status monoton; workspace scoping; encrypted credentials; RBAC backend; non-public metrics.
- **Tidak boleh otomatis:** operasi terhadap `vynor`/`vynor_crm`, staging/production; migrasi destruktif; `DROP SCHEMA`; ubah FK CASCADE; force-push; reset hard; clean -fd; merge PR; kredensial provider live.
- **Test DB diizinkan:** `vynor_test`, `vynor_e2e`, `vynor_shadow` dengan guard; ikuti `07-database-migration-plan.md §4-6`.
- **Validasi cutover:** cek jumlah baris domain, mismatch workspace = 0, status outbox/provider, duplikat message, dan query `pgboss.job` sebelum WU-05b.

## 8. Temuan teknis yang harus ditindaklanjuti sebelum implementasi

1. **Koreksi validasi BullMQ:** dokumen 04–06 telah dikoreksi menjadi `jobId = outbox-<id>` (bukan bentuk lama dengan `:`). Buat regression test. Sumber: https://docs.bullmq.io/guide/jobs/job-ids
2. **Deduplikasi setelah retensi:** job yang di-remove tidak lagi dianggap duplicate oleh jobId; jaminan tetap harus ada di domain/outbox. Sumber: URL di atas.
3. **Redis data loss window:** AOF everysec/noeviction memitigasi, bukan meniadakan semua failure. Perlu rekonsiliasi jika outbox berstatus COMPLETED tetapi job Redis hilang. **Tambahan kontrol risiko**, bukan fitur yang telah terbukti ada.
4. **Worker metrics:** worker memakai NestJS application context tanpa HTTP listener; WU-10 perlu memilih private scrape endpoint atau collector, jangan menganggap sudah ada endpoint worker.
5. **Auth eksternal:** hasil dev-session test tidak membuktikan login Supabase live; enforcement issuer atau cutover production memerlukan evidence owner. Lihat 03 §1 dan 06 §4.
6. **Lokasi compose dalam dokumen 05:** blueprint dan catatan §2 sudah diselaraskan (compose di root, Dockerfile di infrastructure/docker), tetapi implementasinya masih menunggu DEC-08.
7. **Kontrak start pg-boss sejak `1d6b578` (#59, #61, #63):** startup retry, timeout 30 s, handler tertunda, `sendJob` gagal cepat dan heartbeat yang mensyaratkan queue berjalan wajib punya padanan BullMQ (VYN-05A-01..03, VYN-05B-02; `../08-migration-execution-log.md` NF-02/NF-03).
8. **Route dinamis `/ai-agent/[agentId]`:** satu-satunya route `ƒ` pada `next build`, tanpa data server; diverifikasi di VYN-03-04, VYN-06B-01, VYN-06B-03 dan VYN-06C-02 (01 §6.3).

## 9. Format laporan keluaran AI Agent per PR

```md
WU / PR: <id>
Base SHA / head SHA: <sha> / <sha>
Keputusan & persetujuan terpenuhi: <list + proof>
Input & files reviewed: <paths / docs>
Perubahan aktual: <diff summary, file list>
Test commands / hasil / evidence artifacts: <cmd, PASS/FAIL, outputs>
Golden path + SQL integrity: <pass/fail/not-applicable dengan alasan>
Known gaps / NOT VERIFIED / security: <list>
Rollback / rollout procedure: <steps>
Ready for owner review: YES/NO + blocker
```

**Kegiatan berikutnya:** DEC-01 s.d. DEC-09 sudah diputuskan (2026-10-17; DEC-07 = DEFER) VYN-00-01 dan VYN-00-02 `DONE` (diterima owner; baseline `1d6b578`: 182 tes PASS, lihat `../09-regression-test-results.md`). PR WU-00 (#64) di-merge owner pada 2026-10-17 (`07e7748`). WU-01 `IN_PROGRESS` atas instruksi owner: tahap 1 dan smoke terisolasi tahap 2 PASS di branch `fix/wu-01-compose-health` (NF-08 diselesaikan dengan PGSTY Silo; NF-09 terbuka di luar scope). Owner menerima VYN-01-01..03 (2026-10-17); PR WU-01 (#65) di-merge owner pada 2026-10-17 (`aa74590`), sehingga WU-01 `DONE`. WU-02 `IN_PROGRESS` atas instruksi owner: VYN-02-01..02 `IN_REVIEW` di branch `fix/wu-02-security-patches`, PR menunggu review dan merge owner. NF-09 tetap terbuka di luar scope; WU-03 belum dimulai. Keputusan teknis diuji ulang di gerbang WU masing-masing. Tanpa approval, status board tetap perencanaan.

## 10. Sumber

- **AUDIT** — `01-existing-system-audit.md`
- **STACK** — `02-current-stack-inventory.md`
- **FEATURE** — `03-feature-inventory.md`
- **GAP** — `04-architecture-gap-analysis.md`
- **TARGET** — `05-target-architecture.md`
- **ROADMAP** — `06-migration-roadmap.md`
- **DB** — `07-database-migration-plan.md`
- BullMQ Job IDs: https://docs.bullmq.io/guide/jobs/job-ids
- BullMQ Going to production: https://docs.bullmq.io/guide/going-to-production
- BullMQ FIFO: https://docs.bullmq.io/guide/jobs/fifo

## 11. Kontrol revisi dan pemetaan sumber

- Paket ini memperbaiki field status/rollback WU-05a, WU-05b, WU-05c dan WU-09 yang sebelumnya salah terpetakan dalam versi JSON/tiket. Versi terkoreksi dapat diverifikasi dengan `VYNOR_AGENT_TASKS.json` dan 39 file tiket di folder `tickets/`.
- Dokumen `../01..07` kini merupakan versi revisi yang mempertahankan baseline historis dan menambahkan kontrak eksekusi. Rekomendasi tidak setara approval owner.
- Registrasi keputusan ditandatangani di `01-DECISION-REGISTER.md`; jangan mengubah `PENDING` menjadi `APPROVED` tanpa bukti.
- Baca `00-START-HERE.md` dan `03-EXECUTION-RUNBOOK.md` sebelum memulai tiket.
