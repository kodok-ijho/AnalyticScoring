import { useMemo } from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { useDashboardStore } from '../../store/useDashboardStore';

interface ScatterPoint {
  mpg: string;
  size: number;
  avgTotal: number;
}

type ScatterMode = 'csm' | 'technician';

const SCATTER_MODE_CONFIG: Record<ScatterMode, {
  title: string;
  sizeLabel: string;
  scoreLabel: string;
  color: string;
  stroke: string;
}> = {
  csm: {
    title: 'Jumlah CSM vs Performa CSM',
    sizeLabel: 'Jumlah CSM',
    scoreLabel: 'Avg CSM',
    color: '#8b5cf6',
    stroke: '#a78bfa',
  },
  technician: {
    title: 'Jumlah Tim (CE & SPS) vs Performa',
    sizeLabel: 'Jumlah CE & SPS',
    scoreLabel: 'Avg Tim',
    color: '#06b6d4',
    stroke: '#67e8f9',
  },
};

const CustomTooltip = ({ active, payload, mode }: any) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload as ScatterPoint;
  const config = SCATTER_MODE_CONFIG[mode as ScatterMode];
  return (
    <div className="glass rounded-lg px-3 py-2 shadow-xl text-sm">
      <p className="font-semibold text-white">{data.mpg}</p>
      <p className="text-slate-400">{config.sizeLabel}: <span className="text-cyan-400">{data.size}</span></p>
      <p className="text-slate-400">{config.scoreLabel}: <span className="text-violet-400">{data.avgTotal.toFixed(2)}</span></p>
    </div>
  );
};

export function SizeVsPerformanceChart({ mode = 'technician' }: { mode?: ScatterMode }) {
  const filteredProfiles = useDashboardStore((s) => s.filteredProfiles);
  const config = SCATTER_MODE_CONFIG[mode];

  const scatterData = useMemo<ScatterPoint[]>(() => {
    return filteredProfiles
      .map((p) => {
        const lastStat = p.periodStats[p.periodStats.length - 1];
        return {
          mpg: p.mpg,
          size: mode === 'csm'
            ? lastStat?.countByJabatan.CSM ?? 0
            : (lastStat?.countByJabatan.CE ?? 0) + (lastStat?.countByJabatan.SPS ?? 0),
          avgTotal: mode === 'csm'
            ? p.avgTotalCsmOverall ?? 0
            : p.avgTotalAnggotaOverall ?? 0,
        };
      })
      .filter((point) => point.avgTotal > 0);
  }, [filteredProfiles, mode]);

  return (
    <div className="glass rounded-xl overflow-hidden animate-fadeIn h-full">
      <div className="px-6 py-4 border-b border-slate-700/50">
        <h2 className="text-lg font-bold text-white">{config.title}</h2>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={350}>
          <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="size"
              name={config.sizeLabel}
              type="number"
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              axisLine={{ stroke: '#475569' }}
              label={{ value: config.sizeLabel, position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 11 }}
            />
            <YAxis
              dataKey="avgTotal"
              name={config.scoreLabel}
              type="number"
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              axisLine={{ stroke: '#475569' }}
              label={{ value: config.scoreLabel, angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }}
            />
            <Tooltip content={<CustomTooltip mode={mode} />} />
            <Scatter data={scatterData} fill={config.color}>
              {scatterData.map((_, i) => (
                <Cell
                  key={i}
                  fill={config.color}
                  fillOpacity={0.7}
                  stroke={config.stroke}
                  strokeWidth={1}
                  r={7}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
