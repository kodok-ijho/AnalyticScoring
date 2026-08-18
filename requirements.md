# Requirements — MPG Team Profiling Dashboard

## 1. Latar Belakang & Tujuan

Aplikasi web client-side untuk menganalisis file scoring performa karyawan (format `Scoring_JUNxx.xlsx` / sejenis) yang di-*upload* pengguna. Aplikasi menghasilkan **profiling per tim (MPG)** berbasis tren 9 bulan: ranking, tren skor, kekuatan/kelemahan per metrik, komposisi tim, dan kesimpulan pros/cons otomatis.

**MVP scope**: Bagian 1 — Profiling per Tim (MPG).
**Out of scope (Phase 2, didokumentasikan tapi tidak dikerjakan di MVP ini)**: Bagian 2 — Profiling per individu (NPK) & per Jabatan, korelasi dengan cabang/SERPO secara individual.

## 2. Aktor

- **Analyst/HR/Manager (single user, no login)** — upload file, menjelajah dashboard, tidak ada role lain. Tidak ada multi-user, tidak ada backend/auth di MVP.

## 3. Sumber Data & Skema (Kontrak Input)

File Excel `.xlsx`, 1 sheet, format panjang (long format): 1 baris = 1 (NPK, Periode). Berdasarkan file contoh (`Scoring_JUN26.xlsx`): 2.638 baris x 87 kolom, 9 periode bulanan (Okt 2025–Jun 2026), 22 MPG.

### 3.1 Kolom Identitas (wajib ada, non-null kecuali disebutkan)
| Kolom | Tipe | Keterangan |
|---|---|---|
| `Periode` | number (Excel date serial) | Bulan snapshot. Harus dikonversi ke `Date` (epoch 1899-12-30). |
| `MPG` | string | Kode tim (contoh: `A1`, `B1`, ... `Z1`). Ini adalah unit analisis utama Bagian 1. |
| `WCTR` | string | Kode sub-unit/individu di dalam tim. |
| `Nama` | string | Nama karyawan. |
| `NPK` | number | ID unik karyawan. |
| `Lokasi` | string, nullable (~0.1%) | `HO` atau `SERPO`. |
| `Loc` | string | Kode cabang (86 nilai unik pada contoh, mis. `MDN`, `MDN-BANDAACEH`). |
| `Jabatan` | string enum | `CSM` (supervisor, 1 per MPG), `CE` (teknisi), `SPS` (teknisi). |
| `MPG_SaatIni`, `WcTr_SaatIni`, `Posisi_SaatIni` | string, nullable (~3%) | Status/assignment terkini; bisa beda dari `MPG`/`WCTR`/`Jabatan` bila terjadi mutasi. |

### 3.2 Kolom Metrik (jabatan-spesifik, banyak null by design)
Pola nama kolom: `{Tahap}_{NamaMetrik}_{Jabatan}`.

- **Tahap**: `Achievement` (nilai realisasi) → `Target` (target) → `Weighted` (bobot metrik, 0–1) → `5Scale` (skor 1–5) → `SubTotal` (Weighted × 5Scale, kontribusi ke TOTAL).
- **Metrik CSM** (7): `MoP`, `CostPerRevenue`, `CSAT`, `LWH`, `RTSuccessRatio`, `LoL`, `ReturnCons`.
- **Metrik CE** (8): `MoP`, `CostPerRevenue`, `RTFirstVisit`, `WkTS`, `TSM`, `ProductivityCall`, `SupportIT`, `CEComSkill`.
- Baris dengan `Jabatan = CSM` → kolom `*_CE` bernilai null (dan sebaliknya). Ini **valid, bukan data rusak**; sistem tidak boleh menganggapnya error.
- `TOTAL` (float, non-null) = penjumlahan seluruh `SubTotal_*` yang relevan untuk baris tsb. Ini adalah skor akhir individu-periode.

### 3.3 Definisi "Tim" untuk Bagian 1
1 MPG = 1 tim = 1 baris `Jabatan=CSM` (supervisor) + N baris `Jabatan∈{CE,SPS}` (anak buah) pada periode yang sama. Jumlah anggota bisa berubah antar periode (mutasi masuk/keluar).

## 4. Functional Requirements

### FR-1 — Upload & Parsing
- FR-1.1 Sistem SHALL menyediakan drag-and-drop area + tombol "Browse" untuk upload 1 file `.xlsx`.
- FR-1.2 Parsing dilakukan 100% di browser (client-side), menggunakan SheetJS. Tidak ada file yang dikirim ke server manapun.
- FR-1.3 Sistem SHALL membaca sheet pertama pada workbook, mengabaikan sheet lain (jika ada), dan menampilkan nama sheet yang dibaca ke pengguna.
- FR-1.4 Selama parsing (>500ms), sistem SHALL menampilkan loading state.
- FR-1.5 Sistem SHALL menolak file bukan `.xlsx`/`.xls`/`.csv` dengan pesan error yang jelas, tanpa crash.

