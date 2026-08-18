import { useDashboardStore } from './store/useDashboardStore';
import { UploadPanel } from './components/upload/UploadPanel';
import { DashboardShell } from './components/layout/DashboardShell';
import { TeamDetailDrawer } from './components/detail/TeamDetailDrawer';
import { IndividualDetailDrawer } from './components/individual/IndividualDetailDrawer';
import { ErrorBoundary } from './components/common/ErrorBoundary';

export default function App() {
  const uploadStatus = useDashboardStore((s) => s.uploadStatus);
  const selectedTeam = useDashboardStore((s) => s.selectedTeam);
  const selectedIndividual = useDashboardStore((s) => s.selectedIndividual);

  return (
    <div className="min-h-screen bg-slate-950">
      {uploadStatus !== 'success' ? <UploadPanel /> : <DashboardShell />}
      {selectedTeam && (
        <ErrorBoundary fallbackTitle="Error pada Detail Tim">
          <TeamDetailDrawer />
        </ErrorBoundary>
      )}
      {selectedIndividual !== null && (
        <ErrorBoundary fallbackTitle="Error pada Detail Personil">
          <IndividualDetailDrawer />
        </ErrorBoundary>
      )}
    </div>
  );
}
