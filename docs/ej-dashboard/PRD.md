# PRD: EJ Dashboard

| | |
| --- | --- |
| Produk | EJ Dashboard (Daily Report & Performance ATM/CRM) |
| Sumber | **FSD EJ Dashboard (versi 29 Oktober 2026) adalah acuan.** Tabel 6.1 Authorization, 6.2 Proposed Solutions, 7.1 Requirement, Gambar 3.1–3.8. Jika PRD dan FSD berbeda, ikuti FSD dan catat di [Perubahan v1.1](#perubahan-v11) |
| QA owner | Vina |
| Proses | SDLC lihat [testing-strategy.md](testing-strategy.md) dan [design.md](design.md) |
| Status | **Draft v1.1**, 29 Oktober 2026, diselaraskan dengan FSD. Baseline v1.0.0 tetap di git tag `ej-dashboard-v1.0.0`. Rencana perubahan kode: [changes/v1.1-fsd-alignment.md](changes/v1.1-fsd-alignment.md) |

## Perubahan v1.1

Diselaraskan dengan FSD 29 Oktober 2026. Role, akses menu, halaman awal dan idle timeout sudah diterapkan di kode (29 Oktober 2026). Yang belum: lihat kolom Status di bagian 6.

| Area | Baseline v1.0.0 | v1.1 (sesuai FSD) | Requirement |
| --- | --- | --- | --- |
| Role | `admin`, `monitoring` | `admin`, `monitoring`, `vendor` (User Vendor) | REQ-USER-002 |
| Akses Daily Report & Performance | Semua role | Hanya `admin` | REQ-AUTH-007, REQ-RPT-001 |
| Akses menu Users | Semua role melihat daftar user | Hanya `admin` (Create, View, Update, Delete) | REQ-USER-001, REQ-USER-005 |
| Halaman setelah login | Daily Report untuk semua | `admin` ke Daily Report; `monitoring` dan `vendor` ke Home | REQ-AUTH-001 |
| Session | Habis 1 jam setelah login | Habis setelah 10 menit tanpa aktivitas | REQ-AUTH-004 |
| Merge EJ | File gabungan diunduh | Hasil merge ditampilkan di layar (unduh tetap ada) | REQ-MERGE-002 |
| Periode laporan | Hari terakhir yang punya file EJ | H+2 | REQ-RPT-004 |
| Audit trail | P2 | P0 | REQ-AUDIT-001 |
| Validasi input | Per field | Karakter terlarang sesuai FSD 6.2.3 | REQ-VALID-001 |
| Menu EJ Parsing | Halaman ada, belum di menu | Menu EJ Parsing sesuai flowchart Gambar 3.6 ([FSD addendum](fsd/FSD-addendum-ej-parsing.md)) | REQ-PARSE-002 |

## 1. Problem statement

Tim operasional bank memantau Electronic Journal (EJ) dari tiap mesin, data EJ tersimpan sebagai file teks di Server yang khusus menyediakan EJ, sehingga untuk tahu kondisi mesin dan jumlah transaksi harian, petugas harus membuka file EJ satu per satu. Akibatnya masalah mesin (offline, transaksi gagal) terlambat diketahui, dan laporan harian disusun manual.

EJ Dashboard mengambil data EJ ATM dan CRM yang ditarik IM-DISTRO (FSD bab 2), lalu menampilkannya sebagai daftar mesin, preview EJ, dan laporan Daily Report & Performance dalam satu aplikasi web dengan login.

## 2. Goals

1. **Laporan harian tanpa kerja manual:** Daily Report & Performance periode H+2 tersedia untuk semua mesin setiap hari, tanpa petugas membuka file EJ.
2. **Masalah mesin terlihat cepat:** mesin Offline atau Problem terlihat di Home paling lambat 15 menit setelah file EJ terbaru masuk.
3. **EJ satu mesin bisa dilihat dalam hitungan detik:** EJ Preview satu mesin terbuka dalam ≤ 3 detik dari ATM List.
4. **Akses terkontrol:** hanya user terdaftar yang bisa masuk, setiap role hanya melihat menu yang menjadi haknya (FSD Tabel 6.1), dan semua perubahan data tercatat di audit trail.

## 3. Non-goals

| Di luar scope v1 | Alasan |
| --- | --- |
| Mengubah atau mengirim perintah ke mesin ATM/CRM | EJ Dashboard hanya membaca data (monitoring), bukan alat kendali mesin. |
| Rekonsiliasi transaksi dengan core banking | Butuh integrasi dan persetujuan terpisah; inisiatif lain. |
| Notifikasi otomatis (email/WhatsApp) saat mesin bermasalah | Berguna, tetapi dashboard harus stabil dulu; dicatat sebagai P2. |
| Login SSO / Active Directory | v1 memakai akun lokal; SSO dicatat sebagai P2. |
| Aplikasi mobile | Pengguna bekerja dari PC kantor; web responsif sudah cukup. |

## 4. Pengguna dan role

Sesuai FSD Tabel 6.1 Authorization.

| Role | Nama di FSD | Siapa | Menu |
| --- | --- | --- | --- |
| `admin` | Administrator | Supervisor / tim IT aplikasi | Daily Report & Performance (View), Home (View), Merge EJ (View), Users (Create, View, Update, Delete) |
| `monitoring` | User Monitoring | Petugas monitoring ATM/CRM | Home (View), Merge EJ (View) |
| `vendor` | User Vendor | Petugas vendor mesin ATM/CRM | Home (View), Merge EJ (View) |

Akses menu EJ Parsing dan Upload EJ belum ada di Tabel 6.1; usulan barisnya ada di [FSD addendum EJ Parsing](fsd/FSD-addendum-ej-parsing.md). Sampai FSD diperbarui, EJ Parsing (View) terbuka untuk semua role dan Upload EJ hanya untuk `admin`.

## 5. User stories

**Petugas monitoring dan vendor**
- Sebagai petugas monitoring atau vendor, saya ingin langsung melihat Home setelah login, agar daftar mesin dan statusnya langsung terlihat.
- Sebagai petugas monitoring atau vendor, saya ingin melihat daftar ATM/CRM beserta statusnya, agar mesin yang Offline atau Problem cepat diketahui.
- Sebagai petugas monitoring atau vendor, saya ingin membuka EJ Preview satu mesin, agar bisa memeriksa transaksi terakhir tanpa membuka file di server.
- Sebagai petugas monitoring atau vendor, saya ingin menggabungkan (merge) EJ satu mesin untuk rentang tanggal tertentu dan melihat hasilnya di layar, agar bisa memeriksa kasus komplain nasabah.
- Sebagai pengguna, saat login gagal saya ingin tetap di halaman login dengan pesan yang jelas, agar tahu harus mengulang.

**Admin**
- Sebagai admin, saya ingin melihat Daily Report & Performance langsung setelah login, agar performance EJ H+2 langsung terlihat.
- Sebagai admin, saya ingin membuat user baru dengan role tertentu, agar petugas baru bisa memakai aplikasi.
- Sebagai admin, saya ingin mengubah data dan password user, agar akun tetap benar saat ada perubahan.
- Sebagai admin, saya ingin menghapus user, agar petugas yang sudah tidak bertugas tidak bisa masuk lagi.
- Sebagai admin, saya ingin mengunggah file EJ secara manual, agar EJ dari mesin yang gagal ditarik otomatis tetap bisa di-parsing.
- Sebagai admin, saya ingin melihat siapa mengubah apa dan kapan, agar insiden bisa ditelusuri.

## 6. Requirements

ID memakai format `REQ-<MODUL>-<NNN>` sesuai PRD QA Traceability. Kolom **Status** menunjukkan kondisi kode terhadap PRD v1.1.

### P0 — wajib ada sebelum rilis

| ID | Requirement | Acceptance criteria | Status |
| --- | --- | --- | --- |
| REQ-AUTH-001 | Login dan halaman awal per role | Given user terdaftar, when kredensial benar, then masuk; `admin` diarahkan ke Daily Report & Performance, `monitoring` dan `vendor` ke Home. | Selesai |
| REQ-AUTH-002 | Login gagal tetap di halaman login (flowchart "Tidak") | Given password salah atau user tidak terdaftar, then tampil "Email atau password salah", tetap di halaman login, dan tidak ada session dibuat. Pesan sama untuk kedua kasus. | Selesai |
| REQ-AUTH-003 | Batasi percobaan login | Setelah 5 kali gagal dalam 15 menit untuk email + IP yang sama, login ditolak dengan HTTP 429. | Selesai |
| REQ-AUTH-004 | Logout dan idle timeout (FSD 6.2.4) | Tombol Keluar menghapus session. Session habis setelah **10 menit tanpa aktivitas**; setiap request yang berhasil memperpanjang 10 menit. Request setelah habis mendapat 401 dan UI kembali ke login. | Selesai |
| REQ-AUTH-005 | Semua halaman dan API butuh login | Tanpa session yang valid, API mengembalikan 401 dan UI menampilkan halaman login. | Selesai |
| REQ-AUTH-007 | Akses menu per role (FSD Tabel 6.1) | Menu yang bukan hak role tidak tampil di sidebar; membuka URL-nya langsung mengarahkan ke halaman awal role itu; API-nya menjawab HTTP 403. | Selesai (`MENU_ACCESS` di `packages/shared`) |
| REQ-RPT-001 | Daily Report & Performance (hanya `admin`) | Menampilkan total mesin, mesin online, total transaksi, tingkat sukses, grafik sukses/gagal, grafik status mesin, dan tabel performance per mesin untuk satu tanggal. `monitoring` dan `vendor` mendapat 403. | Selesai |
| REQ-HOME-001 | ATM List | Menampilkan Terminal ID, lokasi, tipe (ATM/CRM), status (Online/Offline/Problem) dan waktu EJ terakhir semua mesin. Semua role. | Selesai (status mesin masih diisi manual di tabel `machines`) |
| REQ-HOME-002 | EJ Preview | Memilih mesin di ATM List menampilkan isi EJ terakhir mesin itu. Semua role. | Selesai |
| REQ-USER-001 | Daftar user (hanya `admin`) | Admin melihat nama, email, role dan tanggal dibuat. Password hash tidak pernah dikirim ke browser. | Selesai |
| REQ-USER-002 | Create User | Admin mengisi nama, email, role, password. Validasi: nama wajib (≤ 100 karakter), email valid dan unik, role `admin`/`monitoring`/`vendor`, password ≥ 8 karakter. Data tidak valid tetap di form dengan pesan error. | Selesai |
| REQ-USER-003 | Edit User | Admin bisa mengubah nama, email, role; password kosong berarti tidak diubah. Jika tidak ada perubahan data, tampil "Tidak ada perubahan data" tanpa menyimpan. Admin tidak bisa menurunkan role akunnya sendiri. | Selesai |
| REQ-USER-004 | Delete User | Admin menghapus user setelah konfirmasi. Admin tidak bisa menghapus akunnya sendiri. | Selesai |
| REQ-USER-005 | Menu Users hanya untuk admin | `monitoring` dan `vendor` tidak melihat menu User; semua endpoint `/api/users` menjawab 403 untuk mereka. | Selesai |
| REQ-AUDIT-001 | Audit trail (FSD 6.4) | Setiap login, logout, dan perubahan data (user, upload EJ) tercatat dengan waktu, ID user, alamat IP, modul, dan data sebelum/sesudah. Log tidak bisa diubah lewat aplikasi. | Belum dibuat |
| REQ-VALID-001 | Validasi input (FSD 6.2.3) | Input divalidasi di client dan server: tipe data, panjang maksimal, dan karakter terlarang `~ ' " * < > ^ ; : + - / ! % \|` pada field yang ditentukan. Input tidak valid menampilkan pesan error terstruktur. | Perlu konfirmasi (lihat Open questions) |
| REQ-INGEST-001 | Ambil EJ hasil tarikan IM-DISTRO via SFTP (port 22) | File EJ ATM dan CRM baru terambil secara berkala dan tersimpan di Server EJ Dashboard. | Belum dibuat |
| REQ-PARSE-001 | EJ Parsing | File EJ diubah menjadi data transaksi (waktu, terminal, jenis transaksi, nominal, response code) yang dipakai ATM List dan Daily Report. | Sebagian: parser untuk format EJ contoh; menunggu format asli dari vendor |
| REQ-PARSE-002 | Menu EJ Parsing (FSD Gambar 3.6) | Setelah login, user memilih menu EJ Parsing dan sistem menampilkan transaksi hasil parsing (waktu, Terminal ID, transaksi, nominal, response code) untuk satu tanggal, dengan filter terminal dan tanggal yang punya file EJ, serta jumlah transaksi dan jumlah gagal (RC ≠ 00). Semua role (View). | Selesai |

### P1 — penting, menyusul setelah P0

| ID | Requirement | Acceptance criteria | Status |
| --- | --- | --- | --- |
| REQ-MERGE-001 | Merge EJ | Pilih terminal (ID), Start Date dan End Date, lalu file EJ pada rentang itu digabung menjadi satu file yang bisa diunduh. Semua role. | Selesai |
| REQ-MERGE-002 | Tampilkan hasil merge (FSD 7.1) | Setelah merge, isi EJ gabungan tampil di layar, dipisah per tanggal, sebelum atau tanpa diunduh. | Belum dibuat |
| REQ-UPLOAD-001 | Upload EJ Parsing → Upload EJ | Admin mengunggah file EJ (.txt/.jrn) secara manual; file diproses sama seperti file dari SFTP. | Selesai |
| REQ-RPT-002 | Pilih tanggal laporan | Daily Report bisa ditampilkan untuk tanggal selain tanggal default. | Selesai (pilihan tanggal yang punya file EJ) |
| REQ-RPT-004 | Periode H+2 (FSD 7.1) | Daily Report & Performance secara default menampilkan data H+2 (hari ini dikurangi 2 hari). | Belum dibuat (sekarang hari terakhir yang punya file EJ) |

### P2 — dipertimbangkan nanti (rancang agar tidak menghalangi)

| ID | Requirement |
| --- | --- |
| REQ-NOTIF-001 | Notifikasi saat mesin Offline/Problem lebih dari N menit |
| REQ-AUTH-006 | Login SSO / Active Directory |
| REQ-RPT-003 | Ekspor Daily Report ke Excel/PDF |

## 7. Success metrics

| Jenis | Metrik | Target | Cara ukur | Kapan dievaluasi |
| --- | --- | --- | --- | --- |
| Leading | Petugas monitoring yang login minimal sekali per hari kerja | ≥ 80% | Audit trail (REQ-AUDIT-001) | 2 minggu setelah go-live |
| Leading | Waktu buka EJ Preview dari ATM List | ≤ 3 detik (p95) | Pengukuran di UAT | Saat UAT |
| Leading | Keterlambatan data: file EJ masuk sampai tampil di dashboard | ≤ 15 menit | Bandingkan waktu file di Sumber EJ dan di dashboard | Saat UAT dan 1 bulan setelah go-live |
| Lagging | Waktu menyusun laporan harian | Turun dari manual menjadi 0 (otomatis) | Wawancara petugas | 1 bulan setelah go-live |
| Lagging | Defect P1 (kritis) yang lolos ke production | 0 di rilis pertama | Defect log QA | Setiap rilis |

## 8. Open questions

| Pertanyaan | Untuk | Blocking? |
| --- | --- | --- |
| FSD menyebut login dengan **username** berbasis domain; aplikasi memakai email. Apakah login harus pakai username, dan domain apa yang dimaksud? | Bisnis / FSD owner | Ya, untuk REQ-AUTH-001 |
| Karakter terlarang FSD 6.2.3 (`- / : + !` dan lainnya) berlaku untuk field mana? Email butuh `-` dan `.`, dan password sebaiknya tidak dibatasi. | FSD owner | Ya, untuk REQ-VALID-001 |
| Akses menu EJ Parsing per role: flowchart Gambar 3.6 membuka EJ Parsing dari Daily Report (admin), sedangkan aplikasi membukanya untuk semua role. Akses Upload EJ juga belum ada di Tabel 6.1 | FSD owner | Tidak (sementara: Parsing semua role, Upload hanya admin) |
| Arti "pencegahan login simultan ganda" di FSD 6.4: login kedua menolak login baru, atau mengakhiri session lama? | FSD owner | Tidak |
| H+2: apakah tanggal default laporan = hari ini − 2, atau data yang ditarik IM-DISTRO dua hari setelah transaksi? | Bisnis | Ya, untuk REQ-RPT-004 |
| IM-DISTRO menaruh file EJ di Server Sumber EJ yang diambil via SFTP ([ADR-0005](adr/0005-sftp-pull-ingestion.md)), atau ada integrasi lain? | Tim infrastruktur | Ya, untuk REQ-INGEST-001 |
| Format file EJ per vendor mesin (ATM dan CRM): nama file, encoding, pola baris transaksi | Developer / vendor | Ya, untuk REQ-PARSE-001 |
| Jadwal dan folder SFTP di Server Sumber EJ, serta akun SFTP yang dipakai | Tim infrastruktur | Ya, untuk REQ-INGEST-001 |
| Berapa lama data EJ, hasil parsing dan audit trail disimpan (retensi) | Bisnis / compliance | Tidak |
| Definisi status "Problem" (misalnya N transaksi gagal berturut-turut) | Bisnis | Tidak |

### Revisi yang diusulkan untuk FSD

Bagian FSD berikut tidak cocok dengan keputusan arsitektur yang sudah diambil, atau masih kosong. PRD tetap mengikuti ADR untuk poin ini sampai FSD direvisi.

| Bagian FSD | Isi sekarang | Usulan |
| --- | --- | --- |
| 6.2.3, 6.2.4, 6.2.5 | PHP Laravel, XAMPP Apache | Node.js (Express) + React + SQLite sesuai [ADR-0001](adr/0001-sqlite-on-premise.md) dan [ADR-0002](adr/0002-signed-cookie-session.md) |
| 6.2.1, 6.2.5 | Password dienkripsi AES-256 **dan** di-hash BCrypt | Password cukup di-hash satu arah (scrypt di kode, setara BCrypt); enkripsi yang bisa dibuka balik justru melemahkan |
| Bab 1 | Ada di daftar isi, isinya kosong | Isi Executive Summary |
| 6.1 Tabel Authorization, 7.1 Tabel Requirement | EJ Parsing dan Upload EJ tidak ada, padahal ada di flowchart, ERD dan screen | Tambahkan baris dan role-nya; untuk EJ Parsing lihat [FSD addendum](fsd/FSD-addendum-ej-parsing.md) |
| 2.2, 4.1, 7.2, 7.3 | Ticketing, akses mobile engineer, CCTV, ganti screen, "User Case IM-Hots" | Hapus sisa teks FSD IM-Solutions |
| Document Change Control | Hanya versi 1.0 | Tambahkan versi 1.1 dan revisi ini |

## 9. Timeline dan fase (SDLC)

| Fase SDLC | Isi | Exit criteria |
| --- | --- | --- |
| 1. Requirement analysis | PRD ini, ID requirement, prioritas | PRD disetujui PM dan QA |
| 2. System design | [design.md](design.md) dan ADR | Desain disetujui dev lead |
| 3. Development | P0 lengkap, termasuk REQ-INGEST-001, REQ-PARSE-001, REQ-AUTH-007 dan REQ-AUDIT-001 | Semua requirement P0 punya test yang lulus |
| 4. Testing | Unit, API, UI (Playwright) sesuai [testing-strategy.md](testing-strategy.md) | Semua test P1-risk lulus, tidak ada defect kritis terbuka |
| 5. Deployment / UAT | UAT di lingkungan klien | UAT sign-off |
| 6. Maintenance | P1 (Merge EJ, tampilan hasil merge, Upload EJ, pilih tanggal, H+2) | — |

Ketergantungan utama: akses SFTP ke Server Sumber EJ dan contoh file EJ asli dari vendor. Tanpa keduanya, REQ-INGEST-001 tidak bisa dimulai, REQ-PARSE-001 tetap memakai format EJ contoh, dan semua menu EJ membaca file EJ contoh (atau file yang diunggah lewat Upload EJ).