### FR-2 — Validasi Skema
- FR-2.1 Sistem SHALL memvalidasi keberadaan kolom wajib: `Periode, MPG, WCTR, Nama, NPK, Jabatan, TOTAL` minimal. Kolom metrik yang hilang tidak dianggap fatal (fitur terkait metrik itu dinonaktifkan dengan pesan, bukan crash total).
- FR-2.2 Jika kolom wajib hilang → tampilkan pesan error spesifik menyebut nama kolom yang hilang, dan hentikan proses (tidak render dashboard kosong/salah).
- FR-2.3 Sistem SHALL memvalidasi `Jabatan` hanya berisi nilai dikenal (`CSM`, `CE`, `SPS`); nilai lain ditandai sebagai "Unknown role" pada ringkasan validasi tapi tetap diproses (tidak menghentikan upload).
- FR-2.4 Sistem SHALL mendeteksi & melaporkan (bukan menghentikan): jumlah baris duplikat exact (NPK+Periode sama persis lebih dari 1 baris), MPG dengan CSM > 1 atau CSM = 0 pada suatu periode.
- FR-2.5 Sistem SHALL mengonversi `Periode` (serial number) menjadi label bulan yang human-readable (`"Okt 2025"`), dan mengurutkannya kronologis, bukan alfabetis/numerik mentah.

### FR-3 — Agregasi Data per Tim
- FR-3.1 Sistem SHALL menghitung, untuk setiap (MPG, Periode): rata-rata `TOTAL` seluruh anggota, jumlah anggota, jumlah per Jabatan.
- FR-3.2 Sistem SHALL menghitung tren per MPG sepanjang periode yang tersedia: arah tren (naik/turun/stabil) berbasis perbandingan rata-rata 3 bulan pertama vs 3 bulan terakhir yang tersedia (fallback: bulan pertama vs terakhir bila periode <6).
- FR-3.3 Sistem SHALL menghitung volatilitas per MPG = standar deviasi `TOTAL` rata-rata bulanan tim tsb sepanjang periode.
- FR-3.4 Sistem SHALL menghitung rata-rata tiap `SubTotal_*` (atau `5Scale_*`, dapat dipilih) per MPG per periode, dipisah kelompok CSM-metrics dan CE-metrics (karena anggota tim adalah campuran CSM+CE/SPS).
- FR-3.5 Semua agregasi SHALL mengabaikan nilai null tanpa menganggapnya 0 (gunakan rata-rata dari nilai non-null saja).

### FR-4 — Ranking & Ringkasan Tim
- FR-4.1 Sistem SHALL menampilkan tabel ranking 22 (atau N) tim, diurutkan berdasarkan rata-rata `TOTAL` sepanjang periode terpilih, default descending.
- FR-4.2 Kolom tabel minimal: Rank, MPG, Rata-rata TOTAL, Tren (ikon naik/turun/stabil + delta %), Volatilitas, Jumlah anggota, Komposisi (HO/SERPO %).
- FR-4.3 Tabel SHALL dapat di-*sort* ulang oleh pengguna berdasarkan tiap kolom numerik.
- FR-4.4 Klik satu baris tim SHALL membuka detail view (FR-5, FR-6, FR-7, FR-8) untuk tim tsb.

### FR-5 — Grafik Tren per Tim
- FR-5.1 Sistem SHALL menampilkan line chart rata-rata `TOTAL` per bulan untuk 1 tim.
- FR-5.2 Pengguna SHALL dapat memilih/membandingkan hingga minimal 5 MPG sekaligus dalam satu chart (multi-select).
- FR-5.3 Chart SHALL menampilkan garis rata-rata seluruh tim (benchmark) sebagai pembanding referensi.

### FR-6 — Breakdown Metrik (Heatmap)
- FR-6.1 Sistem SHALL menampilkan heatmap: baris = MPG, kolom = metrik (5Scale rata-rata), warna dari merah (rendah) ke hijau (tinggi) relatif terhadap seluruh tim.
- FR-6.2 Heatmap SHALL memisahkan metrik-metrik CSM dan metrik-metrik CE (dua tabel/section berbeda, karena skala & maknanya beda).
- FR-6.3 Hover/klik sel heatmap SHALL menampilkan nilai eksak (Achievement vs Target vs 5Scale).

### FR-7 — Panel Komposisi
- FR-7.1 Sistem SHALL menampilkan, per tim: jumlah CSM/CE/SPS, dan proporsi HO vs SERPO (berdasarkan `Lokasi`).
- FR-7.2 Sistem SHALL menampilkan scatter/bar sederhana: ukuran tim (jumlah anggota) vs rata-rata TOTAL, untuk mengecek korelasi kasar ukuran-vs-performa.

### FR-8 — Pros/Cons Otomatis
- FR-8.1 Sistem SHALL menghasilkan label **Pros**: metrik (5Scale rata-rata) yang berada di atas rata-rata seluruh tim, diurutkan dari selisih terbesar, maksimal 3 metrik ditampilkan.
- FR-8.2 Sistem SHALL menghasilkan label **Cons**: metrik di bawah rata-rata seluruh tim, maksimal 3 metrik ditampilkan.
- FR-8.3 Sistem SHALL menyertakan catatan tren (naik/turun/stabil) sebagai bagian narasi pros/cons.
- FR-8.4 Logika threshold "di atas/bawah rata-rata" SHALL bisa dikonfigurasi (default: ± 0 dari mean; opsional ambang toleransi mis. ±0.1) — nilai default didokumentasikan di `design.md` dan tidak hardcode tanpa nama variabel.

