import { useMemo, useState } from 'react';
import { useDashboardStore } from '../../store/useDashboardStore';
import { clusterPersonnel } from '../../lib/clustering';

type RoleScope = 'teknisi' | 'csm' | 'all' | 'ce' | 'sps';

const ROLE_OPTIONS: { id: RoleScope; label: string; description: string }[] = [
  { id: 'teknisi', label: 'Teknisi (CE & SPS)', description: 'Analisis kluster khusus personil teknis lapangan' },
  { id: 'csm', label: 'CSM (Service Manager)', description: 'Analisis kluster khusus manajer layanan & pimpinan MPG' },
  { id: 'all', label: 'Semua Peran', description: 'Analisis kluster gabungan seluruh personil' },
  { id: 'ce', label: 'Khusus CE', description: 'Customer Engineer' },
  { id: 'sps', label: 'Khusus SPS', description: 'System Product Specialist' },
];

export function ClusterSegmentPanel() {
  const filteredIndividualProfiles = useDashboardStore((s) => s.filteredIndividualProfiles);
  const selectedClusterId = useDashboardStore((s) => s.selectedClusterId);
  const setSelectedClusterId = useDashboardStore((s) => s.setSelectedClusterId);

  const [activeRoleScope, setActiveRoleScope] = useState<RoleScope>('teknisi');

  // Filter profiles based on selected role scope
  const scopedProfiles = useMemo(() => {
    switch (activeRoleScope) {
      case 'teknisi':
        return filteredIndividualProfiles.filter(
          (p) => p.jabatanUtama === 'CE' || p.jabatanUtama === 'SPS'
        );
      case 'csm':
        return filteredIndividualProfiles.filter((p) => p.jabatanUtama === 'CSM');
      case 'ce':
        return filteredIndividualProfiles.filter((p) => p.jabatanUtama === 'CE');
      case 'sps':
        return filteredIndividualProfiles.filter((p) => p.jabatanUtama === 'SPS');
      case 'all':
      default:
        return filteredIndividualProfiles;
    }
  }, [filteredIndividualProfiles, activeRoleScope]);

  // Re-run deterministic K-Means specifically for this role group
  const { clusters } = useMemo(() => {
    return clusterPersonnel(scopedProfiles);
  }, [scopedProfiles]);

  if (filteredIndividualProfiles.length === 0) return null;

  return (
    <div className="glass rounded-xl p-5 border border-slate-700/50 space-y-4 animate-fadeIn">
      {/* Header with Title and Role Group Filter */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Segmentasi Pola Kerja (K-Means Clustering)
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Pengelompokan otomatis berdasarkan kemiripan pola performa 9 bulan, stabilitas, dan metrik keahlian.
          </p>
        </div>

        {/* Role Group Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/80 p-1.5 rounded-xl border border-slate-700/60 self-start lg:self-auto">
          {ROLE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => {
                setActiveRoleScope(opt.id);
                setSelectedClusterId(null); // reset cluster selection on scope change
              }}
              title={opt.description}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeRoleScope === opt.id
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scope summary indicator */}
      <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800/80 pb-2">
        <span>
          Menampilkan segmentasi untuk: <strong className="text-cyan-300 font-mono">{scopedProfiles.length} orang</strong> (
          {ROLE_OPTIONS.find((r) => r.id === activeRoleScope)?.label})
        </span>

        {selectedClusterId && (
          <button
            onClick={() => setSelectedClusterId(null)}
            className="text-xs px-2.5 py-0.5 rounded-md border border-slate-600 bg-slate-800 text-slate-300 hover:text-white transition-all flex items-center gap-1"
          >
            <span>✕ Reset Filter Kluster</span>
          </button>
        )}
      </div>

      {/* Cluster Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {clusters.map((c) => {
          const isSelected = selectedClusterId === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setSelectedClusterId(isSelected ? null : c.id)}
              className={`text-left p-4 rounded-xl border transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer ${
                isSelected
                  ? 'bg-slate-800/95 border-cyan-400 shadow-xl shadow-cyan-500/10 ring-2 ring-cyan-400/60'
                  : 'bg-slate-900/60 border-slate-700/40 hover:border-slate-600 hover:bg-slate-800/60'
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

              <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                <div className="text-slate-400">
                  <span className="text-[10px] text-slate-500 block font-sans">Rata-rata</span>
                  <span className="font-bold text-white text-sm">{c.archetype.avgScore.toFixed(2)}</span>
                </div>
                <div className="text-slate-400">
                  <span className="text-[10px] text-slate-500 block font-sans">Volatilitas</span>
                  <span className="font-bold text-slate-300 text-sm">{c.archetype.avgVolatility.toFixed(3)}</span>
                </div>
                <div className="text-slate-400">
                  <span className="text-[10px] text-slate-500 block font-sans">Tren</span>
                  <span
                    className={`font-bold text-sm ${
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
        {clusters.length === 0 && (
          <div className="col-span-4 text-center py-6 text-slate-500 text-xs">
            Tidak ada personil pada kategori peran ini.
          </div>
        )}
      </div>
    </div>
  );
}
