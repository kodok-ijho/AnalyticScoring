import { describe, it, expect } from 'vitest';
import {
  buildAttributeHistory,
  computeMutations,
  classifyStatus,
  buildIndividualProfiles,
  computePeerBaselines,
} from '../lib/aggregateIndividuals';
import type { NormalizedRow } from '../types';

describe('aggregateIndividuals', () => {
  const mockRows: NormalizedRow[] = [
    {
      periodeSerial: 45931,
      periodeDate: new Date(2025, 9, 1), // Oct
      periodeLabel: 'Okt 2025',
      mpg: 'A1',
      wctr: 'W1',
      nama: 'Andi',
      npk: 1234,
      lokasi: 'HO',
      loc: 'MDN',
      jabatan: 'CE',
      total: 3.5,
      metrics: { '5Scale_MoP_CE': 3.2 },
    },
    {
      periodeSerial: 45962,
      periodeDate: new Date(2025, 10, 1), // Nov
      periodeLabel: 'Nov 2025',
      mpg: 'A1',
      wctr: 'W1',
      nama: 'Andi',
      npk: 1234,
      lokasi: 'HO',
      loc: 'MDN',
      jabatan: 'CE',
      total: 3.8,
      metrics: { '5Scale_MoP_CE': 3.6 },
    },
    {
      periodeSerial: 45992,
      periodeDate: new Date(2025, 11, 1), // Dec
      periodeLabel: 'Des 2025',
      mpg: 'B1', // Mutation: MPG changed
      wctr: 'W1',
      nama: 'Andi',
      npk: 1234,
      lokasi: 'SERPO', // Mutation: Lokasi & Loc changed
      loc: 'PKU',
      jabatan: 'CSM', // Mutation: Jabatan changed
      total: 4.2,
      metrics: { '5Scale_MoP_CSM': 4.0 },
    },
  ];

  it('should build attribute history chronologically', () => {
    const history = buildAttributeHistory(1234, mockRows);
    expect(history).toHaveLength(3);
    expect(history[0].periodeLabel).toBe('Okt 2025');
    expect(history[2].periodeLabel).toBe('Des 2025');
  });

  it('should detect mutations correctly', () => {
    const history = buildAttributeHistory(1234, mockRows);
    const mutations = computeMutations(history);

    expect(mutations).toHaveLength(3); // mpg, jabatan, loc all changed from Nov to Dec
    expect(mutations).toContainEqual({
      fromPeriode: 'Nov 2025',
      toPeriode: 'Des 2025',
      field: 'mpg',
      from: 'A1',
      to: 'B1',
    });
    expect(mutations).toContainEqual({
      fromPeriode: 'Nov 2025',
      toPeriode: 'Des 2025',
      field: 'jabatan',
      from: 'CE',
      to: 'CSM',
    });
  });

  it('should classify status correctly', () => {
    expect(classifyStatus({ trend: { direction: 'down', deltaPct: -3 }, vsPeerAvg: -0.2 })).toBe('watchlist');
    expect(classifyStatus({ trend: { direction: 'up', deltaPct: 4 }, vsPeerAvg: 0.1 })).toBe('top_performer');
    expect(classifyStatus({ trend: { direction: 'flat', deltaPct: 0 }, vsPeerAvg: -0.1 })).toBe('normal');
  });

  it('should compute peer baselines and build profiles', () => {
    const baselines = computePeerBaselines(mockRows);
    expect(baselines.length).toBeGreaterThan(0);

    const profiles = buildIndividualProfiles(mockRows, baselines);
    expect(profiles).toHaveLength(1);
    expect(profiles[0].npk).toBe(1234);
    expect(profiles[0].hasMutasi).toBe(true);
    expect(profiles[0].rankInPeerGroup).toBe(1);
  });

  it('should omit individuals who have no available score', () => {
    const rows = [
      ...mockRows,
      { ...mockRows[0], npk: 9999, nama: 'Belum Dinilai', total: Number.NaN },
    ];
    const profiles = buildIndividualProfiles(rows, computePeerBaselines(rows));
    expect(profiles.some((profile) => profile.npk === 9999)).toBe(false);
  });

  it('should exclude personnel who are not present in the latest period', () => {
    const rowsWithResigned: NormalizedRow[] = [
      ...mockRows, // NPK 1234 exists in Okt, Nov, Des (latest)
      // NPK 5555 only exists in Okt & Nov (resigned before Des)
      {
        periodeSerial: 45931,
        periodeDate: new Date(2025, 9, 1),
        periodeLabel: 'Okt 2025',
        mpg: 'A1',
        wctr: 'W1',
        nama: 'Budi Resign',
        npk: 5555,
        lokasi: 'HO',
        loc: 'MDN',
        jabatan: 'CE',
        total: 4.0,
        metrics: {},
      },
      {
        periodeSerial: 45962,
        periodeDate: new Date(2025, 10, 1),
        periodeLabel: 'Nov 2025',
        mpg: 'A1',
        wctr: 'W1',
        nama: 'Budi Resign',
        npk: 5555,
        lokasi: 'HO',
        loc: 'MDN',
        jabatan: 'CE',
        total: 4.1,
        metrics: {},
      },
    ];

    const baselines = computePeerBaselines(rowsWithResigned);
    const profiles = buildIndividualProfiles(rowsWithResigned, baselines);

    // Only NPK 1234 should be included because only NPK 1234 is in Des 2025 (the latest period)
    expect(profiles).toHaveLength(1);
    expect(profiles[0].npk).toBe(1234);
    expect(profiles.some((p) => p.npk === 5555)).toBe(false);
  });
});

