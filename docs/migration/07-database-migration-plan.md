# 07 — Rencana Migrasi Database

> **Pembaruan rencana eksekusi (17 Oktober 2026):** bagian audit/baseline asli adalah catatan historis pada commit `565e8e4`. Bagian tambahan setelahnya adalah **spesifikasi pelaksanaan yang diusulkan**, bukan bukti bahwa implementasi, keputusan owner, CI, deployment, atau migrasi database baru sudah dilakukan. Baca `agent/00-START-HERE.md` sebelum menugaskan AI Agent.

## 1. Ringkasan

- **Engine tidak berubah.** Sistem sudah memakai PostgreSQL 16 (+pgvector), dan itu memang target. Tidak ada migrasi data antar-engine, sehingga tidak perlu source-to-target mapping atau konversi tipe data.
- **Skema `public` tidak berubah** di semua work unit wajib (WU-01 s.d. WU-08, WU-10, WU-11).
- Perubahan database hanya terjadi di:
  - **WU-05**: schema `pgboss` tidak dipakai lagi; drop-nya opsional dan butuh persetujuan.
  - **WU-09** (opsional): satu kolom additive di `attachments`.
  - **§3.3** (opsional, butuh persetujuan): pengerasan aturan FK.
- Tidak ada database staging atau production yang diketahui. Semua langkah di bawah dijalankan pertama kali di `vynor_test`, lalu di database lain hanya dengan persetujuan.

## 2. Kondisi skema saat ini

| Aspek                     | Kondisi                                                                                                                                                                                                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tabel                     | 19 (IAM: 9, outbox/audit: 2, channel: 4, conversation core: 4)                                                                                                                                                                                                                                                           |
| Migrasi                   | 7, forward-only, terakhir `20260929100000_channels_conversation_core`                                                                                                                                                                                                                                                    |
| Primary key               | CUID (entitas), UUIDv7 (`outbox_events`, `provider_events`, `messages`; dibuat aplikasi)                                                                                                                                                                                                                                 |
| Tenant isolation          | `workspace_id` di setiap tabel domain, FK ke `workspaces`, indeks komposit dengan `workspace_id`                                                                                                                                                                                                                         |
| Unique constraint penting | `provider_events (provider_account_id, provider_event_key)` untuk dedup webhook; `messages (provider_account_id, provider_message_id)` untuk dedup pesan; `contact_identities (provider_account_id, external_id)`; `provider_accounts (workspace_id, channel_type, account_identifier)`; `provider_accounts.webhook_key` |
| Soft delete               | `deleted_at` di `workspaces`, `user_profiles`, `workspace_memberships`, `provider_accounts`, `contacts`, `attachments`                                                                                                                                                                                                   |
| Aturan hapus              | Hampir semua FK `ON DELETE CASCADE`. `SET NULL` untuk `assignee_membership_id`, `sender_membership_id`, `attachments.provider_account_id`.                                                                                                                                                                               |
| SQL manual                | Claim outbox (`FOR UPDATE SKIP LOCKED`), lease recovery, `pg_notify`                                                                                                                                                                                                                                                     |
| Schema lain               | `pgboss` (dikelola pg-boss)                                                                                                                                                                                                                                                                                              |
| Ekstensi                  | `vector`, `uuid-ossp`                                                                                                                                                                                                                                                                                                    |

## 3. Perubahan per work unit

### 3.1 WU-05: schema `pgboss` (expand → contract)

| Tahap | Database                                                         | Persetujuan              |
| ----- | ---------------------------------------------------------------- | ------------------------ |
| 5a    | Schema `pgboss` tetap; job lama dihabiskan oleh consumer drain   | Tercakup roadmap         |
| 5b    | Kode pg-boss dihapus; schema `pgboss` dibiarkan (tidak terpakai) | Tercakup roadmap         |
| 5c    | `DROP SCHEMA pgboss CASCADE`                                     | **Persetujuan terpisah** |

Cek apakah pg-boss sudah kosong (dijalankan di setiap environment sebelum 5b):

```sql
SELECT name, state, count(*)
FROM pgboss.job
WHERE state IN ('created', 'retry', 'active')
GROUP BY name, state;
-- Harus 0 baris sebelum 5b.
```

Prosedur 5c:

