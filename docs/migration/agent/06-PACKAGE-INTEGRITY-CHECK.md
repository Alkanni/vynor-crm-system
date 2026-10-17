# 06 — Pemeriksaan Integritas Paket (bisa dijalankan secara read-only)

Paket ZIP memiliki `FILE_MANIFEST.json` di root ekstraksi (satu tingkat di atas `docs/`). Setiap path dan hash SHA-256 di manifest harus cocok setelah transfer.

> **Batas berlaku (2026-10-17):** manifest dan `README_AGENT_HANDOFF.md` **tidak** di-commit ke repo. Checksum-nya hanya berlaku untuk isi ZIP asli, **bukan** untuk `docs/migration/` di repo, karena pada WU-00 register keputusan diisi, inkonsistensi dokumen diperbaiki, dan semua file diformat Prettier. Di repo, gunakan riwayat Git sebagai bukti integritas; jangan menjalankan skrip di bawah dari root repo.

```bash
# Jalankan dari direktori ekstraksi yang memuat FILE_MANIFEST.json
python - <<'PY_CHECK'
import json, hashlib, pathlib
r=pathlib.Path('.')
d=json.loads((r/'FILE_MANIFEST.json').read_text(encoding='utf-8'))
for f in d['files']:
    p=r/f['path']
    assert p.is_file(), f'Missing: {p}'
    assert hashlib.sha256(p.read_bytes()).hexdigest()==f['sha256'], f'Changed: {p}'
print('VERIFIED', len(d['files']), 'files')
PY_CHECK
```

Pemeriksaan struktural tambahan: semua file `docs/migration/01-*` s.d. `07-*` ada dan bukan kosong; `VYNOR_AGENT_TASKS.json` mempunyai 17 work unit dan 39 task unik; masing-masing task memiliki `inputs/actions/outputs/acceptance_criteria/verification`; 39 file tiket memiliki ID yang sama; semua status `WAITING_APPROVAL`, `BLOCKED_DEPENDENCY`, `DEFERRED_APPROVAL` atau `DEFERRED_OPTIONAL` sampai owner menyetujui perubahan (sejak 2026-10-17 WU-00 boleh berstatus `IN_PROGRESS` atau `IN_REVIEW`, dan tiket WU-00 boleh `IN_PROGRESS`, `IN_REVIEW`, atau `DONE` sesuai keputusan owner). **Pemeriksaan paket tidak membuktikan kode berjalan**; hanya membuktikan isi dokumen yang ditransfer belum berubah.
