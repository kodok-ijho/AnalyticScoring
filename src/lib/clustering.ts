import type {
  ArchetypeCategory,
  ClusterArchetype,
  IndividualProfile,
  PersonnelCluster,
} from '../types';

/**
 * Deterministic PRNG using Mulberry32 algorithm with a fixed seed.
 */
function createMulberry32(seed = 42) {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface NormalizedFeatureMatrix {
  rawVectors: number[][];
  normalizedVectors: number[][];
  featureNames: string[];
  means: number[];
  stdDevs: number[];
}

/**
 * Extract numerical feature vectors from individual profiles.
 */
function extractFeatures(profiles: IndividualProfile[]): NormalizedFeatureMatrix {
  const featureNames = [
    'avgTotalOverall',
    'volatility',
    'trendDeltaPct',
    'vsPeerAvg',
  ];

  // Collect any common metric names
  const allMetricKeys = new Set<string>();
  for (const p of profiles) {
    for (const k of Object.keys(p.metricAverages)) {
      allMetricKeys.add(k);
    }
  }

  const sortedMetricKeys = Array.from(allMetricKeys).sort();
  const fullFeatureNames = [...featureNames, ...sortedMetricKeys];

  const rawVectors: number[][] = profiles.map((p) => {
    const base = [
      p.avgTotalOverall,
      p.volatility,
      p.trend.deltaPct,
      p.vsPeerAvg,
    ];
    const metricVals = sortedMetricKeys.map((k) => p.metricAverages[k] ?? p.avgTotalOverall);
    return [...base, ...metricVals];
  });

  const numFeatures = fullFeatureNames.length;
  const means: number[] = new Array(numFeatures).fill(0);
  const stdDevs: number[] = new Array(numFeatures).fill(0);

  if (rawVectors.length === 0) {
    return { rawVectors: [], normalizedVectors: [], featureNames: fullFeatureNames, means, stdDevs };
  }

  // Calculate means
  for (let j = 0; j < numFeatures; j++) {
    let sum = 0;
    for (let i = 0; i < rawVectors.length; i++) {
      sum += rawVectors[i][j];
    }
    means[j] = sum / rawVectors.length;
  }

  // Calculate standard deviations
  for (let j = 0; j < numFeatures; j++) {
    let sumSq = 0;
    for (let i = 0; i < rawVectors.length; i++) {
      const diff = rawVectors[i][j] - means[j];
      sumSq += diff * diff;
    }
    stdDevs[j] = Math.sqrt(sumSq / rawVectors.length);
    if (stdDevs[j] < 1e-6) {
      stdDevs[j] = 1; // Avoid divide-by-zero
    }
  }

  // Calculate Z-Scores
  const normalizedVectors: number[][] = rawVectors.map((vec) =>
    vec.map((val, j) => (val - means[j]) / stdDevs[j])
  );

  return {
    rawVectors,
    normalizedVectors,
    featureNames: fullFeatureNames,
    means,
    stdDevs,
  };
}

/**
 * Euclidean distance squared between two vectors.
 */
function distanceSq(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return sum;
}

/**
 * Deterministic K-Means++ Clustering with Mulberry32 PRNG.
 */
export function runKMeans(
  vectors: number[][],
  k: number,
  seed = 42,
  maxIterations = 50
): { assignments: number[]; centroids: number[][] } {
  const n = vectors.length;
  if (n === 0) return { assignments: [], centroids: [] };
  if (n <= k) {
    return {
      assignments: vectors.map((_, i) => i),
      centroids: vectors.map((v) => [...v]),
    };
  }

  const prng = createMulberry32(seed);
  const numFeatures = vectors[0].length;

  // 1. K-Means++ Centroid Initialization
  const centroids: number[][] = [];
  const firstIdx = Math.floor(prng() * n);
  centroids.push([...vectors[firstIdx]]);

  while (centroids.length < k) {
    const distances: number[] = [];
    let sumDist = 0;

    for (let i = 0; i < n; i++) {
      let minDist = Infinity;
      for (const c of centroids) {
        const d = distanceSq(vectors[i], c);
        if (d < minDist) minDist = d;
      }
      distances.push(minDist);
      sumDist += minDist;
    }

    if (sumDist <= 0) {
      // Pick random remaining
      centroids.push([...vectors[Math.floor(prng() * n)]]);
      continue;
    }

    const randVal = prng() * sumDist;
    let cumulative = 0;
    let chosenIdx = 0;
    for (let i = 0; i < n; i++) {
      cumulative += distances[i];
      if (cumulative >= randVal) {
        chosenIdx = i;
        break;
      }
    }
    centroids.push([...vectors[chosenIdx]]);
  }

  // 2. Iterative Lloyd's Algorithm
  let assignments = new Array(n).fill(0);
  let changed = true;
  let iteration = 0;

  while (changed && iteration < maxIterations) {
    changed = false;
    iteration++;

    // Assignment Step
    for (let i = 0; i < n; i++) {
      let bestCluster = 0;
      let bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        const d = distanceSq(vectors[i], centroids[c]);
        if (d < bestDist) {
          bestDist = d;
          bestCluster = c;
        }
      }
      if (assignments[i] !== bestCluster) {
        assignments[i] = bestCluster;
        changed = true;
      }
    }

    // Update Centroids Step
    const counts = new Array(k).fill(0);
    const newCentroids: number[][] = Array.from({ length: k }, () =>
      new Array(numFeatures).fill(0)
    );

    for (let i = 0; i < n; i++) {
      const c = assignments[i];
      counts[c]++;
      for (let j = 0; j < numFeatures; j++) {
        newCentroids[c][j] += vectors[i][j];
      }
    }

    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) {
        for (let j = 0; j < numFeatures; j++) {
          centroids[c][j] = newCentroids[c][j] / counts[c];
        }
      }
    }
  }

  return { assignments, centroids };
}

