# Tasks (Phase 2) — Individual & Jabatan Profiling

Referensi: `requirements-phase2.md`, `design-phase2.md`. Prasyarat: Phase 1 (`tasks.md`) sudah selesai sampai minimal Phase 6 (ranking table jalan), karena Phase 2 memakai ulang store & data yang sama.

---

## Phase P2-0 — Setup Perluasan

- [ ] **T-P2-0.1** Tambahkan interfaces baru (`IndividualProfile`, `AttributeHistoryEntry`, `MutasiEvent`, `PeerBaseline`, `CsmSubordinateCorrelation`, `LocationBreakdown`) ke `types.ts`.
  **File**: `src/types.ts`
  **DoD**: `tsc --noEmit` tidak error; tidak ada breaking change pada interface Bagian 1 yang sudah ada (`TeamProfile` dkk tetap utuh).

- [ ] **T-P2-0.2** Tambahkan `SMALL_SAMPLE_THRESHOLD` dan `PEARSON_INTERPRETATION_BANDS` ke `constants.ts`.
  **File**: `src/lib/constants.ts`
  **DoD**: Diimport di 1 unit test dummy, nilai sesuai design-phase2.md §6.

---

## Phase P2-1 — Riwayat & Deteksi Mutasi (FR-P2-1)

- [ ] **T-P2-1.1** Implement `buildAttributeHistory(npk, normalizedRows): AttributeHistoryEntry[]` — filter baris milik 1 NPK, urut kronologis.
  **File**: `src/lib/aggregateIndividuals.ts`
  **DoD**: Unit test dengan fixture 1 NPK x 4 periode → hasil panjang 4, urut sesuai periode, bukan urutan input file.

- [ ] **T-P2-1.2** Implement `computeMutations(history): MutasiEvent[]` sesuai pseudocode design §5.1.
  **File**: `src/lib/aggregateIndividuals.ts`
  **DoD**: Unit test 3 skenario: (a) tidak ada perubahan apapun → `[]`; (b) 1x ganti `mpg` di tengah → 1 event field='mpg' dengan `from`/`to` benar; (c) ganti `mpg` DAN `loc` di periode yang sama → 2 event terpisah pada periode yang sama.

- [ ] **T-P2-1.3** Implement `buildIndividualProfiles(normalizedRows): IndividualProfile[]` — orkestrasi awal: history, mutasi, `jabatanUtama` (modus/paling sering muncul), `avgTotalOverall`, `trend`, `volatility` (pakai ulang fungsi tren/volatilitas dari `aggregateTeams.ts`, jangan tulis ulang).
  **File**: `src/lib/aggregateIndividuals.ts`
  **DoD**: Unit test dengan fixture 3 orang (1 tanpa mutasi, 1 dengan mutasi jabatan, 1 dengan riwayat cuma 2 periode) → 3 profile valid, `hasMutasi` benar untuk masing², tidak ada crash untuk orang dengan riwayat pendek.

- [ ] **T-P2-1.4** Smoke test terhadap data asli.
  **File**: `src/tests/aggregateIndividuals.smoke.test.ts`
  **DoD**: `buildIndividualProfiles` atas 2638 baris asli → panjang hasil = 317 (jumlah NPK unik), jumlah `hasMutasi=true` sekitar 17-22 orang (cross-check dgn analisis Python sebelumnya: 22 ganti jabatan, 17 ganti MPG, 48 ganti Loc — total unique orang yang minimal 1x mutasi apapun harus ≥22 dan biasanya <87 karena overlap).

---

## Phase P2-2 — Peer Baseline & Pros/Cons Individu (FR-P2-2, FR-P2-3)

- [ ] **T-P2-2.1** Implement `computePeerBaselines(normalizedRows): PeerBaseline[]` — rata-rata per jabatan per periode.
  **File**: `src/lib/aggregateIndividuals.ts`
  **DoD**: Unit test: baseline untuk jabatan='CSM' pada 1 periode tertentu, hitung manual dari fixture, cocok dengan hasil fungsi (toleransi 1e-6).

- [ ] **T-P2-2.2** Hitung `vsTeamAvg`, `vsPeerAvg`, `rankInPeerGroup` untuk tiap `IndividualProfile`.
  **File**: `src/lib/aggregateIndividuals.ts`
  **DoD**: Unit test: 3 orang jabatan sama, `rankInPeerGroup` terurut benar berdasarkan `avgTotalOverall` descending; orang beda jabatan tidak saling memengaruhi ranking satu sama lain.

