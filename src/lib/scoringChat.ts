import type {
  ChatMessage,
  ScoringChatFullContext,
} from './scoringChatTools';
import {
  SCORING_CHAT_TOOLS,
  executeScoringTool,
} from './scoringChatTools';

export type { ChatMessage } from './scoringChatTools';

export interface ChatRequest {
  question: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  context: ScoringChatFullContext;
  onExecutingTool?: (toolName: string) => void;
}

const DEFAULT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

function normalizeEndpoint(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (!trimmed) return DEFAULT_ENDPOINT;
  if (trimmed.endsWith('/chat/completions') || trimmed.endsWith('/completions')) {
    return trimmed;
  }
  return `${trimmed}/chat/completions`;
}

const rawEndpoint = import.meta.env.VITE_AI_CHAT_ENDPOINT || DEFAULT_ENDPOINT;
const chatEndpoint = normalizeEndpoint(rawEndpoint);
const chatApiKey = import.meta.env.VITE_AI_CHAT_API_KEY || '';
const chatModel = import.meta.env.VITE_AI_CHAT_MODEL || '';


function formatScore(value: number | undefined): string {
  return value === undefined ? '-' : value.toFixed(2);
}

function buildSeniorOpsSystemPrompt(context: ScoringChatFullContext): string {
  return [
    'Kamu adalah Senior Operations & Service Performance Lead untuk operasional servis lapangan (CSM, CE, SPS).',
    'Tugasmu adalah memberikan analisis diagnostik yang TAJAM, PRAKTIS, dan MENGUNGKAPKAN AKAR MASALAH (root cause) dari data scoring.',
    '',
    '### PEDOMAN GAYA BAHASA & KOMUNIKASI (SANGAT PENTING):',
    '1. ANTI-AI CLICHE (DILARANG MENGGUNAKAN BAHASA KAKU ROBOT):',
    '   - DILARANG menggunakan kata pembuka klise seperti: "Berdasarkan data yang diberikan...", "Tentu, berikut analisis mendalam...", "Halo! Saya akan menganalisis...", "Berikut adalah beberapa poin...".',
    '   - DILARANG menggunakan jargon hampa: "perlu sinergi optimal", "maksimalkan efisiensi secara holistik", "tingkatkan potensi".',
    '   - Gunakan bahasa Indonesia lugas, profesional, dan mengalir natural seperti diskusi manajerial antar pimpinan operasional.',
    '',
    '2. BOTTOM-LINE FIRST (LANGSUNG KE INTI TEMUAN):',
    '   - Buka kalimat pertama langsung dengan temuan paling krusial.',
    '   - Contoh: "Masalah utama di Tim A1 bukan karena teknisi lambat melayani pelanggan, melainkan tertahan di administrasi MoP dan keterlambatan retur part pasca rotasi cabang."',
    '',
    '3. BEDAKAN KOMPETENSI SKILL VS KENDALA LINGKUNGAN/LOGISTIK:',
    '   - Jika seorang teknisi memiliki CSAT/FirstVisit bagus tapi skor totalnya rendah, jelaskan bahwa keahlian teknisnya solid namun terbebani kepatuhan administrasi atau logistik lokal.',
    '   - Jika performa anjlok setelah mutasi (mutation drift), soroti faktor adaptasi wilayah baru atau supervisi lokal sebelum menyalahkan personel.',
    '',
    '4. REKOMENDASI OPERASIONAL KONKRET:',
    '   - Berikan rekomendasi yang bisa langsung dieksekusi (misal: "Jadwalkan rekonsiliasi part bekas tiap Jumat pagi" atau "Dampingi pengisian MoP di 3 hari pertama bulan berjalan").',
    '',
    '5. GUNAKAN TOOL UNTUK MENGAMBIL DATA DETAIL:',
    '   - Kamu dibekali tools fungsi lokal (query_top_bottom_performers, query_individual_profile, query_team_profile, query_anomalies, query_clusters, query_mutation_impacts, query_branch_comparison).',
    '   - Gunakan tool tersebut untuk mengambil angka riil dan bukti spesifik sebelum menjawab pertanyaan pengguna.',
    '',
    `INFORMASI DATA DASHBOARD SAAT INI:`,
    `- Sumber Data: ${context.sheetName} (${context.rowCount.toLocaleString()} baris)`,
    `- Periode Tersedia: ${context.availablePeriods.join(', ')}`,
    `- Jumlah Tim Aktif: ${context.teams.length}, Jumlah Personil: ${context.individuals.length}`,
    `- Jumlah Anomali Statistik Terdeteksi: ${context.anomalies?.anomalies.length ?? 0}`,
    `- Jumlah Kluster Perilaku (K-Means): ${context.clusters.length}`,
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

  const text =
    data.choices?.[0]?.message?.content ||
    data.choices?.[0]?.text ||
    data.output_text ||
    data.response ||
    data.answer ||
    data.content ||
    '';

  return text
    .replace(/\*\*/g, '')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/<\/?strong>/gi, '')
    .trim();
}

