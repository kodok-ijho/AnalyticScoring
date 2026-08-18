import type { RawRow, NormalizedRow, Jabatan, LokasiType } from '../types';
import { VALID_JABATAN, MONTH_NAMES_ID } from './constants';

/**
 * Convert Excel serial date number to JavaScript Date.
 * Excel epoch: 1900-01-01 = serial 1 (with the Lotus 1-2-3 bug for Feb 29, 1900).
 * The standard formula: Date.UTC(1899, 11, 30) + serial * 86400000
 */
function excelSerialToDate(serial: number): Date {
  return new Date(Math.round((serial - 25569) * 86400 * 1000));
}

function parsePeriodeDate(value: unknown): Date {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return excelSerialToDate(value);
  }

  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  const text = String(value ?? '').trim();
  if (!text) {
    throw new Error('Kolom Periode memiliki nilai kosong.');
  }

  const numeric = Number(text);
  if (Number.isFinite(numeric) && /^\d+(\.\d+)?$/.test(text)) {
    return excelSerialToDate(numeric);
  }

  const datePart = text.match(/^(\d{4}-\d{2}-\d{2})/);
  const parsed = datePart
    ? new Date(`${datePart[1]}T00:00:00Z`)
    : new Date(text);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error(`Nilai Periode tidak valid: ${text}`);
  }
  return parsed;
}

function dateToExcelSerial(date: Date): number {
  return Math.round((date.getTime() / 86400000) + 25569);
}

function formatPeriodeLabel(date: Date): string {
  const month = MONTH_NAMES_ID[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `${month} ${year}`;
}

function parseJabatan(value: unknown): Jabatan {
  const s = String(value ?? '').trim().toUpperCase();
  if ((VALID_JABATAN as readonly string[]).includes(s)) {
    return s as Jabatan;
  }
  return 'UNKNOWN';
}

function parseCurrentJabatan(value: unknown): Jabatan | null {
  const text = String(value ?? '').trim();
  return text ? parseJabatan(text) : null;
}

function optionalText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function parseLokasi(value: unknown): LokasiType {
  const s = String(value ?? '').trim().toUpperCase();
  if (s === 'HO') return 'HO';
  if (s === 'SERPO' || s.includes('SERPO')) return 'SERPO';
  if (s === '') return 'UNKNOWN';
  return 'UNKNOWN';
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

function toScore(value: unknown): number {
  if (value === null || value === undefined || String(value).trim() === '') return Number.NaN;
  const score = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(score) && score > 0 ? score : Number.NaN;
}

export function normalizeRows(rows: RawRow[]): NormalizedRow[] {
  const metricColumnPatterns = /^(5Scale|SubTotal)_/;

  const normalized: NormalizedRow[] = rows.map((row) => {
    const periodeDate = parsePeriodeDate(row['Periode']);
    const periodeSerial = dateToExcelSerial(periodeDate);
    const periodeLabel = formatPeriodeLabel(periodeDate);

    // Collect metric columns
    const metrics: Record<string, number | null> = {};
    for (const key of Object.keys(row)) {
      if (metricColumnPatterns.test(key)) {
        const val = row[key];
        if (val !== undefined && val !== null && val !== '') {
          const num = Number(val);
          metrics[key] = isNaN(num) ? null : num;
        }
      }
    }

    return {
      periodeSerial,
      periodeDate,
      periodeLabel,
      mpg: String(row['MPG'] ?? '').trim(),
      wctr: String(row['WCTR'] ?? '').trim(),
      nama: String(row['Nama'] ?? '').trim(),
      npk: toNumber(row['NPK']),
      lokasi: parseLokasi(row['Lokasi']),
      loc: String(row['Loc'] ?? '').trim(),
      jabatan: parseJabatan(row['Jabatan']),
      currentMpg: optionalText(row['MPG_SaatIni']),
      currentWctr: optionalText(row['WcTr_SaatIni']),
      currentJabatan: parseCurrentJabatan(row['Posisi_SaatIni']),
      total: toScore(row['TOTAL']),
      metrics,
    };
  });

  // Sort chronologically by periodeDate
  normalized.sort((a, b) => a.periodeDate.getTime() - b.periodeDate.getTime());

  return normalized;
}

/**
 * Extract unique sorted period labels from normalized rows (chronological order).
 */
export function getUniquePeriods(rows: NormalizedRow[]): string[] {
  const periodMap = new Map<string, number>();
  for (const row of rows) {
    if (!periodMap.has(row.periodeLabel)) {
      periodMap.set(row.periodeLabel, row.periodeDate.getTime());
    }
  }
  return [...periodMap.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([label]) => label);
}
