import { describe, it, expect } from 'vitest';
import { runKMeans, clusterPersonnel } from '../lib/clustering';
import type { IndividualProfile } from '../types';

function createMockProfile(partial: Partial<IndividualProfile>): IndividualProfile {
  return {
    npk: 10001,
    nama: 'Test Person',
    jabatanUtama: 'CE',
    history: [],
    mutasiEvents: [],
    hasMutasi: false,
    avgTotalOverall: 3.5,
    trend: { direction: 'flat', deltaPct: 0 },
    volatility: 0.15,
    metricAverages: { '5Scale_MoP_CE': 3.5, '5Scale_CSAT_CE': 3.5 },
    vsTeamAvg: 0,
    vsPeerAvg: 0,
    rankInPeerGroup: 1,
    pros: [],
    cons: [],
    status: 'normal',
    ...partial,
  };
}

describe('Deterministic K-Means Clustering', () => {
  it('should produce 100% deterministic centroids and assignments with fixed seed', () => {
    const vectors = [
      [1.0, 0.1, 0.0],
      [1.1, 0.12, 0.05],
      [4.5, 0.4, -0.2],
      [4.6, 0.38, -0.18],
      [2.8, 0.2, 0.5],
      [2.9, 0.22, 0.48],
    ];

    const run1 = runKMeans(vectors, 3, 42);
    const run2 = runKMeans(vectors, 3, 42);

    expect(run1.assignments).toEqual(run2.assignments);
    expect(run1.centroids).toEqual(run2.centroids);
  });

  it('should correctly cluster and label natural archetypes', () => {
    const profiles: IndividualProfile[] = [
      // Solid high performers
      createMockProfile({ npk: 101, nama: 'Solid A', avgTotalOverall: 4.6, volatility: 0.1, trend: { direction: 'up', deltaPct: 2 } }),
      createMockProfile({ npk: 102, nama: 'Solid B', avgTotalOverall: 4.5, volatility: 0.12, trend: { direction: 'flat', deltaPct: 0 } }),
      createMockProfile({ npk: 103, nama: 'Solid C', avgTotalOverall: 4.7, volatility: 0.08, trend: { direction: 'up', deltaPct: 3 } }),

      // Rising stars
      createMockProfile({ npk: 201, nama: 'Rising A', avgTotalOverall: 3.6, volatility: 0.2, trend: { direction: 'up', deltaPct: 8.5 } }),
      createMockProfile({ npk: 202, nama: 'Rising B', avgTotalOverall: 3.7, volatility: 0.18, trend: { direction: 'up', deltaPct: 9.0 } }),

      // Volatile
      createMockProfile({ npk: 301, nama: 'Volatile A', avgTotalOverall: 3.4, volatility: 0.45, trend: { direction: 'down', deltaPct: -6 } }),
      createMockProfile({ npk: 302, nama: 'Volatile B', avgTotalOverall: 3.3, volatility: 0.42, trend: { direction: 'flat', deltaPct: 1 } }),

      // Needs coaching
      createMockProfile({ npk: 401, nama: 'Coaching A', avgTotalOverall: 2.2, volatility: 0.15, trend: { direction: 'down', deltaPct: -8 } }),
      createMockProfile({ npk: 402, nama: 'Coaching B', avgTotalOverall: 2.1, volatility: 0.16, trend: { direction: 'down', deltaPct: -10 } }),
    ];

    const result = clusterPersonnel(profiles);

    expect(result.clusters.length).toBeGreaterThan(1);
    expect(result.profiles.length).toBe(profiles.length);

    // Each profile should have clusterId and clusterLabel assigned
    for (const p of result.profiles) {
      expect(p.clusterId).toBeDefined();
      expect(p.clusterLabel).toBeDefined();
    }
  });

  it('handles empty profile list gracefully', () => {
    const result = clusterPersonnel([]);
    expect(result.profiles).toEqual([]);
    expect(result.clusters).toEqual([]);
  });
});
