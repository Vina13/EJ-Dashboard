# PRD: EJ Dashboard

| | |
| --- | --- |
| Produk | EJ Dashboard (Daily Report & Performance ATM/CRM) |
| Sumber | FSD EJ Dashboard: Gambar 3.1 Solusi Arsitektur, 3.2–3.4 Flowchart, 3.8 Use Case |
| QA owner | Vina |
| Proses | SDLC (bukan sprint); lihat [testing-strategy.md](testing-strategy.md) dan [design.md](design.md) |
| Status | Draft v1, 24 Oktober 2026 |

## 1. Problem statement

Tim operasional bank memantau ratusan mesin ATM dan CRM. Electronic Journal (EJ) tiap mesin tersimpan sebagai file teks di Server Sumber EJ, sehingga untuk tahu kondisi mesin dan jumlah transaksi harian, petugas harus membuka file EJ satu per satu. Akibatnya masalah mesin (offline, transaksi gagal) terlambat diketahui, dan laporan harian disusun manual.

EJ Dashboard mengambil data EJ ATM dan CRM dari Server Sumber EJ melalui SFTP, lalu menampilkannya sebagai daftar mesin, preview EJ, dan laporan Daily Report & Performance dalam satu aplikasi web dengan login.

## 2. Goals

1. **Laporan harian tanpa kerja manual:** Daily Report & Performance tersedia untuk semua mesin setiap hari, tanpa petugas membuka file EJ.
2. **Masalah mesin terlihat cepat:** mesin Offline atau Problem terlihat di Home dan Daily Report paling lambat 15 menit setelah file EJ terbaru masuk.
3. **EJ satu mesin bisa dilihat dalam hitungan detik:** EJ Preview satu mesin terbuka dalam ≤ 3 detik dari ATM List.
4. **Akses terkontrol:** hanya user terdaftar yang bisa masuk, dan hanya admin yang bisa mengelola user.

## 3. Non-goals

| Di luar scope v1 | Alasan |
| --- | --- |
| Mengubah atau mengirim perintah ke mesin ATM/CRM | EJ Dashboard hanya membaca data (monitoring), bukan alat kendali mesin. |
| Rekonsiliasi transaksi dengan core banking | Butuh integrasi dan persetujuan terpisah; inisiatif lain. |
| Notifikasi otomatis (email/WhatsApp) saat mesin bermasalah | Berguna, tetapi dashboard harus stabil dulu; dicatat sebagai P2. |
| Login SSO / Active Directory | v1 memakai akun lokal; SSO dicatat sebagai P2. |
| Aplikasi mobile | Pengguna bekerja dari PC kantor; web responsif sudah cukup. |

## 4. Pengguna dan role

| Role | Siapa | Boleh |
| --- | --- | --- |
| `admin` | Supervisor / tim IT aplikasi | Semua menu, termasuk Create, Edit dan Delete User |
| `monitoring` | Petugas monitoring ATM/CRM | Semua menu monitoring; melihat daftar user, tetapi tidak bisa mengubahnya |

## 5. User stories

**Petugas monitoring**
- Sebagai petugas monitoring, saya ingin melihat Daily Report & Performance langsung setelah login, agar kondisi hari ini langsung terlihat.
- Sebagai petugas monitoring, saya ingin melihat daftar ATM/CRM beserta statusnya, agar mesin yang Offline atau Problem cepat ketahuan.
- Sebagai petugas monitoring, saya ingin membuka EJ Preview satu mesin, agar bisa memeriksa transaksi terakhir tanpa membuka file di server.
- Sebagai petugas monitoring, saya ingin menggabungkan (merge) EJ satu mesin untuk rentang tanggal tertentu, agar bisa memeriksa kasus komplain nasabah.
- Sebagai petugas monitoring, saat login gagal saya ingin tetap di halaman login dengan pesan yang jelas, agar tahu harus mengulang.

