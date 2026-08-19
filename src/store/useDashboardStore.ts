import { create } from 'zustand';
import type {
  RawRow,
  NormalizedRow,
  TeamProfile,
  FilterState,
  ValidationResult,
  UploadStatus,
  IndividualProfile,
  PeerBaseline,
  CsmSubordinateCorrelation,
  LocationBreakdown,
  DataSourceMetadata,
  ContextAnalysis,
  AnalysisScope,
  PersonnelCluster,
  AnomalyAnalysisResult,
  AnomalyCategory,
} from '../types';
import { parseWorkbook } from '../lib/parseWorkbook';
import { validateSchema } from '../lib/validateSchema';
import { normalizeRows, getUniquePeriods } from '../lib/normalizeRows';
import { buildTeamProfiles } from '../lib/aggregateTeams';
import { buildIndividualProfiles, computePeerBaselines } from '../lib/aggregateIndividuals';
import { clusterPersonnel } from '../lib/clustering';
import { detectAnomalies } from '../lib/anomalyDetection';
import {
  computeCsmSubordinateCorrelation,
  computeLocationBreakdown,
} from '../lib/correlation';
import { computeContextAnalysis } from '../lib/contextAnalysis';
import {
  getFiscalYearRange,
  getFiscalYearStart,
  getLatestPeriod,
} from '../lib/analysisPeriods';
import { rowsForTeamAnalysis } from '../lib/teamAssignment';

interface DashboardState {
  rawRows: RawRow[];
  normalizedRows: NormalizedRow[];
  filteredRows: NormalizedRow[];
  teamProfiles: TeamProfile[];
  filteredProfiles: TeamProfile[];
  sheetName: string;
  dataSource: DataSourceMetadata | null;
  uploadStatus: UploadStatus;
  validation: ValidationResult | null;
  filters: FilterState;
  selectedTeam: string | null;
  compareTeams: string[];
  availablePeriods: string[];
  availableMpgs: string[];
  analysisScope: AnalysisScope;
  selectedMonth: string | null;
  selectedFiscalYearStart: number | null;

  // Phase 2 state
  activeTab: 'team' | 'individual';
  individualProfiles: IndividualProfile[];
  filteredIndividualProfiles: IndividualProfile[];
  clusters: PersonnelCluster[];
  selectedClusterId: string | null;
  selectedClusterMemberNpks: number[] | null;
  selectedClusterLabel: string | null;
  anomalyAnalysis: AnomalyAnalysisResult | null;
  selectedAnomalyCategory: AnomalyCategory | null;
  peerBaselines: PeerBaseline[];
  csmCorrelation: CsmSubordinateCorrelation | null;
  locationBreakdownLoc: LocationBreakdown | null;
  locationBreakdownType: LocationBreakdown | null;
  contextAnalysis: ContextAnalysis | null;
  selectedIndividual: number | null; // NPK

  loadFile: (file: File) => Promise<void>;
  loadRows: (rows: RawRow[], source: DataSourceMetadata) => void;
  loadDatabaseRows: (
    rows: RawRow[],
    source: Extract<DataSourceMetadata, { kind: 'sqlserver' }>
  ) => void;
  setFilter: (partial: Partial<FilterState>) => void;
  resetFilters: () => void;
  reset: () => void;
  setSelectedTeam: (mpg: string | null) => void;
  toggleCompareTeam: (mpg: string) => void;
  clearCompareTeams: () => void;
  setAnalysisScope: (scope: AnalysisScope) => void;
  setAnalysisMonth: (period: string) => void;
  setAnalysisFiscalYear: (startYear: number) => void;

  // Phase 2 & Enhancement actions
  setActiveTab: (tab: 'team' | 'individual') => void;
  setSelectedIndividual: (npk: number | null) => void;
  setSelectedCluster: (cluster: { id: string; name: string; memberNpks: number[] } | null) => void;
  setSelectedClusterId: (id: string | null) => void;
  setSelectedAnomalyCategory: (category: AnomalyCategory | null) => void;
}


