import { useState, useMemo } from 'react';
import { useDashboardStore } from '../../store/useDashboardStore';
import { TREND_COLORS } from '../../lib/constants';
import type { IndividualProfile, Jabatan, IndividualSortField, SortDirection } from '../../types';

function TrendIcon({ direction }: { direction: 'up' | 'down' | 'flat' }) {
  const color = TREND_COLORS[direction];
  if (direction === 'up') {
    return (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5}>
        <path d="M7 17l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (direction === 'down') {
    return (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5}>
        <path d="M7 7l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5}>
      <path d="M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

export function IndividualRankingTable() {
  const filteredIndividualProfiles = useDashboardStore((s) => s.filteredIndividualProfiles);
  const contextAnalysis = useDashboardStore((s) => s.contextAnalysis);
  const selectedClusterId = useDashboardStore((s) => s.selectedClusterId);
  const selectedClusterMemberNpks = useDashboardStore((s) => s.selectedClusterMemberNpks);
  const selectedClusterLabel = useDashboardStore((s) => s.selectedClusterLabel);
  const setSelectedCluster = useDashboardStore((s) => s.setSelectedCluster);
  const setSelectedIndividual = useDashboardStore((s) => s.setSelectedIndividual);

  const [activeRole, setActiveRole] = useState<Exclude<Jabatan, 'UNKNOWN'> | 'ALL'>('ALL');
  const [sortField, setSortField] = useState<IndividualSortField>('rankInPeerGroup');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  // Filter profiles by current active role and selected cluster member NPKs
  const roleFilteredProfiles = useMemo(() => {
    let list = filteredIndividualProfiles;
    if (activeRole !== 'ALL') {
      list = list.filter((p) => p.jabatanUtama === activeRole);
    }
    if (selectedClusterMemberNpks && selectedClusterMemberNpks.length > 0) {
      const npkSet = new Set(selectedClusterMemberNpks);
      list = list.filter((p) => npkSet.has(p.npk));
    }
    return list;
  }, [filteredIndividualProfiles, activeRole, selectedClusterMemberNpks]);

  // Sort profiles
  const sortedProfiles = useMemo(() => {
    const sorted = [...roleFilteredProfiles];
    sorted.sort((a, b) => {
      let valA: string | number = 0;
      let valB: string | number = 0;

      switch (sortField) {
        case 'rankInPeerGroup': valA = a.rankInPeerGroup; valB = b.rankInPeerGroup; break;
        case 'npk': valA = a.npk; valB = b.npk; break;
        case 'nama': valA = a.nama; valB = b.nama; break;
        case 'wctr':
          valA = a.currentWctr || a.history[a.history.length - 1]?.wctr || '';
          valB = b.currentWctr || b.history[b.history.length - 1]?.wctr || '';
          break;
        case 'jabatanUtama': valA = a.jabatanUtama; valB = b.jabatanUtama; break;
        case 'avgTotalOverall': valA = a.avgTotalOverall; valB = b.avgTotalOverall; break;
        case 'deltaPct': valA = a.trend.deltaPct; valB = b.trend.deltaPct; break;
        case 'volatility': valA = a.volatility; valB = b.volatility; break;
        case 'vsTeamAvg': valA = a.vsTeamAvg; valB = b.vsTeamAvg; break;
        case 'vsPeerAvg': valA = a.vsPeerAvg; valB = b.vsPeerAvg; break;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDir === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });
    return sorted;
  }, [roleFilteredProfiles, sortField, sortDir]);

  const handleSort = (field: IndividualSortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'rankInPeerGroup' || field === 'npk' ? 'asc' : 'desc');
    }
  };

  const SortHeader = ({ field, label }: { field: IndividualSortField; label: string }) => (
    <th
      onClick={() => handleSort(field)}
      className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-violet-400 transition-colors select-none"
    >
      <div className="flex items-center gap-1">
        {label}
        {sortField === field && (
          <svg className={`w-3.5 h-3.5 ${sortDir === 'desc' ? 'rotate-180' : ''} transition-transform`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        )}
      </div>
    </th>
  );

  return (
    <div className="glass rounded-xl overflow-hidden animate-fadeIn">
      {/* Title & Role Toggles */}
      <div className="px-6 py-4 border-b border-slate-700/50 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Ranking Personil</h2>
          {selectedClusterLabel ? (
            <p className="text-xs text-cyan-400 mt-0.5">
              Menampilkan {roleFilteredProfiles.length} personil pada segmen: <strong>{selectedClusterLabel}</strong>
            </p>
          ) : (
            <p className="text-xs text-slate-400 mt-0.5">
              Daftar ranking komparatif performa individu
            </p>
          )}
        </div>
        
        {/* Role filters */}
        <div className="flex bg-slate-800/80 p-1 rounded-lg border border-slate-700/50">
          {([
            { id: 'ALL', label: 'Semua' },
            { id: 'CE', label: 'CE' },
            { id: 'SPS', label: 'SPS' },
            { id: 'CSM', label: 'CSM' },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveRole(tab.id);
                setSortField('rankInPeerGroup');
                setSortDir('asc');
              }}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeRole === tab.id
                  ? 'bg-violet-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active Cluster Banner with Reset Button */}
      {selectedClusterLabel && (
        <div className="px-6 py-2.5 bg-cyan-500/10 border-b border-cyan-500/20 flex flex-wrap items-center justify-between gap-2 text-xs text-cyan-300">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>Filter Segmen Aktif:</span>
            <strong className="text-white px-2 py-0.5 rounded bg-slate-900 border border-cyan-500/40">
              {selectedClusterLabel}
            </strong>
            <span className="text-slate-400">
              ({roleFilteredProfiles.length} personil)
            </span>
          </div>
          <button
            onClick={() => setSelectedCluster(null)}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-all font-medium"
          >
            ✕ Hapus Filter Segmen
          </button>
        </div>
      )}


      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-800/50">
            <tr>
              <SortHeader field="rankInPeerGroup" label="#" />
              <SortHeader field="npk" label="NPK" />
              <SortHeader field="nama" label="Nama" />
              <SortHeader field="wctr" label="WCTR" />
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Segmen
              </th>
              <SortHeader field="avgTotalOverall" label="Avg TOTAL" />
              <SortHeader field="deltaPct" label="Tren" />
              <SortHeader field="volatility" label="Volatilitas" />
              <SortHeader field="vsTeamAvg" label="vs Tim" />
              <SortHeader field="vsPeerAvg" label="vs Peer" />
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider" title="Rata-rata residual rekan satu MPG, tanpa skor individu ini">
                Konteks Tim
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider" title="Rata-rata residual rekan satu cabang, tanpa skor individu ini">
                Konteks Cabang
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider" title="Rata-rata residual rekan satu tipe lokasi, tanpa skor individu ini">
                Konteks HO/SERPO
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {sortedProfiles.map((p) => (
              <tr
                key={p.npk}
                onClick={() => setSelectedIndividual(p.npk)}
                className="cursor-pointer hover:bg-slate-800/40 transition-colors duration-200"
              >
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold ${
                    p.rankInPeerGroup <= 3
                      ? 'bg-gradient-to-br from-violet-500 to-cyan-500 text-white'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {p.rankInPeerGroup}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400 font-mono text-sm">{p.npk}</td>
                <td className="px-4 py-3 font-semibold text-white">
                  <div className="flex items-center gap-2">
                    {p.nama}
                    {p.hasMutasi && (
                      <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 text-[10px] font-bold uppercase tracking-wider border border-cyan-500/20">
                        Mutasi
                      </span>
                    )}
                    {p.anomalyCount && p.anomalyCount > 0 ? (
                      <span
                        className="px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20 flex items-center gap-1"
                        title={`${p.anomalyCount} anomali statistik terdeteksi`}
                      >
                        <span>⚠️</span>
                        <span>{p.anomalyCount}</span>
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800/90 border border-slate-700 text-cyan-300">
                    {p.currentWctr || p.history[p.history.length - 1]?.wctr || '-'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-medium">
                    {selectedClusterMemberNpks?.includes(p.npk) && selectedClusterLabel
                      ? selectedClusterLabel
                      : (p.clusterLabel ?? '-')}
                  </span>
                </td>

                <td className="px-4 py-3 text-slate-300 font-mono text-sm font-semibold">
                  {p.avgTotalOverall.toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <TrendIcon direction={p.trend.direction} />
                    <span
                      className="text-sm font-medium font-mono"
                      style={{ color: TREND_COLORS[p.trend.direction] }}
                    >
                      {p.trend.deltaPct > 0 ? '+' : ''}
                      {p.trend.deltaPct.toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-400 font-mono text-sm">
                  {p.volatility.toFixed(3)}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-sm font-mono font-medium ${
                    p.vsTeamAvg >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {p.vsTeamAvg >= 0 ? '+' : ''}
                    {p.vsTeamAvg.toFixed(2)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-sm font-mono font-medium ${
                    p.vsPeerAvg >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {p.vsPeerAvg >= 0 ? '+' : ''}
                    {p.vsPeerAvg.toFixed(2)}
                  </span>
                </td>
                {(['team', 'branch', 'location'] as const).map((factor) => {
                  const value = contextAnalysis?.individualEffects[String(p.npk)]?.[factor];
                  const effect = value?.effect ?? null;
                  return (
                    <td key={factor} className="px-4 py-3" title={value && value.peerCount > 0 ? `${value.peerCount} peer-row` : undefined}>
                      <span className={`text-sm font-mono font-medium ${
                        effect === null ? 'text-slate-600' : effect >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {effect === null ? '—' : `${effect >= 0 ? '+' : ''}${effect.toFixed(2)}`}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
            {sortedProfiles.length === 0 && (
              <tr>
                <td colSpan={13} className="text-center py-12 text-slate-500 text-sm">
                  Tidak ada data untuk grup jabatan/segmen ini.
                </td>
              </tr>
            )}
          </tbody>

        </table>
      </div>
    </div>
  );
}

