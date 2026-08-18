import type {
  AnomalyAnalysisResult,
  AnomalyCategory,
  AnomalyEvidence,
  AnomalyRecord,
  AnomalySeverity,
  IndividualProfile,
  NormalizedRow,
} from '../types';
import { safeMean } from './aggregateTeams';

/**
 * Detect multidimensional statistical anomalies across individuals and operational context.
 */
export function detectAnomalies(
  profiles: IndividualProfile[],
  rows: NormalizedRow[]
): AnomalyAnalysisResult {
  const anomalies: AnomalyRecord[] = [];

  // Group active rows per NPK
  const rowsByNpk = new Map<number, NormalizedRow[]>();
  for (const r of rows) {
    let list = rowsByNpk.get(r.npk);
    if (!list) {
      list = [];
      rowsByNpk.set(r.npk, list);
    }
    list.push(r);
  }

  // -------------------------------------------------------------
  // RULE 1: Temporal Single-Period Z-Score Spikes / Cliffs (|z| >= 2.5σ)
  // -------------------------------------------------------------
  for (const p of profiles) {
    const personRows = rowsByNpk.get(p.npk) ?? [];
    const validScores = personRows
      .filter((r) => r.total !== undefined && r.total !== null && !isNaN(r.total) && r.total > 0)
      .map((r) => ({ period: r.periodeLabel, score: r.total }));

    if (validScores.length >= 4) {
      const scores = validScores.map((v) => v.score);
      const mean = safeMean(scores) ?? p.avgTotalOverall;
      const variance =
        scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / (scores.length - 1);
      const stdDev = Math.sqrt(variance);

      if (stdDev >= 0.08) {
        for (const item of validScores) {
          const z = (item.score - mean) / stdDev;
          if (Math.abs(z) >= 2.5) {
            const isDrop = z < 0;
            const delta = Number((item.score - mean).toFixed(2));
            const severity: AnomalySeverity = isDrop && Math.abs(delta) >= 0.75 ? 'critical' : 'warning';

            const evidence: AnomalyEvidence = {
              baselineValue: Number(mean.toFixed(2)),
              observedValue: Number(item.score.toFixed(2)),
              delta,
              unit: 'skor (1-5)',
              details: `Deviasi ${Math.abs(z).toFixed(1)}σ dari rata-rata historis pribadi (stddev: ${stdDev.toFixed(2)}).`,
            };

            anomalies.push({
              id: `temp-${p.npk}-${item.period}`,
              npk: p.npk,
              nama: p.nama,
              jabatan: p.jabatanUtama,
              mpg: p.history[p.history.length - 1]?.mpg ?? '-',
              loc: p.history[p.history.length - 1]?.loc ?? '-',
              category: 'temporal_spike',
              severity,
              title: isDrop ? 'Penurunan Skor Ekstrim Satu Periode' : 'Lonjakan Skor Ekstrim Satu Periode',
              description: isDrop
                ? `Skor ${p.nama} anjlok tajam ke ${item.score.toFixed(2)} pada periode ${item.period} (jauh di bawah baseline ${mean.toFixed(2)}).`
                : `Skor ${p.nama} melonjak signifikan ke ${item.score.toFixed(2)} pada periode ${item.period} (jauh di atas baseline ${mean.toFixed(2)}).`,
              evidence,
              periodLabel: item.period,
            });
          }
        }
      }
    }
  }

  // -------------------------------------------------------------
  // RULE 2: Mutation Drift Anomaly (Pre vs Post score drift)
  // -------------------------------------------------------------
  for (const p of profiles) {
    if (p.hasMutasi && p.mutasiEvents.length > 0 && p.history.length >= 4) {
      const primaryEvent = p.mutasiEvents[0];
      const eventPeriod = primaryEvent.toPeriode;
      const eventIdx = p.history.findIndex((h) => h.periodeLabel === eventPeriod);

      if (eventIdx >= 2 && eventIdx <= p.history.length - 2) {
        const preScores = p.history.slice(0, eventIdx).map((h) => h.total).filter((t) => t > 0);
        const postScores = p.history.slice(eventIdx).map((h) => h.total).filter((t) => t > 0);

        const preMean = safeMean(preScores);
        const postMean = safeMean(postScores);

        if (preMean !== null && postMean !== null) {
          const delta = Number((postMean - preMean).toFixed(2));

          if (delta <= -0.45) {
            const severity: AnomalySeverity = delta <= -0.75 ? 'critical' : 'warning';
            const fieldLabel =
              primaryEvent.field === 'mpg'
                ? 'Tim'
                : primaryEvent.field === 'loc'
                ? 'Cabang'
                : 'Jabatan';

            anomalies.push({
              id: `mut-${p.npk}-${primaryEvent.toPeriode}`,
              npk: p.npk,
              nama: p.nama,
              jabatan: p.jabatanUtama,
              mpg: p.history[p.history.length - 1]?.mpg ?? '-',
              loc: p.history[p.history.length - 1]?.loc ?? '-',
              category: 'mutation_drift',
              severity,
              title: 'Penurunan Performa Pasca Mutasi',
              description: `Performa ${p.nama} mengalami defisit ${Math.abs(delta)} poin pasca pindah ${fieldLabel} dari ${primaryEvent.from} ke ${primaryEvent.to}.`,
              evidence: {
                baselineValue: Number(preMean.toFixed(2)),
                observedValue: Number(postMean.toFixed(2)),
                delta,
                unit: 'skor (1-5)',
                details: `Rata-rata sebelum mutasi: ${preMean.toFixed(2)} (n=${preScores.length}) vs setelah mutasi: ${postMean.toFixed(2)} (n=${postScores.length}).`,
              },
              periodLabel: primaryEvent.toPeriode,
            });
          } else if (delta >= 0.60) {
            anomalies.push({
              id: `mut-boost-${p.npk}-${primaryEvent.toPeriode}`,
              npk: p.npk,
              nama: p.nama,
              jabatan: p.jabatanUtama,
              mpg: p.history[p.history.length - 1]?.mpg ?? '-',
              loc: p.history[p.history.length - 1]?.loc ?? '-',
              category: 'mutation_drift',
              severity: 'info',
              title: 'Akselerasi Positif Pasca Mutasi',
              description: `Performa ${p.nama} meningkat pesat (+${delta} poin) pasca pindah ke ${primaryEvent.to}.`,
              evidence: {
                baselineValue: Number(preMean.toFixed(2)),
                observedValue: Number(postMean.toFixed(2)),
                delta,
                unit: 'skor (1-5)',
                details: `Sebelum mutasi: ${preMean.toFixed(2)} vs sesudah mutasi: ${postMean.toFixed(2)}.`,
              },
              periodLabel: primaryEvent.toPeriode,
            });
          }
        }
      }
    }
  }

  // -------------------------------------------------------------
  // RULE 3: Metric Polarization / Bottleneck Deficit
  // -------------------------------------------------------------
  for (const p of profiles) {
    const totalScore = p.avgTotalOverall;
    for (const [metric, metricVal] of Object.entries(p.metricAverages)) {
      const cleanName = metric.replace(/^(5Scale|SubTotal)_/, '').replace(/_(CSM|CE|SPS)$/, '');

      // Case A: High Total Score but Severe Single-Metric Deficit
      if (totalScore >= 3.75 && metricVal <= 2.20 && (totalScore - metricVal) >= 1.50) {
        anomalies.push({
          id: `pol-neg-${p.npk}-${cleanName}`,
          npk: p.npk,
          nama: p.nama,
          jabatan: p.jabatanUtama,
          mpg: p.history[p.history.length - 1]?.mpg ?? '-',
          loc: p.history[p.history.length - 1]?.loc ?? '-',
          category: 'metric_polarization',
          severity: 'warning',
          title: `Defisit Metrik ${cleanName}`,
          description: `${p.nama} memiliki skor komposit sangat baik (${totalScore.toFixed(2)}), namun memiliki kelemahan kritis pada metrik ${cleanName} (${metricVal.toFixed(2)}).`,
          evidence: {
            baselineValue: Number(totalScore.toFixed(2)),
            observedValue: Number(metricVal.toFixed(2)),
            delta: Number((metricVal - totalScore).toFixed(2)),
            unit: 'skor (1-5)',
            details: `Selisih defisit ${Math.abs(metricVal - totalScore).toFixed(2)} poin dibanding skor agregat.`,
          },
        });
      }

      // Case B: Low Total Score but Outstanding Specific Technical Mastery
      if (totalScore <= 2.85 && metricVal >= 4.40) {
        anomalies.push({
          id: `pol-pos-${p.npk}-${cleanName}`,
          npk: p.npk,
          nama: p.nama,
          jabatan: p.jabatanUtama,
          mpg: p.history[p.history.length - 1]?.mpg ?? '-',
          loc: p.history[p.history.length - 1]?.loc ?? '-',
          category: 'metric_polarization',
          severity: 'info',
          title: `Penguasaan Unggul Metrik ${cleanName}`,
          description: `${p.nama} menunjukkan kapabilitas ${cleanName} sangat tinggi (${metricVal.toFixed(2)}) meskipun skor total tertahan di ${totalScore.toFixed(2)}.`,
          evidence: {
            baselineValue: Number(totalScore.toFixed(2)),
            observedValue: Number(metricVal.toFixed(2)),
            delta: Number((metricVal - totalScore).toFixed(2)),
            unit: 'skor (1-5)',
            details: `Keahlian menonjol pada ${cleanName} (+${(metricVal - totalScore).toFixed(2)} poin di atas skor total).`,
          },
        });
      }
    }
  }

  // -------------------------------------------------------------
  // RULE 4: Cohort Branch Divergence (|residual| >= 2.0σ)
  // -------------------------------------------------------------
  const branchGroups = new Map<string, IndividualProfile[]>();
  for (const p of profiles) {
    const loc = p.history[p.history.length - 1]?.loc;
    if (loc && loc !== 'UNKNOWN') {
      const key = `${p.jabatanUtama}|${loc}`;
      let list = branchGroups.get(key);
      if (!list) {
        list = [];
        branchGroups.set(key, list);
      }
      list.push(p);
    }
  }

  for (const [key, cohort] of branchGroups.entries()) {
    if (cohort.length >= 4) {
      const [, branchName] = key.split('|');
      const scores = cohort.map((c) => c.avgTotalOverall);
      const cohortMean = safeMean(scores) ?? 0;
      const cohortVariance =
        scores.reduce((sum, s) => sum + (s - cohortMean) ** 2, 0) / (scores.length - 1);
      const cohortStd = Math.sqrt(cohortVariance);

      if (cohortStd >= 0.15) {
        for (const member of cohort) {
          const z = (member.avgTotalOverall - cohortMean) / cohortStd;
          if (Math.abs(z) >= 2.1) {
            const isNegative = z < 0;
            anomalies.push({
              id: `cohort-${member.npk}-${branchName}`,
              npk: member.npk,
              nama: member.nama,
              jabatan: member.jabatanUtama,
              mpg: member.history[member.history.length - 1]?.mpg ?? '-',
              loc: branchName,
              category: 'cohort_outlier',
              severity: isNegative ? 'warning' : 'info',
              title: isNegative ? 'Divergensi Signifikan di Bawah Rekan Cabang' : 'Performa Menonjol Jauh di Atas Rekan Cabang',
              description: isNegative
                ? `${member.nama} memiliki skor (${member.avgTotalOverall.toFixed(2)}) jauh di bawah rata-rata rekan sejabatan di cabang ${branchName} (${cohortMean.toFixed(2)}).`
                : `${member.nama} mencatat performa (${member.avgTotalOverall.toFixed(2)}) melampaui rata-rata rekan di cabang ${branchName} (${cohortMean.toFixed(2)}).`,
              evidence: {
                baselineValue: Number(cohortMean.toFixed(2)),
                observedValue: Number(member.avgTotalOverall.toFixed(2)),
                delta: Number((member.avgTotalOverall - cohortMean).toFixed(2)),
                unit: 'skor (1-5)',
                details: `Deviasi ${Math.abs(z).toFixed(1)}σ dibanding rekan sejabatan di ${branchName} (n=${cohort.length}, stddev: ${cohortStd.toFixed(2)}).`,
              },
            });
          }
        }
      }
    }
  }

  // Deduplicate and compile summary
  const uniqueMap = new Map<string, AnomalyRecord>();
  for (const a of anomalies) {
    if (!uniqueMap.has(a.id)) {
      uniqueMap.set(a.id, a);
    }
  }

  const finalAnomalies = Array.from(uniqueMap.values());

  // Sort by severity (critical -> warning -> info) then by delta magnitude
  const severityRank: Record<AnomalySeverity, number> = { critical: 1, warning: 2, info: 3 };
  finalAnomalies.sort((a, b) => {
    if (severityRank[a.severity] !== severityRank[b.severity]) {
      return severityRank[a.severity] - severityRank[b.severity];
    }
    return Math.abs(b.evidence.delta) - Math.abs(a.evidence.delta);
  });

  const summaryByCategory: Record<AnomalyCategory, number> = {
    mutation_drift: 0,
    temporal_spike: 0,
    metric_polarization: 0,
    cohort_outlier: 0,
  };

  const summaryBySeverity: Record<AnomalySeverity, number> = {
    critical: 0,
    warning: 0,
    info: 0,
  };

  for (const a of finalAnomalies) {
    summaryByCategory[a.category] = (summaryByCategory[a.category] ?? 0) + 1;
    summaryBySeverity[a.severity] = (summaryBySeverity[a.severity] ?? 0) + 1;
  }

  return {
    anomalies: finalAnomalies,
    summaryByCategory,
    summaryBySeverity,
  };
}
