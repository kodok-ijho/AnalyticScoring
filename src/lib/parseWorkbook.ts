import * as XLSX from 'xlsx';
import type { RawRow } from '../types';

export async function parseWorkbook(
  file: File
): Promise<{ rows: RawRow[]; sheetName: string }> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Workbook tidak memiliki sheet.');
  }

  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<RawRow>(worksheet, {
    defval: undefined,
  });

  return { rows, sheetName };
}
