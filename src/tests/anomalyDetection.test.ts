import { describe, it, expect } from 'vitest';
import { detectAnomalies } from '../lib/anomalyDetection';
import type { IndividualProfile, NormalizedRow } from '../types';

function mockRow(npk: number, period: string, total: number, metrics: Record<string, number | null> = {}): NormalizedRow {
  return {
    periodeSerial: 45000,
    periodeDate: new Date('2026-01-01'),
    periodeLabel: period,
    mpg: 'A1',
    wctr: 'W1',
    nama: 'Person ' + npk,
    npk,
    lokasi: 'HO',
    loc: 'JKT',
    jabatan: 'CE',
    total,
    metrics,
  };
}

describe('Statistical Anomaly Detection', () => {
  it('detects temporal single-period spikes with high z-scores', () => {
    const npk = 1001;
    // Consistent ~4.0 scores except an extreme plunge to 1.5 in Apr 26
    const rows: NormalizedRow[] = [
      mockRow(npk, 'Okt 25', 4.0),
      mockRow(npk, 'Nov 25', 4.05),
      mockRow(npk, 'Des 25', 3.98),
      mockRow(npk, 'Jan 26', 4.02),
      mockRow(npk, 'Feb 26', 4.01),
      mockRow(npk, 'Mar 26', 3.99),
      mockRow(npk, 'Apr 26', 1.50), // Sudden anomaly plunge!
      mockRow(npk, 'Mei 26', 4.0),
      mockRow(npk, 'Jun 26', 4.02),
    ];

    const profile: IndividualProfile = {
      npk,
      nama: 'Person ' + npk,
      jabatanUtama: 'CE',
      history: rows.map((r) => ({
        periodeLabel: r.periodeLabel,
        mpg: r.mpg,
        wctr: r.wctr,
        jabatan: r.jabatan,
        loc: r.loc,
        lokasi: r.lokasi,
        total: r.total,
      })),
      mutasiEvents: [],
      hasMutasi: false,
      avgTotalOverall: 3.73,
      trend: { direction: 'flat', deltaPct: 0 },
      volatility: 0.8,
      metricAverages: {},
      vsTeamAvg: 0,
      vsPeerAvg: 0,
      rankInPeerGroup: 1,
      pros: [],
      cons: [],
      status: 'normal',
    };

    const result = detectAnomalies([profile], rows);
    const temporalAnomalies = result.anomalies.filter((a) => a.category === 'temporal_spike');

    expect(temporalAnomalies.length).toBeGreaterThan(0);
    expect(temporalAnomalies[0].periodLabel).toBe('Apr 26');
    expect(temporalAnomalies[0].evidence.observedValue).toBe(1.50);
  });

  it('detects mutation drift anomalies when post-transfer score drops', () => {
    const npk = 2002;
    // 3 periods before mutation @ 4.20, then moves from MDN to BTJ and drops to 2.80
    const history = [
      { periodeLabel: 'Okt 25', mpg: 'A1', wctr: 'W1', jabatan: 'CE' as const, loc: 'MDN', lokasi: 'HO' as const, total: 4.20 },
      { periodeLabel: 'Nov 25', mpg: 'A1', wctr: 'W1', jabatan: 'CE' as const, loc: 'MDN', lokasi: 'HO' as const, total: 4.15 },
      { periodeLabel: 'Des 25', mpg: 'A1', wctr: 'W1', jabatan: 'CE' as const, loc: 'MDN', lokasi: 'HO' as const, total: 4.25 },
      { periodeLabel: 'Jan 26', mpg: 'A1', wctr: 'W1', jabatan: 'CE' as const, loc: 'BTJ', lokasi: 'SERPO' as const, total: 2.80 },
      { periodeLabel: 'Feb 26', mpg: 'A1', wctr: 'W1', jabatan: 'CE' as const, loc: 'BTJ', lokasi: 'SERPO' as const, total: 2.90 },
      { periodeLabel: 'Mar 26', mpg: 'A1', wctr: 'W1', jabatan: 'CE' as const, loc: 'BTJ', lokasi: 'SERPO' as const, total: 2.85 },
    ];

    const rows: NormalizedRow[] = history.map((h) => ({
      periodeSerial: 45000,
      periodeDate: new Date('2026-01-01'),
      periodeLabel: h.periodeLabel,
      mpg: h.mpg,
      wctr: h.wctr,
      nama: 'Mutasi Person',
      npk,
      lokasi: h.lokasi,
      loc: h.loc,
      jabatan: h.jabatan,
      total: h.total,
      metrics: {},
    }));

    const profile: IndividualProfile = {
      npk,
      nama: 'Mutasi Person',
      jabatanUtama: 'CE',
      history,
      mutasiEvents: [{ fromPeriode: 'Des 25', toPeriode: 'Jan 26', field: 'loc', from: 'MDN', to: 'BTJ' }],
      hasMutasi: true,
      avgTotalOverall: 3.52,
      trend: { direction: 'down', deltaPct: -30 },
      volatility: 0.65,
      metricAverages: {},
      vsTeamAvg: 0,
      vsPeerAvg: 0,
      rankInPeerGroup: 2,
      pros: [],
      cons: [],
      status: 'watchlist',
    };

    const result = detectAnomalies([profile], rows);
    const mutationAnomalies = result.anomalies.filter((a) => a.category === 'mutation_drift');

    expect(mutationAnomalies.length).toBeGreaterThan(0);
    expect(mutationAnomalies[0].evidence.delta).toBeLessThan(-0.5);
  });

  it('detects metric polarization when aggregate score is high but single vital metric is deficient', () => {
    const npk = 3003;
    const profile: IndividualProfile = {
      npk,
      nama: 'Polarized Person',
      jabatanUtama: 'CE',
      history: [],
      mutasiEvents: [],
      hasMutasi: false,
      avgTotalOverall: 4.10,
      trend: { direction: 'flat', deltaPct: 0 },
      volatility: 0.1,
      metricAverages: {
        '5Scale_CSAT_CE': 4.8,
        '5Scale_RTFirstVisit_CE': 4.7,
        '5Scale_MoP_CE': 1.8, // Severe deficit!
      },
      vsTeamAvg: 0.5,
      vsPeerAvg: 0.6,
      rankInPeerGroup: 3,
      pros: [],
      cons: [],
      status: 'normal',
    };

    const result = detectAnomalies([profile], []);
    const polarAnomalies = result.anomalies.filter((a) => a.category === 'metric_polarization');

    expect(polarAnomalies.length).toBeGreaterThan(0);
    expect(polarAnomalies[0].title).toContain('MoP');
  });
});