1. `pg_dump -Fc -n pgboss <db> > pgboss-<tanggal>.dump`
2. Verifikasi restore ke database sementara: `pg_restore -d <db_sementara> pgboss-<tanggal>.dump`, lalu bandingkan `count(*)` per tabel.
3. `DROP SCHEMA pgboss CASCADE;` (bukan lewat Prisma, karena schema ini tidak dikelola Prisma)
4. Rollback: `pg_restore -d <db> pgboss-<tanggal>.dump`

### 3.2 WU-09 (opsional): menautkan attachment ke pesan

Migrasi additive (expand saja):

```sql
ALTER TABLE "attachments" ADD COLUMN "message_id" TEXT;
ALTER TABLE "attachments"
  ADD CONSTRAINT "attachments_message_id_fkey"
  FOREIGN KEY ("message_id") REFERENCES "messages"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "idx_attachments_message_id" ON "attachments"("message_id");
```

- Tabel `attachments` saat ini **kosong**, jadi `CREATE INDEX` biasa di dalam transaksi Prisma aman. Bila kelak tabel sudah besar, gunakan `CREATE INDEX CONCURRENTLY` di migrasi terpisah tanpa transaksi.
- Konsistensi tenant (`attachments.workspace_id = messages.workspace_id`) dijaga di kode dan diperiksa dengan query validasi di §5.
- **Backfill:** tidak wajib. Backfill best-effort untuk media lama hanya bisa dilakukan bila provider masih menyimpannya; prosesnya non-destruktif (hanya menambah baris).
- **Rollback:** kolom dibiarkan (kode lama tidak membacanya). `DROP COLUMN` hanya dengan persetujuan.

### 3.3 Opsional: pengerasan aturan FK (butuh keputusan owner)

Temuan D-09: satu `DELETE` manual pada `provider_accounts` atau `contacts` menghapus seluruh conversation dan message terkait lewat cascade. Aplikasi sendiri selalu memakai soft-delete.

| FK                                                                                                                                                   | Sekarang | Usulan                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------- |
| `conversations.provider_account_id`, `messages.provider_account_id`, `contact_identities.provider_account_id`, `provider_events.provider_account_id` | CASCADE  | RESTRICT                                                                |
| `conversations.contact_id`, `conversations.contact_identity_id`, `contact_identities.contact_id`                                                     | CASCADE  | RESTRICT                                                                |
| `messages.conversation_id`                                                                                                                           | CASCADE  | RESTRICT                                                                |
| FK ke `workspaces`                                                                                                                                   | CASCADE  | Tetap (penghapusan workspace memang dimaksudkan menghapus semua isinya) |

- Ini **mengubah perilaku**: hard delete yang sebelumnya berhasil akan gagal. Kode aplikasi tidak melakukan hard delete pada tabel-tabel itu, tetapi test cleanup (`packages/database/src/test-utils.ts`) perlu dicek dan mungkin disesuaikan.
- Perubahan constraint mengambil lock `ACCESS EXCLUSIVE` sebentar. Tabel saat ini kecil.
- **Tidak termasuk roadmap default.** Hanya dikerjakan bila owner menyetujuinya, sebagai migrasi terpisah.

## 4. Prosedur standar untuk setiap migrasi skema

1. **Lokal:** `prisma migrate dev` hanya terhadap `vynor_shadow` / `vynor_test`. File migrasi direview manual (tidak ada `DROP`/`TRUNCATE` tanpa persetujuan).
2. **CI:** drift check (`db:migrate:diff`), `migrate deploy` ke DB kosong, `db:verify`, seluruh test.
3. **Sebelum deploy ke database berisi data:**
   - `pg_dump -Fc <db> > backup-<db>-<tanggal>.dump`
   - Uji restore ke database sementara dan bandingkan jumlah baris (query §5.1).
   - Jalankan query validasi §5 dan simpan hasilnya (sebelum).
4. **Deploy:** `pnpm --filter @vynor/database db:migrate:deploy` dengan `DIRECT_URL` (bukan pooler).
5. **Sesudah:** jalankan query §5 lagi dan bandingkan. Jalankan golden path.
6. **Rollback:** Prisma tidak punya down migration. Untuk migrasi additive, rollback = membiarkan kolom atau indeks tidak terpakai dan me-revert kode. Rollback yang menghapus objek atau data memakai SQL yang disiapkan sebelumnya **dan** butuh persetujuan; pilihan terakhir adalah restore dari backup.

