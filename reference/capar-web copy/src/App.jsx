import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { LoginView } from './views/LoginView';
import { CohortOverviewView } from './views/CohortOverviewView';
import { LiveMonitorView } from './views/LiveMonitorView';
import { SignalQualityView } from './views/SignalQualityView';
import { BaselineMaturityView } from './views/BaselineMaturityView';
import { EpisodeView } from './views/EpisodeView';
import { StateTimelineView } from './views/StateTimelineView';
import { ExperienceView } from './views/ExperienceView';
import { PredictionEvalView } from './views/PredictionEvalView';
import { ModelRulesView } from './views/ModelRulesView';
import { ExportView } from './views/ExportView';
import { AuditView } from './views/AuditView';
import { SettingsView } from './views/SettingsView';
import { api } from './services/api';

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedCohort, setSelectedCohort] = useState('pilot-01');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Domain state
  const [userRole, setUserRole] = useState(null);
  const [cohorts, setCohorts] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [experienceModels, setExperienceModels] = useState([]);
  const [modelConfig, setModelConfig] = useState(null);
  const [exportJobs, setExportJobs] = useState([]);
  const [auditTrail, setAuditTrail] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    async function loadData() {
      const user = await api.getMe();
      const cohortList = await api.getCohorts();
      const pList = await api.getParticipants(selectedCohort);
      const epList = await api.getEpisodes();
      const expModels = await api.getPersonalExperience();
      const config = await api.getModelRules();
      const exports = await api.getExportJobs();
      const audit = await api.getAuditTrail();

      setUserRole(user);
      setCohorts(cohortList);
      setParticipants(pList);
      setEpisodes(epList);
      setExperienceModels(expModels);
      setModelConfig(config);
      setExportJobs(exports);
      setAuditTrail(audit);
    }
    loadData();
  }, [selectedCohort]);

  if (!isAuthenticated) {
    return <LoginView onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  const handleSelectParticipant = (id) => {
    setActiveTab('live-monitor');
  };

  return (
    <div className="backoffice-shell">
      {/* Production Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userRole={userRole}
        isOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Production App Body */}
      <div className="backoffice-body">
        {/* Top Header Bar */}
        <Topbar
          cohorts={cohorts}
          selectedCohort={selectedCohort}
          setSelectedCohort={setSelectedCohort}
          user={userRole}
          onLogout={() => setIsAuthenticated(false)}
          onOpenNotifications={() => setShowNotifications(true)}
          onToggleSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        />

        {/* Scrollable Main Content Workspace */}
        <main className="backoffice-main">
          {(activeTab === 'overview' || activeTab === 'w1') && (
            <CohortOverviewView
              participants={participants}
              onSelectParticipant={handleSelectParticipant}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {(activeTab === 'live-monitor' || activeTab === 'w2') && (
            <LiveMonitorView participants={participants} />
          )}

          {(activeTab === 'signal-quality' || activeTab === 'w2d') && (
            <SignalQualityView />
          )}

          {(activeTab === 'baseline-maturity' || activeTab === 'w2e') && (
            <BaselineMaturityView />
          )}

          {(activeTab === 'episode' || activeTab === 'w3') && (
            <EpisodeView episodes={episodes} />
          )}

          {(activeTab === 'state-timeline' || activeTab === 'w3b') && (
            <StateTimelineView />
          )}

          {(activeTab === 'experience' || activeTab === 'w4') && (
            <ExperienceView experienceModels={experienceModels} />
          )}

          {(activeTab === 'prediction-eval' || activeTab === 'w4b') && (
            <PredictionEvalView />
          )}

          {(activeTab === 'model-rules' || activeTab === 'w5') && (
            <ModelRulesView modelConfig={modelConfig} />
          )}

          {(activeTab === 'export' || activeTab === 'w6') && (
            <ExportView exportJobs={exportJobs} />
          )}

          {(activeTab === 'audit' || activeTab === 'w7') && (
            <AuditView auditTrail={auditTrail} />
          )}

          {(activeTab === 'settings' || activeTab === 'w8') && (
            <SettingsView user={userRole} />
          )}
        </main>
      </div>

      {/* Notifications Drawer Modal */}
      {showNotifications && (
        <div className="modal-overlay" onClick={() => setShowNotifications(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fa-regular fa-bell" style={{ fontSize: 16, color: 'var(--navy)' }}></i>
                <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>Operational Alerts</h3>
              </div>
              <button onClick={() => setShowNotifications(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16 }}>
                ✕
              </button>
            </div>

            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ padding: 12, borderRadius: 8, background: 'var(--red-soft)', border: '1px solid var(--red)', fontSize: 12 }}>
                <div style={{ fontWeight: 800, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="fa-solid fa-triangle-exclamation"></i>
                  <span>Participant P-031 — UNRESOLVED Episode</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink)', marginTop: 4 }}>
                  Episode &gt; 90 min (exceeds horizon q=3 windows). Quality score warning active.
                </div>
              </div>

              <div style={{ padding: 12, borderRadius: 8, background: 'var(--amber-soft)', border: '1px solid var(--amber)', fontSize: 12 }}>
                <div style={{ fontWeight: 800, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="fa-solid fa-triangle-exclamation"></i>
                  <span>Participant P-088 — Uncertain Context</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink)', marginTop: 4 }}>
                  Context confidence drops below 60%. Requesting EMA 1 confirmation.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default App;
