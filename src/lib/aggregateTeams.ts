import type { NormalizedRow, TeamPeriodStat, TeamProfile, Jabatan } from '../types';
import { PROS_CONS_TOLERANCE, TREND_THRESHOLD_PCT } from './constants';

/**
 * Null-safe mean: ignores null, undefined, and NaN values.
 * Returns null if no valid values remain.
 */
export function safeMean(values: (number | null | undefined)[]): number | null {
  const valid = values.filter(
    (v): v is number => v !== null && v !== undefined && !isNaN(v)
  );
  if (valid.length === 0) return null;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

/** TOTAL scores at or below zero represent rows that have not been scored yet. */
export function isAvailableScore(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value) && value > 0;
}

/** Mean for TOTAL-derived values. Missing, invalid, and unscored zero values are ignored. */
export function safeScoreMean(values: (number | null | undefined)[]): number | null {
  const valid = values.filter(isAvailableScore);
  if (valid.length === 0) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

/**
 * Group rows by MPG, then by periodeLabel.
 */
export function groupByTeamPeriod(
  rows: NormalizedRow[]
): Map<string, Map<string, NormalizedRow[]>> {
  const result = new Map<string, Map<string, NormalizedRow[]>>();

  for (const row of rows) {
    let teamMap = result.get(row.mpg);
    if (!teamMap) {
      teamMap = new Map<string, NormalizedRow[]>();
      result.set(row.mpg, teamMap);
    }
    let periodRows = teamMap.get(row.periodeLabel);
    if (!periodRows) {
      periodRows = [];
      teamMap.set(row.periodeLabel, periodRows);
    }
    periodRows.push(row);
  }

  return result;
}

/**
 * Compute statistics for one team in one period.
 */
export function computeTeamPeriodStat(
  mpg: string,
  periodeLabel: string,
  rows: NormalizedRow[]
): TeamPeriodStat {
  const avgTotal = safeScoreMean(rows.map((r) => r.total)) ?? 0;

  const csmRows = rows.filter((r) => r.jabatan === 'CSM');
  const anggotaRows = rows.filter((r) => r.jabatan === 'CE' || r.jabatan === 'SPS');
  const avgTotalCsm = safeScoreMean(csmRows.map((r) => r.total)) ?? 0;
  const avgTotalAnggota = safeScoreMean(anggotaRows.map((r) => r.total)) ?? 0;

  const memberCount = rows.length;

  const countByJabatan: Record<Jabatan, number> = {
    CSM: 0,
    CE: 0,
    SPS: 0,
    UNKNOWN: 0,
  };
  let hoCount = 0;
  let serpoCount = 0;

  for (const row of rows) {
    countByJabatan[row.jabatan] = (countByJabatan[row.jabatan] ?? 0) + 1;
    if (row.lokasi === 'HO') hoCount++;
    if (row.lokasi === 'SERPO') serpoCount++;
  }

  const totalLoc = hoCount + serpoCount;
  const pctHO = totalLoc > 0 ? (hoCount / totalLoc) * 100 : 0;
  const pctSERPO = totalLoc > 0 ? (serpoCount / totalLoc) * 100 : 0;

  // Compute metric averages
  const metricKeys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row.metrics)) {
      metricKeys.add(key);
    }
  }

  const metricAverages: Record<string, number> = {};
  for (const key of metricKeys) {
    const values = rows.map((r) => r.metrics[key]);
    const avg = safeMean(values);
    if (avg !== null) {
      metricAverages[key] = avg;
    }
  }

  return {
    mpg,
    periodeLabel,
    avgTotal,
    avgTotalCsm,
    avgTotalAnggota,
    memberCount,
    countByJabatan,
    pctHO,
    pctSERPO,
    metricAverages,
  };
}

/**
 * Compute trend direction by comparing early vs late period blocks.
 */
export function computeTeamTrend(
  periodStats: TeamPeriodStat[]
): { direction: 'up' | 'down' | 'flat'; deltaPct: number } {
  const scoredStats = periodStats.filter((stat) => isAvailableScore(stat.avgTotal));
  if (scoredStats.length < 2) {
    return { direction: 'flat', deltaPct: 0 };
  }

  const n = scoredStats.length;
  const blockSize = n >= 6 ? 3 : 1;

  const earlyBlock = scoredStats.slice(0, blockSize);
  const lateBlock = scoredStats.slice(-blockSize);

  const earlyMean = safeMean(earlyBlock.map((p) => p.avgTotal)) ?? 0;
  const lateMean = safeMean(lateBlock.map((p) => p.avgTotal)) ?? 0;

  if (earlyMean === 0) {
    return { direction: 'flat', deltaPct: 0 };
  }

  const deltaPct = ((lateMean - earlyMean) / earlyMean) * 100;

  let direction: 'up' | 'down' | 'flat';
  if (deltaPct > TREND_THRESHOLD_PCT) {
    direction = 'up';
  } else if (deltaPct < -TREND_THRESHOLD_PCT) {
    direction = 'down';
  } else {
    direction = 'flat';
  }

  return { direction, deltaPct };
}

/**
 * Compute population standard deviation of avgTotal across periods.
 */
export function computeVolatility(periodStats: TeamPeriodStat[]): number {
  const scoredStats = periodStats.filter((stat) => isAvailableScore(stat.avgTotal));
  if (scoredStats.length === 0) return 0;

  const values = scoredStats.map((p) => p.avgTotal);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;

  return Math.sqrt(variance);
}

