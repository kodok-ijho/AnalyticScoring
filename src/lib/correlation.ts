import type {
  NormalizedRow,
  CsmSubordinateCorrelation,
  LocationBreakdown,
  LocationBreakdownRow,
  Jabatan,
} from '../types';
import { isAvailableScore, safeScoreMean } from './aggregateTeams';
import { SMALL_SAMPLE_THRESHOLD, PEARSON_INTERPRETATION_BANDS } from './constants';

/**
 * Compute the Pearson correlation coefficient between two numeric arrays.
 * Formula: r = n*sum(xy) - sum(x)*sum(y) / sqrt([n*sum(x^2) - (sum(x))^2] * [n*sum(y^2) - (sum(y))^2])
 */
export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0 || n !== y.length) return 0;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }

  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (den === 0) return 0;
  return num / den;
}

export function interpretR(r: number): string {
  const absR = Math.abs(r);
  const direction = r > 0 ? 'positif' : r < 0 ? 'negatif' : '';

  let band = PEARSON_INTERPRETATION_BANDS[PEARSON_INTERPRETATION_BANDS.length - 1];
  for (const b of PEARSON_INTERPRETATION_BANDS) {
    if (absR <= b.max) {
      band = b;
      break;
    }
  }

  if (absR < 0.1) {
    return 'tidak ada korelasi yang signifikan atau sangat lemah';
  }

  return `asosiasi ${direction} yang ${band.label}`;
}

/**
 * Calculates correlation points between CSM (supervisor) scores and their team's average subordinate scores.
 */
export function computeCsmSubordinateCorrelation(
  rows: NormalizedRow[]
): CsmSubordinateCorrelation {
  // Group rows by MPG and Periode
  const teamPeriods = new Map<string, NormalizedRow[]>();
  for (const r of rows) {
    const key = `${r.mpg}_${r.periodeLabel}`;
    let list = teamPeriods.get(key);
    if (!list) {
      list = [];
      teamPeriods.set(key, list);
    }
    list.push(r);
  }

  const points: CsmSubordinateCorrelation['points'] = [];

  for (const [key, groupRows] of teamPeriods.entries()) {
    const [mpg, period] = key.split('_');
    const csmRow = groupRows.find((r) => r.jabatan === 'CSM' && isAvailableScore(r.total));
    const subordinates = groupRows.filter(
      (r) => (r.jabatan === 'CE' || r.jabatan === 'SPS') && isAvailableScore(r.total),
    );

    if (csmRow && subordinates.length > 0) {
      const avgSubtotal = safeScoreMean(subordinates.map((s) => s.total));
      if (avgSubtotal === null) continue;
      points.push({
        mpg,
        periodeLabel: period,
        csmTotal: csmRow.total,
        avgSubordinateTotal: avgSubtotal,
      });
    }
  }

  const x = points.map((p) => p.csmTotal);
  const y = points.map((p) => p.avgSubordinateTotal);
  const r = pearsonCorrelation(x, y);
  const interpretation = `Skor supervisor (CSM) cenderung memiliki ${interpretR(r)} dengan rata-rata performa teknisi (CE & SPS) di bawah naungannya.`;

  return {
    points,
    pearsonR: r,
    n: points.length,
    interpretation,
  };
}

/**
 * Groups rows by location (HO vs SERPO) or branch (Loc) to calculate performance statistics.
 */
export function computeLocationBreakdown(
  rows: NormalizedRow[],
  groupBy: 'Lokasi' | 'Loc',
  jabatanFilter: Jabatan | null = null
): LocationBreakdown {
  const filtered = jabatanFilter ? rows.filter((r) => r.jabatan === jabatanFilter) : rows;

  // Group by key
  const grouped = new Map<string, number[]>();
  for (const r of filtered) {
    const key = groupBy === 'Lokasi' ? r.lokasi : r.loc;
    if (key === 'UNKNOWN' || !key) continue; // skip unknown location tags
    let list = grouped.get(key);
    if (!list) {
      list = [];
      grouped.set(key, list);
    }
    if (isAvailableScore(r.total)) list.push(r.total);
  }

  const breakdownRows: LocationBreakdownRow[] = [];
  for (const [key, vals] of grouped.entries()) {
    const avgTotal = safeScoreMean(vals);
    if (avgTotal === null) continue;
    const n = vals.length;
    breakdownRows.push({
      key,
      avgTotal,
      n,
      isSmallSample: n < SMALL_SAMPLE_THRESHOLD,
    });
  }

  // Sort descending by average score
  breakdownRows.sort((a, b) => b.avgTotal - a.avgTotal);

  return {
    groupBy,
    jabatan: jabatanFilter,
    rows: breakdownRows,
  };
}
