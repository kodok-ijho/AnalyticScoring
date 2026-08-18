# Requirements (Phase 2) — Individual & Jabatan Profiling

Melanjutkan `requirements.md` (Bagian 1 — Team/MPG Profiling). Dokumen ini adalah **Bagian 2**: profiling per individu (NPK), per jabatan (CSM/CE/SPS), dan korelasi dengan cabang/tipe lokasi. Dibangun **di atas app yang sama** (bukan aplikasi baru) — lihat `design-phase2.md` untuk cara ekstensinya.

## 1. Tujuan

Menjawab 3 pertanyaan bisnis:
1. Bagaimana karakteristik & tren tiap individu dibanding rekan sejabatan/setim (siapa top performer, siapa perlu perhatian)?
2. Apakah ada pola sistematis antar jabatan (CSM vs CE vs SPS) — kekuatan/kelemahan khas tiap peran?
3. Apakah performa individu berkorelasi dengan cabang (`Loc`), tipe lokasi (`HO`/`SERPO`), atau dengan performa supervisor-nya (CSM)?

## 2. Fakta Data Tambahan (relevan khusus Bagian 2)

Dari `Scoring_JUN26.xlsx` (317 individu unik, 9 periode):
- Distribusi jabatan: **CE 2.274 baris**, **CSM 201 baris**, **SPS 163 baris** (row-period, bukan orang unik).
- **22 dari 317 orang (≈7%)** pernah berganti `Jabatan` sepanjang 9 bulan (mis. promosi CE→CSM).
- **17 dari 317 orang (≈5%)** pernah berganti `MPG` (pindah tim) — konsisten dengan temuan `MPG_SaatIni` vs `MPG` di Bagian 1.
- **48 dari 317 orang (≈15%)** pernah berganti `Loc` (pindah cabang).
- 86 `Loc` unik, dan `Lokasi` (HO/SERPO) split 1.887 HO vs 748 SERPO baris (+3 baris null).
- Tidak semua orang punya data 9 periode penuh (median 9, tapi ada yang minimal 1) — kemungkinan karyawan baru/keluar di tengah jalan.

**Implikasi requirement**: sistem harus eksplisit menangani (a) orang yang pindah tim/jabatan/cabang di tengah periode — bukan dianggap error, (b) orang dengan riwayat periode tidak lengkap.

## 3. Functional Requirements

### FR-P2-1 — Agregasi per Individu (NPK)
- FR-P2-1.1 Sistem SHALL menghitung, per NPK: riwayat `TOTAL` per periode (urut kronologis), rata-rata keseluruhan, tren (memakai definisi & ambang yang sama dengan Bagian 1 FR-3.2, direplikasi di level individu), volatilitas (stddev antar periode).
- FR-P2-1.2 Sistem SHALL mencatat **riwayat atribut** per NPK, bukan cuma nilai terakhir: daftar `{periodeLabel, mpg, jabatan, loc, lokasi}` — supaya perubahan (mutasi) terlihat, bukan tertimpa.
- FR-P2-1.3 Sistem SHALL menandai NPK yang mengalami mutasi (`jabatan` berubah dan/atau `mpg` berubah dan/atau `loc` berubah antar periode berurutan) dengan flag `hasMutasi: boolean` + daftar event mutasi (`{fromPeriode, toPeriode, field, from, to}`).
- FR-P2-1.4 Sistem SHALL menghitung breakdown metrik per individu (5Scale rata-rata per metrik), memakai daftar metrik sesuai jabatan **terkini/terbanyak** orang tsb (bila jabatan berubah, breakdown dipisah per rentang jabatan — lihat FR-P2-1.3).

