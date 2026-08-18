# Design (Phase 2) — Individual & Jabatan Profiling

Referensi: `requirements-phase2.md`, dan `design.md` (Bagian 1) sebagai fondasi arsitektur yang **diperluas**, bukan diganti.

## 1. Prinsip Perluasan

Phase 2 **tidak membuat aplikasi baru**. `rawRows`/`normalizedRows` yang sudah ada di `useDashboardStore` (dari upload Bagian 1) dipakai ulang. Yang ditambahkan:
- 1 modul agregasi baru: `lib/aggregateIndividuals.ts`
- 1 modul korelasi baru: `lib/correlation.ts`
- 1 tab/view baru: "Profil Individu" berdampingan dengan "Profil Tim" (Bagian 1) di `DashboardShell`
- State tambahan di store yang sama (bukan store terpisah), supaya filter global (FR-9 Bagian 1) otomatis berlaku juga ke Bagian 2.

Tidak ada perubahan pada `parseWorkbook.ts`, `validateSchema.ts`, atau skema upload — file yang sama dari Bagian 1 dipakai persis, tidak ada upload kedua.

## 2. Update Arsitektur

```
                (sama seperti design.md Bagian 1, sampai tahap normalizeRows)
                             │
                             ▼
              ┌──────────────┴───────────────┐
              ▼                               ▼
   buildTeamProfiles()             buildIndividualProfiles()   ◀── BARU
   (Bagian 1, tidak berubah)               │
              │                             ▼
              │                   computeMutations()            ◀── BARU
              │                   computePeerBaselines()         ◀── BARU
              │                             │
              │                             ▼
              │                   computeCorrelations()          ◀── BARU
              │                   (CSM↔anak buah, Loc, Lokasi)
              ▼                             ▼
        useDashboardStore.teamProfiles   useDashboardStore.individualProfiles,
                                          .peerBaselines, .correlations
                             │
              ┌──────────────┴───────────────┐
              ▼                               ▼
     ViewTeamProfiling (Bagian 1)     ViewIndividualProfiling  ◀── BARU (tab baru)
```

## 3. Model Data Tambahan

```ts
// types.ts — tambahan

export interface AttributeHistoryEntry {
  periodeLabel: string;
  mpg: string;
  jabatan: Jabatan;
  loc: string;
  lokasi: LokasiType;
  total: number;
}

export interface MutasiEvent {
  fromPeriode: string;
  toPeriode: string;
  field: 'mpg' | 'jabatan' | 'loc';
  from: string;
  to: string;
}

export interface IndividualProfile {
  npk: number;
  nama: string;
  jabatanUtama: Jabatan;        // jabatan terbanyak/terkini sepanjang riwayat
  history: AttributeHistoryEntry[];   // urut kronologis, FR-P2-1.2
  mutasiEvents: MutasiEvent[];        // FR-P2-1.3
  hasMutasi: boolean;
  avgTotalOverall: number;
  trend: { direction: 'up' | 'down' | 'flat'; deltaPct: number };
  volatility: number;
  metricAverages: Record<string, number>;   // 5Scale avg per metrik, sesuai jabatanUtama
  vsTeamAvg: number;             // deltaFromMean thd avg tim (FR-P2-2.2a)
  vsPeerAvg: number;             // deltaFromMean thd avg jabatan sejenis (FR-P2-2.2b)
  rankInPeerGroup: number;       // FR-P2-2.3
  pros: { metric: string; value: number; deltaFromMean: number }[];
  cons: { metric: string; value: number; deltaFromMean: number }[];
  status: 'watchlist' | 'top_performer' | 'normal';  // FR-P2-4
}

export interface PeerBaseline {
  jabatan: Jabatan;
  periodeLabel: string;
  avgTotal: number;
  metricAverages: Record<string, number>;
  n: number;
}

export interface CsmSubordinateCorrelation {
  points: { mpg: string; periodeLabel: string; csmTotal: number; avgSubordinateTotal: number }[];
  pearsonR: number;
  n: number;
  interpretation: string;   // "korelasi positif sedang" dsb — string generator, lihat §5.2
}

export interface LocationBreakdown {
  groupBy: 'Lokasi' | 'Loc';
  jabatan: Jabatan;
  rows: { key: string; avgTotal: number; n: number; isSmallSample: boolean }[];
}
```

