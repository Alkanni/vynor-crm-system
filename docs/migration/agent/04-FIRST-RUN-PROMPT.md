# 04 — Prompt Pertama untuk AI Agent (SALIN APA ADANYA)

```text
PROJECT: VYNOR CRM TypeScript migration
REPOSITORY_EXPECTED: /home/acgix/vynor-crm
BASELINE_AUDIT_COMMIT: 565e8e4 (snapshot 17 Oktober 2026, bukan HEAD yang dijamin)
TICKET_ID: VYN-00-01
MODE: REVIEW_ONLY
ALLOW_CODE_CHANGES: NO
ALLOW_DB_CHANGES: NO
ALLOW_GIT_COMMIT_OR_BRANCH_CHANGE: NO
ALLOW_PR_OR_MERGE: NO
ALLOW_NETWORK_FETCH: NO (minta izin khusus jika perlu)

Anda adalah AI coding agent senior. Ini hanya tahap pemeriksaan handoff dan kesiapan. Baca:
1. docs/migration/agent/00-START-HERE.md
2. docs/migration/agent/01-DECISION-REGISTER.md
3. docs/migration/agent/02-AGENT-OPERATING-RULES.md
4. docs/migration/agent/03-EXECUTION-RUNBOOK.md
5. docs/migration/01-existing-system-audit.md ... 07-database-migration-plan.md
6. docs/migration/agent/VYNOR_AGENT_TASKS.json
7. docs/migration/agent/tickets/VYN-00-01.md

TUGAS ANDA:
- Konfirmasi folder/repo, remote, HEAD, branch, status Git, dokumen belum commit, serta dua worktree dari audit tanpa mengganggunya.
- Bandingkan konteks audit historis dengan kondisi aktual; jangan berasumsi HEAD audit sama dengan origin/main.
- Identifikasi semua DEC-01..09 yang belum disahkan dan gate tambahan yang tidak bisa dilewati.
- Pemeriksaan non-mutating saja: jangan menjalankan build/test yang mengubah dist/seed; jangan git fetch, pull, reset, clean, commit, atau mengubah konfigurasi.
- Susun rencana aman WU-00: bagaimana mempertahankan dokumen untracked, melakukan diff dengan versi paket revisi, memilih base branch, dan membuat PR dokumen setelah persetujuan.
- Tuliskan input, output, acceptance criteria yang relevan, perintah verifikasi aman, ketidakpastian, dan bagian yang membutuhkan keputusan owner.

FORMAT OUTPUT:
(A) Repo/Git snapshot dan sumber evidence
(B) Delta terhadap audit awal
(C) Decision & approval checklist (PENDING/RESOLVED)
(D) Rencana diff / file yang akan disentuh pada WU-00
(E) Risiko & rollback tanpa perubahan destruktif
(F) Status: READY_FOR_OWNER_APPROVAL atau BLOCKED + alasannya

Jangan lakukan implementasi apa pun dan jangan menandai WU selesai.
```
