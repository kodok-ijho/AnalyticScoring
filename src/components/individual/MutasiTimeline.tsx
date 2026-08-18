import type { MutasiEvent, AttributeHistoryEntry } from '../../types';
import { isAvailableScore, safeScoreMean } from '../../lib/aggregateTeams';

interface Props {
  events: MutasiEvent[];
  history: AttributeHistoryEntry[];
}

export function MutasiTimeline({ events, history }: Props) {
  if (events.length === 0) {
    return (
      <div className="text-center py-6 text-slate-500 text-xs bg-slate-950/20 rounded-xl border border-slate-800/30">
        Tidak ada riwayat mutasi tim, jabatan, atau lokasi.
      </div>
    );
  }

  const getFieldName = (field: MutasiEvent['field']) => {
    switch (field) {
      case 'mpg': return 'Kelompok MPG (Tim)';
      case 'jabatan': return 'Jabatan (Role)';
      case 'loc': return 'Cabang (Loc)';
      default: return field;
    }
  };

  // Helper to compute average of scores
  const getAverage = (entries: AttributeHistoryEntry[]) => {
    return safeScoreMean(entries.map((entry) => entry.total));
  };

  return (
    <div className="relative border-l border-slate-700/50 pl-5 ml-2.5 py-2 space-y-5 animate-fadeIn">
      {events.map((event, i) => {
        // Find index of transition
        const toIdx = history.findIndex((h) => h.periodeLabel === event.toPeriode);
        
        let beforeAvg: number | null = null;
        let afterAvg: number | null = null;
        let diff: number | null = null;
        let showAnalysis = false;

        if (toIdx >= 2 && (history.length - toIdx) >= 2) {
          const beforeEntries = history.slice(0, toIdx);
          const afterEntries = history.slice(toIdx);
          beforeAvg = getAverage(beforeEntries);
          afterAvg = getAverage(afterEntries);
          if (beforeAvg !== null && afterAvg !== null) {
            diff = afterAvg - beforeAvg;
            showAnalysis = beforeEntries.some((entry) => isAvailableScore(entry.total))
              && afterEntries.some((entry) => isAvailableScore(entry.total));
          }
        }

        return (
          <div key={i} className="relative">
            {/* Node marker */}
            <div className="absolute -left-[26px] top-1 w-3 h-3 rounded-full bg-cyan-500 border-2 border-slate-900 animate-pulseGlow" />

            {/* Time & field */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider font-mono">
                {event.toPeriode}
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-xs font-semibold text-slate-400">
                Perubahan {getFieldName(event.field)}
              </span>
            </div>

            {/* Value change box */}
            <div className="bg-slate-950/40 border border-slate-800/50 rounded-lg p-2.5 flex items-center gap-3 text-xs">
              <div className="flex-1 text-slate-400 bg-slate-900/50 px-2 py-1 rounded">
                <span className="text-[10px] text-slate-500 block uppercase font-semibold">Sebelum</span>
                <span className="font-semibold text-slate-300">{event.from || '—'}</span>
              </div>
              <div className="flex-shrink-0 text-slate-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
              <div className="flex-1 text-slate-400 bg-cyan-500/5 border border-cyan-500/10 px-2 py-1 rounded">
                <span className="text-[10px] text-cyan-500 block uppercase font-semibold">Sesudah</span>
                <span className="font-semibold text-cyan-300">{event.to || '—'}</span>
              </div>
            </div>

            {/* Before vs After Impact Analysis */}
            {showAnalysis && beforeAvg !== null && afterAvg !== null && diff !== null && (
              <div className="mt-2 ml-1 p-2 bg-slate-800/40 rounded-lg border border-slate-700/30 text-[11px] text-slate-400 flex items-center justify-between">
                <div>
                  Dampak Mutasi: Rata-rata Skor{' '}
                  <span className="font-semibold text-slate-300 font-mono">{beforeAvg.toFixed(2)}</span>
                  {' '}→{' '}
                  <span className="font-semibold text-slate-300 font-mono">{afterAvg.toFixed(2)}</span>
                </div>
                <div className={`font-mono font-bold ${diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {diff >= 0 ? '+' : ''}
                  {diff.toFixed(2)}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
