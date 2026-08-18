import { useMemo, useRef } from 'react';
import { useDashboardStore } from '../../store/useDashboardStore';
import { CSM_METRICS, CE_METRICS } from '../../lib/constants';
import { safeMean } from '../../lib/aggregateTeams';
import { HeatmapCell } from './HeatmapCell';
import { exportElementAsPng } from '../../lib/exportImage';

interface MetricData {
  mpg: string;
  rank: number;
  values: Record<string, number | null>;
}

function HeatmapSection({
  title,
  metrics,
  data,
  sectionRef,
}: {
  title: string;
  metrics: readonly string[];
  data: MetricData[];
  sectionRef?: React.RefObject<HTMLDivElement | null>;
}) {
  // Compute min/max per metric column
  const minMax = useMemo(() => {
    const result: Record<string, { min: number; max: number }> = {};
    for (const metric of metrics) {
      const key = `5Scale_${metric}`;
      const values = data
        .map((d) => d.values[key])
        .filter((v): v is number => v !== null);
      if (values.length > 0) {
        result[key] = { min: Math.min(...values), max: Math.max(...values) };
      }
    }
    return result;
  }, [metrics, data]);

  return (
    <div ref={sectionRef}>
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
        {title}
      </h3>
      <div className="overflow-x-auto">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 sticky left-0 bg-slate-900/90 backdrop-blur-sm z-10 min-w-[80px]">
                MPG
              </th>
              {metrics.map((metric) => (
                <th
                  key={metric}
                  className="px-1 py-2 text-center text-xs font-medium text-slate-500"
                >
                  <div className="writing-mode-vertical" style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)', minHeight: '60px' }}>
                    {metric}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.mpg}>
                <td className="px-3 py-1 text-sm font-medium text-slate-300 sticky left-0 bg-slate-900/90 backdrop-blur-sm z-10">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 w-4">{row.rank}</span>
                    {row.mpg}
                  </div>
                </td>
                {metrics.map((metric) => {
                  const key = `5Scale_${metric}`;
                  const value = row.values[key];
                  const mm = minMax[key];

                  return (
                    <td key={metric} className="px-1 py-1">
                      {value !== null && mm ? (
                        <HeatmapCell
                          value={value}
                          min={mm.min}
                          max={mm.max}
                          metricName={metric}
                          mpg={row.mpg}
                        />
                      ) : (
                        <div className="w-16 h-10 rounded-md bg-slate-800/50 flex items-center justify-center text-xs text-slate-600 border border-slate-700/30">
                          —
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function MetricHeatmap() {
  const filteredProfiles = useDashboardStore((s) => s.filteredProfiles);
  const heatmapRef = useRef<HTMLDivElement>(null);

  // Compute team metric averages across periods for CSM and CE metrics
  const heatmapData = useMemo(() => {
    return filteredProfiles.map((profile) => {
      const values: Record<string, number | null> = {};

      // For each metric, compute average 5Scale across all periods
      const allMetricKeys = new Set<string>();
      for (const ps of profile.periodStats) {
        for (const key of Object.keys(ps.metricAverages)) {
          if (key.startsWith('5Scale_')) {
            allMetricKeys.add(key);
          }
        }
      }

      for (const key of allMetricKeys) {
        const periodValues = profile.periodStats
          .map((ps) => ps.metricAverages[key])
          .filter((v): v is number => v !== undefined);
        values[key] = safeMean(periodValues);
      }

      return {
        mpg: profile.mpg,
        rank: profile.rank,
        values,
      };
    });
  }, [filteredProfiles]);

  // Split metrics for CSM and CE - check which suffix exists
  const csmMetrics = CSM_METRICS.filter((m) => {
    const key = `5Scale_${m}_CSM`;
    return heatmapData.some((d) => d.values[key] !== undefined && d.values[key] !== null);
  });

  const ceMetrics = CE_METRICS.filter((m) => {
    const key = `5Scale_${m}_CE`;
    return heatmapData.some((d) => d.values[key] !== undefined && d.values[key] !== null);
  });

  // Prepare data with correct metric key suffixes
  const csmData = heatmapData.map((d) => ({
    ...d,
    values: Object.fromEntries(
      csmMetrics.map((m) => [`5Scale_${m}`, d.values[`5Scale_${m}_CSM`] ?? null])
    ),
  }));

  const ceData = heatmapData.map((d) => ({
    ...d,
    values: Object.fromEntries(
      ceMetrics.map((m) => [`5Scale_${m}`, d.values[`5Scale_${m}_CE`] ?? null])
    ),
  }));

  return (
    <div className="glass rounded-xl overflow-hidden animate-fadeIn" ref={heatmapRef}>
      <div className="px-6 py-4 flex items-center justify-between border-b border-slate-700/50">
        <h2 className="text-lg font-bold text-white">Breakdown Metrik per Tim</h2>
        <button
          onClick={() => heatmapRef.current && exportElementAsPng(heatmapRef.current, 'metric_heatmap.png')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-slate-700/50 text-slate-400 hover:bg-slate-600/50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          PNG
        </button>
      </div>

      <div className="p-6 space-y-8">
        {csmMetrics.length > 0 && (
          <HeatmapSection
            title="Metrik CSM"
            metrics={csmMetrics}
            data={csmData}
          />
        )}
        {ceMetrics.length > 0 && (
          <HeatmapSection
            title="Metrik Tim (CE & SPS)"
            metrics={ceMetrics}
            data={ceData}
          />
        )}
        {csmMetrics.length === 0 && ceMetrics.length === 0 && (
          <p className="text-slate-500 text-center py-8">
            Tidak ada data metrik 5Scale yang tersedia.
          </p>
        )}
      </div>
    </div>
  );
}
