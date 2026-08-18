import { afterEach, describe, expect, it } from 'vitest';
import { useDashboardStore } from '../store/useDashboardStore';
import type { RawRow } from '../types';

function rawRow(overrides: RawRow = {}): RawRow {
  return {
    Periode: '2025-10-01',
    MPG: 'A1',
    WCTR: 'W-A1',
    Nama: 'Personil',
    NPK: 1,
    Lokasi: 'HO',
    Loc: 'MDN',
    Jabatan: 'CE',
    TOTAL: 3,
    MPG_SaatIni: 'U1',
    WcTr_SaatIni: 'W-U1',
    Posisi_SaatIni: 'CE',
    ...overrides,
  };
}

afterEach(() => {
  useDashboardStore.getState().reset();
});

describe('dashboard fiscal-year team filtering', () => {
  it('filters by period-end MPG instead of historical MPG', () => {
    useDashboardStore.getState().loadRows([
      rawRow({ NPK: 1, MPG: 'A1', MPG_SaatIni: 'U1', TOTAL: 3 }),
      rawRow({ NPK: 2, MPG: 'B1', MPG_SaatIni: 'B1', TOTAL: 4 }),
    ], { kind: 'excel', label: 'Test', sheetName: 'Test' });

    useDashboardStore.getState().setFilter({ mpgSelected: ['U1'] });

    const state = useDashboardStore.getState();
    expect(state.filteredRows.map((row) => row.npk)).toEqual([1]);
    expect(state.filteredProfiles).toHaveLength(1);
    expect(state.filteredProfiles[0]).toMatchObject({
      mpg: 'U1',
      avgTotalAnggotaOverall: 3,
    });
  });
});
