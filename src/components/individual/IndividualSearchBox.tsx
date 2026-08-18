import { useState, useEffect, useRef } from 'react';
import { useDashboardStore } from '../../store/useDashboardStore';

export function IndividualSearchBox() {
  const filteredIndividualProfiles = useDashboardStore((s) => s.filteredIndividualProfiles);
  const setSelectedIndividual = useDashboardStore((s) => s.setSelectedIndividual);

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close list on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const results = query.trim()
    ? filteredIndividualProfiles
        .filter(
          (p) =>
            p.nama.toLowerCase().includes(query.toLowerCase()) ||
            p.npk.toString().includes(query)
        )
        .slice(0, 8)
    : [];

  return (
    <div className="relative w-full max-w-md" ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          placeholder="Cari NPK atau Nama Teknisi/Supervisor..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full bg-slate-800/80 border border-slate-600/50 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-all"
        />
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 w-full mt-2 bg-slate-900 border border-slate-700/50 rounded-xl shadow-2xl z-50 p-2 overflow-hidden animate-fadeIn">
          <div className="max-h-60 overflow-y-auto space-y-0.5">
            {results.map((p) => (
              <button
                key={p.npk}
                onClick={() => {
                  setSelectedIndividual(p.npk);
                  setQuery('');
                  setIsOpen(false);
                }}
                className="w-full text-left flex items-center justify-between px-3.5 py-2.5 rounded-lg hover:bg-slate-800/80 transition-colors text-sm"
              >
                <div>
                  <p className="font-semibold text-white">{p.nama}</p>
                  <p className="text-xs text-slate-500 font-mono">NPK {p.npk}</p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-violet-500/10 text-violet-400 uppercase tracking-wider">
                    {p.jabatanUtama}
                  </span>
                  <p className="text-xs font-semibold text-slate-300 font-mono mt-0.5">
                    {p.avgTotalOverall.toFixed(2)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {isOpen && query.trim() && results.length === 0 && (
        <div className="absolute top-full left-0 w-full mt-2 bg-slate-900 border border-slate-700/50 rounded-xl shadow-2xl z-50 p-4 text-center text-slate-500 text-xs animate-fadeIn">
          Tidak ada personil ditemukan
        </div>
      )}
    </div>
  );
}
