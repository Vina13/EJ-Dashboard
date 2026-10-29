# System Design: EJ Dashboard

Status: Baseline v1.0.0 (dikunci), 27 Oktober 2026 · git tag `ej-dashboard-v1.0.0` · Requirement: [PRD.md](PRD.md) · Keputusan: [adr/](adr/)

Dokumen ini menjelaskan dua hal: **apa yang sudah dibangun** di repo ini (login, User Management, dan semua menu EJ yang membaca file EJ di server) dan **desain target** untuk bagian yang belum ada (ambil EJ via SFTP, parser format vendor, tabel transaksi), sesuai FSD Gambar 3.1.

## 1. Requirements ringkas

**Fungsional** (detail di PRD): login dan logout, akses menu per role (admin, monitoring, vendor), User Management (admin), ATM List + EJ Preview, Daily Report & Performance, Merge EJ, EJ Parsing, Upload EJ.

**Non-fungsional**

| Aspek | Target | Catatan |
| --- | --- | --- |
| Pengguna bersamaan | ≤ 50 | Asumsi: tim monitoring satu bank |
| Jumlah mesin | ≤ 2.000 ATM/CRM | Asumsi, perlu dikonfirmasi klien |
| Volume EJ | ≤ 2.000 file/hari, ≤ 5 MB per file | Asumsi, menunggu contoh file asli |
| Keterlambatan data | ≤ 15 menit dari file masuk ke dashboard | PRD goal 2 |
| EJ Preview | ≤ 3 detik (p95) | PRD goal 3 |
| Ketersediaan | Jam kerja, satu server | Tidak perlu high availability di v1 |
| Lokasi data | On-premise di Server EJ Dashboard | Data transaksi bank tidak keluar ke cloud ([ADR-0001](adr/0001-sqlite-on-premise.md)) |

**Batasan:** tim kecil (QA + developer), stack TypeScript yang sudah ada di monorepo, database SQLite lokal (keputusan user), repository resmi dari developer belum tersedia.

## 2. Arsitektur

```
 ┌──────────────────────┐      SFTP :22      ┌──────────┐      SFTP :22      ┌──────────────────────────────────────────────┐
 │ Server Sumber EJ      │ ◀───────────────── │ FIREWALL │ ◀───────────────── │ Server EJ Dashboard                          │
 │ Source EJ ATM & CRM   │   file EJ (.jrn)   └──────────┘   (pull terjadwal)  │                                              │
 └──────────────────────┘                                                     │  ej-ingest (target) ──▶ ej-parse (target)    │
                                                                              │        │ file mentah          │ transaksi    │
                                                                              │        ▼                      ▼              │
                                                                              │  data/ej/<terminal>/<tgl>   SQLite            │
                                                                              │                     ej-dashboard.db          │
                                                                              │                       ▲          ▲  read-only │
                                                                              │   ej-api (Express) ───┘          └── ej-mcp   │
                                                                              │        ▲ /api (cookie session)                │
                                                                              │   ej-web (React, Vite)                       │
                                                                              └───────────────▲──────────────────────────────┘
                                                                                              │ HTTPS
                                                                                     Browser petugas / admin
```

Arah tarikan: Server EJ Dashboard yang **menarik** file dari Sumber EJ ([ADR-0005](adr/0005-sftp-pull-ingestion.md)). Firewall cukup membuka port 22 dari Server EJ Dashboard ke Sumber EJ.

### Komponen