### 4.1 Rollback kode WU-05a tanpa mengubah skema

Kalau 5a di-revert setelah sebagian event outbox sudah dikirim ke BullMQ, event yang efeknya belum terjadi dapat dikembalikan ke `PENDING` supaya dispatcher pg-boss memprosesnya. Handler idempoten, jadi event yang ternyata sudah diproses akan menjadi no-op.

```sql
-- :cutover = waktu deploy WU-05a. Jalankan dulu sebagai SELECT untuk melihat dampaknya.
UPDATE outbox_events o
SET status = 'PENDING', processed_at = NULL, dispatched_at = NULL,
    claimed_by = NULL, claim_lease_expires_at = NULL, updated_at = NOW()
WHERE o.status = 'COMPLETED'
  AND o.dispatched_at >= :cutover
  AND (
    (o.event_type = 'message.outbound.requested'
       AND EXISTS (SELECT 1 FROM messages m
                   WHERE m.id = o.payload->>'messageId' AND m.status = 'PENDING'))
    OR
    (o.event_type = 'webhook.received'
       AND EXISTS (SELECT 1 FROM provider_events p
                   WHERE p.id = o.payload->>'providerEventId'
                     AND p.status IN ('RECEIVED', 'PROCESSING')))
  );
```

Ini adalah modifikasi data. Di database selain `vynor_test` hanya dijalankan dengan persetujuan saat itu juga.

## 5. Query validasi dan rekonsiliasi

Dijalankan sebelum dan sesudah setiap migrasi skema dan setiap cutover queue. Hasilnya dicatat di `09-regression-test-results.md`.

### 5.1 Jumlah baris

```sql
SELECT 'workspaces' t, count(*) FROM workspaces UNION ALL
SELECT 'user_profiles', count(*) FROM user_profiles UNION ALL
SELECT 'workspace_memberships', count(*) FROM workspace_memberships UNION ALL
SELECT 'provider_accounts', count(*) FROM provider_accounts UNION ALL
SELECT 'provider_events', count(*) FROM provider_events UNION ALL
SELECT 'contacts', count(*) FROM contacts UNION ALL
SELECT 'contact_identities', count(*) FROM contact_identities UNION ALL
SELECT 'conversations', count(*) FROM conversations UNION ALL
SELECT 'messages', count(*) FROM messages UNION ALL
SELECT 'outbox_events', count(*) FROM outbox_events UNION ALL
SELECT 'audit_logs', count(*) FROM audit_logs UNION ALL
SELECT 'attachments', count(*) FROM attachments;
```

### 5.2 Konsistensi tenant (harus 0)

```sql
SELECT count(*) AS message_conversation_workspace_mismatch
FROM messages m JOIN conversations c ON c.id = m.conversation_id
WHERE m.workspace_id <> c.workspace_id;

SELECT count(*) AS conversation_channel_workspace_mismatch
FROM conversations c JOIN provider_accounts p ON p.id = c.provider_account_id
WHERE c.workspace_id <> p.workspace_id;

SELECT count(*) AS identity_contact_workspace_mismatch
FROM contact_identities i JOIN contacts k ON k.id = i.contact_id
WHERE i.workspace_id <> k.workspace_id;

SELECT count(*) AS conversation_identity_contact_mismatch
FROM conversations c JOIN contact_identities i ON i.id = c.contact_identity_id
WHERE i.contact_id <> c.contact_id;
```

### 5.3 Keadaan pipeline pesan

```sql
SELECT status, count(*) FROM outbox_events GROUP BY status;          -- PENDING/PROCESSING harus mengering
SELECT status, count(*) FROM provider_events GROUP BY status;        -- RECEIVED/PROCESSING harus mengering
SELECT status, count(*) FROM messages
WHERE direction = 'OUTBOUND' AND is_private = false GROUP BY status; -- PENDING tidak menumpuk

-- Pesan ganda per provider (harus 0; dijamin unique constraint, dicek sebagai sanity check)
SELECT provider_account_id, provider_message_id, count(*)
FROM messages WHERE provider_message_id IS NOT NULL
GROUP BY 1, 2 HAVING count(*) > 1;
```

