# Design — MPG Team Profiling Dashboard

Referensi: `requirements.md`. Dokumen ini menerjemahkan requirement jadi arsitektur, model data, dan komponen konkret.

## 1. Arsitektur Umum

**Pilihan: Single Page Application, 100% client-side, tanpa backend/database.**

Alasan:
- Sesuai NFR-2 (privasi: file tidak boleh keluar dari browser) dan konteks "vibe coding" (cepat di-generate & di-iterate, cocok untuk tool seperti Claude Code / bolt / lovable).
- Tidak ada kebutuhan multi-user/auth/persistence lintas sesi (lihat A-4, FR-11.2).
- Semua data yang dibutuhkan (2–5rb baris) muat nyaman diproses & disimpan di memori browser.

```
┌────────────────────────────────────────────────────┐
│                    Browser (SPA)                    │
│                                                      │
│  UploadPanel ──▶ parseWorkbook() ──▶ validateSchema()│
│                        │                             │
│                        ▼                             │
│                 RawRow[] (in-memory)                 │
│                        │                             │
│                        ▼                             │
│              buildTeamAggregates()                   │
│                        │                             │
│                        ▼                             │
│         AppState (Zustand store, in-memory only)      │
│                        │                             │
│         ┌──────────────┼───────────────┐             │
│         ▼              ▼               ▼             │
│  RankingTable    TrendChart      MetricHeatmap        │
│         ▲              ▲               ▲             │
│         └──────── FilterBar (global) ──┘             │
│                        │                             │
│                        ▼                             │
│              CompositionPanel, TeamDetailDrawer       │
└────────────────────────────────────────────────────┘
```

Tidak ada API endpoint, tidak ada skema database — cukup dicatat di sini bahwa keduanya **tidak diperlukan** untuk memenuhi requirement saat ini.

## 2. Tech Stack

| Layer | Pilihan | Alasan |
|---|---|---|
| Framework | React 18 + TypeScript + Vite | Cepat di-scaffold, umum dipakai tool "vibe coding" |
| Styling | Tailwind CSS | Konsisten, cepat iterasi |
| State | Zustand | Ringan, cukup untuk 1 dataset + filter global, tanpa boilerplate Redux |
| Parsing Excel | `xlsx` (SheetJS) | Standar untuk baca `.xlsx` di browser |
| Charts | Recharts | Line chart, bar chart cukup lewat komponen deklaratif |
| Heatmap | Custom (div grid + Tailwind, tanpa library) | Kebutuhan sederhana, hindari dependency ekstra |
| Testing | Vitest + React Testing Library | Native cocok dengan Vite |

## 3. Data Flow (detail)

1. **Upload** → `File` object.
2. **Parse** (`lib/parseWorkbook.ts`): `xlsx.read()` → ambil sheet pertama → `xlsx.utils.sheet_to_json()` → `RawRow[]` (tipe belum divalidasi, semua `unknown`).
3. **Validate** (`lib/validateSchema.ts`): cek kolom wajib (FR-2.1–2.4) → hasilkan `ValidationResult { errors: FatalError[], warnings: Warning[] }`. Jika ada `FatalError` → stop, tampilkan pesan, jangan lanjut ke step 4.
4. **Normalize** (`lib/normalizeRows.ts`): konversi `Periode` serial → `Date` + label bulan (FR-2.5); cast numerik; jadikan `NormalizedRow[]`.
5. **Aggregate** (`lib/aggregateTeams.ts`, pure functions, mudah di-unit-test):
   - `groupByTeamPeriod(rows)` → `Map<MPG, Map<PeriodKey, NormalizedRow[]>>`
   - `computeTeamPeriodStat(rows)` → `{ avgTotal, memberCount, byJabatan, byLokasi, metricAverages }`
   - `computeTeamTrend(periodStats[])` → `{ direction, deltaPct }` (FR-3.2)
   - `computeVolatility(periodStats[])` → stddev (FR-3.3)
   - `computeProsCons(teamMetricAvg, overallMetricAvg)` → `{ pros: MetricDelta[], cons: MetricDelta[] }` (FR-8)
6. **Store**: hasil agregasi + `rawRows` disimpan di Zustand store (`useDashboardStore`). Filter global juga bagian dari store ini.
7. **Render**: semua komponen dashboard adalah *selector* dari store (turunan memoized dari `filteredAggregates`), tidak re-hitung ulang dari `rawRows` di tiap komponen.

