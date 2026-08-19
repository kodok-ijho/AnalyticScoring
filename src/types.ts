export type Jabatan = 'CSM' | 'CE' | 'SPS' | 'UNKNOWN';
export type LokasiType = 'HO' | 'SERPO' | 'UNKNOWN';

export interface RawRow {
  [column: string]: string | number | undefined;
}

export interface NormalizedRow {
  periodeSerial: number;
  periodeDate: Date;
  periodeLabel: string;
  mpg: string;
  wctr: string;
  nama: string;
  npk: number;
  lokasi: LokasiType;
  loc: string;
  jabatan: Jabatan;
  currentMpg?: string | null;
  currentWctr?: string | null;
  currentJabatan?: Jabatan | null;
  total: number;
  metrics: Record<string, number | null>;
}

export interface TeamPeriodStat {
  mpg: string;
  periodeLabel: string;
  avgTotal: number;
  avgTotalCsm?: number;
  avgTotalAnggota?: number;
  memberCount: number;
  countByJabatan: Record<Jabatan, number>;
  pctHO: number;
  pctSERPO: number;
  metricAverages: Record<string, number>;
}

export interface TeamProfile {
  mpg: string;
  periodStats: TeamPeriodStat[];
  avgTotalOverall: number;
  avgTotalCsmOverall?: number;
  avgTotalAnggotaOverall?: number;
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
  periodeRange: [string, string] | null;
  lokasi: LokasiType[] | null;
  mpgSelected: string[] | null;
}

export type AnalysisScope = 'monthly' | 'fiscal-year';

export interface FiscalYearOption {
  startYear: number;
  endYear: number;
  label: string;
  firstPeriod: string;
  lastPeriod: string;
  periodCount: number;
  isComplete: boolean;
}

export type UploadStatus = 'idle' | 'loading' | 'validating' | 'success' | 'error';

export interface SqlServerConnection {
  server: string;
  username: string;
  password: string;
  database: string;
  driver?: string;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
}

export interface SqlServerQueryFilters {
  mpg: string;
  periodeStart: string;
  periodeEnd: string;
}

export interface SqlServerQueryResponse {
  columns: string[];
  rows: unknown[][];
  returnedRowCount: number;
  limitExceeded: boolean;
  durationMs: number;
  database: string;
}

export type DataSourceMetadata =
  | { kind: 'excel'; label: string; sheetName: string }
  | {
      kind: 'sqlserver';
      label: string;
      server: string;
      database: string;
      durationMs: number;
      returnedRowCount: number;
      limitExceeded: boolean;
    };
export type SortDirection = 'asc' | 'desc';
export type SortField = 'rank' | 'mpg' | 'avgTotalOverall' | 'avgTotalCsmOverall' | 'avgTotalAnggotaOverall' | 'deltaPct' | 'volatility' | 'memberCount' | 'pctHO';

export interface AttributeHistoryEntry {
  periodeLabel: string;
  mpg: string;
  wctr: string;
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
  jabatanUtama: Jabatan;
  history: AttributeHistoryEntry[];
  mutasiEvents: MutasiEvent[];
  hasMutasi: boolean;
  avgTotalOverall: number;
  trend: { direction: 'up' | 'down' | 'flat'; deltaPct: number };
  volatility: number;
  metricAverages: Record<string, number>;
  vsTeamAvg: number;
  vsPeerAvg: number;
  rankInPeerGroup: number;
  pros: { metric: string; value: number; deltaFromMean: number }[];
  cons: { metric: string; value: number; deltaFromMean: number }[];
  status: 'watchlist' | 'top_performer' | 'normal';
  currentWctr?: string;
  currentMpg?: string;
  currentLoc?: string;
  clusterId?: string;
  clusterLabel?: string;
  anomalyCount?: number;
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
  interpretation: string;
}

export interface LocationBreakdownRow {
  key: string;
  avgTotal: number;
  n: number;
  isSmallSample: boolean;
}

export interface LocationBreakdown {
  groupBy: 'Lokasi' | 'Loc';
  jabatan: Jabatan | null;
  rows: LocationBreakdownRow[];
}

export type ContextEffectFactor = 'team' | 'branch' | 'location';

export interface ContextEffectValue {
  effect: number | null;
  peerCount: number;
}

export interface IndividualContextEffect {
  team: ContextEffectValue;
  branch: ContextEffectValue;
  location: ContextEffectValue;
}

export interface ContextEffectSummary {
  factor: ContextEffectFactor;
  label: string;
  etaSquared: number;
  groupCount: number;
  sampleCount: number;
  interpretation: string;
}

export interface ContextAnalysis {
  summaries: ContextEffectSummary[];
  individualEffects: Record<string, IndividualContextEffect>;
}

export type IndividualSortField =
  | 'rankInPeerGroup'
  | 'npk'
  | 'nama'
  | 'wctr'
  | 'jabatanUtama'
  | 'avgTotalOverall'
  | 'deltaPct'
  | 'volatility'
  | 'vsTeamAvg'
  | 'vsPeerAvg';

// ==================== ENHANCEMENT 1: CLUSTERING TYPES ====================
export type ArchetypeCategory =
  | 'solid_anchor'       // Skor tinggi, volatilitas rendah, tren stabil/naik
  | 'rising_potential'   // Tren akselerasi positif kuat, skor berkembang
  | 'volatile_performer' // Skor fluktuatif tinggi, rawan tidak stabil
  | 'needs_coaching'     // Skor rendah konsisten, tren stagnan/turun
  | 'metric_specialist'; // Skor rata-rata tapi sangat dominan di metrik teknis/CSAT tertentu

export interface ClusterArchetype {
  id: string;
  category: ArchetypeCategory;
  name: string;
  badgeColor: string;
  description: string;
  avgScore: number;
  avgVolatility: number;
  avgTrendDeltaPct: number;
  strengths: string[];
}

export interface PersonnelCluster {
  id: string;
  archetype: ClusterArchetype;
  memberNpks: number[];
  size: number;
  percentage: number;
}

// ==================== ENHANCEMENT 2: ANOMALY DETECTION TYPES ====================
export type AnomalySeverity = 'critical' | 'warning' | 'info';
export type AnomalyCategory =
  | 'mutation_drift'      // Skor anjlok atau melonjak drastis pasca mutasi cabang/tim
  | 'temporal_spike'      // Lonjakan atau penurunan ekstrim di satu bulan tertentu (> 2.5σ)
  | 'metric_polarization' // Skor total tinggi tapi 1 metrik kritis jeblok, atau sebaliknya
  | 'cohort_outlier';     // Deviasi signifikan (> 2.0σ) dibanding rekan cabang/tim setempat

export interface AnomalyEvidence {
  baselineValue: number;
  observedValue: number;
  delta: number;
  unit: string;
  details: string;
}

export interface AnomalyRecord {
  id: string;
  npk: number;
  nama: string;
  jabatan: Jabatan;
  mpg: string;
  loc: string;
  category: AnomalyCategory;
  severity: AnomalySeverity;
  title: string;
  description: string;
  evidence: AnomalyEvidence;
  periodLabel?: string;
}

export interface AnomalyAnalysisResult {
  anomalies: AnomalyRecord[];
  summaryByCategory: Record<AnomalyCategory, number>;
  summaryBySeverity: Record<AnomalySeverity, number>;
}

// ==================== ENHANCEMENT 3: CHAT TOOL CALLING TYPES ====================
export interface ChatToolParameterProperty {
  type: string;
  description: string;
  enum?: string[];
}

export interface ChatToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, ChatToolParameterProperty>;
      required?: string[];
    };
  };
}

export interface ChatToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