const initialFilters: FilterState = {
  periodeRange: null,
  lokasi: null,
  mpgSelected: null,
};

function applyFilters(
  rows: NormalizedRow[],
  filters: FilterState,
  availablePeriods: string[],
  scope: AnalysisScope,
): NormalizedRow[] {
  let filtered = rows;

  // Filter by periode range
  if (filters.periodeRange) {
    const [start, end] = filters.periodeRange;
    const startIdx = availablePeriods.indexOf(start);
    const endIdx = availablePeriods.indexOf(end);
    if (startIdx >= 0 && endIdx >= 0) {
      const validPeriods = new Set(
        availablePeriods.slice(startIdx, endIdx + 1)
      );
      filtered = filtered.filter((r) => validPeriods.has(r.periodeLabel));
    }
  }

  // Filter by lokasi
  if (filters.lokasi && filters.lokasi.length > 0) {
    const lokasiSet = new Set(filters.lokasi);
    filtered = filtered.filter((r) => lokasiSet.has(r.lokasi));
  }

  // Filter by MPG
  if (filters.mpgSelected && filters.mpgSelected.length > 0) {
    const mpgSet = new Set(filters.mpgSelected);
    filtered = filtered.filter((row) => {
      const mpg = scope === 'fiscal-year' && row.currentMpg
        ? row.currentMpg
        : row.mpg;
      return mpgSet.has(mpg);
    });
  }

  return filtered;
}

function scopePeriodRange(
  rows: NormalizedRow[],
  scope: AnalysisScope,
  selectedMonth: string | null,
  selectedFiscalYearStart: number | null,
): [string, string] | null {
  if (scope === 'monthly') {
    const latest = getLatestPeriod(rows)?.periodeLabel ?? null;
    const period = selectedMonth && rows.some((row) => row.periodeLabel === selectedMonth)
      ? selectedMonth
      : latest;
    return period ? [period, period] : null;
  }
  return getFiscalYearRange(rows, selectedFiscalYearStart);
}