### FR-P2-2 — Peer Comparison (Individu vs Kelompok Sejenis)
- FR-P2-2.1 Sistem SHALL menghitung rata-rata jabatan sejenis (semua CE, semua SPS, semua CSM) per periode, sebagai baseline pembanding — bukan rata-rata seluruh populasi campur jabatan (karena skala metrik CSM ≠ CE, lihat requirements.md §3.2).
- FR-P2-2.2 Sistem SHALL menampilkan posisi relatif tiap individu terhadap: (a) rata-rata tim (MPG)-nya, (b) rata-rata jabatan sejenis se-perusahaan, sebagai dua angka terpisah (bukan digabung).
- FR-P2-2.3 Sistem SHALL menghasilkan ranking individu **di dalam kelompok jabatannya sendiri** (CE dibanding CE lain, SPS dibanding SPS lain, CSM dibanding CSM lain) — bukan satu ranking gabungan lintas jabatan.

### FR-P2-3 — Profil Pros/Cons per Individu
- FR-P2-3.1 Sistem SHALL menghasilkan label Pros/Cons per individu memakai logika yang sama dengan Bagian 1 FR-8, tapi baseline-nya rata-rata jabatan sejenis (FR-P2-2.1), bukan rata-rata tim.
- FR-P2-3.2 Sistem SHALL menyertakan catatan mutasi (bila `hasMutasi=true`) di dalam profil individu, termasuk perbandingan skor rata-rata sebelum vs sesudah mutasi (bila data cukup, minimal 2 periode di tiap sisi).

### FR-P2-4 — Watchlist & Top Performer
- FR-P2-4.1 Sistem SHALL menghasilkan daftar **"Perlu Perhatian"**: individu dengan tren turun (sesuai definisi tren Bagian 1) DAN rata-rata TOTAL di bawah rata-rata jabatan sejenis, pada rentang periode terpilih.
- FR-P2-4.2 Sistem SHALL menghasilkan daftar **"Top Performer"**: tren naik/stabil-tinggi DAN rata-rata TOTAL di atas rata-rata jabatan sejenis, urut dari nilai tertinggi.
- FR-P2-4.3 Kedua daftar SHALL dapat difilter per jabatan dan per MPG.

### FR-P2-5 — Perbandingan Antar Jabatan
- FR-P2-5.1 Sistem SHALL menampilkan distribusi (min/median/mean/max, atau box plot) `TOTAL` untuk tiap jabatan (CSM, CE, SPS) secara terpisah.
- FR-P2-5.2 Sistem SHALL menampilkan breakdown metrik rata-rata per jabatan (2 tabel/chart terpisah: metrik CSM, metrik CE — SPS memakai metrik CE yang sama sesuai skema data) untuk melihat pola kekuatan/kelemahan khas tiap peran.
- FR-P2-5.3 Sistem SHALL membandingkan CE vs SPS secara spesifik (dua-duanya teknisi, metrik sama) sebagai satu view berdampingan, karena keduanya paling relevan dibandingkan langsung.

### FR-P2-6 — Korelasi CSM ↔ Anak Buah
- FR-P2-6.1 Sistem SHALL membangun pasangan data `(CSM_TOTAL, avg_anak_buah_TOTAL)` untuk tiap (MPG, Periode) yang punya CSM valid.
- FR-P2-6.2 Sistem SHALL menghitung koefisien korelasi Pearson antara kedua deret di FR-P2-6.1, dan menampilkannya sebagai satu angka + interpretasi kualitatif (lemah/sedang/kuat, positif/negatif) — **bukan klaim kausalitas**, cukup deskriptif.
- FR-P2-6.3 Sistem SHALL menampilkan scatter plot dari pasangan data tsb, dengan garis tren linear sederhana sebagai bantuan visual.
- FR-P2-6.4 Sistem SHALL menampilkan jumlah pasangan data (n) yang dipakai perhitungan korelasi, karena n kecil (maks 22 MPG x 9 periode ≈ 198 titik, bisa kurang bila ada MPG tanpa CSM di periode tertentu) membuat korelasi kurang reliabel — n SHALL selalu terlihat berdampingan dengan angka korelasi.

