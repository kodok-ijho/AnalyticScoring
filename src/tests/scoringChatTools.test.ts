import { describe, it, expect } from 'vitest';
import { executeScoringTool, SCORING_CHAT_TOOLS, type ScoringChatFullContext } from '../lib/scoringChatTools';
import type { IndividualProfile, TeamProfile } from '../types';

function createMockContext(): ScoringChatFullContext {
  const teams: TeamProfile[] = [
    {
      mpg: 'A1',
      periodStats: [],
      avgTotalOverall: 4.2,
      avgTotalCsmOverall: 4.5,
      avgTotalAnggotaOverall: 4.1,
      trend: { direction: 'up', deltaPct: 4.2 },
      volatility: 0.12,
      rank: 1,
      pros: [{ metric: 'CSAT', value: 4.8, deltaFromMean: 0.6 }],
      cons: [],
    },
    {
      mpg: 'B2',
      periodStats: [],
      avgTotalOverall: 2.9,
      avgTotalCsmOverall: 3.1,
      avgTotalAnggotaOverall: 2.8,
      trend: { direction: 'down', deltaPct: -8.1 },
      volatility: 0.35,
      rank: 2,
      pros: [],
      cons: [{ metric: 'MoP', value: 1.8, deltaFromMean: -1.2 }],
    },
  ];

  const individuals: IndividualProfile[] = [
    {
      npk: 101,
      nama: 'Budi Santoso',
      jabatanUtama: 'CE',
      history: [
        { periodeLabel: 'Mei 26', mpg: 'A1', wctr: 'W1', jabatan: 'CE', loc: 'JKT', lokasi: 'HO', total: 4.5 },
      ],
      mutasiEvents: [],
      hasMutasi: false,
      avgTotalOverall: 4.5,
      trend: { direction: 'up', deltaPct: 5 },
      volatility: 0.1,
      metricAverages: { '5Scale_CSAT_CE': 4.8 },
      vsTeamAvg: 0.3,
      vsPeerAvg: 0.5,
      rankInPeerGroup: 1,
      pros: [{ metric: 'CSAT', value: 4.8, deltaFromMean: 0.5 }],
      cons: [],
      status: 'top_performer',
      clusterLabel: 'Pilar Utama',
    },
  ];

  return {
    sheetName: 'Scoring JUN26',
    rowCount: 2638,
    filters: { periodeRange: null, lokasi: null, mpgSelected: null },
    availablePeriods: ['Okt 25', 'Nov 25', 'Des 25', 'Jan 26', 'Feb 26', 'Mar 26', 'Apr 26', 'Mei 26', 'Jun 26'],
    teams,
    individuals,
    clusters: [
      {
        id: 'cluster-1',
        archetype: {
          id: 'cluster-1',
          category: 'solid_anchor',
          name: 'Pilar Utama',
          badgeColor: 'bg-emerald-500',
          description: 'High performer stabil',
          avgScore: 4.4,
          avgVolatility: 0.12,
          avgTrendDeltaPct: 2.0,
          strengths: ['CSAT', 'RTFirstVisit'],
        },
        memberNpks: [101],
        size: 1,
        percentage: 100,
      },
    ],
    anomalies: {
      anomalies: [
        {
          id: 'anom-1',
          npk: 101,
          nama: 'Budi Santoso',
          jabatan: 'CE',
          mpg: 'A1',
          loc: 'JKT',
          category: 'temporal_spike',
          severity: 'warning',
          title: 'Lonjakan Skor Ekstrim',
          description: 'Skor melonjak tajam',
          evidence: { baselineValue: 4.0, observedValue: 4.9, delta: 0.9, unit: 'skor', details: 'Deviasi 2.8σ' },
        },
      ],
      summaryByCategory: { mutation_drift: 0, temporal_spike: 1, metric_polarization: 0, cohort_outlier: 0 },
      summaryBySeverity: { critical: 0, warning: 1, info: 0 },
    },
    csmCorrelation: null,
    locationBreakdownLoc: null,
    locationBreakdownType: null,
    filteredRows: [],
  };
}

describe('AI Scoring Chat Tools & Query Engine', () => {
  it('defines valid OpenAI compatible tool specifications', () => {
    expect(SCORING_CHAT_TOOLS.length).toBeGreaterThanOrEqual(6);
    for (const tool of SCORING_CHAT_TOOLS) {
      expect(tool.type).toBe('function');
      expect(tool.function.name).toBeDefined();
      expect(tool.function.description).toBeDefined();
      expect(tool.function.parameters.type).toBe('object');
    }
  });

  it('executes query_top_bottom_performers accurately', () => {
    const ctx = createMockContext();
    const resultJson = executeScoringTool('query_top_bottom_performers', { target: 'team', order: 'top' }, ctx);
    const parsed = JSON.parse(resultJson);

    expect(parsed.tipe).toBe('Daftar Tim MPG');
    expect(parsed.hasil[0].mpg).toBe('A1');
    expect(parsed.hasil[0].rataRataTotal).toBe(4.2);
  });

  it('executes query_individual_profile lookup by name or NPK', () => {
    const ctx = createMockContext();
    const resultJson = executeScoringTool('query_individual_profile', { search: 'Budi' }, ctx);
    const parsed = JSON.parse(resultJson);

    expect(parsed.jumlahDitemukan).toBe(1);
    expect(parsed.personil[0].nama).toBe('Budi Santoso');
    expect(parsed.personil[0].npk).toBe(101);
  });

  it('executes query_anomalies correctly', () => {
    const ctx = createMockContext();
    const resultJson = executeScoringTool('query_anomalies', {}, ctx);
    const parsed = JSON.parse(resultJson);

    expect(parsed.totalAnomaliTerdeteksi).toBe(1);
    expect(parsed.anomaliDitampilkan[0].nama).toBe('Budi Santoso');
  });

  it('executes query_clusters correctly', () => {
    const ctx = createMockContext();
    const resultJson = executeScoringTool('query_clusters', {}, ctx);
    const parsed = JSON.parse(resultJson);

    expect(parsed.totalKluster).toBe(1);
    expect(parsed.kluster[0].namaArketipe).toBe('Pilar Utama');
  });
});