## 4. Modul Baru & File

```
src/
  lib/
    aggregateIndividuals.ts     # FR-P2-1, FR-P2-2, FR-P2-3, FR-P2-4
    correlation.ts               # FR-P2-6, FR-P2-7 (pearson, location breakdown)
  store/
    useDashboardStore.ts         # UPDATE: tambah state individualProfiles, peerBaselines,
                                  #         csmCorrelation, locationBreakdown; action buildPhase2()
  components/
    layout/
      DashboardShell.tsx          # UPDATE: tambah Tab switcher "Profil Tim" | "Profil Individu"
    individual/
      IndividualSearchBox.tsx     # FR-P2-8.1
      IndividualRankingTable.tsx  # ranking per peer group, FR-P2-2.3
      IndividualDetailDrawer.tsx  # profil lengkap 1 orang: history, mutasi, pros/cons
      MutasiTimeline.tsx          # visualisasi riwayat mutasi 1 orang
      WatchlistPanel.tsx          # FR-P2-4.1
      TopPerformerPanel.tsx       # FR-P2-4.2
    jabatan/
      JabatanComparisonView.tsx   # FR-P2-5: distribusi & breakdown metrik CSM vs CE vs SPS
      CEvsSPSPanel.tsx            # FR-P2-5.3
    correlation/
      CsmSubordinateScatter.tsx   # FR-P2-6
      LocationRankingTable.tsx    # FR-P2-7.1, 7.2
      LocationFilterToggle.tsx    # FR-P2-7.3
  tests/
    aggregateIndividuals.test.ts
    correlation.test.ts
```

Update pada `TeamRankingTable.tsx`/`TeamDetailDrawer.tsx` (Bagian 1): tambah `onClick` pada nama anggota → panggil `setSelectedIndividual(npk)` di store → buka `IndividualDetailDrawer` (FR-P2-8.2). Ini satu-satunya perubahan pada kode Bagian 1 yang sudah ada.

## 5. Logika Kunci (pseudocode)

### 5.1 Deteksi mutasi (FR-P2-1.3, A-P2-4)
```
function computeMutations(history: AttributeHistoryEntry[]): MutasiEvent[] {
  events = []
  for i in 1..history.length-1:
    prev = history[i-1]; curr = history[i]
    for field in ['mpg', 'jabatan', 'loc']:
      if prev[field] != curr[field]:
        events.push({ fromPeriode: prev.periodeLabel, toPeriode: curr.periodeLabel,
                       field, from: prev[field], to: curr[field] })
  return events
}
```
Catatan: history harus sudah terurut kronologis sebelum dipanggil (pakai `normalizeRows` yang sudah sort, lihat design.md §5).

### 5.2 Korelasi CSM ↔ anak buah (FR-P2-6)
```
function computeCsmSubordinateCorrelation(teamPeriodRows): CsmSubordinateCorrelation {
  points = []
  for each (mpg, periode) group:
    csmRow = rows.find(r => r.jabatan === 'CSM')
    subRows = rows.filter(r => r.jabatan !== 'CSM')
    if csmRow && subRows.length > 0:
      points.push({ mpg, periodeLabel, csmTotal: csmRow.total,
                     avgSubordinateTotal: safeMean(subRows.map(r => r.total)) })
  r = pearsonCorrelation(points.map(p => p.csmTotal), points.map(p => p.avgSubordinateTotal))
  interpretation = interpretR(r)   // |r|<0.1 'sangat lemah/tidak ada', <0.3 'lemah', <0.5 'sedang', <0.7 'kuat', else 'sangat kuat' — arah dari tanda r
  return { points, pearsonR: r, n: points.length, interpretation }
}
```
`pearsonCorrelation` diimplementasikan manual (rumus standar, tanpa library statistik tambahan — cukup ringan, tidak perlu dependency baru).