| Komponen | Lokasi | Tanggung jawab | Status |
| --- | --- | --- | --- |
| `ej-web` | `apps/ej-web` | UI React: login, menu, halaman. Memanggil `/api` lewat proxy (same-origin) | Ada |
| `ej-api` | `apps/ej-api` | REST API, autentikasi, User Management, akses SQLite, menu EJ dari file EJ di `data/ej/<terminal>/<tgl>/` (`ejStore.ts`) | Ada |
| `ej-mcp` | `apps/ej-mcp` | MCP server read-only agar Claude bisa membaca user, mesin, laporan, EJ preview ([ADR-0006](adr/0006-read-only-mcp-server.md)) | Ada |
| `shared` | `packages/shared` | Tipe, validasi input, data contoh EJ yang dipakai web, api dan mcp | Ada |
| `ej-ingest` | belum ada | Job terjadwal: tarik file EJ baru via SFTP, simpan file mentah | Target |
| `ej-parse` | `parseEj` di `packages/shared/src/ejData.ts` | Ubah file EJ menjadi baris transaksi. Sekarang dijalankan saat dibaca (on read) dan memakai format contoh; tabel `ej_transactions` dan status mesin terhitung masih target | Sebagian |

## 3. Data model

### Sudah ada

```sql
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,          -- disimpan lowercase
  role          TEXT NOT NULL CHECK (role IN ('admin', 'monitoring', 'vendor')),
  password_hash TEXT NOT NULL,                 -- scrypt "salt:hash"
  created_at    TEXT NOT NULL,                 -- ISO 8601 UTC
  updated_at    TEXT NOT NULL
);
```

CREATE TABLE machines (
  terminal_id TEXT PRIMARY KEY,                -- mis. S1A0101
  location    TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('ATM', 'CRM')),
  status      TEXT NOT NULL CHECK (status IN ('Online', 'Offline', 'Problem'))  -- diisi manual di v1.0.0
);
```

Skema dibuat dan dimigrasi saat `ej-api` start (`apps/ej-api/src/db.ts`). Contoh: role `operator` lama dimigrasi otomatis menjadi `monitoring`, dan constraint role diperluas dengan `vendor` (FSD 29 Oktober 2026).

File EJ mentah disimpan di disk, bukan di database: `data/ej/<terminal>/<YYYY-MM-DD>/<nama file>` (`apps/ej-api/src/ejStore.ts`). File tidak pernah ditimpa. Waktu EJ terakhir, transaksi dan Daily Report dihitung dari file itu setiap kali dibaca (`parseEj`). Di luar production, mesin contoh dan file EJ contoh 20–24 Oktober 2026 dibuat saat start jika masih kosong (`sampleEj.ts`).

### Target (untuk REQ-INGEST, REQ-PARSE, REQ-HOME, REQ-RPT)

```sql
ALTER TABLE machines ADD COLUMN last_ej_at TEXT;  -- waktu record EJ terakhir; status dihitung, kolom status dihapus

CREATE TABLE ej_files (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  terminal_id  TEXT NOT NULL REFERENCES machines(terminal_id),
  ej_date      TEXT NOT NULL,                  -- YYYY-MM-DD
  path         TEXT NOT NULL,                  -- data/ej/<terminal>/<tgl>/<nama file>
  sha256       TEXT NOT NULL UNIQUE,           -- file sama tidak diproses dua kali
  source       TEXT NOT NULL CHECK (source IN ('sftp', 'upload')),
  status       TEXT NOT NULL CHECK (status IN ('received', 'parsed', 'failed')),
  error        TEXT,
  received_at  TEXT NOT NULL
);

