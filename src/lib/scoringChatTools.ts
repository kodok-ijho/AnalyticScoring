import type {
  AnomalyAnalysisResult,
  ChatToolDefinition,
  IndividualProfile,
  PersonnelCluster,
  TeamProfile,
  CsmSubordinateCorrelation,
  LocationBreakdown,
  FilterState,
  NormalizedRow,
} from '../types';

export interface ScoringChatFullContext {
  sheetName: string;
  rowCount: number;
  filters: FilterState;
  availablePeriods: string[];
  teams: TeamProfile[];
  individuals: IndividualProfile[];
  clusters: PersonnelCluster[];
  anomalies: AnomalyAnalysisResult | null;
  csmCorrelation: CsmSubordinateCorrelation | null;
  locationBreakdownLoc: LocationBreakdown | null;
  locationBreakdownType: LocationBreakdown | null;
  filteredRows: NormalizedRow[];
}

export const SCORING_CHAT_TOOLS: ChatToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'query_top_bottom_performers',
      description: 'Mengambil daftar personil atau tim dengan performa tertinggi atau terendah berdasarkan skor total atau metrik spesifik.',
      parameters: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'Target pencarian: "personnel" untuk personil atau "team" untuk tim MPG',
            enum: ['personnel', 'team'],
          },
          order: {
            type: 'string',
            description: 'Urutan: "top" untuk peringkat terbaik, "bottom" untuk peringkat terendah/perlu perhatian',
            enum: ['top', 'bottom'],
          },
          role: {
            type: 'string',
            description: 'Filter jabatan untuk personil: "CSM", "CE", atau "SPS" (opsional)',
            enum: ['CSM', 'CE', 'SPS'],
          },
          limit: {
            type: 'number',
            description: 'Jumlah data yang ingin diambil (default: 5, maksimal: 15)',
          },
        },
        required: ['target', 'order'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_individual_profile',
      description: 'Mencari dan mengambil rincian mendalam satu personil berdasarkan NPK atau Nama (termasuk riwayat periode, mutasi, kekuatan, kelemahan, dan kluster).',
      parameters: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Nomor NPK (misal: "10234") atau bagian dari Nama personil (misal: "Budi")',
          },
        },
        required: ['search'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_team_profile',
      description: 'Mengambil rincian performa mendalam satu Tim MPG tertentu (skor CSM vs Teknisi, tren, volatilitas, komposisi HO/SERPO, pros & cons).',
      parameters: {
        type: 'object',
        properties: {
          mpg: {
            type: 'string',
            description: 'Kode Tim MPG (contoh: "A1", "B2", "K1")',
          },
        },
        required: ['mpg'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_anomalies',
      description: 'Mengambil daftar anomali statistik operasional yang terdeteksi (seperti penurunan pasca mutasi, lonjakan ekstrim di satu bulan, atau defisit metrik kritis).',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: 'Kategori anomali (opsional)',
            enum: ['mutation_drift', 'temporal_spike', 'metric_polarization', 'cohort_outlier'],
          },
          severity: {
            type: 'string',
            description: 'Tingkat keparahan (opsional): "critical", "warning", atau "info"',
            enum: ['critical', 'warning', 'info'],
          },
          limit: {
            type: 'number',
            description: 'Maksimal jumlah anomali yang ditampilkan (default: 8)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_clusters',
      description: 'Mengambil ringkasan pengelompokan segmen perilaku personil hasil K-Means Clustering (Solid High Performer, Rising Star, Volatile Performer, Needs Coaching, dll).',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: 'Kategori arketipe kluster (opsional)',
            enum: ['solid_anchor', 'rising_potential', 'volatile_performer', 'needs_coaching', 'metric_specialist'],
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_mutation_impacts',
      description: 'Mengambil data personil yang mengalami mutasi (pindah tim, promosi jabatan, atau pindah cabang) dan melihat dampak perubahan performa sebelum vs sesudah mutasi.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: 'Filter jenis dampak: "negative" (skor anjlok), "positive" (skor naik), atau "all"',
            enum: ['negative', 'positive', 'all'],
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_branch_comparison',
      description: 'Mengambil perbandingan performa antar cabang (Loc) atau perbandingan HO vs SERPO.',
      parameters: {
        type: 'object',
        properties: {
          groupBy: {
            type: 'string',
            description: '"Loc" untuk per cabang, "Lokasi" untuk HO vs SERPO',
            enum: ['Loc', 'Lokasi'],
          },
          role: {
            type: 'string',
            description: 'Filter jabatan spesifik: "CSM", "CE", atau "SPS" (opsional)',
            enum: ['CSM', 'CE', 'SPS'],
          },
        },
        required: ['groupBy'],
      },
    },
  },
];

