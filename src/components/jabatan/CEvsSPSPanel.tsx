import { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { useDashboardStore } from '../../store/useDashboardStore';
import { CE_METRICS } from '../../lib/constants';
import { safeMean } from '../../lib/aggregateTeams';

interface MetricComp {
  metric: string;
  CE: number;
  SPS: number;
}

export function CEvsSPSPanel() {
  const filteredIndividualProfiles = useDashboardStore((s) => s.filteredIndividualProfiles);

  const comparisonData = useMemo<MetricComp[]>(() => {
    // Separate profiles
    const ceProfiles = filteredIndividualProfiles.filter((p) => p.jabatanUtama === 'CE');
    const spsProfiles = filteredIndividualProfiles.filter((p) => p.jabatanUtama === 'SPS');

    return CE_METRICS.map((metric) => {
      const key = `5Scale_${metric}_CE`;

      // Average for CE
      const ceVals = ceProfiles
        .map((p) => p.metricAverages[key])
        .filter((v): v is number => v !== undefined && v !== null);
      const ceAvg = safeMean(ceVals) ?? 0;

      // Average for SPS
      const spsVals = spsProfiles
        .map((p) => p.metricAverages[key])
        .filter((v): v is number => v !== undefined && v !== null);
      const spsAvg = safeMean(spsVals) ?? 0;

      return {
        metric,
        CE: Number(ceAvg.toFixed(2)),
        SPS: Number(spsAvg.toFixed(2)),
      };
    });
  }, [filteredIndividualProfiles]);

  return (
    <div className="glass rounded-xl overflow-hidden animate-fadeIn h-full flex flex-col">
      <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Breakdown Metrik: CE vs SPS</h2>
        <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
          Skala Metrik 5Scale
        </span>
      </div>

      <div className="p-6 flex-1">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonData} margin={{ top: 10, right: 10, bottom: 5, left: -25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="metric"
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
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Bar dataKey="CE" name="CE (Customer Engineer)" fill="#8b5cf6" fillOpacity={0.8} radius={[2, 2, 0, 0]} />
              <Bar dataKey="SPS" name="SPS (Service Planning Support)" fill="#06b6d4" fillOpacity={0.8} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
