export const CSM_METRICS = [
  'MoP', 'CostPerRevenue', 'CSAT', 'LWH', 'RTSuccessRatio', 'LoL', 'ReturnCons'
] as const;

export const CE_METRICS = [
  'MoP', 'CostPerRevenue', 'RTFirstVisit', 'WkTS', 'TSM',
  'ProductivityCall', 'SupportIT', 'CEComSkill'
] as const;

export const REQUIRED_COLUMNS = [
  'Periode', 'MPG', 'WCTR', 'Nama', 'NPK', 'Jabatan', 'TOTAL'
] as const;

export const VALID_JABATAN = ['CSM', 'CE', 'SPS'] as const;

export const PROS_CONS_TOLERANCE = 0.1;
export const TREND_THRESHOLD_PCT = 2;

export const HEATMAP_COLORS = {
  low: '#ef4444',
  mid: '#eab308',
  high: '#22c55e',
} as const;

export const TREND_COLORS = {
  up: '#22c55e',
  down: '#ef4444',
  flat: '#6b7280',
} as const;

export const CHART_COLORS = [
  '#8b5cf6', '#06b6d4', '#f59e0b', '#ec4899', '#10b981',
  '#f97316', '#3b82f6', '#84cc16', '#e11d48', '#14b8a6',
] as const;

export const METRIC_STAGES = [
  'Achievement', 'Target', 'Weighted', '5Scale', 'SubTotal'
] as const;

export const MONTH_NAMES_ID = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'
] as const;

export const SMALL_SAMPLE_THRESHOLD = 3;

export const PEARSON_INTERPRETATION_BANDS = [
  { max: 0.1, label: 'sangat lemah atau hampir tidak ada' },
  { max: 0.3, label: 'lemah' },
  { max: 0.5, label: 'sedang' },
  { max: 0.7, label: 'kuat' },
  { max: 1.0, label: 'sangat kuat' },
];
