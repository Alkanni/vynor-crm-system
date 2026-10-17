# 03 — Runbook Eksekusi Awal dan Perubahan PR

## Fase A — Penyerahan awal (belum ada approval)

1. Ekstrak ZIP **di direktori sementara**, bukan langsung menimpa `docs/migration/` yang dilaporkan untracked. Paket sudah disusun dengan path relatif root repo (`docs/migration/`).
2. Pastikan semua tujuh dokumen, board, tasks.json, dan 39 file tiket dapat dibaca. Periksa daftar file menggunakan `find`/`unzip -l`.
3. Buka `00-START-HERE.md` dan `01-DECISION-REGISTER.md`. Owner memilih setiap DEC-01..09 secara eksplisit; `DEC-07=DEFER` diterima.
4. Kirim `04-FIRST-RUN-PROMPT.md` kepada agent bersama akses read-only repo atau hasil inspeksi yang disetujui. **MODE: REVIEW_ONLY**.
5. Agent mengembalikan status Git, daftar perubahan aman, perbedaan HEAD vs audit, keputusan yang belum jelas, dan rencana PR WU-00. Tidak boleh commit/ubah kode/DB.

## Fase B — Pemeriksaan awal oleh AI Agent (non-mutating)

Jalankan dari direktori repo TypeScript yang telah terkonfirmasi:

```bash
pwd
git rev-parse --show-toplevel
git remote -v
git status --short
git rev-parse HEAD
git branch --show-current
git worktree list
git log -1 --oneline
git log --oneline main..origin/main
git ls-files --others --exclude-standard docs/migration
```

`origin/main` lokal mungkin stale. `git fetch origin` memperbarui remote-tracking refs; lakukan hanya setelah owner mengizinkan WU-00, lalu ulangi inspeksi. **Jangan** `git reset --hard`, `git clean -fd`, menghapus worktree orang lain, overwrite 7 dokumen tanpa diff, atau langsung `git pull` sambil mengandalkan working tree bersih tanpa verifikasi.

### Hal yang wajib muncul dalam laporan awal

- Nama repo/remote dan current base SHA; perbedaan dengan audit `565e8e4`.
- Daftar file existing yang berubah/untracked, terutama tujuh dokumen audit yang belum commit, dan perbedaan dengan versi paket baru.
- Keputusan owner dan gate yang PENDING.
- Hasil pemeriksaan potensi konflik branch/worktree, kebijakan preservasi file lokal.
- Rencana cabang `docs/migration-plan` atau cabang per WU yang disetujui owner, beserta rollback non-destruktif.
- Status `BLOCKED` bila DEC-01..09 belum resolved; **tidak membuat PR** dalam mode ini.

## Fase C — Setelah owner menyetujui WU-00 secara tertulis

1. Agent melindungi salinan kerja tujuh dokumen. Gunakan backup/diff yang tidak menghapus file, bandingkan paket dengan `docs/migration/` yang sudah ada (`diff -u`/`git diff --no-index`), dan dokumentasikan perubahan. Hindari menimpa modifikasi lokal secara membabi buta.
2. Bila perlu dan diizinkan, `git fetch origin`; verifikasi ulang base branch SHA, selisih origin/main dan working tree. Buat branch dari basis yang disetujui tanpa mengubah `main` secara langsung. Waspadai dua worktree lain yang dicatat audit.
3. Salin tujuh dokumen revisi dan agent kit hanya setelah konflik diperiksa; **tidak ada perubahan pada `apps/*`, `packages/*` atau database** selama WU-00.
4. Jalankan pemeriksaan format yang relevan; log baseline `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` sesuai environment aman. Sekali lagi, sebelum `pnpm test` cek guard `vynor_test` (test dapat mengubah seed).
5. Buat `docs/migration/08-migration-execution-log.md` dan `09-regression-test-results.md` dari template saat proses eksekusi dimulai. Isi hasil nyata, termasuk FAIL atau NOT VERIFIED, bukan template PASS.
6. Commit dokumen/rekaman baseline pada branch dan ajukan PR WU-00 ke `main` untuk review. **Owner yang merge**. Sesudah merge WU-00 berstatus DONE, baru buka branch WU-01.

## Fase D — Pola untuk setiap tiket setelah WU-00

```text
INPUT: ticket ID + file ticket, source commit aktual, decision register, dependency merged, DB sandbox yang disetujui.
IMPLEMENT: diff sesuai batas WU, test unit + integrasi + golden path E2E bila relevan.
OUTPUT: kode/dokumen dalam branch, acceptance checklist, hasil tes aktual, runbook rollback, laporan PR.
VERIFY: owner memeriksa semua acceptance + CI; jika gagal, status BLOCKED dengan repro.
```

**Boundary PR:** 05a/05b/05c dan 06a/06b/06c/06d = PR terpisah. Jangan memulai WU-05/06 tanpa regression WU-03.

## Fase E — Gate environment / risiko tinggi

- Sebelum Redis/BullMQ: buktikan AOF/noeviction, fail-closed, readiness, crash recovery, `jobId` valid (`outbox-<eventId>`). Kegagalan Redis dapat menyebabkan gap yang memerlukan rekonsiliasi PostgreSQL outbox.
- Sebelum 05b: bukti pg-boss sudah drain di tiap environment dan `GATE-CUTOVER` disahkan.
- Sebelum 06d / OIDC enforce production: bukti login Supabase live disahkan owner (`GATE-AUTH-LIVE`).
- Sebelum 09: keputusan scanning malware dan integritas tenant jelas.
- Sebelum 05c: persetujuan destruktif/DB, backup, uji restore, dependency review, jendela maintenance.

## Fase F — Format serah terima setiap PR

```md
Ticket: VYN-xx-xx; WU: WU-xx; Mode: IMPLEMENT
Approval: ID/owner/date/evidence
Branch/base SHA/head SHA:
Input diperiksa & diff ringkas:
Output artefak:
Acceptance: PASS / FAIL / NOT VERIFIED (per item)
Verification: command + output + timestamp
Golden path/UI/SQL: evidence path atau alasan N/A
Rollout & rollback teruji: status
Risiko tersisa / blocker:
PR: link, status draft/review, owner sign-off:
```

**Jangan memberikan tanggal/estimasi pasti untuk pekerjaan yang belum dilakukan.** Sediakan status faktual dan dependency berikutnya.