CREATE TABLE ej_transactions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ej_file_id   INTEGER NOT NULL REFERENCES ej_files(id) ON DELETE CASCADE,
  terminal_id  TEXT NOT NULL,
  occurred_at  TEXT NOT NULL,
  kind         TEXT NOT NULL,                  -- tarik tunai, setor tunai, cek saldo, ...
  amount       INTEGER,                        -- rupiah, NULL jika tidak ada nominal
  response_code TEXT NOT NULL                  -- '00' = sukses
);
CREATE INDEX ej_transactions_by_terminal_time ON ej_transactions (terminal_id, occurred_at);
```

Status mesin (Online/Offline/Problem) **dihitung**, tidak disimpan: Offline jika `last_ej_at` lebih tua dari ambang waktu, Problem jika rasio gagal di atas ambang. Ambang menunggu definisi bisnis (PRD open question).

## 4. API

Semua respons memakai bentuk `{ ok: true, data } | { ok: false, error }` dari `@repo/shared`.

| Method | Path | Auth | Fungsi | Requirement | Status |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/auth/login` | — | Login, set cookie `ej_session` | REQ-AUTH-001..003 | Ada |
| POST | `/api/auth/logout` | — | Hapus cookie | REQ-AUTH-004 | Ada |
| GET | `/api/auth/me` | login | User saat ini | REQ-AUTH-005 | Ada |
| GET | `/api/users` | admin | Daftar user | REQ-USER-001 | Ada |
| GET | `/api/users/:id` | admin | Satu user | REQ-USER-001 | Ada |
| POST | `/api/users` | admin | Create User | REQ-USER-002 | Ada |
| PUT | `/api/users/:id` | admin | Edit User | REQ-USER-003 | Ada |
| DELETE | `/api/users/:id` | admin | Delete User | REQ-USER-004 | Ada |
| GET | `/api/machines` | login | ATM List dengan status (tabel `machines`) dan EJ terakhir | REQ-HOME-001 | Ada |
| GET | `/api/machines/:terminalId/ej?date=` | login | EJ Preview; tanpa `date` = hari terakhir yang punya EJ | REQ-HOME-002 | Ada |
| GET | `/api/reports/daily?date=` | admin | Daily Report & Performance dari EJ yang di-parsing | REQ-RPT-001, 002 | Ada |
| POST | `/api/ej/merge` | login | Gabung EJ satu terminal untuk rentang tanggal (maks. 31 hari), hasil file unduhan `text/plain` | REQ-MERGE-001 | Ada |
| POST | `/api/ej/upload` | admin | Upload file EJ manual: body `application/octet-stream` (maks. 5 MB), `?terminalId=&date=&fileName=`; tidak menimpa file yang sudah ada (409) | REQ-UPLOAD-001 | Ada |
| GET | `/api/ej/transactions?date=&terminalId=` | login | EJ Parsing: transaksi hasil parsing satu hari | REQ-PARSE-001 | Ada |

Kolom Auth mengikuti FSD Tabel 6.1 (`MENU_ACCESS` di `packages/shared/src/ej.ts`): "login" berarti semua role (`admin`, `monitoring`, `vendor`).

Kode status: 400 input tidak valid, 401 belum login atau idle lebih dari 10 menit, 403 role tidak punya akses ke menu itu, 404 tidak ditemukan, 409 email sudah terdaftar, 429 terlalu banyak percobaan login.

## 5. Alur penting

**Login (flowchart Gambar 3.2):** `ej-web` kirim email + password → `ej-api` validasi format (400) → cek rate limit (429) → cari user dan bandingkan scrypt hash, selalu dengan waktu yang sama walau email tidak ada → gagal: 401, UI tetap di form login → sukses: cookie httpOnly berisi token HMAC yang habis setelah 10 menit tanpa request ([ADR-0002](adr/0002-signed-cookie-session.md), amandemen 2026-10-29), UI pindah ke Daily Report untuk admin atau ke Home untuk monitoring dan vendor.

**Ambil dan parsing EJ (target):**
1. `ej-ingest` berjalan tiap 5 menit, daftar file baru di folder SFTP Sumber EJ.
2. Unduh ke `data/ej/<terminal>/<tgl>/`, hitung SHA-256. Hash yang sudah ada dilewati, jadi job aman diulang (idempotent).
3. Catat di `ej_files` dengan status `received`.
4. `ej-parse` membaca file `received`, menulis `ej_transactions` dalam satu transaksi SQLite, lalu set `parsed`. Jika gagal: `failed` + pesan error; file mentah tetap disimpan untuk diproses ulang.
5. Upload EJ manual masuk ke langkah 3 dengan `source = 'upload'`.