/**
 * Determine a human-friendly business archetype classification for a cluster.
 */
function classifyArchetype(
  clusterId: string,
  members: IndividualProfile[],
  avgScore: number,
  avgVolatility: number,
  avgTrendDeltaPct: number
): ClusterArchetype {
  let category: ArchetypeCategory = 'needs_coaching';
  let name = 'Perlu Pendampingan Operasional';
  let badgeColor = 'bg-rose-500/10 border-rose-500/30 text-rose-400';
  let description = 'Personil dengan skor rata-rata rendah dan tren stagnan/menurun.';

  const strengths: string[] = [];

  // Count common strengths across members
  const prosCount = new Map<string, number>();
  for (const m of members) {
    for (const p of m.pros) {
      prosCount.set(p.metric, (prosCount.get(p.metric) ?? 0) + 1);
    }
  }

  const sortedPros = Array.from(prosCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([m]) => m);
  strengths.push(...sortedPros);

  if (avgScore >= 3.85 && avgVolatility < 0.28) {
    category = 'solid_anchor';
    name = 'Pilar Utama (Solid High Performer)';
    badgeColor = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
    description = 'Personil dengan performa unggul konsisten dan tingkat stabilitas kerja sangat tinggi.';
  } else if (avgTrendDeltaPct >= 3.5 && avgScore >= 3.2) {
    category = 'rising_potential';
    name = 'Potensi Berkembang (Rising Star)';
    badgeColor = 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300';
    description = 'Personil dengan akselerasi perbaikan skor signifikan sepanjang periode evaluasi.';
  } else if (avgVolatility >= 0.28) {
    category = 'volatile_performer';
    name = 'Fluktuatif (Volatile Performer)';
    badgeColor = 'bg-amber-500/10 border-amber-500/30 text-amber-400';
    description = 'Personil dengan capaian skor cukup baik namun rentan mengalami naik-turun yang drastis.';
  } else if (strengths.length > 0 && avgScore >= 3.1) {
    category = 'metric_specialist';
    name = 'Spesialis Metrik Tertentu';
    badgeColor = 'bg-violet-500/10 border-violet-500/30 text-violet-400';
    description = 'Personil dengan keunggulan menonjol di metrik spesifik meskipun skor agregat rata-rata.';
  } else {
    category = 'needs_coaching';
    name = 'Fokus Pendampingan (Needs Coaching)';
    badgeColor = 'bg-rose-500/10 border-rose-500/30 text-rose-400';
    description = 'Personil yang membutuhkan intervensi operasional langsung untuk mendongkrak capaian metrik.';
  }

  return {
    id: clusterId,
    category,
    name,
    badgeColor,
    description,
    avgScore: Number(avgScore.toFixed(2)),
    avgVolatility: Number(avgVolatility.toFixed(3)),
    avgTrendDeltaPct: Number(avgTrendDeltaPct.toFixed(1)),
    strengths,
  };
}

/**
 * Cluster a list of individual profiles into natural archetypes.
 */
export function clusterPersonnel(profiles: IndividualProfile[]): {
  profiles: IndividualProfile[];
  clusters: PersonnelCluster[];
} {
  if (profiles.length === 0) {
    return { profiles: [], clusters: [] };
  }

  const { normalizedVectors } = extractFeatures(profiles);
  const k = Math.min(4, Math.max(2, Math.floor(profiles.length / 5)));
  const { assignments } = runKMeans(normalizedVectors, k, 42);

  // Group by cluster
  const clusterMembers = new Map<number, IndividualProfile[]>();
  for (let c = 0; c < k; c++) {
    clusterMembers.set(c, []);
  }

  for (let i = 0; i < profiles.length; i++) {
    const c = assignments[i];
    clusterMembers.get(c)?.push(profiles[i]);
  }

  const clusters: PersonnelCluster[] = [];
  const updatedProfilesMap = new Map<number, IndividualProfile>();

  let clusterIndex = 1;
  for (const [c, members] of clusterMembers.entries()) {
    if (members.length === 0) continue;

    const clusterId = `cluster-${clusterIndex}`;
    const avgScore = members.reduce((sum, m) => sum + m.avgTotalOverall, 0) / members.length;
    const avgVolatility = members.reduce((sum, m) => sum + m.volatility, 0) / members.length;
    const avgTrendDeltaPct =
      members.reduce((sum, m) => sum + m.trend.deltaPct, 0) / members.length;

    const archetype = classifyArchetype(
      clusterId,
      members,
      avgScore,
      avgVolatility,
      avgTrendDeltaPct
    );

    for (const m of members) {
      updatedProfilesMap.set(m.npk, {
        ...m,
        clusterId,
        clusterLabel: archetype.name,
      });
    }

    clusters.push({
      id: clusterId,
      archetype,
      memberNpks: members.map((m) => m.npk),
      size: members.length,
      percentage: Number(((members.length / profiles.length) * 100).toFixed(1)),
    });

    clusterIndex++;
  }

  // Sort clusters descending by avg score
  clusters.sort((a, b) => b.archetype.avgScore - a.archetype.avgScore);

  const updatedProfiles = profiles.map((p) => updatedProfilesMap.get(p.npk) ?? p);

  return {
    profiles: updatedProfiles,
    clusters,
  };
}
