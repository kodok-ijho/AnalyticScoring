import type { RawRow, ValidationResult } from '../types';
import { REQUIRED_COLUMNS, VALID_JABATAN } from './constants';

export function validateSchema(rows: RawRow[]): ValidationResult {
  const errors: ValidationResult['errors'] = [];
  const warnings: ValidationResult['warnings'] = [];

  if (rows.length === 0) {
    errors.push({ code: 'EMPTY_DATA', message: 'File tidak mengandung data (0 baris).' });
    return { errors, warnings };
  }

  // Check required columns
  const sampleRow = rows[0];
  const existingColumns = Object.keys(sampleRow);

  for (const col of REQUIRED_COLUMNS) {
    if (!existingColumns.includes(col)) {
      errors.push({
        code: 'MISSING_COLUMN',
        message: `Kolom wajib "${col}" tidak ditemukan. Kolom yang tersedia: ${existingColumns.slice(0, 10).join(', ')}${existingColumns.length > 10 ? '...' : ''}`,
      });
    }
  }

  // If fatal errors exist, stop here
  if (errors.length > 0) {
    return { errors, warnings };
  }

  // Check for unknown Jabatan
  const unknownJabatan = new Set<string>();
  for (const row of rows) {
    const jab = String(row['Jabatan'] ?? '').trim();
    if (jab && !(VALID_JABATAN as readonly string[]).includes(jab)) {
      unknownJabatan.add(jab);
    }
  }
  if (unknownJabatan.size > 0) {
    warnings.push({
      code: 'UNKNOWN_JABATAN',
      message: `Ditemukan nilai Jabatan tidak dikenal: ${[...unknownJabatan].join(', ')}. Baris ini tetap diproses sebagai "UNKNOWN".`,
      count: unknownJabatan.size,
    });
  }

  const unscoredTotalCount = rows.filter((row) => {
    const raw = row['TOTAL'];
    if (raw === null || raw === undefined || String(raw).trim() === '') return true;
    const total = typeof raw === 'number' ? raw : Number(raw);
    return !Number.isFinite(total) || total <= 0;
  }).length;
  if (unscoredTotalCount > 0) {
    warnings.push({
      code: 'UNSCORED_TOTAL',
      message: `${unscoredTotalCount} baris tidak memiliki nilai TOTAL. Baris tersebut tidak dimasukkan ke perhitungan rata-rata dan analisis performa.`,
      count: unscoredTotalCount,
    });
  }

  // Check for duplicate rows (NPK + Periode)
  const seen = new Map<string, number>();
  let dupCount = 0;
  for (const row of rows) {
    const key = `${row['NPK']}_${row['Periode']}`;
    const prev = seen.get(key) ?? 0;
    seen.set(key, prev + 1);
    if (prev === 1) dupCount++;
  }
  if (dupCount > 0) {
    warnings.push({
      code: 'DUPLICATE_ROW',
      message: `Ditemukan ${dupCount} kombinasi NPK+Periode yang duplikat.`,
      count: dupCount,
    });
  }

  // Check CSM count per MPG per Periode
  const mpgPeriodCsm = new Map<string, number>();
  for (const row of rows) {
    const jab = String(row['Jabatan'] ?? '').trim();
    if (jab === 'CSM') {
      const key = `${row['MPG']}_${row['Periode']}`;
      mpgPeriodCsm.set(key, (mpgPeriodCsm.get(key) ?? 0) + 1);
    }
  }

  // Also track all MPG-Periode combos
  const allMpgPeriod = new Set<string>();
  for (const row of rows) {
    allMpgPeriod.add(`${row['MPG']}_${row['Periode']}`);
  }

  const anomalies: string[] = [];
  for (const key of allMpgPeriod) {
    const csmCount = mpgPeriodCsm.get(key) ?? 0;
    if (csmCount !== 1) {
      const [mpg, periode] = key.split('_');
      anomalies.push(`${mpg} (Periode ${periode}): ${csmCount} CSM`);
    }
  }
  if (anomalies.length > 0) {
    warnings.push({
      code: 'CSM_COUNT_ANOMALY',
      message: `MPG dengan jumlah CSM ≠ 1: ${anomalies.slice(0, 5).join('; ')}${anomalies.length > 5 ? ` dan ${anomalies.length - 5} lainnya` : ''}.`,
      count: anomalies.length,
    });
  }

  return { errors, warnings };
}