function deriveFilteredViews(
  rows: NormalizedRow[],
  peerBaselines: PeerBaseline[],
  scope: AnalysisScope,
  locationJob: LocationBreakdown['jabatan'] = null,
) {
  const teamRows = rowsForTeamAnalysis(rows, scope);
  const indProfiles = buildIndividualProfiles(rows, peerBaselines);
  const clustered = clusterPersonnel(indProfiles);
  const anomalyAnalysis = detectAnomalies(clustered.profiles, rows);

  const anomalyCountsByNpk = new Map<number, number>();
  for (const a of anomalyAnalysis.anomalies) {
    anomalyCountsByNpk.set(a.npk, (anomalyCountsByNpk.get(a.npk) ?? 0) + 1);
  }

  const finalIndividualProfiles = clustered.profiles.map((p) => ({
    ...p,
    anomalyCount: anomalyCountsByNpk.get(p.npk) ?? 0,
  }));

  return {
    filteredRows: teamRows,
    filteredProfiles: buildTeamProfiles(teamRows),
    filteredIndividualProfiles: finalIndividualProfiles,
    clusters: clustered.clusters,
    anomalyAnalysis,
    csmCorrelation: computeCsmSubordinateCorrelation(teamRows),
    locationBreakdownLoc: computeLocationBreakdown(teamRows, 'Loc', locationJob),
    locationBreakdownType: computeLocationBreakdown(teamRows, 'Lokasi', locationJob),
    contextAnalysis: computeContextAnalysis(teamRows),
  };
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  rawRows: [],
  normalizedRows: [],
  filteredRows: [],
  teamProfiles: [],
  filteredProfiles: [],
  sheetName: '',
  dataSource: null,
  uploadStatus: 'idle',
  validation: null,
  filters: { ...initialFilters },
  selectedTeam: null,
  compareTeams: [],
  availablePeriods: [],
  availableMpgs: [],
  analysisScope: 'fiscal-year',
  selectedMonth: null,
  selectedFiscalYearStart: null,

  // Phase 2 initial state
  activeTab: 'team',
  individualProfiles: [],
  filteredIndividualProfiles: [],
  clusters: [],
  selectedClusterId: null,
  selectedClusterMemberNpks: null,
  selectedClusterLabel: null,
  anomalyAnalysis: null,
  selectedAnomalyCategory: null,
  peerBaselines: [],
  csmCorrelation: null,
  locationBreakdownLoc: null,
  locationBreakdownType: null,
  contextAnalysis: null,
  selectedIndividual: null,


  loadRows: (rows: RawRow[], source: DataSourceMetadata) => {
    try {
      set({
        rawRows: rows,
        sheetName: source.label,
        dataSource: source,
        uploadStatus: 'validating',
        validation: null,
      });

      const validation = validateSchema(rows);
      if (validation.errors.length > 0) {
        set({ uploadStatus: 'error', validation });
        return;
      }

      const normalizedRows = normalizeRows(rows);
      const teamProfiles = buildTeamProfiles(normalizedRows);
      const availablePeriods = getUniquePeriods(normalizedRows);
      const availableMpgs = [...new Set(normalizedRows.map((r) => r.mpg))].sort();
      const peerBaselines = computePeerBaselines(normalizedRows);
      const individualProfiles = buildIndividualProfiles(normalizedRows, peerBaselines);
      const latestPeriod = getLatestPeriod(normalizedRows);
      const selectedMonth = latestPeriod?.periodeLabel ?? null;
      const selectedFiscalYearStart = latestPeriod
        ? getFiscalYearStart(latestPeriod.periodeDate)
        : null;
      const periodeRange = scopePeriodRange(
        normalizedRows,
        'fiscal-year',
        selectedMonth,
        selectedFiscalYearStart,
      );
      const filters = { ...initialFilters, periodeRange };
      const scopedRows = applyFilters(normalizedRows, filters, availablePeriods, 'fiscal-year');
      const views = deriveFilteredViews(scopedRows, peerBaselines, 'fiscal-year');

      set({
        normalizedRows,
        filteredRows: views.filteredRows,
        teamProfiles,
        filteredProfiles: views.filteredProfiles,
        availablePeriods,
        availableMpgs,
        validation,
        uploadStatus: 'success',
        filters,
        analysisScope: 'fiscal-year',
        selectedMonth,
        selectedFiscalYearStart,
        peerBaselines,
        individualProfiles,
        filteredIndividualProfiles: views.filteredIndividualProfiles,
        clusters: views.clusters,
        selectedClusterId: null,
        anomalyAnalysis: views.anomalyAnalysis,
        selectedAnomalyCategory: null,
        csmCorrelation: views.csmCorrelation,
        locationBreakdownLoc: views.locationBreakdownLoc,
        locationBreakdownType: views.locationBreakdownType,
        contextAnalysis: views.contextAnalysis,
        selectedIndividual: null,
      });
    } catch (err) {

      set({
        uploadStatus: 'error',
        validation: {
          errors: [
            {
              code: 'PARSE_ERROR',
              message: `Gagal memproses data: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          warnings: [],
        },
      });
    }
  },

  loadFile: async (file: File) => {
    try {
      set({ uploadStatus: 'loading', validation: null });
      const { rows, sheetName } = await parseWorkbook(file);
      get().loadRows(rows, { kind: 'excel', label: sheetName, sheetName });
    } catch (err) {
      set({
        uploadStatus: 'error',
        validation: {
          errors: [
            {
              code: 'PARSE_ERROR',
              message: `Gagal memproses file: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          warnings: [],
        },
      });
    }
  },

  loadDatabaseRows: (rows, source) => {
    get().loadRows(rows, source);
  },

  setFilter: (partial: Partial<FilterState>) => {
    const state = get();
    const newFilters = { ...state.filters, ...partial };
    const filteredRows = applyFilters(
      state.normalizedRows,
      newFilters,
      state.availablePeriods,
      state.analysisScope,
    );

    const currentLocJob = state.locationBreakdownLoc?.jabatan ?? null;
    const views = deriveFilteredViews(filteredRows, state.peerBaselines, state.analysisScope, currentLocJob);

    set({
      filters: newFilters,
      ...views,
    });
  },

  resetFilters: () => {
    const state = get();
    const periodeRange = scopePeriodRange(
      state.normalizedRows,
      state.analysisScope,
      state.selectedMonth,
      state.selectedFiscalYearStart,
    );
    const filters = { ...initialFilters, periodeRange };
    const filteredRows = applyFilters(
      state.normalizedRows,
      filters,
      state.availablePeriods,
      state.analysisScope,
    );
    const views = deriveFilteredViews(filteredRows, state.peerBaselines, state.analysisScope);

    set({
      filters,
      ...views,
    });
  },

  setAnalysisScope: (scope: AnalysisScope) => {
    const state = get();
    const latest = getLatestPeriod(state.normalizedRows);
    const selectedMonth = state.selectedMonth ?? latest?.periodeLabel ?? null;
    const selectedFiscalYearStart = state.selectedFiscalYearStart
      ?? (latest ? getFiscalYearStart(latest.periodeDate) : null);
    const periodeRange = scopePeriodRange(
      state.normalizedRows,
      scope,
      selectedMonth,
      selectedFiscalYearStart,
    );
    set({ analysisScope: scope, selectedMonth, selectedFiscalYearStart });
    get().setFilter({ periodeRange });
  },

  setAnalysisMonth: (period: string) => {
    set({ analysisScope: 'monthly', selectedMonth: period });
    get().setFilter({ periodeRange: [period, period] });
  },

  setAnalysisFiscalYear: (startYear: number) => {
    const state = get();
    const periodeRange = getFiscalYearRange(state.normalizedRows, startYear);
    set({ analysisScope: 'fiscal-year', selectedFiscalYearStart: startYear });
    get().setFilter({ periodeRange });
  },

  reset: () => {
    set({
      rawRows: [],
      normalizedRows: [],
      filteredRows: [],
      teamProfiles: [],
      filteredProfiles: [],
      sheetName: '',
      dataSource: null,
      uploadStatus: 'idle',
      validation: null,
      filters: { ...initialFilters },
      selectedTeam: null,
      compareTeams: [],
      availablePeriods: [],
      availableMpgs: [],
      analysisScope: 'fiscal-year',
      selectedMonth: null,
      selectedFiscalYearStart: null,

      // Phase 2 & Enhancement state reset
      activeTab: 'team',
      individualProfiles: [],
      filteredIndividualProfiles: [],
      clusters: [],
      selectedClusterId: null,
      anomalyAnalysis: null,
      selectedAnomalyCategory: null,
      peerBaselines: [],
      csmCorrelation: null,
      locationBreakdownLoc: null,
      locationBreakdownType: null,
      contextAnalysis: null,
      selectedIndividual: null,
    });
  },

  setSelectedTeam: (mpg: string | null) => {
    set({ selectedTeam: mpg });
  },

  toggleCompareTeam: (mpg: string) => {
    const state = get();
    const idx = state.compareTeams.indexOf(mpg);
    if (idx >= 0) {
      set({ compareTeams: state.compareTeams.filter((m) => m !== mpg) });
    } else if (state.compareTeams.length < 5) {
      set({ compareTeams: [...state.compareTeams, mpg] });
    }
  },

  clearCompareTeams: () => {
    set({ compareTeams: [] });
  },

  // Phase 2 Actions
  setActiveTab: (tab: 'team' | 'individual') => {
    set({ activeTab: tab });
  },

  setSelectedIndividual: (npk: number | null) => {
    set({ selectedIndividual: npk });
  },

  setSelectedCluster: (cluster: { id: string; name: string; memberNpks: number[] } | null) => {
    set({
      selectedClusterId: cluster?.id ?? null,
      selectedClusterMemberNpks: cluster?.memberNpks ?? null,
      selectedClusterLabel: cluster?.name ?? null,
    });
  },

  setSelectedClusterId: (id: string | null) => {
    set({ selectedClusterId: id });
  },

  setSelectedAnomalyCategory: (category: AnomalyCategory | null) => {
    set({ selectedAnomalyCategory: category });
  },
}));


