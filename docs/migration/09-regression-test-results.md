# 09 — Hasil Tes Regresi

> Dibuat dari `agent/templates/09-regression-test-results.template.md` saat WU-00 berjalan. Isinya hanya hasil yang benar-benar dijalankan. Baris berlabel _historis_ adalah catatan audit `01-existing-system-audit.md` §4 dan tidak dijalankan ulang di sini. Log mentah tersimpan lokal di `~/vynor-migration-backup-2026-10-17/07-vyn-00-02-evidence/` (di luar repo, tidak di-commit).

## Baseline WU-00 (VYN-00-02) — 2026-10-17, commit `1d6b578`

Commit diuji: `1d6b578b17582057f2342eabe0e8e7a6459f5a40` (= `origin/main` setelah `git fetch`), ditambah `docs/migration/**` yang masih untracked (dokumen saja). Environment: lokal, Node 24.19.0, pnpm 11.25.0, turbo 2.11.3, PostgreSQL `vynor-postgres` pg16 di `localhost:5434`. DB = **`vynor_test`**, diverifikasi lewat tiga jalur (lihat 08). Semua task turbo dijalankan dengan `--cache=local:,remote:` (0 cache).

| WU    | Commit    | Environment/DB (tanpa secret) | Test/command                                    | Hasil PASS/FAIL/NOT VERIFIED                                                                                                                                                                  | Artefak/log                             | Catatan                                                                                                     |
| ----- | --------- | ----------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| WU-00 | `1d6b578` | lokal, tanpa DB               | `pnpm format:check`                             | **PASS**                                                                                                                                                                                      | `format-check.log`                      | Run pertama FAIL pada 3 file dokumen yang baru diedit; lulus setelah `prettier --write 'docs/migration/**'` |
| WU-00 | `1d6b578` | lokal, tanpa DB               | `turbo run lint --cache=local:,remote:`         | **PASS** 17/17, 0 cached                                                                                                                                                                      | `lint.log`                              | Run ber-cache sebelumnya (16/17 replay) dibuang                                                             |
| WU-00 | `1d6b578` | lokal, tanpa DB               | `turbo run typecheck --cache=local:,remote:`    | **PASS** 11/11, 0 cached                                                                                                                                                                      | `typecheck.log`                         | Dijalankan sebelum build, sesuai urutan CI                                                                  |
| WU-00 | `1d6b578` | lokal, tanpa DB               | `turbo run build --cache=local:,remote:`        | **PASS** 11/11, 0 cached                                                                                                                                                                      | `build.log`                             | 21 route `○` statis + `/ai-agent/[agentId]` `ƒ` dinamis (NF-05); middleware `ƒ`                             |
| WU-00 | `1d6b578` | `vynor_test`                  | `prisma migrate status`                         | **PASS** (read-only)                                                                                                                                                                          | `migrate-status.log`                    | 7 migrasi, "Database schema is up to date"                                                                  |
| WU-00 | `1d6b578` | `vynor_test`                  | `db:seed` → `pnpm test` → `db:seed` (pemulihan) | **PASS**: 29 file, **182 tes**, 12,9 s                                                                                                                                                        | `test.log`, `seed-*.log`                | 0 skipped. Log `warn` heartbeat adalah skenario negatif yang disengaja dalam tes                            |
| WU-00 | `1d6b578` | tanpa DB                      | `pnpm --filter @vynor/api verify`               | **PASS**                                                                                                                                                                                      | `api-verify.log`                        | Statis                                                                                                      |
| WU-00 | `1d6b578` | tanpa DB                      | `pnpm --filter @vynor/web verify`               | **PASS**                                                                                                                                                                                      | `web-verify.log`                        | Statis                                                                                                      |
| WU-00 | `1d6b578` | tanpa DB                      | `pnpm infra:verify`                             | **PASS** 11/11 cek                                                                                                                                                                            | `infra-verify.log`                      | Statis; tetap tidak menangkap F-01                                                                          |
| WU-00 | `1d6b578` | tanpa DB                      | `pnpm --filter @vynor/database db:verify`       | **PASS** 50/50 cek                                                                                                                                                                            | `db-verify.log`                         | Statis (schema + DMMF)                                                                                      |
| WU-00 | `1d6b578` | `vynor_test`, port 3399       | Smoke API `node apps/api/dist/main.js`          | **PASS**: health live/ready 200; `/health/live` 404 (F-01); dev-session → token; `/auth/me` 29 permission; channels/conversations/members 200; tanpa token 401; ID asing 404; OpenAPI 25 path | `api-smoke.txt`, `api-smoke-server.log` | 0 log error; 1 peringatan `LegacyRouteConverter` (D-07); proses dihentikan, tanpa orphan                    |
| WU-00 | `1d6b578` | —                             | `pnpm --filter @vynor/database db:migrate:diff` | **NOT RUN**                                                                                                                                                                                   | —                                       | Akan membuat shadow schema di `vynor_test` (perubahan schema dilarang)                                      |
| WU-00 | `1d6b578` | —                             | Smoke worker `node apps/worker/dist/main.js`    | **NOT RUN**                                                                                                                                                                                   | —                                       | pg-boss akan membuat schema `pgboss` di `vynor_test`; tercakup sebagian oleh spec integrasi                 |
| WU-00 | `1d6b578` | —                             | `pnpm audit --prod`                             | **NOT RUN**                                                                                                                                                                                   | —                                       | Butuh jaringan ke registry; di luar izin VYN-00-02                                                          |
| WU-00 | `1d6b578` | —                             | `pnpm test:e2e`, `docker compose up --wait`     | **NOT RUN**                                                                                                                                                                                   | —                                       | Lingkup WU-03 / WU-01                                                                                       |
| WU-00 | —         | GitHub Actions                | CI PR WU-00                                     | **NOT VERIFIED**                                                                                                                                                                              | —                                       | Belum ada commit/PR                                                                                         |

