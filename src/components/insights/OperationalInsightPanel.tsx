import { useMemo } from 'react';
import { useDashboardStore } from '../../store/useDashboardStore';
import type { IndividualProfile, TeamProfile } from '../../types';

const CUSTOMER_FACING_PATTERNS = [
  'CSAT',
  'RTSuccessRatio',
  'LWH',
  'LoL',
  'RTFirstVisit',
  'WkTS',
  'TSM',
  'CEComSkill',
];

function cleanMetricName(metric: string): string {
  return metric
    .replace(/^(5Scale|SubTotal)_/, '')
    .replace(/_(CSM|CE|SPS)$/, '')
    .replace('CostPerRevenue', 'Cost/Revenue')
    .replace('RTSuccessRatio', 'RT Success')
    .replace('RTFirstVisit', 'RT First Visit')
    .replace('ProductivityCall', 'Productivity')
    .replace('SupportIT', 'Support IT')
    .replace('CEComSkill', 'Communication Skill');
}

function isCustomerFacing(metric: string): boolean {
  return CUSTOMER_FACING_PATTERNS.some((pattern) => metric.includes(pattern));
}

function isTeamLevelTechnicianMetric(metric: string): boolean {
  return metric.includes('TSM');
}

function individualMetricItems<T extends { metric: string }>(items: T[]): T[] {
  return items.filter((item) => !isTeamLevelTechnicianMetric(item.metric));
}

function getLatestHistory(profile: IndividualProfile) {
  return profile.history[profile.history.length - 1] ?? null;
}

function getSeniorityLabel(npk: number, seniorCutoff: number, juniorCutoff: number): string {
  if (npk <= seniorCutoff) return 'Senior';
  if (npk >= juniorCutoff) return 'Junior';
  return 'Mid';
}

function teamDiagnosis(profile: TeamProfile): string {
  const csm = profile.avgTotalCsmOverall ?? 0;
  const technicians = profile.avgTotalAnggotaOverall ?? 0;
  const weakest = profile.cons[0]?.metric;

  if (csm > 0 && technicians > 0 && technicians < csm - 0.2) {
    return 'Skor teknisi lebih tertinggal dari CSM. Prioritasnya adalah coaching eksekusi lapangan dan follow-up KPI teknisi.';
  }
  if (csm > 0 && technicians > 0 && csm < technicians - 0.2) {
    return 'Skor CSM lebih tertinggal dari teknisi. Prioritasnya adalah review supervisi, kontrol, dan ritme monitoring tim.';
  }
  if (weakest && isCustomerFacing(weakest)) {
    return 'Gap terbesar menyentuh KPI yang dekat dengan pengalaman pelanggan. Prioritaskan perbaikan proses layanan harian.';
  }
  return 'Gap performa relatif menyebar. Mulai dari KPI dengan deviasi terbesar sebelum masuk ke audit per individu.';
}

function getMetricValue(profile: IndividualProfile, metric: string | undefined): number {
  if (!metric || isTeamLevelTechnicianMetric(metric)) return -Infinity;
  return profile.metricAverages[metric] ?? -Infinity;
}

function findMentor(
  target: IndividualProfile,
  peers: IndividualProfile[],
  weakMetric: string | undefined
): IndividualProfile | null {
  const latest = getLatestHistory(target);
  const sameRole = peers.filter((p) => p.npk !== target.npk && p.jabatanUtama === target.jabatanUtama);
  const sameLoc = latest
    ? sameRole.filter((p) => getLatestHistory(p)?.loc === latest.loc)
    : [];
  const pool = sameLoc.length > 0 ? sameLoc : sameRole;

  return [...pool]
    .filter((p) => p.avgTotalOverall > target.avgTotalOverall)
    .sort((a, b) => {
      const metricDelta = getMetricValue(b, weakMetric) - getMetricValue(a, weakMetric);
      if (Number.isFinite(metricDelta) && Math.abs(metricDelta) > 0.001) return metricDelta;
      return b.avgTotalOverall - a.avgTotalOverall;
    })[0] ?? null;
}

