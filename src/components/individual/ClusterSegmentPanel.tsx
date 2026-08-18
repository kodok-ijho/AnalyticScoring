import { useDashboardStore } from '../../store/useDashboardStore';

export function ClusterSegmentPanel() {
  const clusters = useDashboardStore((s) => s.clusters);
  const selectedClusterId = useDashboardStore((s) => s.selectedClusterId);
  const setSelectedClusterId = useDashboardStore((s) => s.setSelectedClusterId);

  if (!clusters || clusters.length === 0) return null;

  return (
    <div className="glass rounded-xl p-5 border border-slate-700/50 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Segmentasi Pola Kerja (K-Means Clustering)
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Pengelompokan otomatis berbasis kemiripan trajektori 9 bulan, tingkat volatilitas, dan profil metrik.
          </p>
        </div>

        {selectedClusterId && (
          <button
            onClick={() => setSelectedClusterId(null)}
            className="text-xs px-3 py-1 rounded-lg border border-slate-600 bg-slate-800/80 text-slate-300 hover:text-white hover:border-slate-500 transition-all flex items-center gap-1.5 self-start sm:self-auto"
          >
            <span>✕ Reset Filter Segmen</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {clusters.map((c) => {
          const isSelected = selectedClusterId === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setSelectedClusterId(isSelected ? null : c.id)}
              className={`text-left p-4 rounded-xl border transition-all relative overflow-hidden flex flex-col justify-between ${
                isSelected
                  ? 'bg-slate-800/90 border-cyan-500 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/50'
                  : 'bg-slate-900/60 border-slate-700/40 hover:border-slate-600 hover:bg-slate-800/50'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${c.archetype.badgeColor}`}
                  >
                    {c.archetype.name}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-400">
                    {c.size} orang ({c.percentage}%)
                  </span>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-3">
                  {c.archetype.description}
                </p>
              </div>

              <div className="pt-2.5 border-t border-slate-800 flex items-center justify-between text-xs">
                <div className="text-slate-400">
                  <span>Rata-rata: </span>
                  <span className="font-bold text-white">{c.archetype.avgScore.toFixed(2)}</span>
                </div>
                <div className="text-slate-400">
                  <span>Volatilitas: </span>
                  <span className="font-bold text-slate-300">{c.archetype.avgVolatility.toFixed(3)}</span>
                </div>
                <div className="text-slate-400">
                  <span>Tren: </span>
                  <span
                    className={`font-bold ${
                      c.archetype.avgTrendDeltaPct > 0
                        ? 'text-emerald-400'
                        : c.archetype.avgTrendDeltaPct < 0
                        ? 'text-rose-400'
                        : 'text-slate-300'
                    }`}
                  >
                    {c.archetype.avgTrendDeltaPct > 0 ? '+' : ''}
                    {c.archetype.avgTrendDeltaPct.toFixed(1)}%
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