### 5.3 Location breakdown dengan flag sampel kecil (FR-P2-7.2)
```
function computeLocationBreakdown(rows, groupBy: 'Lokasi'|'Loc', jabatanFilter?): LocationBreakdown {
  filtered = jabatanFilter ? rows.filter(r => r.jabatan === jabatanFilter) : rows
  grouped = groupBy(filtered, r => r[groupBy])
  result = grouped.map(([key, groupRows]) => ({
    key, avgTotal: safeMean(groupRows.map(r=>r.total)), n: groupRows.length,
    isSmallSample: groupRows.length < SMALL_SAMPLE_THRESHOLD   // constants.ts, default 3 (A-P2-3)
  }))
  return { groupBy, jabatan: jabatanFilter, rows: result.sortDesc(avgTotal) }
}
```

### 5.4 Peer baseline & pros/cons individu (FR-P2-2.1, FR-P2-3.1)
Menggunakan ulang `computeProsCons()` dari `aggregateTeams.ts` (Bagian 1) — fungsi ini generik (menerima `Record<metric, avg>` apapun sebagai target & baseline), **tidak perlu ditulis ulang**, cukup dipanggil dengan `baseline = peerBaseline.metricAverages` alih-alih `overallMetricAvg` tim. Ini alasan kenapa `computeProsCons` di Bagian 1 sengaja dibuat generik/reusable sejak awal.

### 5.5 Watchlist / Top performer (FR-P2-4)
```
function classifyStatus(profile): 'watchlist' | 'top_performer' | 'normal' {
  if profile.trend.direction === 'down' && profile.vsPeerAvg < 0: return 'watchlist'
  if profile.trend.direction !== 'down' && profile.vsPeerAvg > 0: return 'top_performer'
  return 'normal'
}
```

## 6. Konstanta Baru (`lib/constants.ts`, ditambahkan ke file yang sama dari Bagian 1)

```ts
export const SMALL_SAMPLE_THRESHOLD = 3;       // A-P2-3, FR-P2-7.2
export const PEARSON_INTERPRETATION_BANDS = [
  { max: 0.1, label: 'sangat lemah / tidak ada' },
  { max: 0.3, label: 'lemah' },
  { max: 0.5, label: 'sedang' },
  { max: 0.7, label: 'kuat' },
  { max: 1.0, label: 'sangat kuat' },
];
```

## 7. Bahasa & UX untuk Klaim Korelasi (NFR-P2-3)

- Semua teks yang dihasilkan otomatis dari `interpretR()` dan sejenisnya WAJIB pakai kata "berasosiasi dengan" / "cenderung diikuti oleh", **tidak pernah** "menyebabkan" / "membuat" / "karena". Ini diberlakukan lewat 1 fungsi generator teks terpusat (`lib/textInterpretation.ts`) supaya konsisten, bukan ditulis manual di tiap komponen.
- Setiap komponen yang menampilkan angka korelasi/rata-rata per grup kecil WAJIB render `n=...` di sebelah angka (bukan di tooltip tersembunyi) — cek ini masuk ke Definition of Done di `tasks-phase2.md`.

## 8. Testing Strategy (tambahan)

- Unit test `aggregateIndividuals.ts`: fixture 1 orang dengan riwayat 4 periode termasuk 1x pindah MPG di tengah → `mutasiEvents.length === 1`, field yang benar terdeteksi.
- Unit test `correlation.ts`: `pearsonCorrelation([1,2,3],[1,2,3]) ≈ 1`; `pearsonCorrelation([1,2,3],[3,2,1]) ≈ -1`; dataset acak tak berkorelasi menghasilkan `|r|` kecil.
- Smoke test dengan data asli: `computeCsmSubordinateCorrelation` terhadap 2638 baris asli → `n` harus mendekati (jumlah MPG-periode dengan CSM terisi), dicek tidak melebihi 22×9=198.
