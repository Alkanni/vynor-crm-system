# 05 — Prompt Implementasi Pertama (HANYA SETELAH APPROVAL)

```text
PROJECT: VYNOR CRM migration
TICKET_ID: VYN-00-01
MODE: IMPLEMENT
BASE_BRANCH: [isi base SHA/branch hasil REVIEW_ONLY]
APPROVAL_EVIDENCE: [tautan/catatan keputusan tertulis owner atas DEC-01..DEC-09 dan WU-00]
REPOSITORY: /home/acgix/vynor-crm
TARGET_BRANCH: docs/migration-plan (atau nama yang disetujui owner)

Baca ulang agent/00-START-HERE.md, 01-DECISION-REGISTER.md, 02-AGENT-OPERATING-RULES.md, 03-EXECUTION-RUNBOOK.md, tickets/VYN-00-01.md, dan docs/migration/01..07.

Jangan melanjutkan bila salah satu DEC-01..09 belum diselesaikan secara eksplisit. DEC-07 boleh diputuskan DEFER sehingga WU-09 tidak aktif. Verifikasi Git lagi sebelum apa pun. Lindungi tujuh dokumen untracked yang ada; jangan overwrite tanpa diff/backup. Jangan ubah apps/*, packages/* atau database pada ticket ini.

Implementasikan HANYA tugas VYN-00-01: dokumentasi keputusan, preservasi berkas, branch WU-00 yang aman, serta bukti state Git dan rencana diff.

Hasil akhir wajib: input yang diverifikasi, perubahan aktual, file list, acceptance PASS/FAIL dengan bukti, rollback dan status untuk review. Jangan commit otomatis ke main, jangan merge. Setelah tiket selesai, TUNGGU perintah baru untuk VYN-00-02. Jika ada blocker, STOP dan laporkan.
```
