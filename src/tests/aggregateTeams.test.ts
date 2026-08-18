import { describe, expect, it } from 'vitest';
import {
  buildTeamProfiles,
  computeTeamPeriodStat,
  computeTeamTrend,
  safeScoreMean,
} from '../lib/aggregateTeams';
import type { NormalizedRow } from '../types';

function row(npk: number, total: number, jabatan: NormalizedRow['jabatan'] = 'CE'): NormalizedRow {
  return {
    periodeSerial: 45931,
    periodeDate: new Date(2025, 9, 1),
    periodeLabel: 'Okt 2025',
    mpg: 'A1',
    wctr: 'W1',
    nama: `Personil ${npk}`,
    npk,
    lokasi: 'HO',
    loc: 'MDN',
    jabatan,
    total,
    metrics: {},
  };
}

function rowInPeriod(
  npk: number,
  total: number,
  periodeLabel: string,
  periodeDate: Date,
): NormalizedRow {
  return { ...row(npk, total), periodeLabel, periodeDate };
}

describe('team score averages', () => {
  it('ignores missing, invalid, and zero scores', () => {
    expect(safeScoreMean([4, Number.NaN, 0, null, undefined, 2])).toBe(3);
  });

  it('does not let unscored team members reduce the team average', () => {
    const rows = [row(1, 4), row(2, Number.NaN), row(3, 0), row(4, 2)];
    const stat = computeTeamPeriodStat('A1', 'Okt 2025', rows);
    expect(stat.avgTotal).toBe(3);
    expect(stat.avgTotalAnggota).toBe(3);

    const profile = buildTeamProfiles(rows)[0];
    expect(profile.avgTotalOverall).toBe(3);
    expect(profile.avgTotalAnggotaOverall).toBe(3);
  });

  it('still counts personnel composition even when their score is absent', () => {
    const rows = [row(1, 4, 'CSM'), row(2, Number.NaN), row(3, 0)];
    const stat = computeTeamPeriodStat('A1', 'Okt 2025', rows);
    expect(stat.memberCount).toBe(3);
    expect(stat.countByJabatan.CE).toBe(2);
    expect(stat.avgTotal).toBe(4);
  });

  it('weights every scored person-period equally in the full-period average', () => {
    const rows = [
      rowInPeriod(1, 4, 'Okt 2025', new Date(2025, 9, 1)),
      rowInPeriod(1, 2, 'Nov 2025', new Date(2025, 10, 1)),
      rowInPeriod(2, 2, 'Nov 2025', new Date(2025, 10, 1)),
      rowInPeriod(3, 2, 'Nov 2025', new Date(2025, 10, 1)),
    ];

    const profile = buildTeamProfiles(rows)[0];
    expect(profile.periodStats.map((stat) => stat.avgTotalAnggota)).toEqual([4, 2]);
    expect(profile.avgTotalAnggotaOverall).toBe(2.5);
  });

  it('ignores an unscored month when calculating a trend', () => {
    const scored = computeTeamPeriodStat('A1', 'Okt 2025', [row(1, 4)]);
    const unscored = computeTeamPeriodStat('A1', 'Nov 2025', [
      { ...row(1, Number.NaN), periodeLabel: 'Nov 2025', periodeDate: new Date(2025, 10, 1) },
    ]);
    expect(computeTeamTrend([scored, unscored])).toEqual({ direction: 'flat', deltaPct: 0 });
  });
});