export function isChatConfigured(): boolean {
  return Boolean(chatEndpoint && (chatEndpoint.startsWith('/') || chatApiKey));
}

/**
 * Fallback query without tool calling (static prompt mode).
 */
async function fallbackStandardChat(
  question: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  context: ScoringChatFullContext
): Promise<string> {
  const topTeams = [...context.teams].sort((a, b) => a.rank - b.rank).slice(0, 5);
  const bottomTeams = [...context.teams].sort((a, b) => b.rank - a.rank).slice(0, 5);
  const watchlist = context.individuals.filter((p) => p.status === 'watchlist').slice(0, 8);
  const topPerfs = context.individuals.filter((p) => p.status === 'top_performer').slice(0, 8);
  const anomalies = context.anomalies?.anomalies.slice(0, 6) ?? [];

  const summary = JSON.stringify({
    timTerbaik: topTeams.map((t) => ({ mpg: t.mpg, skor: formatScore(t.avgTotalOverall), tren: t.trend })),
    timPerluPerhatian: bottomTeams.map((t) => ({ mpg: t.mpg, skor: formatScore(t.avgTotalOverall), tren: t.trend })),
    watchlistPersonil: watchlist.map((w) => ({ npk: w.npk, nama: w.nama, skor: formatScore(w.avgTotalOverall), tren: w.trend })),
    topPerformers: topPerfs.map((tp) => ({ npk: tp.npk, nama: tp.nama, skor: formatScore(tp.avgTotalOverall) })),
    anomaliKritis: anomalies.map((a) => ({ nama: a.nama, judul: a.title, deskripsi: a.description })),
  }, null, 2);

  const messages = [
    { role: 'system', content: `${buildSeniorOpsSystemPrompt(context)}\n\nDATA RINGKASAN:\n${summary}` },
    ...history.slice(-6),
    { role: 'user', content: question },
  ];

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (chatApiKey) headers.Authorization = `Bearer ${chatApiKey}`;

  const response = await fetch(chatEndpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: chatModel || undefined,
      messages,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(err || `AI mengembalikan status ${response.status}`);
  }

  const payload = await response.json();
  return extractAiText(payload);
}

/**
 * Main AI Query Engine with Multi-Turn Tool Calling.
 */
export async function askScoringAi({
  question,
  history,
  context,
  onExecutingTool,
}: ChatRequest): Promise<string> {
  if (!isChatConfigured()) {
    throw new Error(
      'Konfigurasi AI belum lengkap. Isi VITE_AI_CHAT_ENDPOINT dan VITE_AI_CHAT_API_KEY di file .env terlebih dahulu.'
    );
  }

  const systemMessage = { role: 'system', content: buildSeniorOpsSystemPrompt(context) };
  const recentHistory = history.slice(-6).map((h) => ({ role: h.role, content: h.content }));

  const messages: unknown[] = [
    systemMessage,
    ...recentHistory,
    { role: 'user', content: question },
  ];

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (chatApiKey) {
    headers.Authorization = `Bearer ${chatApiKey}`;
  }

  let loopCount = 0;
  const maxLoops = 3;

  while (loopCount < maxLoops) {
    loopCount++;

    let response: Response;
    try {
      response = await fetch(chatEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: chatModel || undefined,
          messages,
          tools: SCORING_CHAT_TOOLS,
          tool_choice: 'auto',
          temperature: 0.2,
        }),
      });
    } catch {
      // Network failure on tools endpoint -> attempt fallback
      return fallbackStandardChat(question, history, context);
    }

    if (!response.ok) {
      // If endpoint doesn't support tools (HTTP 400), seamlessly fallback to standard mode
      if (response.status === 400 || response.status === 422) {
        return fallbackStandardChat(question, history, context);
      }
      const errorText = await response.text().catch(() => '');
      throw new Error(errorText || `AI mengembalikan status ${response.status}.`);
    }

    const payload = await response.json();
    const choice = payload?.choices?.[0];
    const message = choice?.message;

    if (!message) {
      const text = extractAiText(payload);
      if (text) return text;
      throw new Error('Respons AI kosong atau format tidak dikenali.');
    }

    // Check if LLM requested tool calls
    if (message.tool_calls && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
      // Append assistant's tool_call request message
      messages.push(message);

      for (const toolCall of message.tool_calls) {
        const toolName = toolCall.function?.name;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.function?.arguments || '{}');
        } catch {
          args = {};
        }

        if (onExecutingTool) {
          onExecutingTool(toolName);
        }

        const toolResult = executeScoringTool(toolName, args, context);

        // Append tool result message
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolName,
          content: toolResult,
        });
      }

      // Continue the loop to get final answer from LLM with tool data
      continue;
    }

    // If no tool call, this is the final answer
    const finalContent = message.content || extractAiText(payload);
    if (!finalContent) {
      return fallbackStandardChat(question, history, context);
    }

    return finalContent
      .replace(/\*\*/g, '')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/<\/?strong>/gi, '')
      .trim();
  }

  // If reached max loops, do a final standard fallback
  return fallbackStandardChat(question, history, context);
}
