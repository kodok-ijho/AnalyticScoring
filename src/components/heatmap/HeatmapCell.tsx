import { useState } from 'react';

interface Props {
  value: number;
  min: number;
  max: number;
  metricName: string;
  mpg: string;
}

function getHeatmapColor(value: number, min: number, max: number): string {
  if (max === min) return 'rgb(234,179,8)';
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  let r: number, g: number, b: number;
  if (t < 0.5) {
    r = 239;
    g = Math.round(68 + 171 * (t * 2));
    b = 68;
  } else {
    r = Math.round(239 - 205 * ((t - 0.5) * 2));
    g = 197;
    b = Math.round(68 + 30 * ((t - 0.5) * 2));
  }
  return `rgb(${r},${g},${b})`;
}

export function HeatmapCell({ value, min, max, metricName, mpg }: Props) {
  const [showTooltip, setShowTooltip] = useState(false);
  const color = getHeatmapColor(value, min, max);

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        className="w-16 h-10 rounded-md flex items-center justify-center text-xs font-semibold cursor-pointer
          transition-transform hover:scale-110 hover:z-10 border border-white/10"
        style={{ backgroundColor: color }}
      >
        <span className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
          {value.toFixed(2)}
        </span>
      </div>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
          <div className="glass rounded-lg px-3 py-2 text-xs whitespace-nowrap shadow-xl">
            <p className="font-semibold text-white">{mpg}</p>
            <p className="text-slate-400">{metricName}</p>
            <p className="text-violet-400 font-mono mt-0.5">{value.toFixed(3)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export { getHeatmapColor };
