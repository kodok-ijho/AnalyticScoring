import { useDashboardStore } from '../../store/useDashboardStore';
import { TREND_COLORS } from '../../lib/constants';

export function TopPerformerPanel() {
  const filteredIndividualProfiles = useDashboardStore((s) => s.filteredIndividualProfiles);
  const setSelectedIndividual = useDashboardStore((s) => s.setSelectedIndividual);

  // Filter profiles with status === 'top_performer' and sort by avgTotalOverall desc
  const topPerformers = filteredIndividualProfiles
    .filter((p) => p.status === 'top_performer')
    .sort((a, b) => b.avgTotalOverall - a.avgTotalOverall);

  return (
    <div className="glass rounded-xl p-5 border border-emerald-500/10 shadow-lg shadow-emerald-500/2 animate-fadeIn h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0 border border-emerald-500/20">
          <svg className="w-4.5 h-4.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Top Performers</h3>
          <p className="text-xs text-emerald-400 font-semibold">{topPerformers.length} Personil Unggul</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[300px] space-y-2.5 pr-1">
        {topPerformers.map((p, index) => (
          <div
            key={p.npk}
            onClick={() => setSelectedIndividual(p.npk)}
            className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-700/30 hover:border-emerald-500/30 hover:bg-slate-800/80 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <span className="w-5 h-5 rounded bg-emerald-500/10 text-emerald-400 text-xs font-bold flex items-center justify-center font-mono">
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{p.nama}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-bold text-slate-500 font-mono">NPK {p.npk}</span>
                  <span className="px-1.5 py-0.2 rounded bg-slate-700 text-slate-400 text-[9px] font-bold uppercase tracking-wider">
                    {p.jabatanUtama}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-emerald-400 font-mono">
                {p.avgTotalOverall.toFixed(2)}
              </p>
              <div className="flex items-center gap-1 justify-end mt-0.5 text-xs text-slate-500 font-mono">
                <span>Tren:</span>
                <span style={{ color: TREND_COLORS[p.trend.direction] }}>
                  {p.trend.deltaPct > 0 ? '+' : ''}{p.trend.deltaPct.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        ))}

        {topPerformers.length === 0 && (
          <div className="text-center py-12 text-slate-600 text-xs">
            Belum ada personil yang masuk ke radar top performer.
          </div>
        )}
      </div>
    </div>
  );
}
