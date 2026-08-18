import type { ValidationResult } from '../../types';

interface Props {
  validation: ValidationResult;
}

export function ValidationSummary({ validation }: Props) {
  return (
    <div className="space-y-3 animate-fadeIn">
      {validation.errors.map((err, i) => (
        <div
          key={`err-${i}`}
          className="p-4 rounded-xl bg-red-500/10 border border-red-500/30"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <span className="text-xs font-mono text-red-500/70 uppercase tracking-wider">
                {err.code}
              </span>
              <p className="text-red-300 text-sm mt-0.5">{err.message}</p>
            </div>
          </div>
        </div>
      ))}

      {validation.warnings.map((warn, i) => (
        <div
          key={`warn-${i}`}
          className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <span className="text-xs font-mono text-amber-500/70 uppercase tracking-wider">
                {warn.code}
                {warn.count !== undefined && (
                  <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                    {warn.count}
                  </span>
                )}
              </span>
              <p className="text-amber-300 text-sm mt-0.5">{warn.message}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
