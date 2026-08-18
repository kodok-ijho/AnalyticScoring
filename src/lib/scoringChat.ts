import type {
  CsmSubordinateCorrelation,
  FilterState,
  IndividualProfile,
  LocationBreakdown,
  TeamProfile,
} from '../types';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ScoringChatContext {
  sheetName: string;
  rowCount: number;
  filters: FilterState;
  availablePeriods: string[];
  teams: TeamProfile[];
  individuals: IndividualProfile[];
  csmCorrelation: CsmSubordinateCorrelation | null;
  locationBreakdownLoc: LocationBreakdown | null;
  locationBreakdownType: LocationBreakdown | null;
}

interface ChatRequest {
  question: string;
  history: ChatMessage[];
  context: ScoringChatContext;
}

const DEFAULT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

const chatEndpoint = import.meta.env.VITE_AI_CHAT_ENDPOINT || DEFAULT_ENDPOINT;
const chatApiKey = import.meta.env.VITE_AI_CHAT_API_KEY || '';
const chatModel = import.meta.env.VITE_AI_CHAT_MODEL || '';

function formatPercent(value: number | undefined): string {
  return value === undefined ? '-' : `${value.toFixed(1)}%`;
}

function formatScore(value: number | undefined): string {
  return value === undefined ? '-' : value.toFixed(2);
}

function summarizeTeam(profile: TeamProfile): Record<string, string | number> {
  const last = profile.periodStats[profile.periodStats.length - 1];
  return {
    mpg: profile.mpg,
    rank: profile.rank,
    avgTotal: formatScore(profile.avgTotalOverall),
    avgCsm: formatScore(profile.avgTotalCsmOverall),
    avgTeknisi: formatScore(profile.avgTotalAnggotaOverall),
    trend: `${profile.trend.direction} ${profile.trend.deltaPct.toFixed(1)}%`,
    stabilitas: profile.volatility.toFixed(3),
    anggotaTerakhir: last?.memberCount ?? 0,
    lokasiTerakhir: last ? `HO ${formatPercent(last.pctHO)}, SERPO ${formatPercent(last.pctSERPO)}` : '-',
    kekuatan: profile.pros.slice(0, 3).map((p) => p.metric).join(', ') || '-',
    perluDiperbaiki: profile.cons.slice(0, 3).map((c) => c.metric).join(', ') || '-',
  };
}

function summarizeIndividual(profile: IndividualProfile): Record<string, string | number> {
  const latest = profile.history[profile.history.length - 1];
  return {
    nama: profile.nama,
    npk: profile.npk,
    jabatan: profile.jabatanUtama,
    timTerakhir: latest?.mpg ?? '-',
    lokasiTerakhir: latest?.loc ?? '-',
    rankJabatan: profile.rankInPeerGroup,
    avgTotal: formatScore(profile.avgTotalOverall),
    status: profile.status,
    trend: `${profile.trend.direction} ${profile.trend.deltaPct.toFixed(1)}%`,
    stabilitas: profile.volatility.toFixed(3),
    vsTim: formatScore(profile.vsTeamAvg),
    vsJabatan: formatScore(profile.vsPeerAvg),
    mutasi: profile.hasMutasi ? 'ya' : 'tidak',
    kekuatan: profile.pros.slice(0, 3).map((p) => p.metric).join(', ') || '-',
    perluDiperbaiki: profile.cons.slice(0, 3).map((c) => c.metric).join(', ') || '-',
  };
}

function summarizeLocations(breakdown: LocationBreakdown | null): Record<string, string | number>[] {
  if (!breakdown) return [];

  return breakdown.rows.slice(0, 8).map((row) => ({
    lokasi: row.key,
    avgTotal: formatScore(row.avgTotal),
    jumlahData: row.n,
    catatan: row.isSmallSample ? 'data sedikit' : 'data cukup',
  }));
}

