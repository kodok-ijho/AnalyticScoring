import { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { useDashboardStore } from '../../store/useDashboardStore';
import { safeMean } from '../../lib/aggregateTeams';
import { CHART_COLORS } from '../../lib/constants';

interface RoleDist {
  role: string;
  min: number;
  avg: number;
  max: number;
  count: number;
}

export function JabatanComparisonView() {
  const filteredIndividualProfiles = useDashboardStore((s) => s.filteredIndividualProfiles);

  const roleStats = useMemo<RoleDist[]>(() => {
    const roles = ['CE', 'SPS', 'CSM'] as const;
    
    return roles.map((role) => {
      const roleProfiles = filteredIndividualProfiles.filter((p) => p.jabatanUtama === role);
      const totals = roleProfiles.map((p) => p.avgTotalOverall);

      const count = totals.length;
      if (count === 0) {
        return { role, min: 0, avg: 0, max: 0, count };
      }

      return {
        role,
        min: Number(Math.min(...totals).toFixed(2)),
        avg: Number((safeMean(totals) ?? 0).toFixed(2)),
        max: Number(Math.max(...totals).toFixed(2)),
        count,
      };
    });
  }, [filteredIndividualProfiles]);

  return (
    <div className="glass rounded-xl overflow-hidden animate-fadeIn h-full flex flex-col">
      <div className="px-6 py-4 border-b border-slate-700/50">
        <h2 className="text-lg font-bold text-white">Distribusi Performa per Jabatan</h2>
      </div>

      <div className="p-6 flex-1 flex flex-col justify-between gap-6">
        {/* Simple Statistics Grid */}
        <div className="grid grid-cols-3 gap-3">
          {roleStats.map((stat, i) => (
            <div key={stat.role} className="glass-light rounded-xl p-3 border border-slate-700/30 text-center">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{stat.role}</p>
              <p className="text-2xl font-bold text-white mt-1 font-mono">{stat.avg.toFixed(2)}</p>
              <p className="text-[10px] text-slate-400 mt-1 font-mono">
                Min: {stat.min} | Max: {stat.max}
              </p>
              <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                n = {stat.count} orang
              </p>
            </div>
          ))}
        </div>

        {/* Recharts Bar Chart comparing averages */}
        <div className="h-60 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={roleStats} margin={{ top: 10, right: 10, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="role"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={{ stroke: '#475569' }}
              />
              <YAxis
                domain={[0, 5]}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={{ stroke: '#475569' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  color: '#e2e8f0',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="avg" name="Rata-rata TOTAL" radius={[4, 4, 0, 0]}>
                {roleStats.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
