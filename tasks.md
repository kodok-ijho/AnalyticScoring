# Tasks — MPG Team Profiling Dashboard

Referensi: `requirements.md`, `design.md`. Kerjakan berurutan per Phase — tiap task didesain agar aplikasi tetap bisa dijalankan (`npm run dev`) setelah task tsb selesai, tidak menunggu semua task kelar baru bisa dicoba.

Format tiap task: **Deskripsi**, **File**, **DoD (Definition of Done)**.

---

## Phase 0 — Project Setup

- [ ] **T0.1** Scaffold proyek Vite + React + TypeScript (`npm create vite@latest . -- --template react-ts`), install Tailwind, Zustand, `xlsx`, Recharts, Vitest.
  **File**: `package.json`, `vite.config.ts`, `tailwind.config.js`, `src/main.tsx`, `src/App.tsx`
  **DoD**: `npm run dev` menampilkan halaman default tanpa error di console. `npm run test` jalan (walau 0 test) tanpa error konfigurasi.

- [ ] **T0.2** Buat `types.ts` sesuai skema di `design.md` §4.
  **File**: `src/types.ts`
  **DoD**: `tsc --noEmit` tidak error.

- [ ] **T0.3** Buat `lib/constants.ts`: daftar metrik CSM (7) & CE (8), `PROS_CONS_TOLERANCE`, ambang tren (`TREND_THRESHOLD_PCT`), palet warna heatmap/tren.
  **File**: `src/lib/constants.ts`
  **DoD**: Nilai-nilai ini diimport (bukan hardcode ulang) minimal di 1 test dummy yang membaca panjang array metrik CSM = 7 dan CE = 8.

---

## Phase 1 — Upload & Parsing (FR-1)

- [ ] **T1.1** Implement `parseWorkbook(file: File): Promise<RawRow[]>` pakai SheetJS, ambil sheet pertama.
  **File**: `src/lib/parseWorkbook.ts`
  **DoD**: Unit test dengan file `.xlsx` fixture kecil (3 baris, buat manual di `tests/fixtures/`) → hasil `RawRow[]` panjang 3, key sesuai header.

- [ ] **T1.2** Buat `UploadPanel.tsx`: drag-and-drop + tombol browse, memanggil `parseWorkbook`, set loading state selama proses.
  **File**: `src/components/upload/UploadPanel.tsx`
  **DoD (manual)**: Upload `Scoring_JUN26.xlsx` asli di browser → loading indicator muncul lalu hilang, tidak ada error di console, jumlah baris ter-parse (log sementara ke console) = 2638.

- [ ] **T1.3** Tolak file dengan ekstensi selain `.xlsx/.xls/.csv` sebelum parsing.
  **File**: `src/components/upload/UploadPanel.tsx`
  **DoD (manual)**: Upload file `.pdf` sembarang → muncul pesan error jelas, tidak crash, tidak lanjut ke parsing.

---

## Phase 2 — Validasi Skema (FR-2)

- [ ] **T2.1** Implement `validateSchema(rows: RawRow[]): ValidationResult` — cek kolom wajib (§3.1 requirements.md).
  **File**: `src/lib/validateSchema.ts`
  **DoD**: Unit test: (a) data lengkap → 0 errors; (b) fixture tanpa kolom `TOTAL` → 1 error dengan message menyebut "TOTAL".

- [ ] **T2.2** Tambahkan pengecekan warning: `Jabatan` di luar `{CSM,CE,SPS}`, duplikat exact (NPK+Periode), MPG dengan CSM≠1 pada satu periode.
  **File**: `src/lib/validateSchema.ts`
  **DoD**: Unit test dengan fixture yang sengaja punya 1 MPG tanpa CSM sama sekali di 1 periode → warning muncul dengan `code` yang bisa diperiksa test (bukan cuma cek string pesan).

- [ ] **T2.3** Buat `ValidationSummary.tsx`: tampilkan errors (merah, blocking) dan warnings (kuning, dismissible) di atas layar upload/dashboard.
  **File**: `src/components/upload/ValidationSummary.tsx`
  **DoD (manual)**: Upload file dengan kolom `NPK` sengaja dihapus (buat copy modifikasi dari file asli) → muncul banner merah, dashboard tidak dirender, tombol "coba file lain" muncul.

