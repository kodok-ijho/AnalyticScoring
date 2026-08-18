import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { askScoringAi, type ChatMessage, isChatConfigured } from '../../lib/scoringChat';
import { useDashboardStore } from '../../store/useDashboardStore';

interface Props {
  onClose: () => void;
}

const SUGGESTED_QUESTIONS = [
  'Tim mana yang paling perlu diperhatikan bulan ini?',
  'Apa penyebab utama performa tim bawah rendah?',
  'Siapa personil watchlist yang perlu coaching duluan?',
  'Bandingkan tim terbaik dan tim yang paling lemah.',
];

const CHAT_SESSION_KEY = 'iscore-scoring-chat-messages';
const INITIAL_MESSAGE: ChatMessage = {
  role: 'assistant',
  content:
    'Halo, saya bisa bantu membaca data scoring ini. Tanyakan misalnya tim mana yang perlu perhatian, personil mana yang perlu coaching, atau metrik apa yang paling lemah.',
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
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const sheetName = useDashboardStore((s) => s.sheetName);
  const filteredRows = useDashboardStore((s) => s.filteredRows);
  const filters = useDashboardStore((s) => s.filters);
  const availablePeriods = useDashboardStore((s) => s.availablePeriods);
  const filteredProfiles = useDashboardStore((s) => s.filteredProfiles);
  const filteredIndividualProfiles = useDashboardStore((s) => s.filteredIndividualProfiles);
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
      csmCorrelation,
      locationBreakdownLoc,
      locationBreakdownType,
    }),
    [
      sheetName,
      filteredRows.length,
      filters,
      availablePeriods,
      filteredProfiles,
      filteredIndividualProfiles,
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

    const historyForApi = messages.filter((message) => message.content.trim().length > 0);
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setIsLoading(true);

    try {
      const answer = await askScoringAi({
        question: trimmed,
        history: historyForApi,
        context,
      });

      setMessages((current) => [...current, { role: 'assistant', content: answer }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: 'Maaf, chat AI belum bisa menjawab sekarang. Cek konfigurasi endpoint/API key atau coba lagi nanti.',
        },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitQuestion(input);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col border-l border-slate-700/70 bg-slate-950 shadow-2xl shadow-black/70 animate-slideInRight">
        <header className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-white">Chat dengan Scoring</h2>
            <p className="text-xs text-slate-500">
              Tanya pakai bahasa biasa berdasarkan data yang sedang terfilter
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
            <span className="font-mono"> VITE_AI_CHAT_API_KEY</span>, lalu jalankan ulang aplikasi.
          </div>
        )}

        <div className="border-b border-slate-800 px-5 py-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Contoh pertanyaan
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((question) => (
              <button
                key={question}
                onClick={() => void submitQuestion(question)}
                disabled={isLoading}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-left text-xs text-slate-300 transition-colors hover:border-violet-500/50 hover:bg-violet-500/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
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
                className={`max-w-[86%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                  message.role === 'user'
                    ? 'bg-cyan-600 text-white'
                    : 'border border-slate-800 bg-slate-900 text-slate-200'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-400">
                Sedang membaca data scoring...
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
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void submitQuestion(input);
                }
              }}
              rows={2}
              placeholder="Tanya sesuatu dari data scoring..."
              className="min-h-[44px] flex-1 resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-500/70"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-600 text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
              aria-label="Kirim pertanyaan"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
