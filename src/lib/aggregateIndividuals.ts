import type {
  NormalizedRow,
  IndividualProfile,
  AttributeHistoryEntry,
  MutasiEvent,
  PeerBaseline,
  Jabatan,
} from '../types';
import {
  safeMean,
  safeScoreMean,
  isAvailableScore,
  computeTeamTrend,
  computeVolatility,
  computeProsCons,
} from './aggregateTeams';

/**
 * Filter and sort rows for a specific employee (NPK) chronologically.
 */
export function buildAttributeHistory(
  npk: number,
  rows: NormalizedRow[]
): AttributeHistoryEntry[] {
  return rows
    .filter((r) => r.npk === npk)
    .map((r) => ({
      periodeLabel: r.periodeLabel,
      mpg: r.mpg,
      wctr: r.wctr,
      jabatan: r.jabatan,
      loc: r.loc,
      lokasi: r.lokasi,
      total: r.total,
    }));
}

/**
 * Detect changes (mutations) in MPG, Jabatan, or Loc (Branch) across consecutive periods.
 */
export function computeMutations(history: AttributeHistoryEntry[]): MutasiEvent[] {
  const events: MutasiEvent[] = [];
  if (history.length < 2) return events;

  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1];
    const curr = history[i];

    const fields: ('mpg' | 'jabatan' | 'loc')[] = ['mpg', 'jabatan', 'loc'];
    for (const field of fields) {
      if (prev[field] !== curr[field]) {
        events.push({
          fromPeriode: prev.periodeLabel,
          toPeriode: curr.periodeLabel,
          field,
          from: prev[field],
          to: curr[field],
        });
      }
    }
  }

  return events;
}

/**
 * Compute aggregate averages (total score and individual metrics) per role per period.
 * CSM vs CE vs SPS. Note that CE & SPS metrics are on the same CE scale columns.
 */
export function computePeerBaselines(rows: NormalizedRow[]): PeerBaseline[] {
  const grouped = new Map<string, NormalizedRow[]>();

  for (const row of rows) {
    const key = `${row.jabatan}_${row.periodeLabel}`;
    let list = grouped.get(key);
    if (!list) {
      list = [];
      grouped.set(key, list);
    }
    list.push(row);
  }

  const baselines: PeerBaseline[] = [];

  for (const [key, groupRows] of grouped.entries()) {
    const [jab, period] = key.split('_');
    const avgTotal = safeScoreMean(groupRows.map((r) => r.total)) ?? 0;
    const scoredRows = groupRows.filter((row) => isAvailableScore(row.total));

    // Collect all metric keys
    const metricKeys = new Set<string>();
    for (const row of groupRows) {
      for (const k of Object.keys(row.metrics)) {
        metricKeys.add(k);
      }
    }

    const metricAverages: Record<string, number> = {};
    for (const k of metricKeys) {
      const vals = scoredRows.map((r) => r.metrics[k]);
      const avg = safeMean(vals);
      if (avg !== null) {
        metricAverages[k] = avg;
      }
    }

    baselines.push({
      jabatan: jab as Jabatan,
      periodeLabel: period,
      avgTotal,
      metricAverages,
      n: scoredRows.length,
    });
  }

  return baselines;
}

export function classifyStatus(
  profile: Pick<IndividualProfile, 'trend' | 'vsPeerAvg'>
): 'watchlist' | 'top_performer' | 'normal' {
  if (profile.trend.direction === 'down' && profile.vsPeerAvg < 0) {
    return 'watchlist';
  }
  if (profile.trend.direction !== 'down' && profile.vsPeerAvg > 0) {
    return 'top_performer';
  }
  return 'normal';
}

/**
 * Orchestrates individual profiling for all unique employees in the dataset.
 */