**Admin**
- Sebagai admin, saya ingin membuat user baru dengan role tertentu, agar petugas baru bisa memakai aplikasi.
- Sebagai admin, saya ingin mengubah data dan password user, agar akun tetap benar saat ada perubahan.
- Sebagai admin, saya ingin menghapus user, agar petugas yang sudah tidak bertugas tidak bisa masuk lagi.
- Sebagai admin, saya ingin mengunggah file EJ secara manual, agar EJ dari mesin yang gagal terkirim lewat SFTP tetap bisa di-parsing.

## 6. Requirements

ID memakai format `REQ-<MODUL>-<NNN>` sesuai PRD QA Traceability. Kolom **Status** menunjukkan kondisi kode per 24 Oktober 2026.

### P0 — wajib ada sebelum rilis

| ID | Requirement | Acceptance criteria | Status |
| --- | --- | --- | --- |
| REQ-AUTH-001 | Login dengan email dan password | Given user terdaftar, when email dan password benar, then masuk dan diarahkan ke Daily Report & Performance. | Selesai |
| REQ-AUTH-002 | Login gagal tetap di halaman login (flowchart "Tidak") | Given password salah atau email tidak terdaftar, then tampil "Email atau password salah", tetap di halaman login, dan tidak ada session dibuat. Pesan sama untuk kedua kasus. | Selesai |
| REQ-AUTH-003 | Batasi percobaan login | Setelah 5 kali gagal dalam 15 menit untuk email + IP yang sama, login ditolak dengan HTTP 429. | Selesai |
| REQ-AUTH-004 | Logout dan session berakhir | Tombol Keluar menghapus session; session otomatis habis setelah 1 jam. | Selesai |
| REQ-AUTH-005 | Semua halaman dan API butuh login | Tanpa session yang valid, API mengembalikan 401 dan UI menampilkan halaman login. | Selesai |
| REQ-RPT-001 | Daily Report & Performance | Menampilkan total mesin, mesin online, total transaksi, tingkat sukses, grafik sukses/gagal, grafik status mesin, dan tabel performance per mesin untuk satu tanggal. | Data contoh |
| REQ-HOME-001 | ATM List | Menampilkan Terminal ID, lokasi, tipe (ATM/CRM), status (Online/Offline/Problem) dan waktu EJ terakhir semua mesin. | Data contoh |
| REQ-HOME-002 | EJ Preview | Memilih mesin di ATM List menampilkan isi EJ terakhir mesin itu. | Data contoh |
| REQ-USER-001 | Daftar user | Semua role bisa melihat nama, email, role dan tanggal dibuat. Password hash tidak pernah dikirim ke browser. | Selesai |
| REQ-USER-002 | Create User | Admin mengisi nama, email, role, password. Validasi: nama wajib (≤ 100 karakter), email valid dan unik, role `admin`/`monitoring`, password ≥ 8 karakter. Data tidak valid tetap di form dengan pesan error. | Selesai |
| REQ-USER-003 | Edit User | Admin bisa mengubah nama, email, role; password kosong berarti tidak diubah. Jika tidak ada perubahan data, tampil "Tidak ada perubahan data" tanpa menyimpan. Admin tidak bisa menurunkan role akunnya sendiri. | Selesai |
| REQ-USER-004 | Delete User | Admin menghapus user setelah konfirmasi. Admin tidak bisa menghapus akunnya sendiri. | Selesai |
| REQ-USER-005 | Hanya admin yang mengubah user | User `monitoring` tidak melihat tombol Create/Edit/Delete, dan API menolak dengan HTTP 403. | Selesai |
| REQ-INGEST-001 | Ambil EJ dari Server Sumber EJ via SFTP (port 22) | File EJ ATM dan CRM baru terambil secara berkala dan tersimpan di Server EJ Dashboard. | Belum dibuat |
| REQ-PARSE-001 | EJ Parsing | File EJ diubah menjadi data transaksi (waktu, terminal, jenis transaksi, nominal, response code) yang dipakai ATM List dan Daily Report. | Belum dibuat (halaman contoh ada, belum di menu) |

### P1 — penting, menyusul setelah P0

