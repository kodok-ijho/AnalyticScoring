import { useMemo, useRef } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { useDashboardStore } from '../../store/useDashboardStore';
import { CHART_COLORS } from '../../lib/constants';
import { safeMean } from '../../lib/aggregateTeams';
import { exportElementAsPng } from '../../lib/exportImage';
import { TeamMultiSelect } from './TeamMultiSelect';

type TrendMode = 'csm' | 'technician';

const TREND_MODE_CONFIG: Record<TrendMode, {
  title: string;
  exportName: string;
  getValue: (stat: { avgTotalCsm?: number; avgTotalAnggota?: number }) => number | null;
}> = {
  csm: {
    title: 'Tren Performa CSM',
    exportName: 'trend_csm_chart.png',
    getValue: (stat) => stat.avgTotalCsm ?? null,
  },
  technician: {
    title: 'Tren Performa Tim (CE & SPS)',
    exportName: 'trend_tim_ce_sps_chart.png',
    getValue: (stat) => stat.avgTotalAnggota ?? null,
  },
};

export function TeamTrendChart({ mode = 'technician' }: { mode?: TrendMode }) {
  const filteredProfiles = useDashboardStore((s) => s.filteredProfiles);
  const selectedTeam = useDashboardStore((s) => s.selectedTeam);
  const compareTeams = useDashboardStore((s) => s.compareTeams);
  const availablePeriods = useDashboardStore((s) => s.availablePeriods);
  const chartRef = useRef<HTMLDivElement>(null);
  const config = TREND_MODE_CONFIG[mode];

  // Determine which teams to show
  const teamsToShow = useMemo(() => {
    if (compareTeams.length > 0) return compareTeams;
    if (selectedTeam) return [selectedTeam];
    // Default: top 5
    return filteredProfiles.slice(0, 5).map((p) => p.mpg);
  }, [compareTeams, selectedTeam, filteredProfiles]);

  // Build chart data
  const chartData = useMemo(() => {
    const teamProfileMap = new Map(filteredProfiles.map((p) => [p.mpg, p]));

    return availablePeriods.map((period) => {
      const point: Record<string, string | number | null> = { period };

      // Add each team's role-specific average for this period
      for (const mpg of teamsToShow) {
        const profile = teamProfileMap.get(mpg);
        const stat = profile?.periodStats.find((s) => s.periodeLabel === period);
        point[mpg] = stat ? config.getValue(stat) : null;
      }

      // Benchmark (avg of ALL filtered teams)
      const allAvgs = filteredProfiles
        .map((p) => {
          const stat = p.periodStats.find((s) => s.periodeLabel === period);
          return stat ? config.getValue(stat) : null;
        })
        .filter((v): v is number => v !== null && v > 0);
      point['_benchmark'] = safeMean(allAvgs) ?? null;

      return point;
    });
  }, [availablePeriods, teamsToShow, filteredProfiles, config]);

  return (
    <div className="glass rounded-xl overflow-hidden animate-fadeIn">
      <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">{config.title}</h2>
        <button
          onClick={() => chartRef.current && exportElementAsPng(chartRef.current, config.exportName)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-slate-700/50 text-slate-400 hover:bg-slate-600/50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          PNG
        </button>
      </div>

      <div className="px-6 py-3 border-b border-slate-800/50">
        <TeamMultiSelect />
      </div>

      <div className="p-6" ref={chartRef}>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="period"
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              axisLine={{ stroke: '#475569' }}
              tickLine={{ stroke: '#475569' }}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              axisLine={{ stroke: '#475569' }}
              tickLine={{ stroke: '#475569' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '12px',
                color: '#e2e8f0',
                fontSize: '13px',
              }}
              labelStyle={{ color: '#94a3b8', fontWeight: 600 }}
            />
            <Legend
              wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }}
            />

            {/* Team lines */}
            {teamsToShow.map((mpg, i) => (
              <Line
                key={mpg}
                type="monotone"
                dataKey={mpg}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={2.5}
                dot={{ r: 4, fill: CHART_COLORS[i % CHART_COLORS.length] }}
                activeDot={{ r: 6, strokeWidth: 2, stroke: '#0f172a' }}
                connectNulls
              />
            ))}

            {/* Benchmark line */}
            <Line
              type="monotone"
              dataKey="_benchmark"
              name="Rata-rata Semua"
              stroke="#64748b"
              strokeWidth={2}
              strokeDasharray="8 4"
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
