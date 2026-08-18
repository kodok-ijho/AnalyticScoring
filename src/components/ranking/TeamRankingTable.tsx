import { useMemo } from 'react';
import { useDashboardStore } from '../../store/useDashboardStore';
import { exportRankingToXlsx } from '../../lib/exportXlsx';
import { TREND_COLORS, TREND_THRESHOLD_PCT } from '../../lib/constants';
import { safeMean } from '../../lib/aggregateTeams';
import type { TeamPeriodStat, TeamProfile } from '../../types';

type RankedProfile = {
  profile: TeamProfile;
  rank: number;
  score: number;
  count: number;
  trend: { direction: 'up' | 'down' | 'flat'; deltaPct: number };
};

type TrendValueField = 'avgTotalCsm' | 'avgTotalAnggota';

function TrendIcon({ direction }: { direction: 'up' | 'down' | 'flat' }) {
  const color = TREND_COLORS[direction];
  if (direction === 'up') {
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5}>
        <path d="M7 17l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (direction === 'down') {
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5}>
        <path d="M7 7l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5}>
      <path d="M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function computeRoleTrend(
  periodStats: TeamPeriodStat[],
  valueField: TrendValueField
): { direction: 'up' | 'down' | 'flat'; deltaPct: number } {
  const validStats = periodStats.filter((stat) => {
    const value = stat[valueField];
    return value !== undefined && value > 0;
  });

  if (validStats.length < 2) {
    return { direction: 'flat', deltaPct: 0 };
  }

  const blockSize = validStats.length >= 6 ? 3 : 1;
  const earlyMean = safeMean(validStats.slice(0, blockSize).map((stat) => stat[valueField])) ?? 0;
  const lateMean = safeMean(validStats.slice(-blockSize).map((stat) => stat[valueField])) ?? 0;

  if (earlyMean === 0) {
    return { direction: 'flat', deltaPct: 0 };
  }

  const deltaPct = ((lateMean - earlyMean) / earlyMean) * 100;

  if (deltaPct > TREND_THRESHOLD_PCT) {
    return { direction: 'up', deltaPct };
  }
  if (deltaPct < -TREND_THRESHOLD_PCT) {
    return { direction: 'down', deltaPct };
  }
  return { direction: 'flat', deltaPct };
}

function RankingPanel({
  title,
  subtitle,
  rows,
  scoreLabel,
  countLabel,
  accentClass,
  selectedTeam,
  onSelectTeam,
}: {
  title: string;
  subtitle: string;
  rows: RankedProfile[];
  scoreLabel: string;
  countLabel: string;
  accentClass: string;
  selectedTeam: string | null;
  onSelectTeam: (mpg: string) => void;
}) {
  return (
    <section className="rounded-xl border border-slate-700/50 bg-slate-950/30 overflow-hidden">
      <div className={`px-5 py-4 border-b border-slate-800/70 ${accentClass}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white">{title}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
          </div>
          <span className="rounded-lg bg-slate-950/40 px-2.5 py-1 text-xs font-semibold text-slate-300">
            {rows.length} tim
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px]">
          <thead className="bg-slate-900/70">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">#</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">MPG</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">{scoreLabel}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Tren</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">{countLabel}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {rows.map(({ profile, rank, score, count, trend }) => {
              const isSelected = selectedTeam === profile.mpg;

              return (
                <tr
                  key={profile.mpg}
                  onClick={() => onSelectTeam(profile.mpg)}
                  className={`cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? 'bg-violet-500/10 border-l-2 border-l-violet-500'
                      : 'hover:bg-slate-800/40'
                  }`}
                >
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold ${
                      rank <= 3
                        ? 'bg-gradient-to-br from-violet-500 to-cyan-500 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {rank}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-white">{profile.mpg}</td>
                  <td className="px-4 py-3 text-slate-300 font-mono text-sm font-semibold">
                    {score.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <TrendIcon direction={trend.direction} />
                      <span
                        className="text-sm font-medium"
                        style={{ color: TREND_COLORS[trend.direction] }}
                      >
                        {trend.deltaPct > 0 ? '+' : ''}
                        {trend.deltaPct.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-sm">{count}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function TeamRankingTable() {
  const filteredProfiles = useDashboardStore((s) => s.filteredProfiles);
  const setSelectedTeam = useDashboardStore((s) => s.setSelectedTeam);
  const selectedTeam = useDashboardStore((s) => s.selectedTeam);
  const analysisScope = useDashboardStore((s) => s.analysisScope);
  const assignmentNote = analysisScope === 'fiscal-year'
    ? 'Anggota mengikuti snapshot akhir periode; rata-rata menghitung seluruh skor orang-bulan yang terisi.'
    : 'Anggota dan skor mengikuti penempatan pada bulan yang dipilih.';

  const csmRankings = useMemo<RankedProfile[]>(() => {
    return filteredProfiles
      .map((profile) => {
        const lastStat = profile.periodStats[profile.periodStats.length - 1];
        return {
          profile,
          rank: 0,
          score: profile.avgTotalCsmOverall ?? 0,
          count: lastStat?.countByJabatan.CSM ?? 0,
          trend: computeRoleTrend(profile.periodStats, 'avgTotalCsm'),
        };
      })
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }, [filteredProfiles]);

  const technicianRankings = useMemo<RankedProfile[]>(() => {
    return filteredProfiles
      .map((profile) => {
        const lastStat = profile.periodStats[profile.periodStats.length - 1];
        return {
          profile,
          rank: 0,
          score: profile.avgTotalAnggotaOverall ?? 0,
          count: (lastStat?.countByJabatan.CE ?? 0) + (lastStat?.countByJabatan.SPS ?? 0),
          trend: computeRoleTrend(profile.periodStats, 'avgTotalAnggota'),
        };
      })
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }, [filteredProfiles]);

  return (
    <div className="glass rounded-xl overflow-hidden animate-fadeIn">
      <div className="px-6 py-4 flex items-center justify-between border-b border-slate-700/50">
        <h2 className="text-lg font-bold text-white">
          Profil Tim
          <span className="ml-2 text-sm font-normal text-slate-500">
            CSM dan Tim (CE & SPS)
          </span>
        </h2>
        <button
          onClick={() => exportRankingToXlsx(filteredProfiles)}
          className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors border border-emerald-500/20"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export XLSX
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 p-4">
        <RankingPanel
          title="Ranking CSM"
          subtitle={`Diurutkan berdasarkan rata-rata skor CSM per MPG. ${assignmentNote}`}
          rows={csmRankings}
          scoreLabel="Rata-rata CSM"
          countLabel="CSM"
          accentClass="bg-violet-500/10"
          selectedTeam={selectedTeam}
          onSelectTeam={setSelectedTeam}
        />
        <RankingPanel
          title="Ranking Tim (CE & SPS)"
          subtitle={`Diurutkan berdasarkan rata-rata skor CE dan SPS per MPG. ${assignmentNote}`}
          rows={technicianRankings}
          scoreLabel="Rata-rata Tim"
          countLabel="CE & SPS"
          accentClass="bg-cyan-500/10"
          selectedTeam={selectedTeam}
          onSelectTeam={setSelectedTeam}
        />
      </div>
    </div>
  );
}
