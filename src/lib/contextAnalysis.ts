import type {
  ContextAnalysis,
  ContextEffectFactor,
  ContextEffectSummary,
  IndividualContextEffect,
  NormalizedRow,
} from '../types';
import { isAvailableScore, safeMean } from './aggregateTeams';

type ResidualEntry = { npk: number; residual: number };

const FACTORS: { factor: ContextEffectFactor; label: string }[] = [
  { factor: 'team', label: 'MPG / Tim' },
  { factor: 'branch', label: 'Cabang (Loc)' },
  { factor: 'location', label: 'Tipe Lokasi (HO/SERPO)' },
];

function groupKey(row: NormalizedRow, factor: ContextEffectFactor): string | null {
  if (factor === 'team') {
    const value = row.mpg.trim();
    return value && value !== 'UNKNOWN' ? value : null;
  }
  if (factor === 'branch') {
    const value = row.loc.trim();
    return value && value !== 'UNKNOWN' ? value : null;
  }
  return row.lokasi === 'UNKNOWN' ? null : row.lokasi;
}

function interpretation(etaSquared: number): string {
  if (etaSquared < 0.01) return 'asosiasi sangat kecil';
  if (etaSquared < 0.06) return 'asosiasi kecil';
  if (etaSquared < 0.14) return 'asosiasi sedang';
  return 'asosiasi besar';
}

function summarize(
  factor: ContextEffectFactor,
  label: string,
  groups: Map<string, ResidualEntry[]>,
  residuals: ResidualEntry[],
): ContextEffectSummary {
  const overall = safeMean(residuals.map((entry) => entry.residual)) ?? 0;
  const totalSs = residuals.reduce((sum, entry) => sum + (entry.residual - overall) ** 2, 0);
  let betweenSs = 0;

  for (const entries of groups.values()) {
    const mean = safeMean(entries.map((entry) => entry.residual)) ?? 0;
    betweenSs += entries.length * (mean - overall) ** 2;
  }

  const etaSquared = totalSs > 0 ? Math.max(0, Math.min(1, betweenSs / totalSs)) : 0;
  const rounded = Number(etaSquared.toFixed(4));
  return {
    factor,
    label,
    etaSquared: rounded,
    groupCount: groups.size,
    sampleCount: residuals.length,
    interpretation: `${(rounded * 100).toFixed(1)}% variasi skor setelah penyesuaian Jabatan + Periode; ${interpretation(rounded)}.`,
  };
}

function emptyEffect(): IndividualContextEffect {
  return {
    team: { effect: null, peerCount: 0 },
    branch: { effect: null, peerCount: 0 },
    location: { effect: null, peerCount: 0 },
  };
}

/**
 * Estimates descriptive context association after removing the role/period
 * baseline. Individual effects use leave-one-person-out group means.
 */
export function computeContextAnalysis(rows: NormalizedRow[]): ContextAnalysis {
  const rolePeriodValues = new Map<string, number[]>();
  for (const row of rows) {
    if (isAvailableScore(row.total)) {
      const key = `${row.jabatan}|${row.periodeLabel}`;
      const values = rolePeriodValues.get(key) ?? [];
      values.push(row.total);
      rolePeriodValues.set(key, values);
    }
  }

  const residualRows = rows.flatMap((row) => {
    if (!isAvailableScore(row.total)) return [];
    const baseline = safeMean(rolePeriodValues.get(`${row.jabatan}|${row.periodeLabel}`) ?? []);
    return baseline === null ? [] : [{ row, residual: row.total - baseline }];
  });
  const residuals: ResidualEntry[] = residualRows.map(({ row, residual }) => ({ npk: row.npk, residual }));

  const summaries: ContextEffectSummary[] = [];
  const groupedByFactor = new Map<ContextEffectFactor, Map<string, ResidualEntry[]>>();
  const groupStatsByFactor = new Map<ContextEffectFactor, Map<string, { sum: number; count: number; byNpk: Map<number, { sum: number; count: number }> }>>();

  for (const { row, residual } of residualRows) {
    for (const { factor, label } of FACTORS) {
      const key = groupKey(row, factor);
      if (!key) continue;
      const groups = groupedByFactor.get(factor) ?? new Map<string, ResidualEntry[]>();
      const entries = groups.get(key) ?? [];
      entries.push({ npk: row.npk, residual });
      groups.set(key, entries);
      groupedByFactor.set(factor, groups);

      const stats = groupStatsByFactor.get(factor) ?? new Map();
      const group = stats.get(key) ?? { sum: 0, count: 0, byNpk: new Map() };
      group.sum += residual;
      group.count += 1;
      const person = group.byNpk.get(row.npk) ?? { sum: 0, count: 0 };
      person.sum += residual;
      person.count += 1;
      group.byNpk.set(row.npk, person);
      stats.set(key, group);
      groupStatsByFactor.set(factor, stats);
    }
  }

  for (const { factor, label } of FACTORS) {
    const groups = groupedByFactor.get(factor) ?? new Map<string, ResidualEntry[]>();
    const factorResiduals = [...groups.values()].flat();
    summaries.push(summarize(factor, label, groups, factorResiduals));
  }

  const accumulators = new Map<number, Record<ContextEffectFactor, { values: number[]; peerCounts: number[] }>>();
  for (const { row, residual } of residualRows) {
    const person = accumulators.get(row.npk) ?? {
      team: { values: [], peerCounts: [] },
      branch: { values: [], peerCounts: [] },
      location: { values: [], peerCounts: [] },
    };

    for (const { factor } of FACTORS) {
      const key = groupKey(row, factor);
      const stats = key ? groupStatsByFactor.get(factor)?.get(key) : undefined;
      if (!stats) continue;
      const own = stats.byNpk.get(row.npk) ?? { sum: 0, count: 0 };
      const peerCount = stats.count - own.count;
      if (peerCount > 0) {
        person[factor].values.push((stats.sum - own.sum) / peerCount);
        person[factor].peerCounts.push(peerCount);
      }
    }
    accumulators.set(row.npk, person);
  }

  const individualEffects: Record<string, IndividualContextEffect> = {};
  for (const [npk, values] of accumulators) {
    const effect = emptyEffect();
    for (const { factor } of FACTORS) {
      effect[factor] = {
        effect: safeMean(values[factor].values),
        peerCount: Math.round(safeMean(values[factor].peerCounts) ?? 0),
      };
    }
    individualEffects[String(npk)] = effect;
  }

  return { summaries, individualEffects };
}
