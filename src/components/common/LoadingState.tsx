interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Memproses...' }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 animate-fadeIn">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-slate-700 rounded-full" />
        <div className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-violet-500 rounded-full animate-spin" />
      </div>
      <div className="flex gap-1 mt-6">
        <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <p className="mt-4 text-slate-400 text-sm font-medium">{message}</p>
    </div>
  );
}