export function TeamOperationalInsightCard({ profile }: { profile: TeamProfile }) {
  const filteredIndividualProfiles = useDashboardStore((s) => s.filteredIndividualProfiles);
  const setSelectedTeam = useDashboardStore((s) => s.setSelectedTeam);
  const setSelectedIndividual = useDashboardStore((s) => s.setSelectedIndividual);
  const setActiveTab = useDashboardStore((s) => s.setActiveTab);

  const technicians = useMemo(
    () => filteredIndividualProfiles.filter((p) => {
      const latest = getLatestHistory(p);
      return latest?.mpg === profile.mpg && (p.jabatanUtama === 'CE' || p.jabatanUtama === 'SPS');
    }),
    [filteredIndividualProfiles, profile.mpg]
  );

  const seniorityCutoffs = useMemo(() => {
    const allTechnicians = filteredIndividualProfiles
      .filter((p) => p.jabatanUtama === 'CE' || p.jabatanUtama === 'SPS')
      .map((p) => p.npk)
      .sort((a, b) => a - b);
    if (allTechnicians.length === 0) return { senior: 0, junior: 0 };
    return {
      senior: allTechnicians[Math.floor(allTechnicians.length * 0.33)],
      junior: allTechnicians[Math.floor(allTechnicians.length * 0.66)],
    };
  }, [filteredIndividualProfiles]);

  const weakest = profile.cons.find((item) => isCustomerFacing(item.metric)) ?? profile.cons[0] ?? null;
  const customerCons = profile.cons.filter((item) => isCustomerFacing(item.metric));

  const coachingTargets = useMemo(() => {
    return [...technicians]
      .map((person) => {
        const individualCons = individualMetricItems(person.cons);
        const weakMetric = individualCons.find((item) => isCustomerFacing(item.metric))?.metric ?? individualCons[0]?.metric;
        const mentor = findMentor(person, technicians, weakMetric);
        const seniority = getSeniorityLabel(person.npk, seniorityCutoffs.senior, seniorityCutoffs.junior);
        const riskScore =
          Math.max(0, -person.vsTeamAvg) +
          Math.max(0, -person.vsPeerAvg) +
          (person.trend.direction === 'down' ? 0.25 : 0) +
          (seniority === 'Senior' && person.vsPeerAvg < 0 ? 0.15 : 0);

        return { person, weakMetric, mentor, seniority, riskScore };
      })
      .filter((item) => item.riskScore > 0)
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 3);
  }, [technicians, seniorityCutoffs]);

  const roleModels = useMemo(() => {
    return [...technicians]
      .filter((person) => person.vsTeamAvg > 0 && person.vsPeerAvg > 0)
      .sort((a, b) => b.avgTotalOverall - a.avgTotalOverall)
      .slice(0, 3);
  }, [technicians]);

  return (
    <div className="glass-light rounded-xl p-5 border border-amber-500/20">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Operational Insight</h3>
        <p className="text-xs text-amber-300">Diagnosis operasional untuk Tim {profile.mpg}</p>
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border border-slate-800/50 bg-slate-950/30 p-3">
          <h4 className="text-xs font-semibold text-red-300 uppercase tracking-wider mb-2">Kenapa Lebih Rendah</h4>
          <p className="text-xs leading-relaxed text-slate-300">{teamDiagnosis(profile)}</p>
          <p className="mt-2 text-xs text-slate-400">
            Weakest KPI: <span className="text-slate-100">{weakest ? cleanMetricName(weakest.metric) : '-'}</span>
            {weakest ? ` (${weakest.deltaFromMean.toFixed(2)} vs benchmark)` : ''}
          </p>
          {customerCons.length > 0 && (
            <p className="mt-1 text-xs text-red-300">
              Customer risk: {customerCons.slice(0, 3).map((item) => cleanMetricName(item.metric)).join(', ')}
            </p>
          )}
        </div>

        {coachingTargets.length > 0 && (
          <div className="rounded-lg border border-slate-800/50 bg-slate-950/30 p-3">
            <h4 className="text-xs font-semibold text-amber-300 uppercase tracking-wider mb-2">Teknisi Prioritas Coaching</h4>
            <div className="space-y-2">
              {coachingTargets.map(({ person, weakMetric, mentor, seniority }) => (
                <button
                  key={person.npk}
                  onClick={() => {
                    setSelectedTeam(null);
                    setSelectedIndividual(person.npk);
                    setActiveTab('individual');
                  }}
                  className="w-full rounded-lg bg-slate-900/70 border border-slate-800/50 px-3 py-2 text-left hover:border-amber-500/30 transition-all"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{person.nama}</p>
                    <span className="text-xs font-mono text-amber-300">{person.avgTotalOverall.toFixed(2)}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono">NPK {person.npk} · {seniority}</p>
                  <p className="mt-1 text-xs text-slate-300">
                    Fokus {weakMetric ? cleanMetricName(weakMetric) : 'TOTAL'} · Pairing {mentor ? mentor.nama : 'role model satu Loc/tim'}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {roleModels.length > 0 && (
          <div className="rounded-lg border border-slate-800/50 bg-slate-950/30 p-3">
            <h4 className="text-xs font-semibold text-emerald-300 uppercase tracking-wider mb-2">Role Model Tim</h4>
            <div className="space-y-2">
              {roleModels.map((person) => {
                const individualPros = individualMetricItems(person.pros);
                const bestMetric = individualPros.find((item) => isCustomerFacing(item.metric)) ?? individualPros[0];
                return (
                  <button
                    key={person.npk}
                    onClick={() => {
                      setSelectedTeam(null);
                      setSelectedIndividual(person.npk);
                      setActiveTab('individual');
                    }}
                    className="w-full rounded-lg bg-slate-900/70 border border-slate-800/50 px-3 py-2 text-left hover:border-emerald-500/30 transition-all"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">{person.nama}</p>
                      <span className="text-xs font-mono text-emerald-300">{person.avgTotalOverall.toFixed(2)}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-300">
                      Kuat di {bestMetric ? cleanMetricName(bestMetric.metric) : 'TOTAL'} · vs tim +{person.vsTeamAvg.toFixed(2)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function IndividualOperationalInsightCard({ profile }: { profile: IndividualProfile }) {
  const filteredIndividualProfiles = useDashboardStore((s) => s.filteredIndividualProfiles);

  const technicians = useMemo(
    () => filteredIndividualProfiles.filter((p) => p.jabatanUtama === 'CE' || p.jabatanUtama === 'SPS'),
    [filteredIndividualProfiles]
  );

  const seniorityCutoffs = useMemo(() => {
    const sortedNpks = technicians.map((p) => p.npk).sort((a, b) => a - b);
    if (sortedNpks.length === 0) return { senior: 0, junior: 0 };
    return {
      senior: sortedNpks[Math.floor(sortedNpks.length * 0.33)],
      junior: sortedNpks[Math.floor(sortedNpks.length * 0.66)],
    };
  }, [technicians]);

  const latest = getLatestHistory(profile);
  const individualCons = individualMetricItems(profile.cons);
  const individualPros = individualMetricItems(profile.pros);
  const weakMetric = individualCons.find((item) => isCustomerFacing(item.metric))?.metric ?? individualCons[0]?.metric;
  const mentor = findMentor(profile, technicians, weakMetric);
  const seniority = getSeniorityLabel(profile.npk, seniorityCutoffs.senior, seniorityCutoffs.junior);
  const bestMetric = individualPros.find((item) => isCustomerFacing(item.metric)) ?? individualPros[0];

  const diagnosis = (() => {
    if (profile.vsTeamAvg < 0 && profile.vsPeerAvg < 0) {
      return `${profile.nama} berada di bawah rata-rata tim dan peer. Fokus coaching sebaiknya diarahkan ke KPI gap terbesar, bukan hanya total score.`;
    }
    if (profile.vsTeamAvg < 0) {
      return `${profile.nama} tertinggal dibanding rekan satu tim, tetapi masih relatif kompetitif terhadap peer. Cek pembagian area/case dan pola kerja di tim.`;
    }
    if (profile.vsPeerAvg < 0) {
      return `${profile.nama} unggul di timnya, tetapi masih di bawah peer sejabatan. Tim mungkin perlu benchmark ke Loc/SERPO lain.`;
    }
    return `${profile.nama} berada di atas benchmark tim dan peer. Cocok dijadikan referensi praktik kerja untuk KPI yang kuat.`;
  })();

  return (
    <div className="glass-light rounded-xl p-4 border border-amber-500/20">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Operational Insight</h3>
        <p className="text-xs text-amber-300">
          {latest?.mpg ?? '-'} / {latest?.loc ?? '-'} · {seniority} berdasarkan NPK
        </p>
      </div>

      <div className="space-y-3">
        <div className="rounded-lg border border-slate-800/50 bg-slate-950/30 p-3">
          <h4 className="text-xs font-semibold text-red-300 uppercase tracking-wider mb-2">Diagnosis</h4>
          <p className="text-xs leading-relaxed text-slate-300">{diagnosis}</p>
          <p className="mt-2 text-xs text-slate-400">
            Fokus KPI: <span className="text-slate-100">{weakMetric ? cleanMetricName(weakMetric) : 'TOTAL'}</span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-slate-800/50 bg-slate-950/30 p-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">vs Tim</p>
            <p className={`mt-1 text-lg font-bold font-mono ${profile.vsTeamAvg >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
              {profile.vsTeamAvg >= 0 ? '+' : ''}{profile.vsTeamAvg.toFixed(2)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-800/50 bg-slate-950/30 p-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">vs Peer</p>
            <p className={`mt-1 text-lg font-bold font-mono ${profile.vsPeerAvg >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
              {profile.vsPeerAvg >= 0 ? '+' : ''}{profile.vsPeerAvg.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800/50 bg-slate-950/30 p-3">
          <h4 className="text-xs font-semibold text-cyan-300 uppercase tracking-wider mb-2">Saran Operasional</h4>
          <ul className="space-y-2 text-xs text-slate-300">
            <li>Prioritaskan coaching pada {weakMetric ? cleanMetricName(weakMetric) : 'KPI individual teknisi'}.</li>
            {profile.cons.some((item) => isTeamLevelTechnicianMetric(item.metric)) && (
              <li>TSM dibaca sebagai isu level tim, bukan kelemahan individual teknisi.</li>
            )}
            {mentor && (
              <li>Pairing dengan {mentor.nama} karena performanya lebih kuat pada area pembanding yang sama.</li>
            )}
            {bestMetric && (
              <li>Pertahankan kekuatan di {cleanMetricName(bestMetric.metric)} sebagai modal perbaikan KPI lain.</li>
            )}
            {seniority === 'Senior' && profile.vsPeerAvg < 0 && (
              <li>Karena termasuk senior, lakukan review pola kerja/case handling, bukan hanya training dasar.</li>
            )}
            {seniority === 'Junior' && profile.vsPeerAvg < 0 && (
              <li>Karena termasuk junior, gunakan coaching rutin dan shadowing dengan teknisi role model.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function OperationalInsightPanel() {
  const filteredProfiles = useDashboardStore((s) => s.filteredProfiles);
  const filteredIndividualProfiles = useDashboardStore((s) => s.filteredIndividualProfiles);
  const setSelectedTeam = useDashboardStore((s) => s.setSelectedTeam);
  const setSelectedIndividual = useDashboardStore((s) => s.setSelectedIndividual);
  const setActiveTab = useDashboardStore((s) => s.setActiveTab);

  const technicians = useMemo(
    () => filteredIndividualProfiles.filter((p) => p.jabatanUtama === 'CE' || p.jabatanUtama === 'SPS'),
    [filteredIndividualProfiles]
  );

  const seniorityCutoffs = useMemo(() => {
    const sortedNpks = technicians.map((p) => p.npk).sort((a, b) => a - b);
    if (sortedNpks.length === 0) return { senior: 0, junior: 0 };
    return {
      senior: sortedNpks[Math.floor(sortedNpks.length * 0.33)],
      junior: sortedNpks[Math.floor(sortedNpks.length * 0.66)],
    };
  }, [technicians]);

  const priorityTeams = useMemo(() => {
    return [...filteredProfiles]
      .map((profile) => {
        const customerCons = profile.cons.filter((item) => isCustomerFacing(item.metric));
        const weakest = customerCons[0] ?? profile.cons[0] ?? null;
        const riskScore =
          (5 - profile.avgTotalOverall) +
          Math.max(0, -((profile.avgTotalAnggotaOverall ?? profile.avgTotalOverall) - profile.avgTotalOverall)) +
          customerCons.length * 0.15;

        return { profile, weakest, customerCons, riskScore };
      })
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 4);
  }, [filteredProfiles]);

  const coachingTargets = useMemo(() => {
    return [...technicians]
      .map((profile) => {
        const individualCons = individualMetricItems(profile.cons);
        const weakMetric = individualCons.find((item) => isCustomerFacing(item.metric))?.metric ?? individualCons[0]?.metric;
        const mentor = findMentor(profile, technicians, weakMetric);
        const latest = getLatestHistory(profile);
        const seniority = getSeniorityLabel(profile.npk, seniorityCutoffs.senior, seniorityCutoffs.junior);
        const riskScore =
          Math.max(0, -profile.vsTeamAvg) +
          Math.max(0, -profile.vsPeerAvg) +
          (profile.trend.direction === 'down' ? 0.25 : 0) +
          (seniority === 'Senior' && profile.vsPeerAvg < 0 ? 0.15 : 0);

        return { profile, weakMetric, mentor, latest, seniority, riskScore };
      })
      .filter((item) => item.riskScore > 0)
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 5);
  }, [technicians, seniorityCutoffs]);

  const roleModels = useMemo(() => {
    return [...technicians]
      .filter((p) => p.vsTeamAvg > 0 && p.vsPeerAvg > 0)
      .sort((a, b) => b.avgTotalOverall - a.avgTotalOverall)
      .slice(0, 5);
  }, [technicians]);

  return (
    <div className="glass rounded-xl overflow-hidden animate-fadeIn">
      <div className="px-6 py-4 border-b border-slate-700/50">
        <h2 className="text-lg font-bold text-white">Operational Insight</h2>
        <p className="mt-1 text-xs text-slate-500">
          Analisa otomatis berbasis gap KPI, benchmark tim/peer, dan seniority dari NPK.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 p-4">
        <section className="rounded-xl border border-red-500/10 bg-red-500/5 p-4">
          <div className="mb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">Tim Prioritas</h3>
            <p className="text-xs text-red-300">Kenapa tim lebih rendah dibanding benchmark.</p>
          </div>
          <div className="space-y-3">
            {priorityTeams.map(({ profile, weakest, customerCons }) => (
              <button
                key={profile.mpg}
                onClick={() => setSelectedTeam(profile.mpg)}
                className="w-full rounded-lg border border-slate-800/60 bg-slate-950/40 p-3 text-left hover:border-red-500/30 hover:bg-slate-900/70 transition-all"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-white">MPG {profile.mpg}</p>
                  <span className="font-mono text-sm text-red-300">{profile.avgTotalOverall.toFixed(2)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Weakest KPI: <span className="text-slate-200">{weakest ? cleanMetricName(weakest.metric) : '-'}</span>
                  {weakest ? ` (${weakest.deltaFromMean.toFixed(2)} vs benchmark)` : ''}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">{teamDiagnosis(profile)}</p>
                {customerCons.length > 0 && (
                  <p className="mt-2 text-[11px] text-red-300">
                    Customer risk: {customerCons.slice(0, 2).map((item) => cleanMetricName(item.metric)).join(', ')}
                  </p>
                )}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-amber-500/10 bg-amber-500/5 p-4">
          <div className="mb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">Teknisi Coaching</h3>
            <p className="text-xs text-amber-300">Prioritas dari gap vs tim, peer, dan KPI customer-facing.</p>
          </div>
          <div className="space-y-3">
            {coachingTargets.map(({ profile, weakMetric, mentor, latest, seniority }) => (
              <button
                key={profile.npk}
                onClick={() => {
                  setSelectedIndividual(profile.npk);
                  setActiveTab('individual');
                }}
                className="w-full rounded-lg border border-slate-800/60 bg-slate-950/40 p-3 text-left hover:border-amber-500/30 hover:bg-slate-900/70 transition-all"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{profile.nama}</p>
                    <p className="text-[11px] font-mono text-slate-500">
                      NPK {profile.npk} · {seniority} · {latest?.mpg ?? '-'} / {latest?.loc ?? '-'}
                    </p>
                  </div>
                  <span className="font-mono text-sm text-amber-300">{profile.avgTotalOverall.toFixed(2)}</span>
                </div>
                <p className="mt-2 text-xs text-slate-300">
                  Gap vs tim {profile.vsTeamAvg.toFixed(2)}, vs peer {profile.vsPeerAvg.toFixed(2)}.
                  Fokus: <span className="text-slate-100">{weakMetric ? cleanMetricName(weakMetric) : 'KPI total'}</span>.
                </p>
                <p className="mt-1 text-[11px] text-amber-300">
                  Pairing: {mentor ? `${mentor.nama} (${getLatestHistory(mentor)?.loc ?? '-'})` : 'cari role model di tim/Loc terkait'}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-4">
          <div className="mb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">Role Model</h3>
            <p className="text-xs text-emerald-300">Kandidat mentor operasional per Loc/SERPO.</p>
          </div>
          <div className="space-y-3">
            {roleModels.map((profile) => {
              const latest = getLatestHistory(profile);
              const individualPros = individualMetricItems(profile.pros);
              const bestMetric = individualPros.find((item) => isCustomerFacing(item.metric)) ?? individualPros[0];
              const seniority = getSeniorityLabel(profile.npk, seniorityCutoffs.senior, seniorityCutoffs.junior);

              return (
                <button
                  key={profile.npk}
                  onClick={() => {
                    setSelectedIndividual(profile.npk);
                    setActiveTab('individual');
                  }}
                  className="w-full rounded-lg border border-slate-800/60 bg-slate-950/40 p-3 text-left hover:border-emerald-500/30 hover:bg-slate-900/70 transition-all"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{profile.nama}</p>
                      <p className="text-[11px] font-mono text-slate-500">
                        NPK {profile.npk} · {seniority} · {latest?.mpg ?? '-'} / {latest?.loc ?? '-'}
                      </p>
                    </div>
                    <span className="font-mono text-sm text-emerald-300">{profile.avgTotalOverall.toFixed(2)}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-300">
                    Kuat di <span className="text-slate-100">{bestMetric ? cleanMetricName(bestMetric.metric) : 'TOTAL'}</span>,
                    unggul vs tim {profile.vsTeamAvg.toFixed(2)} dan vs peer {profile.vsPeerAvg.toFixed(2)}.
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