## 4. Model Data (TypeScript interfaces)

```ts
// types.ts

export type Jabatan = 'CSM' | 'CE' | 'SPS' | 'UNKNOWN';
export type LokasiType = 'HO' | 'SERPO' | 'UNKNOWN';

export interface RawRow {
  [column: string]: string | number | undefined;
}

export interface NormalizedRow {
  periodeSerial: number;
  periodeDate: Date;
  periodeLabel: string;      // "Okt 2025"
  mpg: string;
  wctr: string;
  nama: string;
  npk: number;
  lokasi: LokasiType;
  loc: string;
  jabatan: Jabatan;
  total: number;
  metrics: Record<string, number | null>; // key = "Achievement_MoP_CSM" dst, hanya yang ada nilainya
}

export interface TeamPeriodStat {
  mpg: string;
  periodeLabel: string;
  avgTotal: number;
  memberCount: number;
  countByJabatan: Record<Jabatan, number>;
  pctHO: number;
  pctSERPO: number;
  metricAverages: Record<string, number>; // avg 5Scale per metrik, null di-skip
}

export interface TeamProfile {
  mpg: string;
  periodStats: TeamPeriodStat[];   // urut kronologis
  avgTotalOverall: number;
  trend: { direction: 'up' | 'down' | 'flat'; deltaPct: number };
  volatility: number;
  rank: number;
  pros: { metric: string; value: number; deltaFromMean: number }[];
  cons: { metric: string; value: number; deltaFromMean: number }[];
}

export interface ValidationResult {
  errors: { code: string; message: string }[];
  warnings: { code: string; message: string; count?: number }[];
}

export interface FilterState {
  periodeRange: [string, string] | null; // [labelAwal, labelAkhir]
  lokasi: LokasiType[] | null;
  mpgSelected: string[] | null;
}
```

## 5. Logika Kunci (pseudocode)

### 5.1 Tren tim (FR-3.2)
```
function computeTeamTrend(periodStats: TeamPeriodStat[]): Trend {
  if periodStats.length < 2: return { direction: 'flat', deltaPct: 0 }
  const n = periodStats.length
  const blockSize = n >= 6 ? 3 : 1
  const early = mean(periodStats.slice(0, blockSize).map(p => p.avgTotal))
  const late  = mean(periodStats.slice(-blockSize).map(p => p.avgTotal))
  const deltaPct = (late - early) / early * 100
  direction = deltaPct > 2 ? 'up' : deltaPct < -2 ? 'down' : 'flat'  // ambang 2% dikonfigurasi di constants.ts
  return { direction, deltaPct }
}
```

### 5.2 Pros/Cons (FR-8)
```
function computeProsCons(team: Record<metric, avg>, overall: Record<metric, avg>, tolerance = 0):
  diffs = for each metric in team: { metric, value: team[metric], deltaFromMean: team[metric] - overall[metric] }
  pros = diffs.filter(d => d.deltaFromMean > tolerance).sortDesc(deltaFromMean).slice(0,3)
  cons = diffs.filter(d => d.deltaFromMean < -tolerance).sortAsc(deltaFromMean).slice(0,3)
  return { pros, cons }
```
`tolerance` adalah konstanta bernama di `lib/constants.ts` (`PROS_CONS_TOLERANCE = 0.1`), sesuai FR-8.4 (tidak hardcode tanpa nama).

### 5.3 Null-safe averaging (FR-3.5)
```
function safeMean(values: (number|null|undefined)[]): number | null {
  const valid = values.filter(v => v != null && !isNaN(v))
  return valid.length === 0 ? null : sum(valid) / valid.length
}
```
Seluruh agregasi metrik SHALL memakai `safeMean`, bukan `Array.reduce` naif.

## 6. Komponen & Struktur File

