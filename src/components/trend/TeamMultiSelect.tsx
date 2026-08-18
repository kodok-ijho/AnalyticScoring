import { useDashboardStore } from '../../store/useDashboardStore';
import { CHART_COLORS } from '../../lib/constants';

export function TeamMultiSelect() {
  const availableMpgs = useDashboardStore((s) => s.availableMpgs);
  const compareTeams = useDashboardStore((s) => s.compareTeams);
  const toggleCompareTeam = useDashboardStore((s) => s.toggleCompareTeam);
  const clearCompareTeams = useDashboardStore((s) => s.clearCompareTeams);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
        Bandingkan:
      </span>
      <div className="flex flex-wrap gap-1.5">
        {availableMpgs.map((mpg) => {
          const idx = compareTeams.indexOf(mpg);
          const isSelected = idx >= 0;
          const isDisabled = !isSelected && compareTeams.length >= 5;

          return (
            <button
              key={mpg}
              onClick={() => !isDisabled && toggleCompareTeam(mpg)}
              disabled={isDisabled}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                isSelected
                  ? 'text-white shadow-sm'
                  : isDisabled
                    ? 'bg-slate-800/30 text-slate-600 cursor-not-allowed'
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 border border-slate-700/50'
              }`}
              style={
                isSelected
                  ? { backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] + '30', borderLeft: `3px solid ${CHART_COLORS[idx % CHART_COLORS.length]}` }
                  : undefined
              }
            >
              {mpg}
            </button>
          );
        })}
      </div>
      {compareTeams.length > 0 && (
        <button
          onClick={clearCompareTeams}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors ml-1"
        >
          Hapus Semua
        </button>
      )}
    </div>
  );
}