export function buildIndividualProfiles(
  rows: NormalizedRow[],
  baselines: PeerBaseline[]
): IndividualProfile[] {
  if (rows.length === 0) return [];

  // Group rows by NPK
  const rowsByNpk = new Map<number, NormalizedRow[]>();
  const nameByNpk = new Map<number, string>();

  for (const row of rows) {
    let list = rowsByNpk.get(row.npk);
    if (!list) {
      list = [];
      rowsByNpk.set(row.npk, list);
    }
    list.push(row);
    nameByNpk.set(row.npk, row.nama);
  }

  // Create baseline mapping for fast lookup: `${jabatan}_${periodeLabel}` -> PeerBaseline
  const baselineMap = new Map<string, PeerBaseline>(
    baselines.map((b) => [`${b.jabatan}_${b.periodeLabel}`, b])
  );

  // Compute team average benchmarks per MPG per Period (for vsTeamAvg)
  const teamAverages = new Map<string, number>(); // key: `${mpg}_${periodeLabel}`
  const teamGrouped = new Map<string, number[]>();
  for (const r of rows) {
    const key = `${r.mpg}_${r.periodeLabel}`;
    let list = teamGrouped.get(key);
    if (!list) {
      list = [];
      teamGrouped.set(key, list);
    }
    if (isAvailableScore(r.total)) list.push(r.total);
  }
  for (const [key, vals] of teamGrouped.entries()) {
    const average = safeScoreMean(vals);
    if (average !== null) teamAverages.set(key, average);
  }

  const profiles: IndividualProfile[] = [];

  for (const [npk, npkRows] of rowsByNpk.entries()) {
    const nama = nameByNpk.get(npk) ?? 'Karyawan Tanpa Nama';

    // Sort chronologically
    npkRows.sort((a, b) => a.periodeDate.getTime() - b.periodeDate.getTime());

    // 1. History & Mutations
    const history = npkRows.map((r) => ({
      periodeLabel: r.periodeLabel,
      mpg: r.mpg,
      wctr: r.wctr,
      jabatan: r.jabatan,
      loc: r.loc,
      lokasi: r.lokasi,
      total: r.total,
    }));

    const mutasiEvents = computeMutations(history);
    const hasMutasi = mutasiEvents.length > 0;

    // 2. Main Role (Jabatan Utama) - defined as the latest role or most frequent
    const roleCounts = new Map<Jabatan, number>();
    for (const h of history) {
      roleCounts.set(h.jabatan, (roleCounts.get(h.jabatan) ?? 0) + 1);
    }
    let jabatanUtama: Jabatan = 'UNKNOWN';
    let maxCount = 0;
    for (const [role, count] of roleCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        jabatanUtama = role;
      }
    }
    // Fallback to latest
    if (history.length > 0) {
      jabatanUtama = history[history.length - 1].jabatan;
    }

    // 3. Stats & Trends
    const scoredRows = npkRows.filter((row) => isAvailableScore(row.total));
    if (scoredRows.length === 0) continue;
    const avgTotalOverall = safeScoreMean(scoredRows.map((r) => r.total)) ?? 0;
    
    // For trend & volatility, we shape periodStats like TeamPeriodStat
    const shapedStats = scoredRows.map((r) => ({
      mpg: r.mpg,
      periodeLabel: r.periodeLabel,
      avgTotal: r.total,
      memberCount: 1,
      countByJabatan: { CSM: 0, CE: 0, SPS: 0, UNKNOWN: 0 },
      pctHO: 0,
      pctSERPO: 0,
      metricAverages: {},
    }));

    const trend = computeTeamTrend(shapedStats);
    const volatility = computeVolatility(shapedStats);

    // 4. Metric Averages (for the employee across all periods)
    const metricAccum = new Map<string, number[]>();
    for (const r of scoredRows) {
      for (const [k, val] of Object.entries(r.metrics)) {
        if (val !== null && val !== undefined) {
          let arr = metricAccum.get(k);
          if (!arr) {
            arr = [];
            metricAccum.set(k, arr);
          }
          arr.push(val);
        }
      }
    }

    const metricAverages: Record<string, number> = {};
    for (const [k, vals] of metricAccum.entries()) {
      const avg = safeMean(vals);
      if (avg !== null) {
        metricAverages[k] = avg;
      }
    }

    // 5. vsTeamAvg and vsPeerAvg
    // Calculate differences relative to team avg and peer role avg in the respective months, then average them
    const vsTeamDeltas = scoredRows.map((r) => {
      const teamAvg = teamAverages.get(`${r.mpg}_${r.periodeLabel}`) ?? r.total;
      return r.total - teamAvg;
    });
    const vsTeamAvg = safeMean(vsTeamDeltas) ?? 0;

    const vsPeerDeltas = scoredRows.map((r) => {
      const peer = baselineMap.get(`${r.jabatan}_${r.periodeLabel}`);
      const peerAvg = peer?.avgTotal ?? r.total;
      return r.total - peerAvg;
    });
    const vsPeerAvg = safeMean(vsPeerDeltas) ?? 0;

    // 6. Pros & Cons (vs Peer Baseline)
    // Gather average baselines for the same peer group (across the employee's active periods)
    const peerMetricAccum = new Map<string, number[]>();
    for (const r of scoredRows) {
      const peer = baselineMap.get(`${r.jabatan}_${r.periodeLabel}`);
      if (peer) {
        for (const [k, val] of Object.entries(peer.metricAverages)) {
          let arr = peerMetricAccum.get(k);
          if (!arr) {
            arr = [];
            peerMetricAccum.set(k, arr);
          }
          arr.push(val);
        }
      }
    }

    const peerMetricAverages: Record<string, number> = {};
    for (const [k, vals] of peerMetricAccum.entries()) {
      const avg = safeMean(vals);
      if (avg !== null) {
        peerMetricAverages[k] = avg;
      }
    }

    const { pros, cons } = computeProsCons(metricAverages, peerMetricAverages);

    // 7. Status
    const status = classifyStatus({ trend, vsPeerAvg });

    profiles.push({
      npk,
      nama,
      jabatanUtama,
      history,
      mutasiEvents,
      hasMutasi,
      avgTotalOverall,
      trend,
      volatility,
      metricAverages,
      vsTeamAvg,
      vsPeerAvg,
      rankInPeerGroup: 0, // set later
      pros,
      cons,
      status,
    });
  }

  // 8. Assign rankInPeerGroup per peer group (CSM, CE, SPS separately)
  const groups: Record<Jabatan, IndividualProfile[]> = {
    CSM: [],
    CE: [],
    SPS: [],
    UNKNOWN: [],
  };

  for (const p of profiles) {
    groups[p.jabatanUtama] = groups[p.jabatanUtama] ?? [];
    groups[p.jabatanUtama].push(p);
  }

  for (const key of Object.keys(groups)) {
    const list = groups[key as Jabatan];
    list.sort((a, b) => b.avgTotalOverall - a.avgTotalOverall);
    list.forEach((p, index) => {
      p.rankInPeerGroup = index + 1;
    });
  }

  return profiles;
}