```
src/
  main.tsx
  App.tsx                        # routing sederhana: Upload screen ↔ Dashboard screen
  types.ts
  lib/
    constants.ts                 # tolerance, ambang tren, daftar metrik CSM/CE, warna heatmap
    parseWorkbook.ts              # FR-1
    validateSchema.ts             # FR-2
    normalizeRows.ts              # FR-2.5
    aggregateTeams.ts             # FR-3, FR-8 (pure functions — unit test utama di sini)
    exportXlsx.ts                 # FR-10.1
    exportImage.ts                # FR-10.2
  store/
    useDashboardStore.ts          # Zustand: rawRows, teamProfiles, filters, uploadStatus
  components/
    upload/
      UploadPanel.tsx             # FR-1
      ValidationSummary.tsx       # FR-2.2, 2.3, 2.4 (tampilkan errors/warnings)
    layout/
      DashboardShell.tsx
      FilterBar.tsx                # FR-9
    ranking/
      TeamRankingTable.tsx         # FR-4
    trend/
      TeamTrendChart.tsx           # FR-5
      TeamMultiSelect.tsx
    heatmap/
      MetricHeatmap.tsx            # FR-6
      HeatmapCell.tsx
    composition/
      CompositionPanel.tsx         # FR-7
      SizeVsPerformanceChart.tsx
    detail/
      TeamDetailDrawer.tsx         # gabungan trend+heatmap+proscons untuk 1 tim, dipicu FR-4.4
      ProsConsCard.tsx             # FR-8
    common/
      LoadingState.tsx
      ErrorBoundary.tsx            # NFR-3
      Tooltip.tsx
  tests/
    aggregateTeams.test.ts
    validateSchema.test.ts
    normalizeRows.test.ts
```

**File yang berubah saat iterasi (refactor)**: karena ini proyek baru, tidak ada file existing untuk di-refactor — seluruh file di atas adalah file baru. Struktur ini sengaja dipisah `lib/` (pure logic, testable, tanpa React) dari `components/` (presentational) agar `tasks.md` bisa mengurutkan "logic dulu, baru UI", dan supaya AI coding tool tidak mencampur logic+rendering dalam 1 file besar yang sulit diverifikasi.

## 7. Penanganan Error (NFR-3)

- `ErrorBoundary` di level `DashboardShell` — kalau 1 komponen chart error, komponen lain tetap tampil (tidak white-screen total).
- `validateSchema` memisahkan **fatal** (hentikan render dashboard, kembali ke upload screen dengan pesan) vs **warning** (tampilkan banner kuning di atas dashboard, tetap lanjut) — sesuai FR-2.2 vs FR-2.3/2.4.
- Setiap fungsi di `lib/aggregateTeams.ts` menangani array kosong / all-null tanpa throw (return `null`/`[]`, bukan `NaN` menyebar ke UI).

## 8. Styling / Semantik Warna

- Heatmap: skala warna merah→kuning→hijau berbasis persentil relatif terhadap seluruh tim pada metrik yang sama (bukan skala absolut 1–5), supaya tetap informatif walau semua tim sama-sama tinggi/rendah. Nilai numerik tetap ditampilkan di tiap sel (NFR-6).
- Tren: ikon panah + warna (naik=hijau, turun=merah, stabil=abu) DAN teks "+3.2%"/"-1.8%" (tidak warna-only).
- Definisi warna & ambang di `lib/constants.ts`, bukan hardcode di komponen, supaya sekali diubah konsisten di semua tempat.

## 9. Performance

- Parsing besar (>2000 baris) dijalankan tetap di main thread untuk MVP (ukuran file contoh ~2.600 baris terbukti <3 detik pada `xlsx` biasa); Web Worker didokumentasikan sebagai opsi lanjutan bila file jauh lebih besar, **tidak dikerjakan di MVP** kecuali NFR-1 gagal terukur saat testing.
- `teamProfiles` dihitung sekali setelah upload+filter berubah, disimpan di store, semua komponen membaca hasil jadi (bukan re-aggregate per render) — pakai `useMemo`/Zustand selector.

## 10. Testing Strategy

- **Unit test (wajib, Vitest)**: seluruh fungsi di `lib/aggregateTeams.ts`, `lib/validateSchema.ts`, `lib/normalizeRows.ts` — karena ini pure function, gampang di-assert dengan data fixture kecil (buat fixture 3 tim x 3 periode x beberapa anggota, termasuk kasus null metrik).
- **Manual verification**: seluruh komponen UI (upload flow, filter, heatmap warna, export) — instruksi step-by-step ada di `tasks.md` per task, karena ini yang paling relevan untuk alur "vibe coding" (AI coding tool + pengecekan manual manusia di browser).
- Tidak ada E2E (Playwright dsb) di MVP — dianggap berlebihan untuk scope single-session SPA ini; bisa ditambah di Phase 2 kalau app tumbuh.