/**
 * Identify pros (above mean) and cons (below mean) metrics for a team.
 */
export function computeProsCons(
  teamMetricAvg: Record<string, number>,
  overallMetricAvg: Record<string, number>,
  tolerance: number = PROS_CONS_TOLERANCE
): {
  pros: { metric: string; value: number; deltaFromMean: number }[];
  cons: { metric: string; value: number; deltaFromMean: number }[];
} {
  const diffs: { metric: string; value: number; deltaFromMean: number }[] = [];

  for (const metric of Object.keys(teamMetricAvg)) {
    if (overallMetricAvg[metric] !== undefined) {
      diffs.push({
        metric,
        value: teamMetricAvg[metric],
        deltaFromMean: teamMetricAvg[metric] - overallMetricAvg[metric],
      });
    }
  }

  const pros = diffs
    .filter((d) => d.deltaFromMean > tolerance)
    .sort((a, b) => b.deltaFromMean - a.deltaFromMean)
    .slice(0, 3);

  const cons = diffs
    .filter((d) => d.deltaFromMean < -tolerance)
    .sort((a, b) => a.deltaFromMean - b.deltaFromMean)
    .slice(0, 3);

  return { pros, cons };
}

/**
 * Build complete team profiles from normalized rows.
 * Orchestrates grouping, aggregation, trending, ranking, and pros/cons.
 */
export function buildTeamProfiles(rows: NormalizedRow[]): TeamProfile[] {
  const teamPeriodGroups = groupByTeamPeriod(rows);

  // Get sorted unique periods
  const allPeriods = new Map<string, number>();
  for (const row of rows) {
    if (!allPeriods.has(row.periodeLabel)) {
      allPeriods.set(row.periodeLabel, row.periodeDate.getTime());
    }
  }
  const sortedPeriods = [...allPeriods.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([label]) => label);

  // Compute per-team period stats
  const teamStatsMap = new Map<string, TeamPeriodStat[]>();
  for (const [mpg, periodMap] of teamPeriodGroups) {
    const stats: TeamPeriodStat[] = [];
    for (const period of sortedPeriods) {
      const periodRows = periodMap.get(period);
      if (periodRows && periodRows.length > 0) {
        stats.push(computeTeamPeriodStat(mpg, period, periodRows));
      }
    }
    teamStatsMap.set(mpg, stats);
  }

  // Compute overall metric averages (across all teams) for pros/cons baseline
  const allMetricValues = new Map<string, number[]>();
  for (const stats of teamStatsMap.values()) {
    // Average each team's metric averages across periods first
    const teamMetricAccum = new Map<string, number[]>();
    for (const ps of stats) {
      for (const [key, val] of Object.entries(ps.metricAverages)) {
        let arr = teamMetricAccum.get(key);
        if (!arr) {
          arr = [];
          teamMetricAccum.set(key, arr);
        }
        arr.push(val);
      }
    }
    for (const [key, vals] of teamMetricAccum) {
      const avg = safeMean(vals);
      if (avg !== null) {
        let arr = allMetricValues.get(key);
        if (!arr) {
          arr = [];
          allMetricValues.set(key, arr);
        }
        arr.push(avg);
      }
    }
  }

  const overallMetricAvg: Record<string, number> = {};
  for (const [key, vals] of allMetricValues) {
    const avg = safeMean(vals);
    if (avg !== null) {
      overallMetricAvg[key] = avg;
    }
  }

  // Build profiles
  const profiles: TeamProfile[] = [];

  for (const [mpg, stats] of teamStatsMap) {
    const allTeamRows = [...(teamPeriodGroups.get(mpg)?.values() ?? [])].flat();
    const avgTotalOverall = safeScoreMean(allTeamRows.map((row) => row.total)) ?? 0;
    const avgTotalCsmOverall = safeScoreMean(
      allTeamRows.filter((row) => row.jabatan === 'CSM').map((row) => row.total),
    ) ?? 0;
    const avgTotalAnggotaOverall = safeScoreMean(
      allTeamRows
        .filter((row) => row.jabatan === 'CE' || row.jabatan === 'SPS')
        .map((row) => row.total),
    ) ?? 0;

    const trend = computeTeamTrend(stats);
    const volatility = computeVolatility(stats);

    // Team's own metric averages across all periods
    const teamMetricAccum = new Map<string, number[]>();
    for (const ps of stats) {
      for (const [key, val] of Object.entries(ps.metricAverages)) {
        let arr = teamMetricAccum.get(key);
        if (!arr) {
          arr = [];
          teamMetricAccum.set(key, arr);
        }
        arr.push(val);
      }
    }
    const teamMetricAvg: Record<string, number> = {};
    for (const [key, vals] of teamMetricAccum) {
      const avg = safeMean(vals);
      if (avg !== null) {
        teamMetricAvg[key] = avg;
      }
    }

    const { pros, cons } = computeProsCons(teamMetricAvg, overallMetricAvg);

    profiles.push({
      mpg,
      periodStats: stats,
      avgTotalOverall,
      avgTotalCsmOverall,
      avgTotalAnggotaOverall,
      trend,
      volatility,
      rank: 0, // will be set after sorting
      pros,
      cons,
    });
  }

  // Rank by avgTotalOverall descending
  profiles.sort((a, b) => b.avgTotalOverall - a.avgTotalOverall);
  profiles.forEach((p, i) => {
    p.rank = i + 1;
  });

  return profiles;
}