---

## Phase 3 — Normalisasi (FR-2.5)

- [ ] **T3.1** Implement `normalizeRows(rows: RawRow[]): NormalizedRow[]` — konversi `Periode` serial → `Date` + label bulan Indonesia ("Okt 2025"), cast `NPK`/`TOTAL` ke number, map `Jabatan`/`Lokasi` ke enum (nilai tak dikenal → `'UNKNOWN'`), kumpulkan kolom metrik ke `metrics` map (skip yang null).
  **File**: `src/lib/normalizeRows.ts`
  **DoD**: Unit test: baris dengan `Periode=45931` → `periodeLabel === "Okt 2025"`; baris `Jabatan=CSM` → `metrics` tidak mengandung key `*_CE` (atau bernilai `null`, sesuai desain); urutan label bulan hasil sort kronologis benar walau input tidak berurutan.

---

## Phase 4 — Aggregation Engine (FR-3) — Prioritas tertinggi, murni logic

- [ ] **T4.1** Implement `groupByTeamPeriod(rows: NormalizedRow[])`.
  **File**: `src/lib/aggregateTeams.ts`
  **DoD**: Unit test dengan fixture 2 MPG x 2 periode → struktur grup sesuai jumlah baris per grup yang diharapkan.

- [ ] **T4.2** Implement `safeMean()` dan `computeTeamPeriodStat()` (avgTotal, memberCount, countByJabatan, pctHO/pctSERPO, metricAverages via `safeMean`).
  **File**: `src/lib/aggregateTeams.ts`
  **DoD**: Unit test: grup dengan 1 nilai metrik null di antara 3 anggota → rata-rata dihitung dari 2 nilai valid saja (bukan dianggap 0, bukan `NaN`).

- [ ] **T4.3** Implement `computeTeamTrend()` sesuai pseudocode design §5.1.
  **File**: `src/lib/aggregateTeams.ts`
  **DoD**: Unit test 3 kasus: rata-rata blok akhir jelas lebih tinggi → `direction='up'`; jelas lebih rendah → `'down'`; delta dalam ambang → `'flat'`.

- [ ] **T4.4** Implement `computeVolatility()` (stddev populasi dari `avgTotal` per periode).
  **File**: `src/lib/aggregateTeams.ts`
  **DoD**: Unit test dengan deret angka yang stddev-nya dihitung manual dulu di luar kode → hasil fungsi cocok (toleransi 1e-6).

- [ ] **T4.5** Implement `computeProsCons()` sesuai pseudocode §5.2, pakai `PROS_CONS_TOLERANCE` dari constants.
  **File**: `src/lib/aggregateTeams.ts`
  **DoD**: Unit test: metrik dengan deltaFromMean tepat di tolerance → tidak masuk pros maupun cons (boundary case); metrik jauh di atas mean → masuk pros index 0.

- [ ] **T4.6** Implement `buildTeamProfiles(rows: NormalizedRow[]): TeamProfile[]` — orkestrasi T4.1–T4.5 + ranking berdasarkan `avgTotalOverall`.
  **File**: `src/lib/aggregateTeams.ts`
  **DoD**: Unit test end-to-end dengan fixture realistis kecil (buat 3 MPG, masing² 1 CSM + 2 CE, 4 periode) → panjang hasil 3, terurut rank 1..3 sesuai avgTotal descending, tiap profile punya `pros`/`cons` tidak kosong.

- [ ] **T4.7** Jalankan seluruh Phase 4 test suite terhadap **data asli** (`Scoring_JUN26.xlsx` diparse+normalize) sebagai smoke test, bukan cuma fixture kecil.
  **File**: `src/tests/aggregateTeams.smoke.test.ts`
  **DoD**: `buildTeamProfiles` terhadap 2638 baris asli menghasilkan 22 `TeamProfile`, tidak ada `NaN`/`undefined` di `avgTotalOverall` manapun, waktu eksekusi dicatat di log test (cross-check NFR-1).

---

## Phase 5 — State & Store

