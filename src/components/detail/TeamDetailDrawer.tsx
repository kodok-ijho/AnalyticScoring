import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
} from 'recharts';
import { useDashboardStore } from '../../store/useDashboardStore';
import { isAvailableScore, safeMean, safeScoreMean } from '../../lib/aggregateTeams';
import { TREND_COLORS } from '../../lib/constants';
import { ProsConsCard } from './ProsConsCard';
import { generateAiAnalysis } from '../../lib/aiAnalysis';
import { TeamOperationalInsightCard } from '../insights/OperationalInsightPanel';

export function TeamDetailDrawer() {
  const selectedTeam = useDashboardStore((s) => s.selectedTeam);
  const setSelectedTeam = useDashboardStore((s) => s.setSelectedTeam);
  const filteredProfiles = useDashboardStore((s) => s.filteredProfiles);
  const availablePeriods = useDashboardStore((s) => s.availablePeriods);
  const filteredRows = useDashboardStore((s) => s.filteredRows);
  const setSelectedIndividual = useDashboardStore((s) => s.setSelectedIndividual);
  const setActiveTab = useDashboardStore((s) => s.setActiveTab);

  const [hoveredTrend, setHoveredTrend] = useState(false);
  const [hoveredVol, setHoveredVol] = useState(false);

  const profile = useMemo(
    () => filteredProfiles.find((p) => p.mpg === selectedTeam),
    [filteredProfiles, selectedTeam]
  );

  const lastStat = useMemo(() => {
    if (!profile) return null;
    return profile.periodStats[profile.periodStats.length - 1];
  }, [profile]);

  const teamMembers = useMemo(() => {
    if (!profile || !lastStat) return [];
    const members = filteredRows.filter(
      (r) => r.mpg === profile.mpg && r.periodeLabel === lastStat.periodeLabel
    );
    const seen = new Set<number>();
    const unique: typeof members = [];
    for (const m of members) {
      if (!seen.has(m.npk)) {
        seen.add(m.npk);
        unique.push(m);
      }
    }
    return unique;
  }, [profile, lastStat, filteredRows]);

  const groupedTeamMembers = useMemo(() => {
    const csm = teamMembers
      .filter((member) => member.jabatan === 'CSM')
      .sort((a, b) => b.total - a.total);
    const teknisi = teamMembers
      .filter((member) => member.jabatan === 'CE' || member.jabatan === 'SPS')
      .sort((a, b) => b.total - a.total);

    return {
      csm,
      teknisi,
      avgCsm: safeScoreMean(csm.map((member) => member.total)),
      avgTeknisi: safeScoreMean(teknisi.map((member) => member.total)),
    };
  }, [teamMembers]);

  // Trend chart data separated by CSM and Tim (CE & SPS).
  const chartData = useMemo(() => {
    if (!profile) return [];
    return availablePeriods.map((period) => {
      const stat = profile.periodStats.find((s) => s.periodeLabel === period);
      const benchmarkCsmValues = filteredProfiles
        .map((p) => p.periodStats.find((s) => s.periodeLabel === period)?.avgTotalCsm)
        .filter((v): v is number => v !== undefined && v > 0);
      const benchmarkTeknisiValues = filteredProfiles
        .map((p) => p.periodStats.find((s) => s.periodeLabel === period)?.avgTotalAnggota)
        .filter((v): v is number => v !== undefined && v > 0);

      return {
        period,
        CSM: stat?.avgTotalCsm ?? null,
        'Tim CE & SPS': stat?.avgTotalAnggota ?? null,
        'Benchmark CSM': safeMean(benchmarkCsmValues),
        'Benchmark Tim': safeMean(benchmarkTeknisiValues),
      };
    });
  }, [profile, filteredProfiles, availablePeriods]);

  // Spiderweb/Radar diagram data split by CSM and Tim (CE & SPS).
  const radarDataByGroup = useMemo(() => {
    if (!profile) return { csm: [], technician: [] };
    const teamKeys = new Set<string>();
    profile.periodStats.forEach((ps) => {
      Object.keys(ps.metricAverages).forEach((k) => {
        if (k.startsWith('5Scale_')) {
          teamKeys.add(k);
        }
      });
    });

    const buildRadarData = (suffix: 'CSM' | 'CE') => {
      const data: { subject: string; team: number; benchmark: number }[] = [];

      teamKeys.forEach((key) => {
        if (!key.endsWith(`_${suffix}`)) return;

        const teamVals = profile.periodStats
          .map((ps) => ps.metricAverages[key])
          .filter((v): v is number => v !== undefined);
        const teamAvg = safeMean(teamVals);

        if (teamAvg !== null) {
          const benchmarkVals: number[] = [];
          filteredProfiles.forEach((p) => {
            p.periodStats.forEach((ps) => {
              const val = ps.metricAverages[key];
              if (val !== undefined && val !== null) {
                benchmarkVals.push(val);
              }
            });
          });
          const benchmarkAvg = safeMean(benchmarkVals) ?? 0;

          const cleanName = key
            .replace(/^5Scale_/, '')
            .replace(/_(CSM|CE|SPS)$/, '');

          data.push({
            subject: cleanName,
            team: Number(teamAvg.toFixed(2)),
            benchmark: Number(benchmarkAvg.toFixed(2)),
          });
        }
      });

      return data;
    };

    return {
      csm: buildRadarData('CSM'),
      technician: buildRadarData('CE'),
    };
  }, [profile, filteredProfiles]);

  const aiReport = useMemo(() => {
    if (!profile) return null;
    return generateAiAnalysis(profile);
  }, [profile]);

  if (!profile || !aiReport || !lastStat) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={() => setSelectedTeam(null)}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full lg:w-1/2 bg-slate-900 z-50 shadow-2xl shadow-black/80 animate-slideInRight overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10 px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Tim {profile.mpg}</h2>
            <p className="text-sm text-slate-500">Detail Profiling</p>
          </div>
          <button
            onClick={() => setSelectedTeam(null)}
            className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors"
          >
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="glass-light rounded-xl p-3 text-center flex flex-col justify-between">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Rank</p>
              <p className="text-xl font-bold gradient-text">#{profile.rank}</p>
            </div>
            <div className="glass-light rounded-xl p-3 text-center flex flex-col justify-between">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Avg CSM</p>
              <p className="text-lg font-bold text-violet-300">{profile.avgTotalCsmOverall?.toFixed(2) ?? '-'}</p>
            </div>
            
            {/* Tren (Hover Tooltip) */}
            <div
              className="glass-light rounded-xl p-3 text-center relative cursor-pointer flex flex-col justify-between"
              onMouseEnter={() => setHoveredTrend(true)}
              onMouseLeave={() => setHoveredTrend(false)}
            >
              <p className="text-xs text-slate-500 uppercase tracking-wider flex items-center justify-center gap-1 select-none">
                Tren
                <svg className="w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </p>
              <div className="flex items-center justify-center gap-1">
                <span
                  className="text-lg font-bold"
                  style={{ color: TREND_COLORS[profile.trend.direction] }}
                >
                  {profile.trend.direction === 'up' ? '↑' : profile.trend.direction === 'down' ? '↓' : '→'}
                  {profile.trend.deltaPct > 0 ? '+' : ''}{profile.trend.deltaPct.toFixed(1)}%
                </span>
              </div>
              {hoveredTrend && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 z-50 glass rounded-lg shadow-xl text-left border border-slate-700/50 text-xs animate-fadeIn pointer-events-none">
                  <h5 className="font-semibold text-violet-400 mb-1">Penjelasan Tren</h5>
                  <p className="text-slate-300 leading-relaxed">{aiReport.trendExplanation}</p>
                </div>
              )}
            </div>

            {/* Volatilitas (Hover Tooltip) */}
            <div
              className="glass-light rounded-xl p-3 text-center relative cursor-pointer flex flex-col justify-between"
              onMouseEnter={() => setHoveredVol(true)}
              onMouseLeave={() => setHoveredVol(false)}
            >
              <p className="text-xs text-slate-500 uppercase tracking-wider flex items-center justify-center gap-1 select-none">
                Stabilitas
                <svg className="w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </p>
              <div className="flex items-center justify-center gap-1">
                <span className="text-lg font-bold text-white">
                  {profile.volatility.toFixed(3)}
                </span>
              </div>
              {hoveredVol && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 z-50 glass rounded-lg shadow-xl text-left border border-slate-700/50 text-xs animate-fadeIn pointer-events-none">
                  <h5 className="font-semibold text-cyan-400 mb-1">Penjelasan Stabilitas</h5>
                  <p className="text-slate-300 leading-relaxed">{aiReport.volatilityExplanation}</p>
                </div>
              )}
            </div>

            <div className="glass-light rounded-xl p-3 text-center flex flex-col justify-between">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Avg Tim</p>
              <p className="text-lg font-bold text-cyan-300">{profile.avgTotalAnggotaOverall?.toFixed(2) ?? '-'}</p>
            </div>
          </div>

          <TeamOperationalInsightCard profile={profile} />

          {/* Trend Chart */}
          <div className="glass-light rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Tren Performa CSM vs Tim (CE & SPS)
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#475569' }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#475569' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0', fontSize: '12px' }}
                />
                <Line
                  type="monotone"
                  dataKey="CSM"
                  stroke="#8b5cf6"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#8b5cf6' }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="Tim CE & SPS"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#06b6d4' }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="Benchmark CSM"
                  stroke="#64748b"
                  strokeWidth={1.5}
                  strokeDasharray="6 3"
                  dot={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="Benchmark Tim"
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Spiderweb / Radar Diagram */}
          {(radarDataByGroup.csm.length > 0 || radarDataByGroup.technician.length > 0) && (
            <div className="glass-light rounded-xl p-4 space-y-5">
              {[
                {
                  title: 'Radar Metrik CSM (5Scale)',
                  data: radarDataByGroup.csm,
                  name: `CSM ${profile.mpg}`,
                  color: '#8b5cf6',
                  benchmarkColor: '#f59e0b',
                },
                {
                  title: 'Radar Metrik Tim CE & SPS (5Scale)',
                  data: radarDataByGroup.technician,
                  name: `Tim CE & SPS ${profile.mpg}`,
                  color: '#06b6d4',
                  benchmarkColor: '#f59e0b',
                },
              ].map((section) => (
                section.data.length > 0 && (
                  <div key={section.title}>
                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                      {section.title}
                    </h3>
                    <div className="flex justify-center">
                      <ResponsiveContainer width="100%" height={300}>
                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={section.data}>
                          <PolarGrid stroke="#334155" />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 5]} tick={{ fill: '#64748b', fontSize: 9 }} />
                          <Radar
                            name={section.name}
                            dataKey="team"
                            stroke={section.color}
                            fill={section.color}
                            fillOpacity={0.35}
                          />
                          <Radar
                            name="Rata-rata Semua"
                            dataKey="benchmark"
                            stroke={section.benchmarkColor}
                            fill={section.benchmarkColor}
                            fillOpacity={0.06}
                            strokeDasharray="5 4"
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#1e293b',
                              border: '1px solid #334155',
                              borderRadius: '8px',
                              color: '#e2e8f0',
                              fontSize: '12px',
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )
              ))}
            </div>
          )}

          {/* Composition */}
          {lastStat && (
            <div className="glass-light rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Komposisi Tim
              </h3>
              <div className="space-y-3">
                {/* Role distribution */}
                <div className="flex gap-3">
                  {(['CSM', 'CE', 'SPS'] as const).map((role) => {
                    const count = lastStat.countByJabatan[role] ?? 0;
                    const colors: Record<string, string> = {
                      CSM: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
                      CE: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
                      SPS: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
                    };
                    return (
                      <div key={role} className={`flex-1 rounded-lg p-3 border ${colors[role]}`}>
                        <p className="text-xs font-medium uppercase">{role}</p>
                        <p className="text-2xl font-bold">{count}</p>
                      </div>
                    );
                  })}
                </div>

                {/* HO vs SERPO bar */}
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>HO {lastStat.pctHO.toFixed(0)}%</span>
                    <span>SERPO {lastStat.pctSERPO.toFixed(0)}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-700 overflow-hidden flex">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-violet-400 rounded-l-full"
                      style={{ width: `${lastStat.pctHO}%` }}
                    />
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-r-full"
                      style={{ width: `${lastStat.pctSERPO}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Daftar Anggota Tim */}
          {teamMembers.length > 0 && (
            <div className="glass-light rounded-xl p-4">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                  Daftar Tim (Periode Terakhir)
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-2">
                    <p className="font-semibold text-violet-300">CSM</p>
                    <p className="font-mono text-slate-300">
                      {groupedTeamMembers.csm.length} orang
                      <span className="text-slate-500">
                        {' / '}
                        Avg {groupedTeamMembers.avgCsm !== null ? groupedTeamMembers.avgCsm.toFixed(2) : '-'}
                      </span>
                    </p>
                  </div>
                  <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2">
                    <p className="font-semibold text-cyan-300">Teknisi</p>
                    <p className="font-mono text-slate-300">
                      {groupedTeamMembers.teknisi.length} orang
                      <span className="text-slate-500">
                        {' / '}
                        Avg {groupedTeamMembers.avgTeknisi !== null ? groupedTeamMembers.avgTeknisi.toFixed(2) : '-'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  {
                    key: 'csm',
                    title: 'CSM',
                    members: groupedTeamMembers.csm,
                    empty: 'Tidak ada CSM pada periode terakhir.',
                    badgeClass: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
                  },
                  {
                    key: 'teknisi',
                    title: 'Teknisi (CE & SPS)',
                    members: groupedTeamMembers.teknisi,
                    empty: 'Tidak ada Teknisi pada periode terakhir.',
                    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
                  },
                ].map((section) => (
                  <div key={section.key} className="rounded-xl border border-slate-800/60 bg-slate-950/20 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                        {section.title}
                      </h4>
                      <span className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${section.badgeClass}`}>
                        {section.members.length} orang
                      </span>
                    </div>

                    {section.members.length > 0 ? (
                      <div className="space-y-2">
                        {section.members.map((member) => (
                          <div
                            key={member.npk}
                            onClick={() => {
                              setSelectedTeam(null);
                              setSelectedIndividual(member.npk);
                              setActiveTab('individual');
                            }}
                            className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 hover:bg-slate-800/70 border border-slate-800/30 transition-all cursor-pointer group"
                          >
                            <div>
                              <p className="text-sm font-semibold text-white group-hover:text-violet-400 transition-colors">
                                {member.nama}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 font-mono">
                                <span>NPK {member.npk}</span>
                                <span>•</span>
                                <span>{member.loc}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                                {member.jabatan}
                              </span>
                              <span className="text-sm font-bold text-slate-300 font-mono">
                                {isAvailableScore(member.total) ? member.total.toFixed(2) : '—'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-lg border border-slate-800/40 bg-slate-900/40 px-3 py-2 text-xs text-slate-500">
                        {section.empty}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pros/Cons */}
          <div>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Kekuatan & Kelemahan
            </h3>
            <ProsConsCard pros={profile.pros} cons={profile.cons} />
          </div>

          {/* AI Analysis & Recommendations */}
          <div className="glass-light rounded-xl p-5 border border-violet-500/20 relative overflow-hidden shadow-lg shadow-violet-500/5">
            <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center animate-pulseGlow">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">Ringkasan Analisis & Saran</h4>
                <p className="text-xs text-violet-400">Bahasa yang lebih mudah dibaca</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Executive Summary */}
              <div className="text-slate-300 text-sm leading-relaxed bg-slate-950/30 p-3 rounded-lg border border-slate-800/50">
                {aiReport.summary}
              </div>

              {/* Trend & Volatility Explanations */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/20 p-3 rounded-lg border border-slate-800/30 text-xs">
                <div>
                  <h5 className="font-semibold text-violet-400 mb-1 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    Tren Kerja
                  </h5>
                <p className="text-slate-300 leading-relaxed">{aiReport.trendExplanation}</p>
                </div>
                <div>
                  <h5 className="font-semibold text-cyan-400 mb-1 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Stabilitas Hasil
                  </h5>
                  <p className="text-slate-300 leading-relaxed">{aiReport.volatilityExplanation}</p>
                </div>
              </div>

              {/* Detailed Breakdown */}
              {aiReport.prosAnalysis.length > 0 && (
                <div>
                  <h5 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1.5">Yang Sudah Bagus</h5>
                  <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                    {aiReport.prosAnalysis.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {aiReport.consAnalysis.length > 0 && (
                <div>
                  <h5 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1.5">Yang Perlu Diperbaiki</h5>
                  <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                    {aiReport.consAnalysis.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* What to Improve */}
              <div className="border-t border-slate-800/80 pt-3">
                <h5 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Saran Perbaikan
                </h5>
                <ul className="space-y-2 text-xs text-slate-300">
                  {aiReport.recommendations.map((rec, i) => (
                    <li key={i} className="flex gap-2 items-start bg-slate-950/20 p-2 rounded-lg border border-slate-800/30">
                      <span className="w-4 h-4 rounded bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold text-[10px] mt-0.5 flex-shrink-0">
                        {i + 1}
                      </span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