### 5.4 Integritas referensial

Dijamin oleh FK. Sebagai sanity check setelah restore:

```sql
SELECT count(*) FROM messages m LEFT JOIN conversations c ON c.id = m.conversation_id WHERE c.id IS NULL;
SELECT count(*) FROM conversations c LEFT JOIN contacts k ON k.id = c.contact_id WHERE k.id IS NULL;
```

## 6. Aturan database lokal

| Database       | Boleh dipakai untuk                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------ |
| `vynor_test`   | Test otomatis, smoke test, uji migrasi (env file menolak URL lain)                                           |
| `vynor_e2e`    | E2E Playwright (WU-03 dan seterusnya)                                                                        |
| `vynor_shadow` | Shadow database `migrate dev`/`diff`                                                                         |
| `vynor_crm`    | Live run. **Tidak** untuk test atau eksperimen migrasi. Migrasi ke sini hanya dengan persetujuan dan backup. |
| `vynor`        | **Jangan disentuh** (skema parsial, tidak dapat dimigrasi)                                                   |

## 7. Yang sengaja ditunda

| Item                                                                  | Alasan                                                                                                                                         |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Upgrade Prisma 6.4 → 7                                                | Perubahan mayor (generator dan driver adapter). Dijadikan unit tersendiri setelah migrasi utama supaya tidak bercampur dengan perubahan queue. |
| Indeks `pg_trgm` untuk pencarian Inbox                                | Belum ada masalah performa yang terukur                                                                                                        |
| Partisi atau pruning `provider_events`, `outbox_events`, `audit_logs` | Kolom `purge_after` sudah ada; job pruning dibuat setelah BullMQ (queue `maintenance.outbox-prune` sudah didefinisikan)                        |
| Pemakaian pgvector                                                    | Menunggu backend AI Agent                                                                                                                      |

## 8. Runbook gerbang data untuk AI Agent (revisi rencana)

Bagian §1–7 merupakan analisis database hasil audit; perubahan di bawah adalah **kontrol operasional usulan** yang wajib dikaji saat WU terkait. Tidak ada perintah berikut yang menjadi izin melakukan update/delete pada database non-test.

### 8.1 Matriks izin dan jenis operasi

| Operasi                      | `vynor_test` / `vynor_e2e` / `vynor_shadow`                                  | `vynor`, `vynor_crm`, staging, production                                |
| ---------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Query baca/verifikasi        | Boleh sesuai ruang lingkup, gunakan URL terverifikasi                        | Hanya bila akses telah disetujui, baca-only sesuai kebijakan lingkungan  |
| Seed/reset data test         | Boleh bila env guard memeriksa nama DB dan tidak mempengaruhi layanan lain   | **Dilarang otomatis**; persetujuan lingkungan, backup, dan change window |
| Prisma schema `public`       | Hanya WU-09 additive bila disetujui; WU wajib tidak mengubah schema `public` | Persetujuan, backup dan review migrasi per environment                   |
| WU-05a/b cutover antrean     | Boleh di sandbox dengan fixture                                              | `GATE-CUTOVER`, rekonsiliasi, rencana rollback + operator                |
| WU-05c DROP schema pgboss    | Hanya setelah `GATE-DB-DROP` walau DB test                                   | `GATE-DB-DROP` **dan** `GATE-ENV`, backup/restore diuji                  |
| Perubahan aturan foreign key | Di luar scope default, buat tiket terpisah                                   | `GATE-DB-FK` dan `GATE-ENV`                                              |

**Guard wajib sebelum tes:** tampilkan nama host/database efektif dari `DATABASE_URL` dan `DIRECT_URL` tanpa mencetak password. Pastikan keduanya menarget DB sandbox yang benar. Agent tidak boleh menafsirkan nama `.env` sebagai bukti; cek koneksi aktual, identitas database, dan log verifikasi.

### 8.2 Rekonsiliasi Redis/BullMQ pasca kegagalan

