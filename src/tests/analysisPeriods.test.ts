import { describe, expect, it } from 'vitest';
import {
  buildFiscalYearOptions,
  getFiscalYearRange,
  getFiscalYearStart,
  getScopeStatusLabel,
} from '../lib/analysisPeriods';
import type { NormalizedRow } from '../types';

function row(year: number, month: number, label: string): NormalizedRow {
  return {
    periodeSerial: 0,
    periodeDate: new Date(year, month, 1),
    periodeLabel: label,
    mpg: 'A1',
    wctr: 'W1',
    nama: 'Personil',
    npk: year * 100 + month,
    lokasi: 'HO',
    loc: 'MDN',
    jabatan: 'CE',
    total: 3,
    metrics: {},
  };
}

describe('analysisPeriods', () => {
  it('uses October as the beginning of the scoring year', () => {
    expect(getFiscalYearStart(new Date(2025, 9, 1))).toBe(2025);
    expect(getFiscalYearStart(new Date(2026, 8, 1))).toBe(2025);
  });

  it('marks an incomplete scoring year as YTD and returns its available range', () => {
    const rows = [
      row(2025, 9, 'Okt 2025'),
      row(2025, 10, 'Nov 2025'),
      row(2026, 6, 'Jul 2026'),
    ];
    const option = buildFiscalYearOptions(rows)[0];
    expect(option.label).toBe('Okt 2025 – Sep 2026');
    expect(option.isComplete).toBe(false);
    expect(getFiscalYearRange(rows, 2025)).toEqual(['Okt 2025', 'Jul 2026']);
    expect(getScopeStatusLabel(option, null)).toBe('YTD · Okt 2025 – Jul 2026');
  });

  it('marks twelve October-to-September periods as complete', () => {
    const rows = Array.from({ length: 12 }, (_, index) => {
      const absoluteMonth = 9 + index;
      const date = new Date(2025, absoluteMonth, 1);
      return row(date.getFullYear(), date.getMonth(), `P${index + 1}`);
    });
    expect(buildFiscalYearOptions(rows)[0].isComplete).toBe(true);
  });
});
