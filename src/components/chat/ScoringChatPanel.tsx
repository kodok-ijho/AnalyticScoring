import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { askScoringAi, type ChatMessage, isChatConfigured } from '../../lib/scoringChat';
import { useDashboardStore } from '../../store/useDashboardStore';

interface Props {
  onClose: () => void;
}

const SUGGESTED_QUESTIONS = [
  'Tim mana yang performanya paling anjlok dan apa akar masalahnya?',
  'Siapa personil yang memiliki anomali mutasi atau lonjakan skor ekstrim?',
  'Jelaskan karakteristik 4 kluster segmen personil yang terbentuk.',
  'Siapa personil di watchlist yang paling butuh intervensi segera?',
];

const CHAT_SESSION_KEY = 'iscore-scoring-chat-messages';
const INITIAL_MESSAGE: ChatMessage = {
  role: 'assistant',
  content:
    'Halo, saya siap membantu menganalisis data scoring secara diagnostik. Tanyakan apa saja mengenai performa tim, anomali mutasi, kluster personil, atau metrik yang perlu perbaikan.',
};

function loadSessionMessages(): ChatMessage[] {
  try {
    const saved = sessionStorage.getItem(CHAT_SESSION_KEY);
    if (!saved) return [INITIAL_MESSAGE];

    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [INITIAL_MESSAGE];

    const messages = parsed.filter(
      (message): message is ChatMessage =>
        Boolean(message) &&
        typeof message === 'object' &&
        ((message as ChatMessage).role === 'user' || (message as ChatMessage).role === 'assistant') &&
        typeof (message as ChatMessage).content === 'string'
    );

    return messages.length > 0 ? messages : [INITIAL_MESSAGE];
  } catch {
    return [INITIAL_MESSAGE];
  }
}

export function ScoringChatPanel({ onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(loadSessionMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeToolName, setActiveToolName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const sheetName = useDashboardStore((s) => s.sheetName);
  const filteredRows = useDashboardStore((s) => s.filteredRows);
  const filters = useDashboardStore((s) => s.filters);
  const availablePeriods = useDashboardStore((s) => s.availablePeriods);
  const filteredProfiles = useDashboardStore((s) => s.filteredProfiles);
  const filteredIndividualProfiles = useDashboardStore((s) => s.filteredIndividualProfiles);
  const clusters = useDashboardStore((s) => s.clusters);
  const anomalyAnalysis = useDashboardStore((s) => s.anomalyAnalysis);
  const csmCorrelation = useDashboardStore((s) => s.csmCorrelation);
  const locationBreakdownLoc = useDashboardStore((s) => s.locationBreakdownLoc);
  const locationBreakdownType = useDashboardStore((s) => s.locationBreakdownType);

  const context = useMemo(
    () => ({
      sheetName,
      rowCount: filteredRows.length,
      filters,
      availablePeriods,
      teams: filteredProfiles,
      individuals: filteredIndividualProfiles,
      clusters,
      anomalies: anomalyAnalysis,
      csmCorrelation,
      locationBreakdownLoc,
      locationBreakdownType,
      filteredRows,
    }),
    [
      sheetName,
      filteredRows,
      filters,
      availablePeriods,
      filteredProfiles,
      filteredIndividualProfiles,
      clusters,
      anomalyAnalysis,
      csmCorrelation,
      locationBreakdownLoc,
      locationBreakdownType,
    ]
  );

  const configured = isChatConfigured();

  useEffect(() => {
    try {
      sessionStorage.setItem(CHAT_SESSION_KEY, JSON.stringify(messages));
    } catch {
      // Sesi tetap bisa digunakan walau penyimpanan browser tidak tersedia.
    }
  }, [messages]);

  const submitQuestion = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || isLoading) return;

    setError(null);
    setInput('');
    setActiveToolName(null);

    const historyForApi = messages.filter((message) => message.content.trim().length > 0);
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setIsLoading(true);

    try {
      const answer = await askScoringAi({
        question: trimmed,
        history: historyForApi,
        context,
        onExecutingTool: (toolName) => {
          setActiveToolName(toolName);
        },
      });

      setMessages((current) => [...current, { role: 'assistant', content: answer }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: 'Maaf, sistem analisis AI belum dapat menjawab saat ini. Pastikan konfigurasi API key valid di file .env.',
        },
      ]);
    } finally {
      setIsLoading(false);
      setActiveToolName(null);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitQuestion(input);
  };

  const toolLabels: Record<string, string> = {
    query_top_bottom_performers: 'Mengevaluasi ranking & tren performa...',
    query_individual_profile: 'Mencari rekam jejak personil...',
    query_team_profile: 'Mengambil rincian tim MPG...',
    query_anomalies: 'Mendeteksi anomali statistik...',
    query_clusters: 'Menganalisis kluster segmen...',
    query_mutation_impacts: 'Mengukur dampak mutasi kerja...',
    query_branch_comparison: 'Membandingkan data cabang...',
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col border-l border-slate-700/70 bg-slate-950 shadow-2xl shadow-black/70 animate-slideInRight">
        <header className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <h2 className="text-base font-bold text-white">AI Scoring Copilot</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Analisis diagnostik manajerial interaktif berbasis data live
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-400 transition-colors hover:border-cyan-500/50 hover:bg-cyan-500/10 hover:text-white"
            aria-label="Tutup chat"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        {!configured && (
          <div className="border-b border-amber-500/20 bg-amber-500/10 px-5 py-3 text-xs leading-relaxed text-amber-200">
            Konfigurasi AI belum lengkap. Isi <span className="font-mono">VITE_AI_CHAT_ENDPOINT</span> dan
            <span className="font-mono"> VITE_AI_CHAT_API_KEY</span> di file <span className="font-mono">.env</span>, lalu jalankan ulang aplikasi.
          </div>
        )}

        <div className="border-b border-slate-800 px-5 py-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Pertanyaan Analitik Cepat
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_QUESTIONS.map((question) => (
              <button
                key={question}
                onClick={() => void submitQuestion(question)}
                disabled={isLoading}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-left text-xs text-slate-300 transition-colors hover:border-cyan-500/50 hover:bg-cyan-500/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {question}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[88%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                    : 'border border-slate-800 bg-slate-900/90 text-slate-200 shadow-sm'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-xl border border-cyan-500/30 bg-slate-900 px-4 py-2.5 text-xs text-cyan-300 flex items-center gap-2.5 shadow-md">
                <svg className="w-4 h-4 animate-spin text-cyan-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>
                  {activeToolName
                    ? (toolLabels[activeToolName] || `Menjalankan kueri: ${activeToolName}...`)
                    : 'Menganalisis data scoring...'}
                </span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="border-t border-red-500/20 bg-red-500/10 px-5 py-2 text-xs text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="border-t border-slate-800 p-4">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void submitQuestion(input);
                }
              }}
              placeholder="Tanyakan analisis tajam terkait tim, individu, mutasi, atau metrik..."
              className="flex-1 resize-none rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center self-end h-10"
            >
              Kirim
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