- [ ] **T5.1** Buat `useDashboardStore.ts` (Zustand): state `rawRows`, `normalizedRows`, `teamProfiles`, `filters`, `uploadStatus`, `validation`; actions `loadFile()`, `setFilter()`, `reset()`.
  **File**: `src/store/useDashboardStore.ts`
  **DoD (manual)**: Dari devtools React, setelah upload sukses, state store menunjukkan `teamProfiles.length === 22` untuk file contoh.

- [ ] **T5.2** Hubungkan `App.tsx`: tampilkan `UploadPanel` bila `uploadStatus !== 'success'`, else tampilkan `DashboardShell`.
  **File**: `src/App.tsx`
  **DoD (manual)**: Alur upload → dashboard muncul tanpa reload manual; tombol "Upload file baru" (T-akan dibuat di T9.3) kembali ke layar upload.

---

## Phase 6 — Ranking Table (FR-4)

- [ ] **T6.1** Buat `TeamRankingTable.tsx`: render `teamProfiles` (dari store, sudah terfilter) sebagai tabel dengan kolom sesuai FR-4.2.
  **File**: `src/components/ranking/TeamRankingTable.tsx`
  **DoD (manual)**: Dengan file asli, tabel menampilkan 22 baris, MPG dengan avgTotal tertinggi ada di rank 1 (cocokkan manual dengan 1-2 angka hasil hitung Python sebelumnya sebagai sanity check).

- [ ] **T6.2** Tambahkan sorting per kolom (klik header).
  **File**: `src/components/ranking/TeamRankingTable.tsx`
  **DoD (manual)**: Klik header "Volatilitas" → urutan berubah ascending, klik lagi → descending.

- [ ] **T6.3** Klik baris → buka `TeamDetailDrawer` (placeholder dulu, isi lengkap di Phase 8).
  **File**: `src/components/ranking/TeamRankingTable.tsx`, `src/components/detail/TeamDetailDrawer.tsx`
  **DoD (manual)**: Klik salah satu baris → drawer/modal terbuka menampilkan nama MPG yang benar.

---

## Phase 7 — Trend Chart & Heatmap (FR-5, FR-6)

- [ ] **T7.1** Buat `TeamTrendChart.tsx` (Recharts line chart) untuk 1 MPG.
  **File**: `src/components/trend/TeamTrendChart.tsx`
  **DoD (manual)**: Chart untuk MPG apapun menunjukkan 9 titik data (sesuai 9 periode file contoh), sumbu X berlabel bulan berurutan kronologis.

- [ ] **T7.2** Tambahkan `TeamMultiSelect.tsx` agar bisa overlay hingga 5 MPG + garis rata-rata seluruh tim.
  **File**: `src/components/trend/TeamMultiSelect.tsx`, update `TeamTrendChart.tsx`
  **DoD (manual)**: Pilih 3 MPG berbeda → 3 garis warna berbeda + 1 garis benchmark putus-putus muncul bersamaan.

- [ ] **T7.3** Buat `MetricHeatmap.tsx` — 2 section (CSM metrics, CE metrics), warna berbasis persentil (design §8).
  **File**: `src/components/heatmap/MetricHeatmap.tsx`, `HeatmapCell.tsx`
  **DoD (manual)**: Heatmap CE metrics menampilkan 22 baris x 8 kolom, hover sel manapun menampilkan tooltip dengan Achievement/Target/5Scale eksak.

---

## Phase 8 — Komposisi & Pros/Cons (FR-7, FR-8)

- [ ] **T8.1** Buat `CompositionPanel.tsx`: jumlah CSM/CE/SPS + % HO/SERPO per tim.
  **File**: `src/components/composition/CompositionPanel.tsx`
  **DoD (manual)**: Angka komposisi untuk 1 MPG tertentu dicocokkan manual dengan hasil Python `groupby` sebelumnya (mis. MPG A1 = 11 CE + 1 CSM).

- [ ] **T8.2** Buat `SizeVsPerformanceChart.tsx`: scatter ukuran tim vs avgTotal.
  **File**: `src/components/composition/SizeVsPerformanceChart.tsx`
  **DoD (manual)**: 22 titik muncul di scatter, tidak ada titik NaN/di luar chart area.