| ID | Requirement | Acceptance criteria | Status |
| --- | --- | --- | --- |
| REQ-MERGE-001 | Merge EJ | Pilih terminal dan rentang tanggal, lalu file EJ pada rentang itu digabung menjadi satu file yang bisa diunduh. | Form placeholder, belum ada backend |
| REQ-UPLOAD-001 | Upload EJ Parsing → Upload EJ | Admin mengunggah file EJ (.txt/.jrn) secara manual; file diproses sama seperti file dari SFTP. | Halaman contoh ada, belum di menu |
| REQ-RPT-002 | Pilih tanggal laporan | Daily Report bisa ditampilkan untuk tanggal selain hari ini. | Belum dibuat |

### P2 — dipertimbangkan nanti (rancang agar tidak menghalangi)

| ID | Requirement |
| --- | --- |
| REQ-NOTIF-001 | Notifikasi saat mesin Offline/Problem lebih dari N menit |
| REQ-AUTH-006 | Login SSO / Active Directory |
| REQ-AUDIT-001 | Audit log perubahan user (siapa mengubah apa, kapan) |
| REQ-RPT-003 | Ekspor Daily Report ke Excel/PDF |

## 7. Success metrics

| Jenis | Metrik | Target | Cara ukur | Kapan dievaluasi |
| --- | --- | --- | --- | --- |
| Leading | Petugas monitoring yang login minimal sekali per hari kerja | ≥ 80% | Log login per user | 2 minggu setelah go-live |
| Leading | Waktu buka EJ Preview dari ATM List | ≤ 3 detik (p95) | Pengukuran di UAT | Saat UAT |
| Leading | Keterlambatan data: file EJ masuk sampai tampil di dashboard | ≤ 15 menit | Bandingkan waktu file di Sumber EJ dan di dashboard | Saat UAT dan 1 bulan setelah go-live |
| Lagging | Waktu menyusun laporan harian | Turun dari manual menjadi 0 (otomatis) | Wawancara petugas | 1 bulan setelah go-live |
| Lagging | Defect P1 (kritis) yang lolos ke production | 0 di rilis pertama | Defect log QA | Setiap rilis |

## 8. Open questions

| Pertanyaan | Untuk | Blocking? |
| --- | --- | --- |
| Format file EJ per vendor mesin (ATM dan CRM): nama file, encoding, pola baris transaksi | Developer / vendor | Ya, untuk REQ-PARSE-001 |
| Jadwal dan folder SFTP di Server Sumber EJ, serta akun SFTP yang dipakai | Tim infrastruktur | Ya, untuk REQ-INGEST-001 |
| Berapa lama data EJ dan hasil parsing disimpan (retensi) | Bisnis / compliance | Tidak |
| Definisi status "Problem" (misalnya N transaksi gagal berturut-turut) | Bisnis | Tidak |
| Apakah EJ Parsing dan Upload EJ Parsing tetap menu terpisah seperti di Use Case FSD? Saat ini keduanya tidak tampil di menu. | PM | Tidak |
| Repository resmi dari developer: aplikasi ini prototipe QA atau akan menjadi kode produksi? | PM / developer | Tidak |

## 9. Timeline dan fase (SDLC)

| Fase SDLC | Isi | Exit criteria |
| --- | --- | --- |
| 1. Requirement analysis | PRD ini, ID requirement, prioritas | PRD disetujui PM dan QA |
| 2. System design | [design.md](design.md) dan ADR | Desain disetujui dev lead |
| 3. Development | P0 lengkap, termasuk REQ-INGEST-001 dan REQ-PARSE-001 | Semua requirement P0 punya test yang lulus |
| 4. Testing | Unit, API, UI (Playwright) sesuai [testing-strategy.md](testing-strategy.md) | Semua test P1-risk lulus, tidak ada defect kritis terbuka |
| 5. Deployment / UAT | UAT di lingkungan klien | UAT sign-off |
| 6. Maintenance | P1 (Merge EJ, Upload EJ, pilih tanggal) | — |

Ketergantungan utama: akses SFTP ke Server Sumber EJ dan contoh file EJ asli dari vendor. Tanpa keduanya, REQ-INGEST-001 dan REQ-PARSE-001 tidak bisa dimulai, dan semua menu EJ tetap memakai data contoh.
