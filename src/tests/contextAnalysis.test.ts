import { describe, expect, it } from 'vitest';
import { computeContextAnalysis } from '../lib/contextAnalysis';
import type { NormalizedRow } from '../types';

function row(overrides: Partial<NormalizedRow>): NormalizedRow {
  return {
    periodeSerial: 45931,
    periodeDate: new Date(2025, 9, 1),
    periodeLabel: 'Okt 2025',
    mpg: 'A1',
    wctr: 'W1',
    nama: 'Personil',
    npk: 1,
    lokasi: 'HO',
    loc: 'MDN',
    jabatan: 'CE',
    total: 3,
    metrics: {},
    ...overrides,
  };
}

describe('contextAnalysis', () => {
  it('calculates role-period-adjusted association and leave-one-out effects', () => {
    const rows = [
      row({ npk: 1, nama: 'A-1', mpg: 'A1', loc: 'MDN', total: 4 }),
      row({ npk: 2, nama: 'A-2', mpg: 'A1', loc: 'MDN', total: 4 }),
      row({ npk: 3, nama: 'B-1', mpg: 'B1', loc: 'PKU', lokasi: 'SERPO', total: 2 }),
      row({ npk: 4, nama: 'B-2', mpg: 'B1', loc: 'PKU', lokasi: 'SERPO', total: 2 }),
    ];

    const analysis = computeContextAnalysis(rows);
    expect(analysis.summaries.find((s) => s.factor === 'team')?.etaSquared).toBe(1);
    expect(analysis.summaries.find((s) => s.factor === 'branch')?.etaSquared).toBe(1);
    expect(analysis.summaries.find((s) => s.factor === 'location')?.etaSquared).toBe(1);
    expect(analysis.individualEffects['1'].team.effect).toBeCloseTo(1);
    expect(analysis.individualEffects['3'].team.effect).toBeCloseTo(-1);
    expect(analysis.individualEffects['1'].team.peerCount).toBe(1);
  });

  it('excludes unknown contexts and returns zero for no score variation', () => {
    const rows = [
      row({ npk: 1, mpg: 'UNKNOWN', loc: 'UNKNOWN', lokasi: 'UNKNOWN', total: 3 }),
      row({ npk: 2, mpg: 'A1', loc: 'MDN', lokasi: 'HO', total: 3 }),
      row({ npk: 3, mpg: 'A1', loc: 'MDN', lokasi: 'HO', total: 3 }),
    ];
    const analysis = computeContextAnalysis(rows);
    for (const summary of analysis.summaries) {
      expect(summary.etaSquared).toBe(0);
      expect(summary.sampleCount).toBe(2);
    }
    expect(analysis.individualEffects['1'].team.effect).toBeNull();
  });
});