AOF `everysec` mengurangi risiko kehilangan data Redis, bukan menghapusnya. Contoh kesenjangan: transaksi outbox selesai, dispatcher berhasil memasukkan job, lalu menandai event `COMPLETED`; Redis rollback AOF setelah crash dan job hilang. Karena itu **status outbox `COMPLETED` saja bukan bukti efek domain telah terjadi**, dan jobId yang telah dihapus oleh retensi tidak lagi menjadi penahan duplikasi.

Runbook WU-05a harus mencakup:

1. Bekukan/berhentikan produser sesuai runbook di lingkungan yang memang diotorisasi; ambil snapshot read-only outbox event, `provider_events`, `messages` dan metrik antrean yang ada.
2. Klasifikasikan setiap kandidat: **efek domain sudah terjadi**, **belum terjadi**, atau **tidak dapat ditentukan** (misalnya provider menerima send tetapi respons hilang). Kandidat kategori ketiga memerlukan review operator, bukan replay otomatis.
3. Untuk replay, rumuskan daftar ID event yang akan dikembalikan ke `PENDING` dan bukti kenapa aman; jalankan `SELECT` simulasi dulu. `UPDATE` pada §4.1 hanya dijalankan di sandbox otomatis, atau setelah approval khusus di environment lain.
4. Uji crash: setelah `Queue.add` sebelum mark `COMPLETED`, setelah send sebelum ACK provider, Redis restart/outage, worker shutdown dengan active job. Hasilnya dicatat termasuk sisa risiko pengiriman ganda eksternal.
5. Simpan output query sebelum/sesudah serta keputusan operator dalam 08/09. Jangan menyebut delivery exactly-once tanpa bukti protokol provider yang mendukungnya.

### 8.3 Gerbang drain sebelum WU-05b dan persetujuan 05c

Query `pgboss.job` §3.1 menghitung `created`/`retry`/`active`; lakukan pengecekan di **setiap environment yang disetujui** dan catat snapshot waktu serta versi worker. Jangan menyimpulkan antrean telah aman hanya karena `0` pada satu pengambilan jika produser lama masih dapat mengirim job baru. Validasi produser legacy sudah dinonaktifkan, lalu lakukan observasi periode yang disepakati owner dan periksa in-flight.

Sebelum 05c, identifikasi dependency objek luar schema yang terancam `DROP SCHEMA ... CASCADE`, arsipkan output dan verifikasi dump restore di database sementara. Perubahan destruktif tidak pernah otomatis menjadi bagian dari WU-05b atau approval roadmap global.

### 8.4 WU-09 media dan ketepatan workspace

`attachments.message_id` tetap nullable sebagai migrasi additive. Bila WU-09 dipilih, relasi `attachments.workspace_id = messages.workspace_id` harus ditangani oleh service dan dibuktikan dengan query validasi berikut:

```sql
SELECT count(*) AS attachment_message_workspace_mismatch
FROM attachments a
JOIN messages m ON m.id = a.message_id
WHERE a.message_id IS NOT NULL AND a.workspace_id <> m.workspace_id;
-- Acceptance: 0.
```

Membaca file dari provider yang tidak dipercaya memerlukan pemeriksaan MIME nyata, batas ukuran/timeout, kebijakan scan/quarantine yang disetujui, dan validasi path/object key. Jangan menandai file tanpa scan sebagai `CLEAN` kecuali kebijakan exception formal disetujui owner/security dan risikonya didokumentasikan.

### 8.5 Bukti minimum di setiap PR yang menyentuh pipeline/data

- Environment alias tanpa secret, Git SHA, timestamp, database guard hasil PASS.
- Hasil query §5 (jumlah baris, tenant mismatch, status outbox/provider, duplicate, FK sanity), dengan penyimpanan artefak yang aman dan tanpa PII.
- Kesesuaian fixture test, versi Redis/BullMQ yang aktual, hasil fault injection atau alasan mengapa belum bisa diuji.
- Pernyataan eksplisit `NO PUBLIC SCHEMA CHANGE` untuk WU wajib; untuk WU-09 tampilkan SQL migration additive yang di-review.
- Rollback dan perintah yang **belum** dijalankan diberi label `PROPOSED`, bukan `DONE`.

**Tiket terkait:** `VYN-05A-01..03`, `VYN-05B-01..02`, `VYN-05C-01`, `VYN-09-01..02`; rujukan lengkap di `agent/VYNOR_AGENT_TASKS.json`.
