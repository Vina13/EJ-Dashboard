# ADR-0001: SQLite lokal (on-premise) lewat `node:sqlite`

**Status:** Accepted
**Date:** 2026-10-24
**Deciders:** Vina (QA owner), Dev lead, PM

## Context

EJ Dashboard menyimpan akun user, dan nantinya file EJ, transaksi hasil parsing, serta status mesin. Data EJ adalah data transaksi ATM/CRM milik bank klien, sehingga harus tetap berada di Server EJ Dashboard (on-premise). Volume v1 diperkirakan ≤ 2.000 file EJ per hari dengan ≤ 50 pengguna bersamaan, dan hanya ada satu server aplikasi. Alur kerja tim menyarankan Supabase, tetapi user memutuskan tetap memakai SQLite lokal.

## Decision

Pakai satu file SQLite (`apps/ej-api/data/ej-dashboard.db`) melalui modul bawaan Node.js `node:sqlite` (Node 24). Skema dibuat dan dimigrasi oleh `ej-api` saat start. File database tidak masuk git.

## Options Considered

### Option A: SQLite lewat `node:sqlite` (dipilih)
| Dimension | Assessment |
| --- | --- |
| Complexity | Low: tanpa server database, tanpa paket native |
| Cost | Nol |
| Scalability | Cukup untuk satu server dan satu proses penulis |
| Team familiarity | Tinggi (SQL standar) |

**Pros:** data tetap on-premise; instalasi cukup `npm install`; test memakai `:memory:` sehingga cepat dan terisolasi.
**Cons:** satu penulis dalam satu waktu; `node:sqlite` masih ditandai experimental di Node; tidak cocok untuk banyak server.

### Option B: Supabase (PostgreSQL di cloud)
| Dimension | Assessment |
| --- | --- |
| Complexity | Medium: akun, project, kredensial, jaringan keluar |
| Cost | Gratis untuk kecil, berbayar untuk produksi |
| Scalability | Tinggi |
| Team familiarity | Sedang |

**Pros:** dashboard admin, backup terkelola, ada Supabase MCP.
**Cons:** data transaksi bank keluar ke cloud pihak ketiga, perlu persetujuan compliance klien; butuh akses internet dari server klien.

### Option C: PostgreSQL on-premise
**Pros:** banyak penulis, siap multi-server, data tetap on-premise.
**Cons:** perlu instalasi dan pemeliharaan server database; berlebihan untuk volume v1.

## Trade-off Analysis

Faktor penentu adalah lokasi data dan kesederhanaan operasi. SQLite memenuhi keduanya untuk v1. Batas utamanya (satu penulis) tidak bermasalah selama ingest/parse dan API berjalan di satu server dan transaksi ditulis dalam batch.

## Consequences

- Lebih mudah: setup lokal, test cepat, backup cukup menyalin file.
- Lebih sulit: menjalankan lebih dari satu instance `ej-api`; query analitik berat di data bulanan.
- Perlu ditinjau ulang: jika volume melebihi asumsi atau aplikasi dijalankan di lebih dari satu server → pindah ke PostgreSQL on-premise (Option C).

## Action Items

1. [x] Skema `users` dan migrasi otomatis di `apps/ej-api/src/db.ts`
2. [ ] Aktifkan `PRAGMA journal_mode = WAL` saat tabel EJ ditambahkan
3. [ ] Job backup harian dengan `VACUUM INTO`
