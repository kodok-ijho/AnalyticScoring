import type { AnalysisScope, NormalizedRow } from '../types';

/**
 * Full-year/YTD team analysis follows the selected period-end manpower snapshot.
 * Monthly analysis keeps the historical assignment recorded in that month.
 */
export function rowsForTeamAnalysis(
  rows: NormalizedRow[],
  scope: AnalysisScope,
): NormalizedRow[] {
  if (scope === 'monthly') return rows;

  // Older Excel templates do not contain the period-end snapshot columns.
  // Keep their historical behavior instead of returning an empty dashboard.
  const hasCurrentAssignmentSnapshot = rows.some(
    (row) => row.currentMpg || row.currentJabatan,
  );
  if (!hasCurrentAssignmentSnapshot) return rows;

  return rows.flatMap((row) => {
    if (!row.currentMpg || !row.currentJabatan || row.currentJabatan === 'UNKNOWN') return [];
    return [{
      ...row,
      mpg: row.currentMpg,
      wctr: row.currentWctr ?? row.wctr,
      jabatan: row.currentJabatan,
    }];
  });
}
