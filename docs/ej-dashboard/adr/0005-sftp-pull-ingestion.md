# ADR-0005: Ambil file EJ dengan SFTP pull terjadwal

**Status:** Proposed
**Date:** 2026-10-24
**Deciders:** Dev lead, tim infrastruktur, PM

## Context

FSD Gambar 3.1: file EJ ATM dan CRM ada di Server Sumber EJ, dan hubungan ke Server EJ Dashboard melewati firewall dengan SFTP port 22. Dashboard harus menampilkan data paling lambat 15 menit setelah file masuk (PRD goal 2). Format file, jadwal dan folder SFTP belum diketahui (PRD open questions).

## Decision

Usulan: job `ej-ingest` di Server EJ Dashboard berjalan tiap 5 menit, menarik (pull) file baru dari folder SFTP Sumber EJ dengan akun read-only, menyimpan file mentah, dan mencatatnya di tabel `ej_files` dengan hash SHA-256 agar file yang sama tidak diproses dua kali. Parsing dilakukan terpisah (`ej-parse`). Detail di [design.md](../design.md) bagian 5.

## Options Considered

### Option A: Pull terjadwal dari Server EJ Dashboard (diusulkan)
| Dimension | Assessment |
| --- | --- |
| Complexity | Medium |
| Cost | Rendah |
| Scalability | Baik untuk ribuan file per hari |
| Team familiarity | Sedang (perlu library SFTP, mis. `ssh2-sftp-client`) |

**Pros:** Sumber EJ tidak perlu diubah; firewall cukup satu arah; aman diulang (idempotent).
**Cons:** keterlambatan sampai satu interval job; perlu menyimpan posisi file terakhir.

### Option B: Sumber EJ push ke Server EJ Dashboard
**Pros:** data lebih cepat.
**Cons:** perlu mengubah Sumber EJ dan membuka SFTP masuk ke Server EJ Dashboard.

### Option C: Folder bersama (SMB/NFS)
**Pros:** paling sederhana dari sisi kode.
**Cons:** tidak sesuai FSD (SFTP port 22); lebih sulit diamankan lewat firewall.

## Trade-off Analysis

Pull terjadwal sesuai FSD dan tidak menuntut perubahan di Sumber EJ. Interval 5 menit memberi cadangan cukup terhadap target 15 menit.

## Consequences

- Lebih mudah: memproses ulang file (file mentah selalu disimpan).
- Lebih sulit: menangani file yang masih ditulis saat diambil (perlu aturan nama file atau cek ukuran stabil).
- Perlu ditinjau ulang: jika target keterlambatan turun di bawah 5 menit.

## Action Items

1. [ ] Dapatkan contoh file EJ asli per vendor dan aturan nama file
2. [ ] Dapatkan akun SFTP read-only dan buka firewall port 22 (Server EJ Dashboard → Sumber EJ)
3. [ ] Buat tabel `ej_files`, `ej_transactions`, `machines`
4. [ ] Implementasi `ej-ingest` dan `ej-parse` dengan test memakai file contoh