## Perbandingan dengan baseline audit (_historis_, `565e8e4`)

| Pemeriksaan          | Audit `565e8e4` (_historis_)  | `1d6b578` (aktual)            | Delta                                                               |
| -------------------- | ----------------------------- | ----------------------------- | ------------------------------------------------------------------- |
| Build / typecheck    | PASS 11/11                    | PASS 11/11 (tanpa cache)      | Sama                                                                |
| Lint                 | PASS 17/17                    | PASS 17/17 (tanpa cache)      | Sama                                                                |
| Format               | PASS                          | PASS                          | Sama (setelah dokumen migrasi diformat)                             |
| Migrasi `vynor_test` | 7, up to date                 | 7, up to date                 | Sama                                                                |
| Unit + integrasi     | 28 file, 176 tes              | **29 file, 182 tes**          | +1 file (`pg-boss-start-retry`, 5 tes) dan +1 tes heartbeat (NF-01) |
| `api` / `web` verify | PASS                          | PASS                          | Sama                                                                |
| `infra:verify`       | PASS 11                       | PASS 11                       | Sama                                                                |
| `db:verify`          | PASS                          | PASS 50/50                    | Jumlah cek tidak dicatat audit                                      |
| Smoke API            | PASS (25 path, 29 permission) | PASS (25 path, 29 permission) | Sama; F-01 masih ada                                                |
| Smoke worker         | PASS                          | NOT RUN                       | Lihat alasan di atas                                                |
| `pnpm audit --prod`  | 9 advisory (web)              | NOT RUN                       | —                                                                   |
| Route web            | "semua statis"                | 21 statis + 1 dinamis         | Ketidakakuratan audit, bukan regresi (NF-05)                        |

## Golden path

Belum tersedia sampai WU-03. Semua butir berikut **NOT RUN** pada WU-00:

- Dev login / Inbox: NOT RUN (smoke `dev-session` API PASS bukan bukti UI)
- Signed webhook / dedup / inbound: NOT RUN
- Reply / Graph stub / statuses: NOT RUN
- Assignment / audit: NOT RUN
- Retry transient / permanent: NOT RUN
- Channels E2E / screenshot: NOT RUN
- Cross-workspace / auth: NOT RUN di E2E (smoke API: ID percakapan asing → 404)

## DB integrity

- **Nama DB diverifikasi:** `vynor_test` (`prisma migrate status`, `current_database()` lewat tiga variabel URL, `system_identifier` 7689052853146714150, env proses API).
- **Sebelum tes:** schema `public`; `workspaces=1`, `user_profiles=0`, `workspace_memberships=0`, `roles=4`, `permissions=28`, `outbox_events=1`, tabel domain lain 0; seed admin tidak ada.
- **Sesudah tes + seed ulang:** schema `public`; `workspaces=2` (termasuk residu "Committed Workspace", NF-07), `user_profiles=2`, `workspace_memberships=2`, `roles=4`, `permissions=28`, `outbox_events=0`, tabel domain lain 0; seed admin ada.
- **Outbox/provider/message statuses:** semua 0 baris setelah tes (N/A untuk WU-00).
- **Tenant mismatch:** N/A (tidak ada data domain).
- **pg-boss drain:** N/A (WU-05b).
- **DB non-test:** tidak diakses oleh sesi ini; `tup_inserted/updated/deleted` di `vynor` dan `vynor_crm` = 0 (lihat 08).

## Validasi dokumen sebelum commit WU-00 — 2026-10-17

Dijalankan pada worktree `docs/migration-plan` (base `1d6b578`) setelah koreksi finalisasi, dan diulang tepat sebelum `git add`.

| Pemeriksaan                                                                                         | Hasil                                                                                                                    |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `pnpm format:check` (seluruh repo)                                                                  | **PASS** ("All matched files use Prettier code style!")                                                                  |
| Tautan relatif di `docs/migration/**` (termasuk anchor)                                             | **PASS**: 26 tautan, 0 rusak                                                                                             |
| JSON valid; 17 WU; 39 task = 39 file tiket; status dalam kosakata yang disetujui                    | **PASS**; VYN-00-01/02 `DONE`, WU-00 `IN_REVIEW`, DEC RESOLVED 9/9, GATE PENDING 5/5                                     |
| Konsistensi input/aksi/output/acceptance/verifikasi dan catatan: JSON ↔ `tickets/*.md` ↔ Kanban     | **PASS**: 39 tiket, 0 perbedaan (sebelum perbaikan: 4 perbedaan akibat Prettier pada VYN-01-02 dan VYN-06B-02, lihat 08) |
| Frasa status/kontrak usang (status lama WU-00 dan VYN-00-02, `jobId` bertitik dua di desain target) | **PASS**: tidak ada                                                                                                      |
| Klaim "semua route statis"                                                                          | **PASS**: setiap klaim membawa koreksi `/ai-agent/[agentId]`                                                             |
| Diff semantik JSON sebelum ↔ sesudah finalisasi                                                     | **PASS**: hanya 2 status, 2 perbaikan code span, dan item tambahan pada 10 tiket yang dimaksud                           |
| Scope                                                                                               | **PASS**: hanya `docs/migration/**` (untracked), 0 perubahan file tracked                                                |
| `git diff --cached --check`                                                                         | Dijalankan setelah `git add`; hasil ada di laporan PR                                                                    |

Tidak ada tes aplikasi yang dijalankan ulang pada finalisasi, karena tidak ada perubahan kode. Baseline yang berlaku tetap 182 tes / 29 file pada `1d6b578` (di atas).
