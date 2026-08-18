import { describe, expect, it } from 'vitest';
import { normalizeRows } from '../lib/normalizeRows';

const base = {
  MPG: 'A1',
  WCTR: 'W1',
  Nama: 'Andi',
  NPK: 123,
  Lokasi: 'HO',
  Loc: 'MDN',
  Jabatan: 'CE',
  TOTAL: 4,
  '5Scale_MoP_CE': 4,
};

describe('normalizeRows period formats', () => {
  it('accepts SQL date strings', () => {
    const [row] = normalizeRows([{ ...base, Periode: '2025-10-01T00:00:00' }]);
    expect(row.periodeLabel).toBe('Okt 2025');
  });

  it('continues accepting Excel serial dates', () => {
    const [row] = normalizeRows([{ ...base, Periode: 45931 }]);
    expect(row.periodeLabel).toBe('Okt 2025');
  });

  it('keeps blank and zero TOTAL values out of scoring averages', () => {
    const [blank, zero] = normalizeRows([
      { ...base, Periode: 45931, TOTAL: '' },
      { ...base, Periode: 45931, NPK: 456, TOTAL: 0 },
    ]);
    expect(Number.isNaN(blank.total)).toBe(true);
    expect(Number.isNaN(zero.total)).toBe(true);
  });

  it('reads the period-end manpower snapshot returned by the SQL query', () => {
    const [row] = normalizeRows([{
      ...base,
      Periode: '2025-10-01',
      MPG_SaatIni: 'U1',
      WcTr_SaatIni: 'UAC',
      Posisi_SaatIni: 'sps',
    }]);

    expect(row).toMatchObject({
      currentMpg: 'U1',
      currentWctr: 'UAC',
      currentJabatan: 'SPS',
    });
  });
});