- [ ] **T8.3** Buat `ProsConsCard.tsx`, isi `TeamDetailDrawer.tsx` sepenuhnya: gabungkan trend chart + heatmap tim ini + composition + pros/cons card.
  **File**: `src/components/detail/ProsConsCard.tsx`, `src/components/detail/TeamDetailDrawer.tsx`
  **DoD (manual)**: Untuk 1 MPG, card menampilkan maksimal 3 pros & 3 cons dengan nama metrik yang masuk akal (bandingkan manual ke heatmap tim tsb — metrik pros harus terlihat hijau di heatmap, cons harus merah).

---

## Phase 9 — Filtering Global, Export, Polish (FR-9, FR-10, FR-11)

- [ ] **T9.1** Buat `FilterBar.tsx`: filter rentang periode, Lokasi, multi-select MPG; hubungkan ke `useDashboardStore`.
  **File**: `src/components/layout/FilterBar.tsx`
  **DoD (manual)**: Filter Lokasi="SERPO" saja → composition panel & ranking table hanya menghitung anggota SERPO, jumlah anggota di ranking table berkurang dari total awal.

- [ ] **T9.2** Tombol "Reset filter".
  **File**: `src/components/layout/FilterBar.tsx`
  **DoD (manual)**: Setelah apply beberapa filter, klik reset → semua komponen kembali ke data penuh.

- [ ] **T9.3** Tombol "Upload file baru" (reset store, kembali ke `UploadPanel`).
  **File**: `src/App.tsx` atau `DashboardShell.tsx`
  **DoD (manual)**: Klik tombol → layar upload muncul kembali, state lama tidak "bocor" (upload file kedua yang berbeda menghasilkan angka baru, bukan gabungan).

- [ ] **T9.4** Implement `exportXlsx()` untuk tabel ranking terfilter.
  **File**: `src/lib/exportXlsx.ts`
  **DoD (manual)**: Klik export → file `.xlsx` terunduh, dibuka di Excel, isinya cocok dengan yang tampil di tabel saat itu (termasuk saat filter aktif).

- [ ] **T9.5** Implement `exportImage()` (PNG) untuk chart & heatmap.
  **File**: `src/lib/exportImage.ts`
  **DoD (manual)**: Klik export pada heatmap → file PNG terunduh dan terbuka, gambar sesuai tampilan layar.

- [ ] **T9.6** Tambahkan `ErrorBoundary` di `DashboardShell` (NFR-3).
  **File**: `src/components/common/ErrorBoundary.tsx`
  **DoD (manual)**: Simulasikan error sengaja di satu komponen chart (lempar `throw` sementara) → hanya komponen itu yang menampilkan fallback error, komponen lain (tabel, heatmap) tetap berfungsi normal.

---

## Phase 10 — Final QA terhadap data asli

- [ ] **T10.1** Full run: upload `Scoring_JUN26.xlsx` asli dari awal sampai akhir, coba seluruh fitur (filter, export, drawer, multi-select tren) satu per satu.
  **DoD (manual, checklist)**:
  - [ ] 22 tim muncul di ranking, jumlah cocok dengan hasil Python (`df['MPG'].nunique() == 22`)
  - [ ] Total anggota tanpa filter = 2638 baris data sumber (jumlah baris-periode, dicek lewat composition sum atau count)
  - [ ] Tidak ada `NaN`/`undefined` terlihat di UI manapun
  - [ ] Rank 1 & rank terakhir masuk akal dibanding sanity-check manual sebelumnya
  - [ ] Filter kombinasi (Lokasi + rentang periode + MPG tertentu) tidak membuat aplikasi blank/error
  - [ ] Export xlsx & PNG berhasil dibuka

- [ ] **T10.2** Review NFR-1 (performa): catat waktu upload→dashboard-siap di DevTools Performance tab untuk file asli.
  **DoD**: Waktu < 3 detik, atau jika lebih, dicatat sebagai known issue + rekomendasi Web Worker (design §9) untuk Phase 2.

---

## Catatan untuk Phase 2 (belum dikerjakan, referensi saja)

Setelah Phase 0–10 selesai & stabil, requirement Bagian 2 (profiling individu/NPK, korelasi CSM↔anak buah, korelasi per `Loc`) bisa dipecah jadi `requirements-phase2.md` terpisah mengikuti pola dokumen ini, supaya tidak mencampur scope dan membuat MVP susah selesai.
