import { useState, useCallback } from 'react';
import { useDashboardStore } from '../../store/useDashboardStore';
import { ValidationSummary } from './ValidationSummary';
import { LoadingState } from '../common/LoadingState';
import { SqlServerPanel } from './SqlServerPanel';

const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

export function UploadPanel() {
  const [isDragging, setIsDragging] = useState(false);
  const [source, setSource] = useState<'excel' | 'sqlserver'>('excel');
  const [fileError, setFileError] = useState<string | null>(null);
  const uploadStatus = useDashboardStore((s) => s.uploadStatus);
  const validation = useDashboardStore((s) => s.validation);
  const loadFile = useDashboardStore((s) => s.loadFile);
  const reset = useDashboardStore((s) => s.reset);

  const validateFile = useCallback((file: File): boolean => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setFileError(
        `Format file "${ext}" tidak didukung. Gunakan file .xlsx, .xls, atau .csv`
      );
      return false;
    }
    setFileError(null);
    return true;
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      if (validateFile(file)) {
        loadFile(file);
      }
    },
    [validateFile, loadFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const isLoading = uploadStatus === 'loading' || uploadStatus === 'validating';

  if (source === 'sqlserver') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
        <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center">
          <div className="glass w-full rounded-2xl p-8 shadow-2xl shadow-violet-500/5">
            <button type="button" onClick={() => setSource('excel')} className="mb-6 text-sm text-slate-400 hover:text-white">
              ← Kembali ke upload Excel
            </button>
            <SqlServerPanel />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-xl animate-fadeIn">
        <div className="glass rounded-2xl p-8 shadow-2xl shadow-violet-500/5">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold gradient-text mb-2">
              iScore Analytics
            </h1>
            <p className="text-slate-400 text-lg font-medium">
              MPG Team Profiling Dashboard
            </p>
            <p className="text-slate-500 text-sm mt-2">
              Upload file scoring (.xlsx) untuk menganalisis performa tim
            </p>
          </div>

          <button
            type="button"
            onClick={() => setSource('sqlserver')}
            className="mb-5 w-full rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-medium text-cyan-200 transition-colors hover:border-cyan-400/60 hover:bg-cyan-500/20"
          >
            Tarik data dari MS SQL Server
          </button>

          {isLoading ? (
            <LoadingState
              message={
                uploadStatus === 'loading'
                  ? 'Membaca file...'
                  : 'Memvalidasi data...'
              }
            />
          ) : uploadStatus === 'error' && validation ? (
            <div className="space-y-4">
              <ValidationSummary validation={validation} />
              <button
                onClick={reset}
                className="w-full py-3 rounded-xl bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 transition-colors font-medium"
              >
                ← Upload File Lain
              </button>
            </div>
          ) : (
            <>
              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`
                  relative border-2 border-dashed rounded-xl p-12 text-center
                  transition-all duration-300 cursor-pointer group
                  ${
                    isDragging
                      ? 'border-violet-500 bg-violet-500/10 scale-[1.02]'
                      : 'border-slate-600/50 hover:border-violet-500/50 hover:bg-slate-800/30'
                  }
                `}
                onClick={() =>
                  document.getElementById('file-input')?.click()
                }
              >
                <input
                  id="file-input"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleInputChange}
                  className="hidden"
                />

                {/* Icon */}
                <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <svg className="w-8 h-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>

                <p className="text-slate-300 font-medium mb-1">
                  {isDragging ? 'Lepaskan file di sini' : 'Seret file ke sini atau'}
                </p>

                {!isDragging && (
                  <button
                    type="button"
                    className="mt-3 px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-medium
                      hover:from-violet-500 hover:to-cyan-500 transition-all shadow-lg shadow-violet-500/25
                      active:scale-95"
                    onClick={(e) => {
                      e.stopPropagation();
                      document.getElementById('file-input')?.click();
                    }}
                  >
                    Browse File
                  </button>
                )}

                <p className="text-slate-500 text-xs mt-4">
                  Format: .xlsx, .xls, .csv
                </p>
              </div>

              {/* File error */}
              {fileError && (
                <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {fileError}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-slate-600 text-xs">
              Semua data diproses di browser Anda — tidak ada file yang dikirim ke server
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