### FR-9 — Filtering & Interaktivitas Global
- FR-9.1 Sistem SHALL menyediakan filter global: rentang periode (date range slider/select bulan awal-akhir), Lokasi (HO/SERPO), MPG (multi-select).
- FR-9.2 Semua komponen (ranking, chart, heatmap, komposisi) SHALL bereaksi terhadap filter global secara konsisten.
- FR-9.3 Sistem SHALL menyediakan tombol "Reset filter".

### FR-10 — Export
- FR-10.1 Sistem SHALL menyediakan tombol export tabel ranking (state ter-filter saat ini) ke `.xlsx` (client-side, via SheetJS).
- FR-10.2 Sistem SHALL menyediakan tombol export chart/heatmap sebagai gambar PNG.

### FR-11 — Reset / Upload Ulang
- FR-11.1 Sistem SHALL menyediakan tombol "Upload file baru" yang mengosongkan state saat ini dan kembali ke layar upload.
- FR-11.2 Tidak ada data yang di-*persist* antar sesi browser di MVP (tidak ada localStorage/backend) — setiap reload = mulai dari upload lagi. *(Catatan: jika nanti dibangun sebagai Claude Artifact, gunakan in-memory state saja — localStorage/sessionStorage tidak didukung di lingkungan Artifact.)*

## 5. Non-Functional Requirements

- NFR-1 **Performa**: Parsing + agregasi untuk file ≤5.000 baris x ≤100 kolom SHALL selesai < 3 detik pada laptop standar.
- NFR-2 **Privasi/keamanan data**: Tidak ada upload ke server eksternal; seluruh pemrosesan di browser pengguna.
- NFR-3 **Resilience**: Error pada satu bagian (mis. 1 kolom metrik hilang) tidak boleh membuat seluruh dashboard blank/crash — degradasi bertahap (graceful degradation) per fitur.
- NFR-4 **Responsif**: Layout dapat digunakan pada layar desktop (≥1280px) minimal; mobile adalah nice-to-have, bukan wajib di MVP.
- NFR-5 **Reusability skema**: Kode agregasi tidak boleh hardcode nama MPG/jumlah tim/jumlah periode dari file contoh — semuanya diturunkan secara dinamis dari file yang di-upload agar tetap berfungsi untuk file bulan lain (`Scoring_JULxx.xlsx`, dst) selama skema kolom sama.
- NFR-6 **Aksesibilitas warna**: Heatmap merah-hijau SHALL disertai indikator non-warna (angka/nilai) agar tetap terbaca oleh pengguna buta warna.

## 6. Asumsi

- A-1 File yang di-upload berikutnya mengikuti skema kolom yang sama persis dengan `Scoring_JUN26.xlsx` (nama kolom, arti `Jabatan`, hierarki 1 CSM per MPG). Jika berbeda signifikan, perlu update `requirements.md` ini.
- A-2 "Tren" cukup direpresentasikan dengan perbandingan rata-rata blok awal vs blok akhir periode (bukan regresi statistik kompleks) — cukup untuk kebutuhan profiling kualitatif.
- A-3 Definisi objektif pros/cons (FR-8) sudah disepakati: relatif terhadap rata-rata seluruh tim pada periode yang sama, bukan terhadap target internal masing-masing metrik.
- A-4 Tidak ada kebutuhan autentikasi/multi-user pada MVP ini.

## 7. Out of Scope (didokumentasikan untuk Phase 2, tidak dikerjakan sekarang)

- Profiling per individu (NPK): riwayat skor per orang, perbandingan ke rata-rata tim/jabatan.
- Analisis korelasi CSM ↔ kinerja anak buahnya secara statistik (mis. korelasi Pearson).
- Analisis korelasi skor dengan `Loc` (cabang spesifik) secara individual (Bagian 1 baru sampai level HO/SERPO agregat per tim).
- Deteksi otomatis mutasi (`MPG` vs `MPG_SaatIni` berbeda) dan dampaknya ke skor.
- Backend/database, autentikasi, multi-file/multi-bulan historis di luar 1 file upload.

## 8. Glosarium

| Istilah | Arti |
|---|---|
| MPG | Kode tim/grup kerja (unit analisis Bagian 1) |
| WCTR | Kode sub-unit/individu dalam tim |
| CSM | Customer Service/Solution Manager — supervisor, 1 per MPG |
| CE | Customer Engineer — teknisi, anak buah CSM |
| SPS | Peran teknisi lain, juga anak buah CSM |
| Lokasi | Kategori `HO` (kantor pusat/hub) atau `SERPO` (cabang satelit) |
| Loc | Kode cabang spesifik |
| 5Scale | Skor metrik dikonversi ke skala 1–5 |
| SubTotal | Kontribusi metrik ke TOTAL (5Scale × Weighted) |
| TOTAL | Skor akhir individu pada satu periode |