**Retry:** koneksi SFTP gagal → coba lagi di jadwal berikutnya; tiga kali berturut-turut gagal → log error (dan nanti notifikasi, REQ-NOTIF-001).

## 6. Keamanan

- Password: scrypt dengan salt acak; hash tidak pernah dikirim ke browser atau MCP.
- Session: cookie `httpOnly`, `SameSite=Lax`, `Secure` di production; token ditandatangani `AUTH_SECRET`; habis setelah 10 menit tanpa request, diperpanjang setiap request (FSD 6.2.4).
- Rate limit login per email + IP (5 kali / 15 menit).
- Otorisasi per menu sesuai FSD Tabel 6.1: Daily Report dan User Management hanya admin; Home dan Merge EJ semua role. Menu tersembunyi di sidebar dan API menjawab 403; admin tidak bisa menghapus atau menurunkan role dirinya sendiri.
- Akun SFTP: read-only di Sumber EJ, kredensial di `.env` server, tidak di repo.
- MCP server membuka database dalam mode read-only.

## 7. Skala dan keandalan

Dengan asumsi di atas: ±2.000 file × ±500 transaksi = ±1 juta baris per hari, ±30 juta baris per bulan. SQLite dengan index `(terminal_id, occurred_at)` masih memadai untuk query per mesin dan per hari, selama hanya satu proses yang menulis ([ADR-0001](adr/0001-sqlite-on-premise.md)).

- Penulisan: hanya `ej-ingest`/`ej-parse` dan `ej-api` (user). Aktifkan `PRAGMA journal_mode = WAL` saat tabel EJ ditambahkan, agar baca tidak terblokir saat parsing.
- Laporan harian: hitung agregat per hari setelah parsing selesai (tabel ringkasan), bukan menghitung ulang jutaan baris tiap kali halaman dibuka.
- Backup: salin file `.db` harian (SQLite `VACUUM INTO`) dan simpan file EJ mentah sesuai kebijakan retensi.
- Monitoring: endpoint `GET /health`; log jumlah file diterima, diparsing dan gagal per run.

## 8. Trade-off

| Keputusan | Dipilih | Alternatif | Alasan | Biaya |
| --- | --- | --- | --- | --- |
| Database | SQLite lokal | PostgreSQL, Supabase | Data tetap on-premise, tanpa server DB tambahan, cukup untuk volume v1 | Satu penulis saja; pindah DB jika multi-server |
| Session | Cookie bertanda tangan HMAC | Session di DB, JWT di localStorage | Sederhana, tidak bisa dibaca JavaScript | Tidak bisa mencabut satu session sebelum kedaluwarsa |
| Pengambilan EJ | Pull via SFTP terjadwal | Sumber EJ push ke dashboard | Firewall hanya perlu satu arah; Sumber EJ tidak perlu diubah | Keterlambatan hingga interval job |
| Routing UI | Hash route (`#/menu`) | React Router + history API | Tanpa dependensi, reload tetap di menu yang sama | URL kurang rapi |
| Struktur kode | Workspace terpisah `ej-*` | Menyatu dengan `apps/api` dan `apps/web` | Aplikasi demo yang ada tidak terganggu | Ada duplikasi kode auth |

## 9. Yang perlu ditinjau ulang saat sistem tumbuh

- Lebih dari satu server aplikasi atau penulis bersamaan → pindah ke PostgreSQL on-premise.
- Rate limit dan data session di memori → simpan di DB/Redis jika ada lebih dari satu instance.
- Kode auth terduplikasi di `apps/api` dan `apps/ej-api` → pindahkan ke paket bersama jika keduanya tetap dipakai.
- Data contoh di `packages/shared/src/ejSample.ts` masih dipakai `ej-mcp` dan seed mesin → hapus setelah MCP membaca file EJ yang sama dengan `ej-api` dan mesin diisi dari sumber asli.
- Parsing saat dibaca (on read) → pindah ke tabel `ej_transactions` saat volume file asli membuat halaman lambat.
