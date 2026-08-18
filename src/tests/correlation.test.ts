import { describe, it, expect } from 'vitest';
import {
  pearsonCorrelation,
  interpretR,
  computeCsmSubordinateCorrelation,
  computeLocationBreakdown,
} from '../lib/correlation';
import type { NormalizedRow } from '../types';

describe('correlation', () => {
  it('should calculate pearson correlation coefficient correctly', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [2, 4, 6, 8, 10]; // Perfect positive
    const z = [5, 4, 3, 2, 1]; // Perfect negative
    const randomY = [1, 5, 2, 8, 3]; // Low correlation

    expect(pearsonCorrelation(x, y)).toBeCloseTo(1, 5);
    expect(pearsonCorrelation(x, z)).toBeCloseTo(-1, 5);
    expect(Math.abs(pearsonCorrelation(x, randomY))).toBeLessThan(0.7);
  });

  it('should interpret R bands correctly', () => {
    expect(interpretR(0.95)).toContain('sangat kuat');
    expect(interpretR(0.4)).toContain('sedang');
    expect(interpretR(0.02)).toContain('tidak ada korelasi');
  });

  it('should compute CSM subordinate correlation and skips periods without CSM', () => {
    const mockRows: NormalizedRow[] = [
      // Period 1, MPG A1
      {
        periodeSerial: 45931,
        periodeDate: new Date(2025, 9, 1),
        periodeLabel: 'Okt 2025',
        mpg: 'A1',
        wctr: 'W1',
        nama: 'Csm1',
        npk: 111,
        lokasi: 'HO',
        loc: 'MDN',
        jabatan: 'CSM',
        total: 4.0,
        metrics: {},
      },
      {
        periodeSerial: 45931,
        periodeDate: new Date(2025, 9, 1),
        periodeLabel: 'Okt 2025',
        mpg: 'A1',
        wctr: 'W1',
        nama: 'Ce1',
        npk: 222,
        lokasi: 'HO',
        loc: 'MDN',
        jabatan: 'CE',
        total: 3.5,
        metrics: {},
      },
      // Period 1, MPG B1 (No CSM)
      {
        periodeSerial: 45931,
        periodeDate: new Date(2025, 9, 1),
        periodeLabel: 'Okt 2025',
        mpg: 'B1',
        wctr: 'W2',
        nama: 'Ce2',
        npk: 333,
        lokasi: 'HO',
        loc: 'MDN',
        jabatan: 'CE',
        total: 3.8,
        metrics: {},
      },
    ];

    const correlation = computeCsmSubordinateCorrelation(mockRows);
    expect(correlation.points).toHaveLength(1); // Only A1 has both CSM and sub
    expect(correlation.points[0].mpg).toBe('A1');
    expect(correlation.points[0].csmTotal).toBe(4.0);
    expect(correlation.points[0].avgSubordinateTotal).toBe(3.5);
  });

  it('should compute location breakdown and identifies small samples', () => {
    const mockRows: NormalizedRow[] = [
      {
        periodeSerial: 45931,
        periodeDate: new Date(2025, 9, 1),
        periodeLabel: 'Okt 2025',
        mpg: 'A1',
        wctr: 'W1',
        nama: 'Andi',
        npk: 123,
        lokasi: 'HO',
        loc: 'MDN',
        jabatan: 'CE',
        total: 3.5,
        metrics: {},
      },
      {
        periodeSerial: 45931,
        periodeDate: new Date(2025, 9, 1),
        periodeLabel: 'Okt 2025',
        mpg: 'A1',
        wctr: 'W1',
        nama: 'Budi',
        npk: 456,
        lokasi: 'HO',
        loc: 'MDN',
        jabatan: 'CE',
        total: 4.0,
        metrics: {},
      },
      {
        periodeSerial: 45931,
        periodeDate: new Date(2025, 9, 1),
        periodeLabel: 'Okt 2025',
        mpg: 'B1',
        wctr: 'W2',
        nama: 'Caca',
        npk: 789,
        lokasi: 'SERPO',
        loc: 'PKU',
        jabatan: 'CE',
        total: 3.8,
        metrics: {},
      },
    ];

    const locationB = computeLocationBreakdown(mockRows, 'Lokasi');
    expect(locationB.rows).toHaveLength(2); // HO and SERPO

    const ho = locationB.rows.find((r) => r.key === 'HO');
    const serpo = locationB.rows.find((r) => r.key === 'SERPO');

    expect(ho?.n).toBe(2);
    expect(ho?.isSmallSample).toBe(true); // default threshold is 3

    expect(serpo?.n).toBe(1);
    expect(serpo?.isSmallSample).toBe(true);
  });
});
