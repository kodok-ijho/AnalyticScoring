import type { FiscalYearOption, NormalizedRow } from '../types';

export function getFiscalYearStart(date: Date): number {
  return date.getMonth() >= 9 ? date.getFullYear() : date.getFullYear() - 1;
}

export function getLatestPeriod(rows: NormalizedRow[]): NormalizedRow | null {
  if (rows.length === 0) return null;
  return rows.reduce((latest, row) =>
    row.periodeDate.getTime() > latest.periodeDate.getTime() ? row : latest
  );
}

export function buildFiscalYearOptions(rows: NormalizedRow[]): FiscalYearOption[] {
  const periodsByYear = new Map<number, Map<string, Date>>();

  for (const row of rows) {
    const startYear = getFiscalYearStart(row.periodeDate);
    const periods = periodsByYear.get(startYear) ?? new Map<string, Date>();
    periods.set(row.periodeLabel, row.periodeDate);
    periodsByYear.set(startYear, periods);
  }

  return [...periodsByYear.entries()]
    .map(([startYear, periodMap]) => {
      const periods = [...periodMap.entries()].sort((a, b) => a[1].getTime() - b[1].getTime());
      const monthKeys = new Set(periods.map(([, date]) => `${date.getFullYear()}-${date.getMonth()}`));
      return {
        startYear,
        endYear: startYear + 1,
        label: `Okt ${startYear} – Sep ${startYear + 1}`,
        firstPeriod: periods[0]?.[0] ?? '',
        lastPeriod: periods.at(-1)?.[0] ?? '',
        periodCount: monthKeys.size,
        isComplete: monthKeys.size === 12,
      };
    })
    .sort((a, b) => b.startYear - a.startYear);
}

export function getFiscalYearRange(
  rows: NormalizedRow[],
  startYear: number | null,
): [string, string] | null {
  const options = buildFiscalYearOptions(rows);
  const option = options.find((item) => item.startYear === startYear) ?? options[0];
  return option?.firstPeriod && option.lastPeriod
    ? [option.firstPeriod, option.lastPeriod]
    : null;
}

export function getScopeStatusLabel(
  option: FiscalYearOption | undefined,
  monthlyPeriod: string | null,
): string {
  if (monthlyPeriod) return `Bulanan · ${monthlyPeriod}`;
  if (!option) return 'Full Year';
  return option.isComplete
    ? `Full Year · ${option.label}`
    : `YTD · ${option.firstPeriod} – ${option.lastPeriod}`;
}
