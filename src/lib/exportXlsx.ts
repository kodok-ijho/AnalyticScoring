import * as XLSX from 'xlsx';
import type { TeamProfile } from '../types';

export function exportRankingToXlsx(
  profiles: TeamProfile[],
  filename: string = 'team_ranking.xlsx'
): void {
  const data = profiles.map((p) => ({
    Rank: p.rank,
    MPG: p.mpg,
    'Rata-rata CSM': p.avgTotalCsmOverall !== undefined ? Number(p.avgTotalCsmOverall.toFixed(3)) : 0,
    'Rata-rata Anggota (CE & SPS)': p.avgTotalAnggotaOverall !== undefined ? Number(p.avgTotalAnggotaOverall.toFixed(3)) : 0,
    'Rata-rata TOTAL': Number(p.avgTotalOverall.toFixed(3)),
    'Tren (%)': Number(p.trend.deltaPct.toFixed(2)),
    'Arah Tren':
      p.trend.direction === 'up'
        ? '↑ Naik'
        : p.trend.direction === 'down'
          ? '↓ Turun'
          : '→ Stabil',
    Volatilitas: Number(p.volatility.toFixed(3)),
    'Jumlah Anggota':
      p.periodStats.length > 0
        ? p.periodStats[p.periodStats.length - 1].memberCount
        : 0,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Team Ranking');
  XLSX.writeFile(wb, filename);
}
