import { useState } from 'react';
import { useDashboardStore } from '../../store/useDashboardStore';
import type {
  AnomalyCategory,
  ContextEffectFactor,
  ContextEffectSummary,
} from '../../types';

const ACCENTS: Record<ContextEffectFactor, { bar: string }> = {
  team: { bar: 'bg-violet-500' },
  branch: { bar: 'bg-cyan-500' },
  location: { bar: 'bg-emerald-500' },
};

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function SummaryCard({ summary }: { summary: ContextEffectSummary }) {
  const accent = ACCENTS[summary.factor];
  return (
    <div className="glass-light rounded-xl p-4 border border-slate-700/40 relative overflow-hidden">
      <div className={`absolute top-0 left-0 w-full h-1 ${accent.bar}`} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
          {summary.label}
        </span>
        <span className="text-[10px] text-slate-600 font-medium">η²</span>
      </div>
      <span className="text-2xl font-extrabold text-white mt-2 block font-mono">
        {percent(summary.etaSquared)}
      </span>
      <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">{summary.interpretation}</p>
      <p className="text-[10px] text-slate-600 mt-2 font-mono">
        {summary.groupCount} grup · n = {summary.sampleCount}
      </p>
    </div>
  );
}

export function ContextEffectPanel() {
  const contextAnalysis = useDashboardStore((s) => s.contextAnalysis);
  const anomalyAnalysis = useDashboardStore((s) => s.anomalyAnalysis);
  const setSelectedIndividual = useDashboardStore((s) => s.setSelectedIndividual);

  const [activeCategory, setActiveCategory] = useState<AnomalyCategory | 'all'>('all');

  if (!contextAnalysis) return null;

  const anomalies = anomalyAnalysis?.anomalies ?? [];
  const filteredAnomalies =
    activeCategory === 'all'
      ? anomalies
      : anomalies.filter((a) => a.category === activeCategory);

  const categoryLabels: Record<AnomalyCategory, string> = {
    mutation_drift: 'Pasca Mutasi',
    temporal_spike: 'Lonjakan 1-Bulan',
    metric_polarization: 'Polarisasi Metrik',
    cohort_outlier: 'Divergensi Cabang',
  };

  return (
    <section className="glass rounded-xl p-6 animate-fadeIn space-y-6">
      {/* 1. Eta-Squared Context Cards */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-white">Asosiasi Konteks Penempatan</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Eta-kuadrat (η²) menunjukkan proporsi variasi TOTAL yang berasosiasi dengan tim, cabang, atau tipe lokasi setelah menyesuaikan Jabatan dan Periode.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {contextAnalysis.summaries.map((summary) => (
            <SummaryCard key={summary.factor} summary={summary} />
          ))}
        </div>
        <p className="text-[11px] text-amber-400/80 mt-3">
          Catatan: metrik ini bersifat deskriptif (asosiasi), bukan bukti bahwa penempatan tersebut menyebabkan perubahan skor. Nilai konteks individu dihitung dari rata-rata rekan satu konteks tanpa memasukkan skor individu itu sendiri.
        </p>
      </div>

      {/* 2. Statistical Anomaly Section */}
      {anomalies.length > 0 && (
        <div className="pt-6 border-t border-slate-700/50 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <h3 className="text-base font-bold text-white">
                  Deteksi Anomali Statistik Operasional
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Menemukan deviasi non-linier seperti penurunan drastis pasca mutasi, lonjakan skor ekstrim (&gt;2.5σ), atau polarisasi metrik kritis.
              </p>

            </div>

            {/* Category Filter Tabs */}
            <div className="flex flex-wrap gap-1.5 bg-slate-900/80 p-1 rounded-lg border border-slate-700/50">
              <button
                onClick={() => setActiveCategory('all')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  activeCategory === 'all'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Semua ({anomalies.length})
              </button>
              {(Object.keys(categoryLabels) as AnomalyCategory[]).map((cat) => {
                const count = anomalyAnalysis?.summaryByCategory[cat] ?? 0;
                if (count === 0) return null;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                      activeCategory === cat
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {categoryLabels[cat]} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Anomaly Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredAnomalies.slice(0, 9).map((a) => (
              <div
                key={a.id}
                onClick={() => setSelectedIndividual(a.npk)}
                className="p-4 rounded-xl border border-slate-700/60 bg-slate-900/70 hover:bg-slate-800/80 hover:border-slate-600 transition-all cursor-pointer flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border ${
                        a.severity === 'critical'
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                          : a.severity === 'warning'
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                          : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                      }`}
                    >
                      {a.severity === 'critical' ? 'Kritis' : a.severity === 'warning' ? 'Perhatian' : 'Insight'}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      NPK {a.npk} · {a.loc}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-white">{a.nama}</h4>
                  <p className="text-xs text-slate-300 font-medium mt-0.5">{a.title}</p>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{a.description}</p>
                </div>

                {/* Evidence Box */}
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] space-y-1 font-mono">
                  <div className="flex justify-between text-slate-400">
                    <span>Baseline Rata-rata:</span>
                    <span className="text-white font-bold">{a.evidence.baselineValue}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Nilai Terobservasi:</span>
                    <span className="text-white font-bold">{a.evidence.observedValue}</span>
                  </div>
                  <div className="flex justify-between text-slate-400 border-t border-slate-800/80 pt-1">
                    <span>Selisih Deviasi:</span>
                    <span
                      className={`font-bold ${
                        a.evidence.delta < 0 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {a.evidence.delta > 0 ? '+' : ''}
                      {a.evidence.delta} {a.evidence.unit}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-sans mt-1">
                    {a.evidence.details}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
