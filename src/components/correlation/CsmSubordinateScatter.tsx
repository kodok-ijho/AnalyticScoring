import { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Scatter,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ZAxis,
} from 'recharts';
import { useDashboardStore } from '../../store/useDashboardStore';

interface Point {
  csmTotal: number;
  avgSubordinateTotal: number;
  mpg: string;
  periodeLabel: string;
}

export function CsmSubordinateScatter() {
  const csmCorrelation = useDashboardStore((s) => s.csmCorrelation);

  const { points, pearsonR, n, interpretation } = useMemo(() => {
    if (!csmCorrelation) {
      return { points: [], pearsonR: 0, n: 0, interpretation: 'Belum ada data korelasi.' };
    }
    return csmCorrelation;
  }, [csmCorrelation]);

  // Compute linear regression line points to show a trendline: y = mx + c
  const trendlineData = useMemo(() => {
    if (points.length < 2) return [];

    const x = points.map((p) => p.csmTotal);
    const y = points.map((p) => p.avgSubordinateTotal);

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((accum, val, i) => accum + val * y[i], 0);
    const sumX2 = x.reduce((accum, val) => accum + val * val, 0);

    const m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const c = (sumY - m * sumX) / n;

    // Find min and max X
    const minX = Math.min(...x);
    const maxX = Math.max(...x);

    return [
      { csmTotal: minX, trendVal: m * minX + c },
      { csmTotal: maxX, trendVal: m * maxX + c },
    ];
  }, [points, n]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    
    // Check if it's the scatter point or the line point
    const data = payload[0].payload;
    if (data.trendVal !== undefined) return null; // skip tooltip for trendline

    return (
      <div className="glass rounded-lg px-3.5 py-2.5 shadow-2xl border border-slate-700/50 text-xs text-slate-300">
        <p className="font-semibold text-white mb-1">
          Tim {data.mpg} ({data.periodeLabel})
        </p>
        <p>Skor CSM (Supervisor): <span className="text-violet-400 font-bold font-mono">{data.csmTotal.toFixed(2)}</span></p>
        <p>Rata-rata Teknisi: <span className="text-cyan-400 font-bold font-mono">{data.avgSubordinateTotal.toFixed(2)}</span></p>
      </div>
    );
  };

  return (
    <div className="glass rounded-xl overflow-hidden animate-fadeIn h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-700/50 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Hubungan Skor CSM ↔ Skor Teknisi</h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Analisis korelasi performa supervisor dan anak buah</p>
        </div>
        <div className="flex items-center gap-3 bg-slate-800/80 px-3.5 py-2 rounded-xl border border-slate-700/50">
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-semibold">Pearson r</span>
            <span className="text-sm font-bold text-violet-400 font-mono">
              {n >= 2 ? pearsonR.toFixed(3) : '—'}
            </span>
          </div>
          <div className="h-6 w-px bg-slate-700" />
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-semibold">Sampel (n)</span>
            <span className="text-sm font-bold text-cyan-400 font-mono">{n} pasang</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 flex-1 flex flex-col justify-between gap-4">
        {/* Scatter Plot */}
        <div className="h-60 mt-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart margin={{ top: 10, right: 15, bottom: 5, left: -25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="csmTotal"
                name="Skor CSM"
                type="number"
                domain={['auto', 'auto']}
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                axisLine={{ stroke: '#475569' }}
                label={{ value: 'Skor CSM (Supervisor)', position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 10 }}
              />
              <YAxis
                dataKey="avgSubordinateTotal"
                name="Rata-rata Teknisi"
                type="number"
                domain={['auto', 'auto']}
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                axisLine={{ stroke: '#475569' }}
                label={{ value: 'Rata-rata Skor Teknisi', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }}
              />
              <ZAxis range={[50, 50]} />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Scatter Points */}
              <Scatter
                name="MPG Per Periode"
                data={points}
                fill="#8b5cf6"
                fillOpacity={0.7}
                line={false}
              />

              {/* Trendline */}
              {trendlineData.length > 0 && (
                <Line
                  name="Garis Tren"
                  data={trendlineData}
                  type="monotone"
                  dataKey="trendVal"
                  stroke="#06b6d4"
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Narrative / Interpretation */}
        <div className="p-4 rounded-xl bg-violet-500/5 border border-violet-500/10 text-xs leading-relaxed text-slate-300">
          <div className="flex gap-2 items-start">
            <div className="w-5 h-5 rounded-md bg-violet-500/10 text-violet-400 flex items-center justify-center flex-shrink-0 font-bold">
              i
            </div>
            <div>
              <p className="font-semibold text-slate-200">Catatan Interpretasi Statistik:</p>
              <p className="mt-1">{interpretation}</p>
              <p className="text-[10px] text-slate-500 mt-1 font-medium">
                * Korelasi ini bersifat **deskriptif** asosiatif ("berasosiasi dengan"), bukan hubungan sebab-akibat (kausalitas). Nilai n yang kecil dapat memperbesar margin error korelasi.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
