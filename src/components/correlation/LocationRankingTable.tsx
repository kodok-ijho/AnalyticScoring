import { useState, useMemo } from 'react';
import { useDashboardStore } from '../../store/useDashboardStore';
import { computeLocationBreakdown } from '../../lib/correlation';
import type { Jabatan, LocationBreakdownRow } from '../../types';

export function LocationRankingTable() {
  const filteredRows = useDashboardStore((s) => s.filteredRows);

  const [activeRole, setActiveRole] = useState<Jabatan | 'ALL'>('ALL');

  // Compute breakdowns dynamically based on selected role filter
  const locBreakdown = useMemo(() => {
    const job = activeRole === 'ALL' ? null : activeRole;
    return computeLocationBreakdown(filteredRows, 'Loc', job);
  }, [filteredRows, activeRole]);

  const typeBreakdown = useMemo(() => {
    const job = activeRole === 'ALL' ? null : activeRole;
    return computeLocationBreakdown(filteredRows, 'Lokasi', job);
  }, [filteredRows, activeRole]);

  // Separate HO vs SERPO rows
  const hoRow = typeBreakdown.rows.find((r) => r.key === 'HO');
  const serpoRow = typeBreakdown.rows.find((r) => r.key === 'SERPO');

  return (
    <div className="glass rounded-xl overflow-hidden animate-fadeIn h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-700/50 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Performa Cabang & Lokasi</h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Analisis skor rata-rata per lokasi kerja dan cabang</p>
        </div>

        {/* Role toggle filters */}
        <div className="flex bg-slate-800/80 p-1 rounded-lg border border-slate-700/50">
          <button
            onClick={() => setActiveRole('ALL')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              activeRole === 'ALL' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Semua
          </button>
          {(['CE', 'SPS', 'CSM'] as const).map((role) => (
            <button
              key={role}
              onClick={() => setActiveRole(role)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                activeRole === role ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 space-y-6 flex-1 flex flex-col justify-between">
        {/* HO vs SERPO Breakdown Summary */}
        <div className="grid grid-cols-2 gap-4">
          {/* HO Card */}
          <div className="glass-light rounded-xl p-4 border border-violet-500/10 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-violet-500" />
            <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">
              Head Office (HO)
            </span>
            <span className="text-3xl font-extrabold text-white mt-2 block font-mono">
              {hoRow ? hoRow.avgTotal.toFixed(2) : '—'}
            </span>
            <span className="text-[10px] text-slate-500 font-mono mt-1 block">
              n = {hoRow ? hoRow.n : 0} sampel
            </span>
          </div>

          {/* SERPO Card */}
          <div className="glass-light rounded-xl p-4 border border-cyan-500/10 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-cyan-500" />
            <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">
              SERPO (Satelit)
            </span>
            <span className="text-3xl font-extrabold text-white mt-2 block font-mono">
              {serpoRow ? serpoRow.avgTotal.toFixed(2) : '—'}
            </span>
            <span className="text-[10px] text-slate-500 font-mono mt-1 block">
              n = {serpoRow ? serpoRow.n : 0} sampel
            </span>
          </div>
        </div>

        {/* Branch (Loc) Ranking Table */}
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
            Peringkat Performa per Cabang (Loc)
          </h3>
          <div className="overflow-hidden rounded-xl border border-slate-700/30">
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-800/80 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2.5 text-xs font-semibold text-slate-400">#</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-slate-400">Cabang</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-slate-400">Avg TOTAL</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-slate-400">Sampel (n)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 bg-slate-900/30">
                  {locBreakdown.rows.map((row: LocationBreakdownRow, index: number) => (
                    <tr key={row.key} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-2 font-mono text-xs text-slate-500">{index + 1}</td>
                      <td className="px-4 py-2 font-semibold text-white text-sm">
                        <div className="flex items-center gap-2">
                          {row.key}
                          {row.isSmallSample && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-500 text-[9px] font-bold uppercase tracking-wider border border-amber-500/20">
                              Sampel Kecil
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-slate-300 font-mono text-sm font-semibold">
                        {row.avgTotal.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-slate-500 font-mono text-xs">
                        {row.n}
                      </td>
                    </tr>
                  ))}
                  {locBreakdown.rows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-slate-600 text-xs">
                        Tidak ada data cabang yang cocok.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