- [ ] **T-P2-2.3** Isi `pros`/`cons` tiap `IndividualProfile` dengan memanggil ulang `computeProsCons()` dari `aggregateTeams.ts` (bukan tulis ulang — lihat design §5.4), baseline = `peerBaseline.metricAverages` milik jabatan yang sama.
  **File**: `src/lib/aggregateIndividuals.ts`
  **DoD**: Unit test: orang dengan 1 metrik jelas di atas rata-rata peer → metrik itu muncul di `pros[0]`.

---

## Phase P2-3 — Watchlist & Top Performer (FR-P2-4)

- [ ] **T-P2-3.1** Implement `classifyStatus()` sesuai pseudocode §5.5, panggil untuk semua profile.
  **File**: `src/lib/aggregateIndividuals.ts`
  **DoD**: Unit test 3 kasus eksplisit (turun+dibawah rata2 → watchlist; naik+diatas rata2 → top_performer; campuran → normal).

- [ ] **T-P2-3.2** Buat `WatchlistPanel.tsx` dan `TopPerformerPanel.tsx`, dengan filter jabatan & MPG (FR-P2-4.3).
  **File**: `src/components/individual/WatchlistPanel.tsx`, `TopPerformerPanel.tsx`
  **DoD (manual)**: Dengan data asli, watchlist menampilkan daftar nama masuk akal (silang cek 1-2 nama dengan grafik tren individunya — harus benar-benar terlihat turun).

---

## Phase P2-4 — UI Individu: Search, Ranking, Detail (FR-P2-2.3, FR-P2-8)

- [ ] **T-P2-4.1** Tambah tab switcher "Profil Tim" | "Profil Individu" di `DashboardShell.tsx`.
  **File**: `src/components/layout/DashboardShell.tsx`
  **DoD (manual)**: Pindah tab tidak mengulang upload/reset filter global; filter Bagian 1 yang aktif tetap berlaku saat pindah ke tab individu.

- [ ] **T-P2-4.2** Buat `IndividualSearchBox.tsx` (cari by Nama/NPK).
  **File**: `src/components/individual/IndividualSearchBox.tsx`
  **DoD (manual)**: Ketik sebagian nama karyawan asli → hasil ter-filter real-time, klik salah satu → detail terbuka.

- [ ] **T-P2-4.3** Buat `IndividualRankingTable.tsx` — ranking per peer group (toggle jabatan CSM/CE/SPS).
  **File**: `src/components/individual/IndividualRankingTable.tsx`
  **DoD (manual)**: Toggle ke "SPS" → tabel hanya 163-baris-worth of unique SPS people, ranking dimulai dari 1 lagi (bukan lanjutan ranking CE).

- [ ] **T-P2-4.4** Buat `IndividualDetailDrawer.tsx` (skor per periode, pros/cons, vsTeamAvg/vsPeerAvg) + `MutasiTimeline.tsx`.
  **File**: `src/components/individual/IndividualDetailDrawer.tsx`, `MutasiTimeline.tsx`
  **DoD (manual)**: Buka profil orang yang diketahui `hasMutasi=true` dari smoke test T-P2-1.4 → timeline menampilkan event mutasi dengan periode & field yang benar (mis. "MPG berubah dari A1 ke B1 pada Mar 2026").

- [ ] **T-P2-4.5** Hubungkan klik nama anggota di `TeamDetailDrawer.tsx` (Bagian 1) → buka `IndividualDetailDrawer` (FR-P2-8.2).
  **File**: `src/components/detail/TeamDetailDrawer.tsx` (update kecil)
  **DoD (manual)**: Dari tab Profil Tim, klik nama anggota → otomatis pindah ke profil individu orang tsb.

---

## Phase P2-5 — Perbandingan Antar Jabatan (FR-P2-5)

- [ ] **T-P2-5.1** Buat `JabatanComparisonView.tsx`: distribusi TOTAL per jabatan (bar/box sederhana pakai Recharts).
  **File**: `src/components/jabatan/JabatanComparisonView.tsx`
  **DoD (manual)**: 3 kelompok (CSM/CE/SPS) tampil berdampingan dengan skala yang jelas berbeda tercatat (CSM ≠ skala CE, jangan digabung 1 sumbu tanpa keterangan).

- [ ] **T-P2-5.2** Buat `CEvsSPSPanel.tsx`: breakdown metrik CE vs SPS berdampingan (keduanya pakai metrik yang sama).
  **File**: `src/components/jabatan/CEvsSPSPanel.tsx`
  **DoD (manual)**: 8 metrik CE tampil dengan 2 bar (CE vs SPS) per metrik, angka bisa dicek manual terhadap 1-2 metrik hasil groupby Python.

---

## Phase P2-6 — Korelasi CSM ↔ Anak Buah (FR-P2-6)