function buildContextSummary(context: ScoringChatContext): string {
  const topTeams = [...context.teams].sort((a, b) => a.rank - b.rank).slice(0, 8);
  const bottomTeams = [...context.teams].sort((a, b) => b.rank - a.rank).slice(0, 8);
  const topIndividuals = [...context.individuals]
    .sort((a, b) => b.avgTotalOverall - a.avgTotalOverall)
    .slice(0, 10);
  const watchlist = context.individuals
    .filter((p) => p.status === 'watchlist')
    .sort((a, b) => a.avgTotalOverall - b.avgTotalOverall)
    .slice(0, 10);

  return JSON.stringify(
    {
      sumberData: {
        sheetName: context.sheetName,
        jumlahBaris: context.rowCount,
        periode: context.availablePeriods,
        filterAktif: context.filters,
        jumlahTimTerfilter: context.teams.length,
        jumlahPersonilTerfilter: context.individuals.length,
      },
      ringkasanTim: {
        terbaik: topTeams.map(summarizeTeam),
        perluPerhatian: bottomTeams.map(summarizeTeam),
      },
      ringkasanPersonil: {
        topPerformer: topIndividuals.map(summarizeIndividual),
        watchlist: watchlist.map(summarizeIndividual),
      },
      korelasiCsmTeknisi: context.csmCorrelation
        ? {
            nilaiKorelasi: context.csmCorrelation.pearsonR.toFixed(3),
            jumlahTitikData: context.csmCorrelation.n,
            interpretasi: context.csmCorrelation.interpretation,
          }
        : null,
      rankingLokasi: {
        loc: summarizeLocations(context.locationBreakdownLoc),
        tipeLokasi: summarizeLocations(context.locationBreakdownType),
      },
    },
    null,
    2
  );
}

function buildSystemPrompt(context: ScoringChatContext): string {
  return [
    'Kamu adalah asisten analisis iScore untuk pengguna Indonesia.',
    'Jawab dengan bahasa Indonesia yang sederhana, natural, dan mudah dipahami orang awam.',
    'Gunakan hanya data scoring yang diberikan sebagai konteks. Jangan mengarang angka, nama, peringkat, atau periode yang tidak ada di konteks.',
    'Jika data tidak cukup, jelaskan bagian yang belum tersedia dan sarankan cara membaca data yang ada.',
    'Fokus pada insight operasional: siapa/tim mana yang kuat, mana yang perlu perhatian, penyebab yang mungkin terlihat dari metrik, dan langkah perbaikan yang praktis.',
    'Gunakan teks biasa tanpa Markdown atau HTML. Jangan gunakan penanda teks tebal/miring, judul Markdown, backtick, atau tag HTML untuk menebalkan teks.',
    'Jangan menyebut bahwa kamu menerima JSON kecuali pengguna memintanya.',
    '',
    'Konteks data scoring saat ini:',
    buildContextSummary(context),
  ].join('\n');
}

function extractAiText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const data = payload as {
    choices?: { message?: { content?: string }; text?: string }[];
    output_text?: string;
    response?: string;
    answer?: string;
    content?: string;
  };

  const text = (
    data.choices?.[0]?.message?.content ||
    data.choices?.[0]?.text ||
    data.output_text ||
    data.response ||
    data.answer ||
    data.content ||
    ''
  );

  return text
    .replace(/\*\*/g, '')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/<\/?strong>/gi, '')
    .trim();
}

export function isChatConfigured(): boolean {
  return Boolean(chatEndpoint && (chatEndpoint.startsWith('/') || chatApiKey));
}

export async function askScoringAi({ question, history, context }: ChatRequest): Promise<string> {
  if (!isChatConfigured()) {
    throw new Error('Konfigurasi AI belum lengkap. Isi VITE_AI_CHAT_ENDPOINT dan VITE_AI_CHAT_API_KEY terlebih dahulu.');
  }

  const recentHistory = history.slice(-8);
  const body = {
    model: chatModel || undefined,
    messages: [
      { role: 'system', content: buildSystemPrompt(context) },
      ...recentHistory,
      { role: 'user', content: question },
    ],
    temperature: 0.2,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (chatApiKey) {
    headers.Authorization = `Bearer ${chatApiKey}`;
  }

  const response = await fetch(chatEndpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || `AI mengembalikan status ${response.status}.`);
  }

  const payload = await response.json();
  const text = extractAiText(payload).trim();

  if (!text) {
    throw new Error('Respons AI kosong atau format respons tidak dikenali.');
  }

  return text;
}