### FR-P2-7 — Korelasi dengan Lokasi/Cabang
- FR-P2-7.1 Sistem SHALL menampilkan rata-rata `TOTAL` per `Lokasi` (HO vs SERPO), dipisah per jabatan (karena skala CSM≠CE), dengan ukuran sampel (n) masing-masing.
- FR-P2-7.2 Sistem SHALL menampilkan ranking rata-rata `TOTAL` per `Loc` (cabang), dipisah per jabatan, dengan n per cabang ditampilkan eksplisit dan **cabang dengan n < ambang tertentu (default 3 orang) ditandai "sampel kecil"** agar tidak disalahartikan sebagai temuan solid.
- FR-P2-7.3 Sistem SHALL menyediakan filter untuk fokus ke 1 jabatan (CE saja / SPS saja) saat melihat ranking cabang, karena komposisi jabatan per cabang bisa timpang.
- FR-P2-7.4 Sistem TIDAK WAJIB melakukan uji statistik formal (ANOVA/t-test) di MVP Phase 2 — cukup deskriptif (rata-rata + n + sebaran). Uji signifikansi didokumentasikan sebagai kemungkinan Phase 3, bukan dikerjakan sekarang.

### FR-P2-8 — Pencarian & Navigasi Individu
- FR-P2-8.1 Sistem SHALL menyediakan search box untuk mencari individu by Nama atau NPK.
- FR-P2-8.2 Dari `TeamDetailDrawer` (Bagian 1), klik nama anggota tim SHALL membuka profil individu tsb (deep link antar Bagian 1 dan Bagian 2).

## 4. Non-Functional Requirements (tambahan)

- NFR-P2-1 Perhitungan korelasi & agregasi 317 individu x 9 periode SHALL tetap < 1 detik tambahan di atas waktu load Bagian 1 (data sudah ada di memori, tinggal re-agregasi, bukan re-parse file).
- NFR-P2-2 Setiap angka korelasi/statistik yang ditampilkan SHALL selalu disertai ukuran sampel (n) — untuk mencegah kesimpulan berlebihan dari data kecil (selaras FR-P2-6.4, FR-P2-7.2).
- NFR-P2-3 Sistem SHALL secara eksplisit melabeli semua temuan korelasi sebagai deskriptif ("berasosiasi dengan"), bukan bahasa kausal ("menyebabkan") — ini requirement produk, bukan sekadar gaya bahasa, karena akan dibaca manajemen untuk keputusan personel.

## 5. Asumsi (tambahan untuk Phase 2)

- A-P2-1 Baseline "jabatan sejenis" (FR-P2-2.1) dihitung dari data yang sama-sama diupload (bukan benchmark eksternal).
- A-P2-2 SPS dianggap setara CE dari sisi struktur metrik (memakai kolom `*_CE`, sesuai temuan skema data), sehingga perbandingan CE vs SPS FR-P2-5.3 valid secara struktur data.
- A-P2-3 Ambang "sampel kecil" cabang (default 3) adalah nilai awal yang bisa diubah, didokumentasikan sebagai konstanta bernama (lihat `design-phase2.md`), bukan aturan bisnis yang kaku.
- A-P2-4 Deteksi mutasi (FR-P2-1.3) berdasarkan perubahan nilai `MPG`/`Jabatan`/`Loc` antar baris periode berurutan milik NPK yang sama — bukan dari kolom `*_SaatIni` (kolom itu hanya snapshot status terkini, sudah dipakai secara terpisah di Bagian 1 sebagai info tambahan, bukan sumber utama deteksi mutasi historis).

## 6. Out of Scope (Phase 2 ini)

- Uji statistik formal (p-value, ANOVA, regresi berganda) — didokumentasikan sebagai kemungkinan Phase 3.
- Prediksi/forecasting skor individu ke depan.
- Rekomendasi otomatis (mis. "pindahkan orang X ke cabang Y") — sistem hanya deskriptif, keputusan tetap di tangan manajemen.
- Export laporan per-individu ke PDF (export xlsx tabel individu cukup, mengikuti pola FR-10 Bagian 1).

## 7. Glosarium Tambahan

| Istilah | Arti |
|---|---|
| Mutasi | Perubahan `MPG`, `Jabatan`, atau `Loc` seorang NPK antar periode berurutan |
| Peer group | Kelompok pembanding sejabatan (semua CSM, semua CE, atau semua SPS) |
| Watchlist | Daftar individu tren turun & di bawah rata-rata peer group |
