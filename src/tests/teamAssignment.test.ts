import { describe, expect, it } from 'vitest';
import { buildTeamProfiles } from '../lib/aggregateTeams';
import { rowsForTeamAnalysis } from '../lib/teamAssignment';
import type { NormalizedRow } from '../types';

function row(overrides: Partial<NormalizedRow> = {}): NormalizedRow {
  return {
    periodeSerial: 45931,
    periodeDate: new Date(2025, 9, 1),
    periodeLabel: 'Okt 2025',
    mpg: 'OLD',
    wctr: 'W-OLD',
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

describe('team assignment by analysis scope', () => {
  it('uses current period-end MPG and role for fiscal-year analysis', () => {
    const result = rowsForTeamAnalysis([
      row({ currentMpg: 'U1', currentWctr: 'W-U1', currentJabatan: 'SPS' }),
    ], 'fiscal-year');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ mpg: 'U1', wctr: 'W-U1', jabatan: 'SPS' });
  });

  it('keeps historical assignment for monthly analysis', () => {
    const source = row({ currentMpg: 'U1', currentJabatan: 'SPS' });
    const result = rowsForTeamAnalysis([source], 'monthly');

    expect(result[0]).toBe(source);
    expect(result[0]).toMatchObject({ mpg: 'OLD', jabatan: 'CE' });
  });

  it('excludes rows that are not in the period-end manpower snapshot', () => {
    const result = rowsForTeamAnalysis([
      row({ npk: 1, currentMpg: 'U1', currentJabatan: 'CE' }),
      row({ npk: 2, currentMpg: null, currentJabatan: null }),
    ], 'fiscal-year');

    expect(result.map((item) => item.npk)).toEqual([1]);
  });

  it('groups all scored history of current U1 CE/SPS personnel under U1', () => {
    const rows = [
      row({ npk: 1, mpg: 'A1', total: 3, currentMpg: 'U1', currentJabatan: 'CE' }),
      row({
        npk: 1,
        mpg: 'B1',
        total: 4,
        periodeLabel: 'Nov 2025',
        periodeDate: new Date(2025, 10, 1),
        currentMpg: 'U1',
        currentJabatan: 'CE',
      }),
      row({ npk: 2, mpg: 'U1', total: Number.NaN, currentMpg: 'U1', currentJabatan: 'SPS' }),
    ];

    const profiles = buildTeamProfiles(rowsForTeamAnalysis(rows, 'fiscal-year'));
    expect(profiles).toHaveLength(1);
    expect(profiles[0].mpg).toBe('U1');
    expect(profiles[0].avgTotalAnggotaOverall).toBe(3.5);
  });

  it('falls back to historical assignment for legacy Excel data without snapshot columns', () => {
    const source = [row({ currentMpg: undefined, currentJabatan: undefined })];
    expect(rowsForTeamAnalysis(source, 'fiscal-year')).toEqual(source);
  });
});