/**
 * Executes a tool function locally against in-memory scoring context.
 */
export function executeScoringTool(
  toolName: string,
  args: Record<string, unknown>,
  context: ScoringChatFullContext
): string {
  switch (toolName) {
    case 'query_top_bottom_performers': {
      const target = String(args.target || 'personnel');
      const order = String(args.order || 'top');
      const role = args.role ? String(args.role) : null;
      const limit = Math.min(15, Math.max(1, Number(args.limit) || 5));

      if (target === 'team') {
        let sorted = [...context.teams];
        if (order === 'top') {
          sorted.sort((a, b) => a.rank - b.rank);
        } else {
          sorted.sort((a, b) => b.rank - a.rank);
        }
        const slice = sorted.slice(0, limit);
        return JSON.stringify({
          tipe: 'Daftar Tim MPG',
          urutan: order === 'top' ? 'Peringkat Terbaik' : 'Perlu Perhatian',
          hasil: slice.map((t) => ({
            mpg: t.mpg,
            rank: t.rank,
            rataRataTotal: Number(t.avgTotalOverall.toFixed(2)),
            rataRataCSM: t.avgTotalCsmOverall ? Number(t.avgTotalCsmOverall.toFixed(2)) : '-',
            rataRataTeknisi: t.avgTotalAnggotaOverall ? Number(t.avgTotalAnggotaOverall.toFixed(2)) : '-',
            tren: `${t.trend.direction} (${t.trend.deltaPct.toFixed(1)}%)`,
            volatilitas: Number(t.volatility.toFixed(3)),
            kekuatan: t.pros.slice(0, 2).map((p) => p.metric),
            kelemahan: t.cons.slice(0, 2).map((c) => c.metric),
          })),
        });
      }

      // Personnel target
      let list = [...context.individuals];
      if (role) {
        list = list.filter((p) => p.jabatanUtama === role);
      }
      if (order === 'top') {
        list.sort((a, b) => b.avgTotalOverall - a.avgTotalOverall);
      } else {
        list.sort((a, b) => a.avgTotalOverall - b.avgTotalOverall);
      }
      const slice = list.slice(0, limit);
      return JSON.stringify({
        tipe: 'Daftar Personil',
        urutan: order === 'top' ? 'Top Performer' : 'Skor Terendah / Perlu Perhatian',
        jabatan: role || 'Semua Jabatan',
        hasil: slice.map((p) => ({
          npk: p.npk,
          nama: p.nama,
          jabatan: p.jabatanUtama,
          timTerakhir: p.history[p.history.length - 1]?.mpg ?? '-',
          cabangTerakhir: p.history[p.history.length - 1]?.loc ?? '-',
          skorRataRata: Number(p.avgTotalOverall.toFixed(2)),
          rankJabatan: p.rankInPeerGroup,
          status: p.status,
          kluster: p.clusterLabel ?? '-',
          tren: `${p.trend.direction} (${p.trend.deltaPct.toFixed(1)}%)`,
          kekuatan: p.pros.slice(0, 2).map((x) => x.metric),
          kelemahan: p.cons.slice(0, 2).map((x) => x.metric),
        })),
      });
    }

    case 'query_individual_profile': {
      const search = String(args.search || '').trim().toLowerCase();
      if (!search) return JSON.stringify({ error: 'Parameter search tidak boleh kosong.' });

      const found = context.individuals.filter(
        (p) => String(p.npk) === search || p.nama.toLowerCase().includes(search)
      );

      if (found.length === 0) {
        return JSON.stringify({ pesan: `Personil dengan kata kunci "${search}" tidak ditemukan.` });
      }

      // If multiple, return full details of first 3
      return JSON.stringify({
        jumlahDitemukan: found.length,
        personil: found.slice(0, 3).map((p) => ({
          npk: p.npk,
          nama: p.nama,
          jabatan: p.jabatanUtama,
          kluster: p.clusterLabel ?? '-',
          skorRataRata: Number(p.avgTotalOverall.toFixed(2)),
          peringkatJabatan: p.rankInPeerGroup,
          deviasiVsTim: Number(p.vsTeamAvg.toFixed(2)),
          deviasiVsRekanJabatan: Number(p.vsPeerAvg.toFixed(2)),
          volatilitas: Number(p.volatility.toFixed(3)),
          tren: `${p.trend.direction} (${p.trend.deltaPct.toFixed(1)}%)`,
          riwayatPerkembangan: p.history.map((h) => ({
            periode: h.periodeLabel,
            mpg: h.mpg,
            jabatan: h.jabatan,
            cabang: h.loc,
            skor: Number(h.total.toFixed(2)),
          })),
          mutasi: p.mutasiEvents,
          kekuatanMetrik: p.pros.map((pr) => ({ metrik: pr.metric, nilai: Number(pr.value.toFixed(2)), delta: Number(pr.deltaFromMean.toFixed(2)) })),
          kelemahanMetrik: p.cons.map((cn) => ({ metrik: cn.metric, nilai: Number(cn.value.toFixed(2)), delta: Number(cn.deltaFromMean.toFixed(2)) })),
        })),
      });
    }

    case 'query_team_profile': {
      const mpg = String(args.mpg || '').trim().toUpperCase();
      const team = context.teams.find((t) => t.mpg.toUpperCase() === mpg);
      if (!team) {
        return JSON.stringify({ pesan: `Tim MPG "${mpg}" tidak ditemukan.` });
      }

      return JSON.stringify({
        mpg: team.mpg,
        peringkat: team.rank,
        rataRataTotal: Number(team.avgTotalOverall.toFixed(2)),
        rataRataCSM: team.avgTotalCsmOverall ? Number(team.avgTotalCsmOverall.toFixed(2)) : null,
        rataRataTeknisi: team.avgTotalAnggotaOverall ? Number(team.avgTotalAnggotaOverall.toFixed(2)) : null,
        tren: team.trend,
        volatilitas: Number(team.volatility.toFixed(3)),
        riwayatBulanan: team.periodStats.map((s) => ({
          periode: s.periodeLabel,
          rataRataTim: Number(s.avgTotal.toFixed(2)),
          skorCSM: s.avgTotalCsm ? Number(s.avgTotalCsm.toFixed(2)) : '-',
          skorTeknisi: s.avgTotalAnggota ? Number(s.avgTotalAnggota.toFixed(2)) : '-',
          jumlahAnggota: s.memberCount,
          persentaseHO: `${s.pctHO.toFixed(1)}%`,
          persentaseSERPO: `${s.pctSERPO.toFixed(1)}%`,
        })),
        pros: team.pros,
        cons: team.cons,
      });
    }

    case 'query_anomalies': {
      if (!context.anomalies || context.anomalies.anomalies.length === 0) {
        return JSON.stringify({ pesan: 'Tidak ada anomali statistik kritis yang terdeteksi pada filter saat ini.' });
      }

      let list = [...context.anomalies.anomalies];
      if (args.category) {
        list = list.filter((a) => a.category === String(args.category));
      }
      if (args.severity) {
        list = list.filter((a) => a.severity === String(args.severity));
      }

      const limit = Math.min(12, Math.max(1, Number(args.limit) || 8));
      return JSON.stringify({
        totalAnomaliTerdeteksi: context.anomalies.anomalies.length,
        anomaliDitampilkan: list.slice(0, limit).map((a) => ({
          npk: a.npk,
          nama: a.nama,
          jabatan: a.jabatan,
          cabang: a.loc,
          kategori: a.category,
          tingkatKeparahan: a.severity,
          judul: a.title,
          deskripsi: a.description,
          buktiStatistik: a.evidence,
          periode: a.periodLabel || 'Sepanjang periode',
        })),
      });
    }

    case 'query_clusters': {
      if (context.clusters.length === 0) {
        return JSON.stringify({ pesan: 'Data kluster belum tersedia.' });
      }

      let filtered = context.clusters;
      if (args.category) {
        filtered = filtered.filter((c) => c.archetype.category === String(args.category));
      }

      return JSON.stringify({
        totalKluster: context.clusters.length,
        kluster: filtered.map((c) => ({
          id: c.id,
          namaArketipe: c.archetype.name,
          kategori: c.archetype.category,
          deskripsi: c.archetype.description,
          jumlahAnggota: c.size,
          persentase: `${c.percentage}%`,
          rataRataSkor: c.archetype.avgScore,
          rataRataVolatilitas: c.archetype.avgVolatility,
          rataRataTren: `${c.archetype.avgTrendDeltaPct}%`,
          kekuatanUtama: c.archetype.strengths,
        })),
      });
    }

    case 'query_mutation_impacts': {
      const type = String(args.type || 'all');
      const mutatedIndividuals = context.individuals.filter((p) => p.hasMutasi && p.history.length >= 3);

      const impacts = mutatedIndividuals.map((p) => {
        const primaryEvent = p.mutasiEvents[0];
        const eventIdx = p.history.findIndex((h) => h.periodeLabel === primaryEvent?.toPeriode);
        if (eventIdx > 0 && eventIdx < p.history.length) {
          const preScores = p.history.slice(0, eventIdx).map((h) => h.total);
          const postScores = p.history.slice(eventIdx).map((h) => h.total);
          const preMean = preScores.reduce((a, b) => a + b, 0) / preScores.length;
          const postMean = postScores.reduce((a, b) => a + b, 0) / postScores.length;
          const delta = postMean - preMean;
          return {
            npk: p.npk,
            nama: p.nama,
            jabatan: p.jabatanUtama,
            mutasi: `${primaryEvent.field} dari ${primaryEvent.from} ke ${primaryEvent.to}`,
            periodeMutasi: primaryEvent.toPeriode,
            skorSebelum: Number(preMean.toFixed(2)),
            skorSesudah: Number(postMean.toFixed(2)),
            delta: Number(delta.toFixed(2)),
            dampak: delta < -0.3 ? 'negatif' : delta > 0.3 ? 'positif' : 'stabil',
          };
        }
        return null;
      }).filter((item): item is NonNullable<typeof item> => item !== null);

      let filtered = impacts;
      if (type === 'negative') {
        filtered = filtered.filter((i) => i.delta < 0).sort((a, b) => a.delta - b.delta);
      } else if (type === 'positive') {
        filtered = filtered.filter((i) => i.delta > 0).sort((a, b) => b.delta - a.delta);
      } else {
        filtered.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
      }

      return JSON.stringify({
        totalPersonilMutasi: impacts.length,
        hasil: filtered.slice(0, 10),
      });
    }

    case 'query_branch_comparison': {
      const groupBy = args.groupBy === 'Lokasi' ? 'Lokasi' : 'Loc';
      const breakdown = groupBy === 'Loc' ? context.locationBreakdownLoc : context.locationBreakdownType;

      if (!breakdown || breakdown.rows.length === 0) {
        return JSON.stringify({ pesan: 'Data perbandingan lokasi belum tersedia.' });
      }

      return JSON.stringify({
        grup: groupBy === 'Loc' ? 'Per Cabang' : 'HO vs SERPO',
        hasil: breakdown.rows.slice(0, 12).map((r) => ({
          lokasi: r.key,
          rataRataSkor: Number(r.avgTotal.toFixed(2)),
          jumlahSampel: r.n,
          keteranganSampel: r.isSmallSample ? 'Sampel kecil (n<3)' : 'Cukup representatif',
        })),
      });
    }

    default:
      return JSON.stringify({ error: `Tool "${toolName}" tidak dikenal.` });
  }
}