- [ ] **T-P2-6.1** Implement `pearsonCorrelation(x[], y[]): number` (rumus manual, tanpa dependency baru).
  **File**: `src/lib/correlation.ts`
  **DoD**: Unit test sesuai design §8: `[1,2,3]` vs `[1,2,3]` → ~1; vs `[3,2,1]` → ~-1; data acak tak berkorelasi → `|r| < 0.3` (pakai seed tetap di fixture supaya test deterministik).

- [ ] **T-P2-6.2** Implement `computeCsmSubordinateCorrelation()` sesuai pseudocode §5.2.
  **File**: `src/lib/correlation.ts`
  **DoD**: Unit test fixture 3 MPG x 2 periode, salah satu MPG sengaja tanpa CSM di 1 periode → titik itu di-skip, `n` sesuai jumlah pasangan valid saja.

- [ ] **T-P2-6.3** Smoke test dengan data asli.
  **File**: `src/tests/correlation.smoke.test.ts`
  **DoD**: `n <= 198` (22 MPG × 9 periode), `pearsonR` adalah angka valid antara -1 dan 1 (bukan NaN).

- [ ] **T-P2-6.4** Buat `CsmSubordinateScatter.tsx` — scatter plot + garis tren + tampilkan `r` dan `n` berdampingan (NFR-P2-2).
  **File**: `src/components/correlation/CsmSubordinateScatter.tsx`
  **DoD (manual)**: Grafik menampilkan titik-titik, angka `r` dan `n=...` terlihat jelas di header chart (bukan tersembunyi di tooltip), teks interpretasi pakai kata "berasosiasi" (bukan "menyebabkan").

---

## Phase P2-7 — Korelasi Lokasi/Cabang (FR-P2-7)

- [ ] **T-P2-7.1** Implement `computeLocationBreakdown()` sesuai pseudocode §5.3.
  **File**: `src/lib/correlation.ts`
  **DoD**: Unit test: grup dengan 2 anggota → `isSmallSample=true` (ambang default 3); grup dengan 5 anggota → `false`.

- [ ] **T-P2-7.2** Buat `LocationRankingTable.tsx` (ranking per `Loc`) + `LocationFilterToggle.tsx` (filter jabatan, FR-P2-7.3).
  **File**: `src/components/correlation/LocationRankingTable.tsx`, `LocationFilterToggle.tsx`
  **DoD (manual)**: Toggle ke jabatan="CE" → tabel cabang hanya menghitung CE; baris dengan n<3 diberi badge "sampel kecil" yang terlihat jelas (bukan cuma warna beda).

- [ ] **T-P2-7.3** Tambahkan panel ringkas `Lokasi` (HO vs SERPO) di atas tabel `Loc` — 2 angka besar berdampingan + n masing².
  **File**: `src/components/correlation/LocationRankingTable.tsx` (section tambahan)
  **DoD (manual)**: Bandingkan manual: rata-rata HO vs SERPO untuk jabatan CE, cocokkan dengan groupby Python cepat sebagai sanity check.

---

## Phase P2-8 — Final QA Phase 2

- [ ] **T-P2-8.1** Full run dengan data asli: buka tab Profil Individu, coba search, watchlist, top performer, jabatan comparison, kedua jenis korelasi.
  **DoD (manual checklist)**:
  - [ ] 317 individu bisa dicari semua
  - [ ] Minimal 1 orang dengan mutasi ditemukan & timeline-nya masuk akal
  - [ ] Watchlist & Top Performer tidak overlap (tidak ada 1 orang muncul di keduanya sekaligus)
  - [ ] Korelasi CSM↔anak buah menampilkan n dan r yang valid, tidak NaN
  - [ ] Ranking cabang menampilkan badge sampel kecil dengan benar untuk cabang kecil
  - [ ] Semua teks korelasi/asosiasi memakai bahasa deskriptif, tidak ada klaim sebab-akibat
  - [ ] Filter global (dari Bagian 1) tetap konsisten memengaruhi tab Individu

- [ ] **T-P2-8.2** Review NFR-P2-1 (performa tambahan Phase 2).
  **DoD**: Waktu render tab Individu setelah data Bagian 1 sudah ada di store < 1 detik tambahan, dicatat di DevTools Performance tab.

---

## Catatan Lanjutan

Uji statistik formal (p-value, ANOVA/regresi berganda untuk isolasi pengaruh cabang vs jabatan vs waktu secara simultan) sengaja **tidak** masuk Phase 2 (lihat FR-P2-7.4 & Out of Scope di `requirements-phase2.md`). Jika nanti dibutuhkan, disarankan sebagai `requirements-phase3.md` terpisah — kemungkinan besar itu titik di mana kombinasi Python (untuk kekuatan library statistik) + React (untuk UI) baru mulai masuk akal dipertimbangkan lagi.
