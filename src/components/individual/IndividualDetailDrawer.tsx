import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';
import { useDashboardStore } from '../../store/useDashboardStore';
import { isAvailableScore } from '../../lib/aggregateTeams';
import { TREND_COLORS } from '../../lib/constants';
import { MutasiTimeline } from './MutasiTimeline';
import { ProsConsCard } from '../detail/ProsConsCard';
import { generateIndividualAiAnalysis } from '../../lib/aiAnalysis';
import { IndividualOperationalInsightCard } from '../insights/OperationalInsightPanel';

export function IndividualDetailDrawer() {
  const selectedIndividual = useDashboardStore((s) => s.selectedIndividual);
  const setSelectedIndividual = useDashboardStore((s) => s.setSelectedIndividual);
  const filteredIndividualProfiles = useDashboardStore((s) => s.filteredIndividualProfiles);
  const peerBaselines = useDashboardStore((s) => s.peerBaselines);

  const [hoveredTrend, setHoveredTrend] = useState(false);
  const [hoveredVol, setHoveredVol] = useState(false);

  // Find profile of selected NPK
  const profile = useMemo(
    () => filteredIndividualProfiles.find((p) => p.npk === selectedIndividual),
    [filteredIndividualProfiles, selectedIndividual]
  );

  const chartData = useMemo(() => {
    if (!profile) return [];
    return profile.history.map((h) => {
      // Find peer baseline for the same role and month
      const peer = peerBaselines.find(
        (b) => b.jabatan === h.jabatan && b.periodeLabel === h.periodeLabel
      );
      return {
        period: h.periodeLabel,
        Skor: isAvailableScore(h.total) ? h.total : null,
        'Rata-rata Peran': peer?.avgTotal ?? null,
      };
    });
  }, [profile, peerBaselines]);

  const radarData = useMemo(() => {
    if (!profile) return [];

    const data: { subject: string; value: number; baseline: number }[] = [];

    Object.entries(profile.metricAverages).forEach(([key, val]) => {
      if (key.startsWith('5Scale_')) {
        if ((profile.jabatanUtama === 'CE' || profile.jabatanUtama === 'SPS') && key.includes('TSM')) {
          return;
        }

        // Clean name
        const cleanName = key
          .replace(/^5Scale_/, '')
          .replace(/_(CSM|CE|SPS)$/, '');

        // Find peer baseline average for this period range (aggregate of peer metrics)
        const activePeriods = new Set(profile.history.map((h) => h.periodeLabel));
        const matchingPeers = peerBaselines.filter(
          (b) => b.jabatan === profile.jabatanUtama && activePeriods.has(b.periodeLabel)
        );

        const peerVals = matchingPeers
          .map((b) => b.metricAverages[key])
          .filter((v): v is number => v !== undefined);

        const baselineAvg =
          peerVals.length > 0 ? peerVals.reduce((a, b) => a + b, 0) / peerVals.length : 0;

        data.push({
          subject: cleanName,
          value: Number(val.toFixed(2)),
          baseline: Number(baselineAvg.toFixed(2)),
        });
      }
    });

    return data;
  }, [profile, peerBaselines]);

  const latestEntry = useMemo(() => {
    if (!profile || profile.history.length === 0) return null;
    return profile.history[profile.history.length - 1];
  }, [profile]);

  const aiReport = useMemo(() => {
    if (!profile) return null;
    return generateIndividualAiAnalysis(profile);
  }, [profile]);

  const individualProsCons = useMemo(() => {
    if (!profile) return { pros: [], cons: [] };
    const isTeamLevelMetric = (metric: string) => metric.includes('TSM');
    return {
      pros: profile.pros.filter((item) => !isTeamLevelMetric(item.metric)),
      cons: profile.cons.filter((item) => !isTeamLevelMetric(item.metric)),
    };
  }, [profile]);

  if (!profile || !aiReport) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={() => setSelectedIndividual(null)}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full lg:w-1/2 bg-slate-900 z-50 shadow-2xl shadow-black/80 animate-slideInRight overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10 px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">{profile.nama}</h2>
            <p className="text-sm text-slate-500 font-mono">
              NPK {profile.npk} • {profile.jabatanUtama}
              {latestEntry && ` • WCTR ${latestEntry.wctr} • Tim ${latestEntry.mpg}`}
            </p>
          </div>
          <button
            onClick={() => setSelectedIndividual(null)}
            className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors"
          >
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <div className="glass-light rounded-xl p-3 text-center flex flex-col justify-between">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Rank Peran</p>
              <p className="text-xl font-bold gradient-text">#{profile.rankInPeerGroup}</p>
            </div>
            <div className="glass-light rounded-xl p-3 text-center flex flex-col justify-between">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Avg TOTAL</p>
              <p className="text-lg font-bold text-white">{profile.avgTotalOverall.toFixed(2)}</p>
            </div>

            {/* Tren (Hover Popup) */}
            <div
              className="glass-light rounded-xl p-3 text-center relative cursor-pointer flex flex-col justify-between"
              onMouseEnter={() => setHoveredTrend(true)}
              onMouseLeave={() => setHoveredTrend(false)}
            >
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold flex items-center justify-center gap-0.5 select-none">
                Tren
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </p>
              <span
                className="text-base font-bold font-mono"
                style={{ color: TREND_COLORS[profile.trend.direction] }}
              >
                {profile.trend.direction === 'up' ? '↑' : profile.trend.direction === 'down' ? '↓' : '→'}
                {profile.trend.deltaPct > 0 ? '+' : ''}{profile.trend.deltaPct.toFixed(1)}%
              </span>
              {hoveredTrend && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 z-50 glass rounded-lg shadow-xl text-left border border-slate-700/50 text-xs animate-fadeIn pointer-events-none">
                  <h5 className="font-semibold text-violet-400 mb-1">Penjelasan Tren</h5>
                  <p className="text-slate-300 leading-relaxed">
                    {profile.trend.direction === 'up' ? (
                      `Skor rata-rata naik sebesar ${profile.trend.deltaPct.toFixed(1)}% dibandingkan periode awal, menunjukkan peningkatan kinerja.`
                    ) : profile.trend.direction === 'down' ? (
                      `Skor rata-rata turun sebesar ${Math.abs(profile.trend.deltaPct).toFixed(1)}% dibandingkan periode awal, perlu dievaluasi.`
                    ) : (
                      'Kinerja cenderung konstan sepanjang periode.'
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Volatilitas (Hover Popup) */}
            <div
              className="glass-light rounded-xl p-3 text-center relative cursor-pointer flex flex-col justify-between"
              onMouseEnter={() => setHoveredVol(true)}
              onMouseLeave={() => setHoveredVol(false)}
            >
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold flex items-center justify-center gap-0.5 select-none">
                Stabilitas
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </p>
              <span className="text-base font-bold text-white font-mono">
                {profile.volatility.toFixed(3)}
              </span>
              {hoveredVol && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 z-50 glass rounded-lg shadow-xl text-left border border-slate-700/50 text-xs animate-fadeIn pointer-events-none">
                  <h5 className="font-semibold text-cyan-400 mb-1">Penjelasan Stabilitas</h5>
                  <p className="text-slate-300 leading-relaxed">
                    {profile.volatility < 0.15 ? (
                      'Tingkat volatilitas rendah. Performa bulanan sangat stabil dan konsisten.'
                    ) : profile.volatility < 0.30 ? (
                      'Tingkat volatilitas sedang. Fluktuasi performa bulanan tergolong wajar.'
                    ) : (
                      'Tingkat volatilitas tinggi. Performa bulanan naik-turun secara drastis (inkonsisten).'
                    )}
                  </p>
                </div>
              )}
            </div>

            <div className="glass-light rounded-xl p-3 text-center flex flex-col justify-between">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">vs Peer Group</p>
              <span className={`text-base font-bold font-mono ${
                profile.vsPeerAvg >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {profile.vsPeerAvg >= 0 ? '+' : ''}{profile.vsPeerAvg.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Peer Comparison Deviations */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-950/20 p-3 rounded-lg border border-slate-800/30 text-xs text-center">
              <span className="text-slate-500 block uppercase tracking-wider font-semibold mb-1">vs Rata-rata Tim (MPG)</span>
              <span className={`text-base font-bold font-mono ${profile.vsTeamAvg >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {profile.vsTeamAvg >= 0 ? '+' : ''}{profile.vsTeamAvg.toFixed(2)}
              </span>
            </div>
            <div className="bg-slate-950/20 p-3 rounded-lg border border-slate-800/30 text-xs text-center">
              <span className="text-slate-500 block uppercase tracking-wider font-semibold mb-1">vs Rata-rata Jabatan</span>
              <span className={`text-base font-bold font-mono ${profile.vsPeerAvg >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {profile.vsPeerAvg >= 0 ? '+' : ''}{profile.vsPeerAvg.toFixed(2)}
              </span>
            </div>
          </div>

          <IndividualOperationalInsightCard profile={profile} />

          {/* Trend Chart */}
          <div className="glass-light rounded-xl p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Perkembangan Skor
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={{ stroke: '#475569' }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={{ stroke: '#475569' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0', fontSize: '11px' }}
                />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Line
                  type="monotone"
                  dataKey="Skor"
                  stroke="#8b5cf6"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#8b5cf6' }}
                />
                <Line
                  type="monotone"
                  dataKey="Rata-rata Peran"
                  stroke="#64748b"
                  strokeWidth={1.5}
                  strokeDasharray="6 3"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Metric Radar Chart (5Scale metrics vs Peer Baseline) */}
          {radarData.length > 0 && (
            <div className="glass-light rounded-xl p-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Radar Profil Metrik (vs Rata-rata Sejabatan)
              </h3>
              <div className="flex justify-center">
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                    <PolarGrid stroke="#334155" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 5]} tick={{ fill: '#64748b', fontSize: 8 }} />
                    <Radar
                      name={profile.nama}
                      dataKey="value"
                      stroke="#8b5cf6"
                      fill="#8b5cf6"
                      fillOpacity={0.4}
                    />
                    <Radar
                      name="Rata-rata Peran"
                      dataKey="baseline"
                      stroke="#06b6d4"
                      fill="#06b6d4"
                      fillOpacity={0.15}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0', fontSize: '11px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* AI Insights Card */}
          <div className="glass-light rounded-xl p-4 border border-violet-500/10 shadow-lg shadow-violet-500/2">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Ringkasan Analisis Performa
              </h3>
            
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-slate-950/20 p-3 rounded-lg border border-slate-800/30">
                <h4 className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-2">Ringkasan Singkat</h4>
                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                  {aiReport.summary}
                </p>
              </div>

              {/* Explanations */}
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

          {/* Pros & Cons (Strengths vs Weaknesses) */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Perbandingan Metrik vs Peer Group
            </h3>
            <ProsConsCard pros={individualProsCons.pros} cons={individualProsCons.cons} />
          </div>

          {/* Mutation Timeline */}
          <div className="glass-light rounded-xl p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Riwayat Mutasi
            </h3>
            <MutasiTimeline events={profile.mutasiEvents} history={profile.history} />
          </div>
        </div>
      </div>
    </>
  );
}
