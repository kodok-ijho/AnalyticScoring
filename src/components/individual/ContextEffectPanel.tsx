import { useDashboardStore } from '../../store/useDashboardStore';
import type { ContextEffectFactor, ContextEffectSummary } from '../../types';

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
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{summary.label}</span>
        <span className="text-[10px] text-slate-600 font-medium">η²</span>
      </div>
      <span className="text-2xl font-extrabold text-white mt-2 block font-mono">{percent(summary.etaSquared)}</span>
      <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">{summary.interpretation}</p>
      <p className="text-[10px] text-slate-600 mt-2 font-mono">{summary.groupCount} grup · n = {summary.sampleCount}</p>
    </div>
  );
}

export function ContextEffectPanel() {
  const contextAnalysis = useDashboardStore((s) => s.contextAnalysis);
  if (!contextAnalysis) return null;

  return (
    <section className="glass rounded-xl p-6 animate-fadeIn">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-white">Asosiasi Konteks Penempatan</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-3xl">
          Eta-kuadrat (η²) menunjukkan proporsi variasi TOTAL yang berasosiasi dengan tim, cabang, atau tipe lokasi setelah menyesuaikan Jabatan dan Periode.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {contextAnalysis.summaries.map((summary) => <SummaryCard key={summary.factor} summary={summary} />)}
      </div>
      <p className="text-[11px] text-amber-400/80 mt-4">
        Catatan: metrik ini bersifat deskriptif (asosiasi), bukan bukti bahwa penempatan tersebut menyebabkan perubahan skor. Nilai konteks individu dihitung dari rata-rata rekan satu konteks tanpa memasukkan skor individu itu sendiri.
      </p>
    </section>
  );
}
