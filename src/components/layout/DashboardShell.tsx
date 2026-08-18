import { useState } from 'react';
import { useDashboardStore } from '../../store/useDashboardStore';
import { FilterBar } from './FilterBar';
import { TeamRankingTable } from '../ranking/TeamRankingTable';
import { TeamTrendChart } from '../trend/TeamTrendChart';
import { MetricHeatmap } from '../heatmap/MetricHeatmap';
import { SizeVsPerformanceChart } from '../composition/SizeVsPerformanceChart';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { ScoringChatPanel } from '../chat/ScoringChatPanel';

import { IndividualSearchBox } from '../individual/IndividualSearchBox';
import { IndividualRankingTable } from '../individual/IndividualRankingTable';
import { ContextEffectPanel } from '../individual/ContextEffectPanel';
import { ClusterSegmentPanel } from '../individual/ClusterSegmentPanel';
import { WatchlistPanel } from '../individual/WatchlistPanel';

import { TopPerformerPanel } from '../individual/TopPerformerPanel';
import { JabatanComparisonView } from '../jabatan/JabatanComparisonView';
import { CEvsSPSPanel } from '../jabatan/CEvsSPSPanel';
import { CsmSubordinateScatter } from '../correlation/CsmSubordinateScatter';
import { LocationRankingTable } from '../correlation/LocationRankingTable';

export function DashboardShell() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const sheetName = useDashboardStore((s) => s.sheetName);
  const dataSource = useDashboardStore((s) => s.dataSource);
  const reset = useDashboardStore((s) => s.reset);
  const normalizedRows = useDashboardStore((s) => s.normalizedRows);
  const filteredRows = useDashboardStore((s) => s.filteredRows);
  const validation = useDashboardStore((s) => s.validation);

  const activeTab = useDashboardStore((s) => s.activeTab);
  const setActiveTab = useDashboardStore((s) => s.setActiveTab);

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-slate-700/50">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold gradient-text">iScore Analytics</h1>
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700/50">
                {sheetName}
              </span>
              {dataSource?.kind === 'sqlserver' && (
                <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                  SQL Server
                </span>
              )}
              <span>•</span>
              <span>{filteredRows.length.toLocaleString()} / {normalizedRows.length.toLocaleString()} baris aktif</span>
            </div>
          </div>

          {/* Tab Switcher in Center */}
          <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-700/50">
            <button
              onClick={() => setActiveTab('team')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'team'
                  ? 'bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-lg shadow-violet-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Profil Tim
            </button>
            <button
              onClick={() => setActiveTab('individual')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'individual'
                  ? 'bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-lg shadow-violet-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Profil Individu & Jabatan
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Warnings badge */}
            {validation && validation.warnings.length > 0 && (
              <span className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-xs font-medium">
                {validation.warnings.length} peringatan
              </span>
            )}
            {dataSource?.kind === 'sqlserver' && dataSource.limitExceeded && (
              <span className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-xs font-medium">
                Data dibatasi 100.000 baris
              </span>
            )}
            <button
              onClick={() => setIsChatOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl border border-cyan-500/40 bg-cyan-500/10 text-cyan-200 hover:text-white hover:border-cyan-400/70 hover:bg-cyan-500/20 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-4 4v-4H9z" />
              </svg>
              Chat Scoring
            </button>
            <button
              onClick={reset}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl border border-slate-600/50 text-slate-400 hover:text-white hover:border-violet-500/50 hover:bg-violet-500/10 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload File Baru
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-[1600px] mx-auto px-6 py-6">
        <FilterBar />

        {activeTab === 'team' ? (
          /* ==================== TEAM VIEW (PHASE 1) ==================== */
          <div className="space-y-6">
            {/* Ranking Table */}
            <ErrorBoundary fallbackTitle="Error pada Tabel Ranking">
              <TeamRankingTable />
            </ErrorBoundary>

            {/* CSM Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <ErrorBoundary fallbackTitle="Error pada Chart Tren CSM">
                  <TeamTrendChart mode="csm" />
                </ErrorBoundary>
              </div>
              <div>
                <ErrorBoundary fallbackTitle="Error pada Scatter CSM">
                  <SizeVsPerformanceChart mode="csm" />
                </ErrorBoundary>
              </div>
            </div>

            {/* Technician Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <ErrorBoundary fallbackTitle="Error pada Chart Tren Tim CE/SPS">
                  <TeamTrendChart mode="technician" />
                </ErrorBoundary>
              </div>
              <div>
                <ErrorBoundary fallbackTitle="Error pada Scatter Tim CE/SPS">
                  <SizeVsPerformanceChart mode="technician" />
                </ErrorBoundary>
              </div>
            </div>

            {/* Heatmap */}
            <ErrorBoundary fallbackTitle="Error pada Heatmap">
              <MetricHeatmap />
            </ErrorBoundary>
          </div>
        ) : (
          /* ==================== INDIVIDUAL & JABATAN VIEW (PHASE 2) ==================== */
          <div className="space-y-6">
            {/* Search Box & Summary Panels */}
            <div className="flex flex-col md:flex-row gap-4 items-stretch">
              {/* Left Column: Search Box & Welcome Card */}
              <div className="relative z-30 w-full md:w-1/3 glass rounded-xl p-5 border border-slate-700/50 flex flex-col justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-white mb-1">Cari Profil Personil</h3>
                  <p className="text-xs text-slate-500">Lihat data perkembangan skor, kelebihan/kekurangan metrik, dan mutasi kerja individu</p>
                </div>
                <IndividualSearchBox />
              </div>

              {/* Right Columns: Watchlist and Top Performers */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ErrorBoundary fallbackTitle="Error pada Panel Watchlist">
                  <WatchlistPanel />
                </ErrorBoundary>
                <ErrorBoundary fallbackTitle="Error pada Panel Top Performer">
                  <TopPerformerPanel />
                </ErrorBoundary>
              </div>
            </div>

            {/* Cluster Segments */}
            <ErrorBoundary fallbackTitle="Error pada Segmentasi Kluster">
              <ClusterSegmentPanel />
            </ErrorBoundary>

            {/* Main Individual Ranking Table */}
            <ErrorBoundary fallbackTitle="Error pada Analisis Konteks Penempatan">
              <ContextEffectPanel />
            </ErrorBoundary>


            <ErrorBoundary fallbackTitle="Error pada Tabel Ranking Individu">
              <IndividualRankingTable />
            </ErrorBoundary>

            {/* Distribution Comparisons & Correlations */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Column 1: Jabatan comparisons */}
              <div className="space-y-6">
                <ErrorBoundary fallbackTitle="Error pada Distribusi Jabatan">
                  <JabatanComparisonView />
                </ErrorBoundary>
                <ErrorBoundary fallbackTitle="Error pada Metrik CE vs SPS">
                  <CEvsSPSPanel />
                </ErrorBoundary>
              </div>

              {/* Column 2: Correlation scatter & Locations */}
              <div className="space-y-6">
                <ErrorBoundary fallbackTitle="Error pada Scatter CSM-Teknisi">
                  <CsmSubordinateScatter />
                </ErrorBoundary>
                <ErrorBoundary fallbackTitle="Error pada Performa Cabang/Lokasi">
                  <LocationRankingTable />
                </ErrorBoundary>
              </div>
            </div>
          </div>
        )}
      </main>
      {isChatOpen && (
        <ErrorBoundary fallbackTitle="Error pada Chat Scoring">
          <ScoringChatPanel onClose={() => setIsChatOpen(false)} />
        </ErrorBoundary>
      )}
    </div>
  );
}
