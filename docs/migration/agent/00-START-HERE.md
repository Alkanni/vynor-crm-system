# 00 — START HERE: Handoff Migrasi VYNOR CRM

> **Status 2026-10-19:** DEC-01..09 sudah diputuskan owner (lihat `01-DECISION-REGISTER.md`); semua `GATE-*` masih PENDING. WU-00 `DONE` (PR #64 di-merge owner, `07e7748`). WU-01 `DONE` (PR #65 di-merge owner, `aa74590`). WU-02 `DONE` (PR #66 di-merge owner, `f21f012`). WU-03 `DONE` (PR #67 di-merge owner, `69fd238`). WU-04 `IN_PROGRESS` (VYN-04-01..03 `IN_REVIEW`; PR dari branch `feat/wu-04-redis-shared-state` menunggu review dan merge owner). Baca file ini sebelum membuka satu pun tiket.

## Apa yang dikirim

Paket berisi **7 dokumen audit/migrasi yang diperbarui** (`../01-*` s.d. `../07-*`), satu Kanban full vertical slice, **17 WU/PR** dan **39 tiket AI Agent** yang memiliki input, tindakan, output, acceptance criteria, verifikasi dan rollback, serta keputusan owner, protokol AI Agent dan template log. Baseline awal ialah commit `565e8e4` pada 17 Oktober 2026, **bukan** klaim HEAD sekarang. Semua tanggal historis audit dan 176 test dilabel snapshot, bukan verifikasi terbaru.

## Mulai di mana

1. **Owner:** isi `01-DECISION-REGISTER.md` untuk DEC-01..09. Persetujuan WU-00 berbeda dari persetujuan tindakan DB/destruktif. Jika belum disetujui, agent hanya bekerja `REVIEW_ONLY`.
2. **AI Agent:** baca `02-AGENT-OPERATING-RULES.md`, `03-EXECUTION-RUNBOOK.md` dan tujuh dokumen `../01..07` yang relevan; baca `VYNOR_AGENT_TASKS.json` dan `KANBAN_VERTICAL_SLICE_VYNOR.md`.
3. **Pemanggilan pertama:** salin isi `04-FIRST-RUN-PROMPT.md`; set `TICKET_ID: VYN-00-01` dan `MODE: REVIEW_ONLY`. Agent memeriksa keadaan repo dan menyiapkan laporan gerbang keputusan tanpa memodifikasi kode.
4. **Setelah persetujuan tertulis:** gunakan `05-WU00-IMPLEMENT-PROMPT.md`. Jalankan VYN-00-01 lalu VYN-00-02 **pada branch dokumen**; hanya owner yang merge PR WU-00 ke `main`.
5. **Kemudian:** WU-01 health → WU-02 security → WU-03 golden path (WU-02 boleh independen setelah WU-00), baru migrasi Redis/BullMQ/Vite sesuai dependency di board.

## Semua file atau satu file tiket?

**Saat handoff pertama:** berikan **seluruh ZIP**, atau pastikan semua file dalam `docs/migration/` dan `docs/migration/agent/` tersedia langsung lewat workspace/repo agent. _Jangan_ hanya mengirim tujuh dokumen lama, karena input/output dan status tiket ada di `agent/`.

**Setiap sesi berikutnya:** tidak perlu mengunggah ZIP berkali-kali jika agent punya akses repo dan membaca file terbaru. Cukup kirim `TICKET_ID`, `MODE`, branch/base, persetujuan owner, dan minta baca `tickets/<id>.md`; wajib cek kembali file sumber terkait.

**Jika AI Agent tidak dapat membaca repo:** ZIP saja hanya memadai untuk **perencanaan/audit dokumen**, bukan implementasi; agent membutuhkan akses read/write yang tepat ke source code dan fasilitas tes yang aman.

## Peta folder

```text
repo-root/
└── docs/migration/
    ├── 01-existing-system-audit.md
    ├── 02-current-stack-inventory.md
    ├── 03-feature-inventory.md
    ├── 04-architecture-gap-analysis.md
    ├── 05-target-architecture.md
    ├── 06-migration-roadmap.md
    ├── 07-database-migration-plan.md
    ├── 08-migration-execution-log.md   (dibuat di WU-00, append-only)
    ├── 09-regression-test-results.md   (dibuat di WU-00)
    └── agent/
        ├── 00-START-HERE.md
        ├── 01-DECISION-REGISTER.md
        ├── 02-AGENT-OPERATING-RULES.md
        ├── 03-EXECUTION-RUNBOOK.md
        ├── 04-FIRST-RUN-PROMPT.md
        ├── 05-WU00-IMPLEMENT-PROMPT.md
        ├── 06-PACKAGE-INTEGRITY-CHECK.md
        ├── KANBAN_VERTICAL_SLICE_VYNOR.md
        ├── VYNOR_AGENT_TASKS.json
        ├── PROMPT_AI_AGENT.md
        ├── tickets/VYN-*.md  (39 tiket)
        └── templates/08–10  (template untuk diisi saat eksekusi, bukan laporan eksekusi)
```

`README_AGENT_HANDOFF.md` dan `FILE_MANIFEST.json` hanya ada di paket ZIP transfer (17 Oktober 2026) dan sengaja **tidak** di-commit ke repo. Checksum manifest tersebut hanya berlaku untuk isi ZIP; dokumen di repo sudah diedit dan diformat pada WU-00 (lihat `06-PACKAGE-INTEGRITY-CHECK.md`).

## Dokumen mana yang paling penting?

| Kebutuhan                                  | Bacaan utama                              |
| ------------------------------------------ | ----------------------------------------- |
| Mengetahui kondisi asli dan kekurangan     | 01, 02, 03                                |
| Mengetahui alasan pilihan teknologi        | 04, 05                                    |
| Menentukan urutan, approval dan DoD        | 06, Kanban, Decision Register             |
| Memahami keselamatan database dan rollback | 07, Runbook                               |
| Menugaskan agent                           | JSON tasks + file tiket spesifik + prompt |

## Batas keselamatan yang tidak bisa dinegosiasikan

Tidak melakukan `reset --hard`, `clean -fd`, auto merge, tindakan destruktif, force push, tes terhadap database `vynor`/`vynor_crm` atau server production tanpa persetujuan; tidak mencampur queue dan frontend di satu PR; tidak mengaku Supabase live bekerja sebelum diverifikasi; jangan mengira Redis persisten berarti zero-loss. Baca §8 dokumen 07 sebelum mengubah pipeline.
