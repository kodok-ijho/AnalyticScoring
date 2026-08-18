interface MetricDelta {
  metric: string;
  value: number;
  deltaFromMean: number;
}

interface Props {
  pros: MetricDelta[];
  cons: MetricDelta[];
}

function cleanMetricName(raw: string): string {
  // Remove prefixes like "5Scale_" or "SubTotal_" and suffixes like "_CSM" or "_CE"
  return raw
    .replace(/^(5Scale|SubTotal)_/, '')
    .replace(/_(CSM|CE|SPS)$/, '');
}

export function ProsConsCard({ pros, cons }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn">
      {/* Pros */}
      <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4">
        <h4 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Kekuatan
        </h4>
        {pros.length > 0 ? (
          <div className="space-y-2.5">
            {pros.map((p) => (
              <div key={p.metric} className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-300 font-medium">
                    {cleanMetricName(p.metric)}
                  </p>
                  <p className="text-xs text-slate-500 font-mono">{p.value.toFixed(2)}</p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold">
                  +{p.deltaFromMean.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-600">Tidak ada metrik yang menonjol</p>
        )}
      </div>

      {/* Cons */}
      <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-4">
        <h4 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          Kelemahan
        </h4>
        {cons.length > 0 ? (
          <div className="space-y-2.5">
            {cons.map((c) => (
              <div key={c.metric} className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-300 font-medium">
                    {cleanMetricName(c.metric)}
                  </p>
                  <p className="text-xs text-slate-500 font-mono">{c.value.toFixed(2)}</p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-semibold">
                  {c.deltaFromMean.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-600">Tidak ada metrik di bawah rata-rata</p>
        )}
      </div>
    </div>
  );
}
