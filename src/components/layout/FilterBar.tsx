import { useState, useRef, useEffect, useMemo } from 'react';
import { useDashboardStore } from '../../store/useDashboardStore';
import type { LokasiType } from '../../types';
import { buildFiscalYearOptions, getScopeStatusLabel } from '../../lib/analysisPeriods';

export function FilterBar() {
  const filters = useDashboardStore((s) => s.filters);
  const availablePeriods = useDashboardStore((s) => s.availablePeriods);
  const availableMpgs = useDashboardStore((s) => s.availableMpgs);
  const normalizedRows = useDashboardStore((s) => s.normalizedRows);
  const analysisScope = useDashboardStore((s) => s.analysisScope);
  const selectedMonth = useDashboardStore((s) => s.selectedMonth);
  const selectedFiscalYearStart = useDashboardStore((s) => s.selectedFiscalYearStart);
  const setFilter = useDashboardStore((s) => s.setFilter);
  const resetFilters = useDashboardStore((s) => s.resetFilters);
  const setAnalysisScope = useDashboardStore((s) => s.setAnalysisScope);
  const setAnalysisMonth = useDashboardStore((s) => s.setAnalysisMonth);
  const setAnalysisFiscalYear = useDashboardStore((s) => s.setAnalysisFiscalYear);

  const [mpgOpen, setMpgOpen] = useState(false);
  const [mpgSearch, setMpgSearch] = useState('');
  const mpgRef = useRef<HTMLDivElement>(null);

  // Close MPG dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (mpgRef.current && !mpgRef.current.contains(e.target as Node)) {
        setMpgOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filteredMpgs = availableMpgs.filter((m) =>
    m.toLowerCase().includes(mpgSearch.toLowerCase())
  );

  const selectedMpgs = filters.mpgSelected ?? [];
  const selectedLokasi = filters.lokasi ?? [];
  const fiscalYearOptions = useMemo(
    () => buildFiscalYearOptions(normalizedRows),
    [normalizedRows],
  );
  const activeFiscalYear = fiscalYearOptions.find(
    (option) => option.startYear === selectedFiscalYearStart,
  ) ?? fiscalYearOptions[0];
  const scopeStatus = getScopeStatusLabel(
    activeFiscalYear,
    analysisScope === 'monthly' ? selectedMonth : null,
  );

  const toggleLokasi = (lok: LokasiType) => {
    const current = filters.lokasi ?? [];
    if (current.includes(lok)) {
      const next = current.filter((l) => l !== lok);
      setFilter({ lokasi: next.length > 0 ? next : null });
    } else {
      setFilter({ lokasi: [...current, lok] });
    }
  };

  const toggleMpg = (mpg: string) => {
    const current = filters.mpgSelected ?? [];
    if (current.includes(mpg)) {
      const next = current.filter((m) => m !== mpg);
      setFilter({ mpgSelected: next.length > 0 ? next : null });
    } else {
      setFilter({ mpgSelected: [...current, mpg] });
    }
  };

  const hasActiveFilters =
    (filters.lokasi !== null && filters.lokasi.length > 0) ||
    (filters.mpgSelected !== null && filters.mpgSelected.length > 0);

  return (
    <div className="glass relative z-30 rounded-xl p-4 mb-6 animate-fadeIn">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-700/40">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Mode Analisa</span>
          <div className="flex bg-slate-900/70 p-1 rounded-lg border border-slate-700/50">
            <button
              onClick={() => setAnalysisScope('monthly')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                analysisScope === 'monthly'
                  ? 'bg-violet-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Bulanan
            </button>
            <button
              onClick={() => setAnalysisScope('fiscal-year')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                analysisScope === 'fiscal-year'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Full Year (Okt–Sep)
            </button>
          </div>
        </div>
        <div className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${
          analysisScope === 'monthly'
            ? 'bg-violet-500/10 border-violet-500/30 text-violet-300'
            : activeFiscalYear?.isComplete
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
        }`}>
          Data aktif: {scopeStatus}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {/* Analysis period */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
            {analysisScope === 'monthly' ? 'Bulan' : 'Tahun Scoring'}
          </span>
          {analysisScope === 'monthly' ? (
            <select
              className="bg-slate-800/80 border border-slate-600/50 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-violet-500/50"
              value={selectedMonth ?? ''}
              onChange={(e) => setAnalysisMonth(e.target.value)}
            >
              {availablePeriods.map((period) => (
                <option key={period} value={period}>{period}</option>
              ))}
            </select>
          ) : (
            <select
              className="bg-slate-800/80 border border-slate-600/50 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-cyan-500/50"
              value={selectedFiscalYearStart ?? activeFiscalYear?.startYear ?? ''}
              onChange={(e) => setAnalysisFiscalYear(Number(e.target.value))}
            >
              {fiscalYearOptions.map((option) => (
                <option key={option.startYear} value={option.startYear}>
                  {option.label}{option.isComplete ? '' : ` (YTD s.d. ${option.lastPeriod})`}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Lokasi */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Lokasi</span>
          {(['HO', 'SERPO'] as LokasiType[]).map((lok) => (
            <button
              key={lok}
              onClick={() => toggleLokasi(lok)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-all ${
                selectedLokasi.includes(lok)
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25'
                  : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700/80 border border-slate-600/50'
              }`}
            >
              {lok}
            </button>
          ))}
        </div>

        {/* MPG multi-select */}
        <div className="relative" ref={mpgRef}>
          <button
            onClick={() => setMpgOpen(!mpgOpen)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-slate-800/80 border border-slate-600/50 text-slate-300 hover:border-violet-500/50 transition-colors"
          >
            <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold mr-1">MPG</span>
            {selectedMpgs.length > 0 ? (
              <span className="px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400 text-xs font-semibold">
                {selectedMpgs.length} dipilih
              </span>
            ) : (
              <span className="text-slate-400">Semua</span>
            )}
            <svg className={`w-4 h-4 text-slate-500 transition-transform ${mpgOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {mpgOpen && (
            <div className="absolute top-full mt-2 left-0 z-50 w-64 glass rounded-xl shadow-2xl shadow-black/50 p-3 animate-fadeIn">
              <input
                type="text"
                placeholder="Cari MPG..."
                className="w-full bg-slate-800/80 border border-slate-600/50 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-violet-500/50 mb-2"
                value={mpgSearch}
                onChange={(e) => setMpgSearch(e.target.value)}
              />
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => setFilter({ mpgSelected: [...availableMpgs] })}
                  className="text-xs text-violet-400 hover:text-violet-300"
                >
                  Pilih Semua
                </button>
                <button
                  onClick={() => setFilter({ mpgSelected: null })}
                  className="text-xs text-slate-500 hover:text-slate-400"
                >
                  Hapus
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {filteredMpgs.map((mpg) => (
                  <label
                    key={mpg}
                    className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-700/50 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMpgs.includes(mpg)}
                      onChange={() => toggleMpg(mpg)}
                      className="rounded border-slate-600 text-violet-500 focus:ring-violet-500 bg-slate-800"
                    />
                    <span className="text-slate-300">{mpg}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Reset */}
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-slate-700/50 text-slate-400 hover:bg-slate-600/50 hover:text-slate-300 transition-colors ml-auto"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reset Filter
          </button>
        )}
      </div>
    </div>
  );
}
