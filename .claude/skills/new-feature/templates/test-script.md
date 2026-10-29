# Test script: <versi> — <nama perubahan>

| | |
| --- | --- |
| Requirement | <REQ-ID, REQ-ID> ([PRD.md](../PRD.md)) |
| Impact analysis | [changes/<slug>.md](../changes/<slug>.md) |
| Lingkungan | <Dev lokal / UAT>, build <commit atau versi> |
| Penguji | <nama> |
| Tanggal eksekusi | <YYYY-MM-DD> |

## Data uji

| Akun / data | Nilai | Sumber |
| --- | --- | --- |
| Admin | akun seed admin | `apps/ej-api/src/seed.ts` |
| Monitoring | <dibuat lewat Create User> | TC sebelumnya |
| Vendor | <dibuat lewat Create User> | TC sebelumnya |
| File EJ | file EJ contoh | `apps/ej-api/data/ej/` atau Upload EJ |

## Test case

| ID | Requirement | Role | Judul | Prasyarat | Langkah | Data uji | Hasil yang diharapkan | Hasil aktual | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TC-<MODUL>-<NNN> | REQ-<MODUL>-<NNN> | admin | <positif: ...> | <login sebagai ...> | 1. ...<br>2. ... | ... | ... | | Belum dijalankan |
| TC-<MODUL>-<NNN> | REQ-<MODUL>-<NNN> | vendor | <negatif: ...> | ... | ... | ... | Menu tidak tampil; API menjawab 403 | | Belum dijalankan |

Status: `Belum dijalankan`, `Pass`, `Fail` (isi nomor defect), `Blocked` (isi alasan).

## Ringkasan eksekusi

| Total | Pass | Fail | Blocked | Belum dijalankan |
| --- | --- | --- | --- | --- |
| <n> | | | | <n> |

## Defect

| ID defect | TC | Ringkasan | Severity | Status |
| --- | --- | --- | --- | --- |
