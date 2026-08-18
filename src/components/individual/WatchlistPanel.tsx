import { useDashboardStore } from '../../store/useDashboardStore';
import { TREND_COLORS } from '../../lib/constants';

export function WatchlistPanel() {
  const filteredIndividualProfiles = useDashboardStore((s) => s.filteredIndividualProfiles);
  const setSelectedIndividual = useDashboardStore((s) => s.setSelectedIndividual);

  // Filter profiles with status === 'watchlist'
  const watchlist = filteredIndividualProfiles.filter((p) => p.status === 'watchlist');

  return (
    <div className="glass rounded-xl p-5 border border-red-500/10 shadow-lg shadow-red-500/2 animate-fadeIn h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0 border border-red-500/20">
          <svg className="w-4.5 h-4.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Watchlist Performa</h3>
          <p className="text-xs text-red-400 font-semibold">{watchlist.length} Personil Perlu Perhatian</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[300px] space-y-2.5 pr-1">
        {watchlist.map((p) => (
          <div
            key={p.npk}
            onClick={() => setSelectedIndividual(p.npk)}
            className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-700/30 hover:border-red-500/30 hover:bg-slate-800/80 transition-all cursor-pointer"
          >
            <div>
              <p className="text-sm font-semibold text-white">{p.nama}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-bold text-slate-500 font-mono">NPK {p.npk}</span>
                <span className="px-1.5 py-0.2 rounded bg-slate-700 text-slate-400 text-[9px] font-bold uppercase tracking-wider">
                  {p.jabatanUtama}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-red-400 font-mono">
                {p.avgTotalOverall.toFixed(2)}
              </p>
              <div className="flex items-center gap-1 justify-end mt-0.5 text-xs text-slate-500 font-mono">
                <span>Tren:</span>
                <span style={{ color: TREND_COLORS[p.trend.direction] }}>
                  {p.trend.deltaPct.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        ))}

        {watchlist.length === 0 && (
          <div className="text-center py-12 text-slate-600 text-xs">
            Tidak ada personil dalam radar perhatian.
          </div>
        )}
      </div>
    </div>
  );
}
