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
import { io } from 'socket.io-client';

const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3030', {
  transports: ['websocket', 'polling']
});

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedCohort, setSelectedCohort] = useState('pilot-01');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  const [globalParticipantFilter, setGlobalParticipantFilter] = useState('ALL');
  const [globalDateFilter, setGlobalDateFilter] = useState('');
  const [availableDates, setAvailableDates] = useState([]);

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
  const [selectedParticipantId, setSelectedParticipantId] = useState(null);

  useEffect(() => {
    async function loadAuth() {
      try {
        const user = await api.getMe();
        if (user) {
          setUserRole(user);
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch (e) {
        setIsAuthenticated(false);
      }
    }
    loadAuth();
  }, []);

  const targetPatientId = globalParticipantFilter !== 'ALL' ? globalParticipantFilter : selectedParticipantId;

  useEffect(() => {
    if (!targetPatientId) {
      setAvailableDates([]);
      setGlobalDateFilter('');
      return;
    }

    api.getAnalyzedSegments(targetPatientId, 500).then(data => {
      const dates = new Set();
      const segments = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
      segments.forEach(seg => {
        const val = seg.window_start || seg.timestamp || seg.createdAt;
        if (val) {
          const ts = new Date(val).getTime();
          if (!isNaN(ts)) {
            const dt = new Date(ts);
            const dateStr = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
            dates.add(dateStr);
          }
        }
      });
      const datesArr = Array.from(dates).sort();
      setAvailableDates(datesArr);
      
      if (datesArr.length > 0) {
        setGlobalDateFilter(datesArr[datesArr.length - 1]);
      } else {
        setGlobalDateFilter('');
      }
    }).catch(err => {
      console.error('[App] Error fetching available dates:', err);
      setAvailableDates([]);
      setGlobalDateFilter('');
    });
  }, [targetPatientId]);

  useEffect(() => {
    if (!isAuthenticated) return;

    async function loadData() {
      const cohortList = await api.getCohorts();
      const pList = await api.getParticipants(selectedCohort);
      const epList = await api.getEpisodes();
      const expModels = await api.getPersonalExperience();
      const config = await api.getModelRules();
      const exports = await api.getExportJobs();
      const audit = await api.getAuditTrail();

      console.log('[API LoadData] Cohorts:', cohortList);
      console.log('[API LoadData] Participants:', pList);
      console.log('[API LoadData] Episodes:', epList);
      console.log('[API LoadData] Personal Experience:', expModels);
      console.log('[API LoadData] Model Config:', config);
      console.log('[API LoadData] Export Jobs:', exports);
      console.log('[API LoadData] Audit Trail:', audit);

      setCohorts(cohortList);
      setParticipants(pList);
      setEpisodes(epList);
      setExperienceModels(expModels);
      setModelConfig(config);
      setExportJobs(exports);
      setAuditTrail(audit);
    }
    loadData();

    socket.on('new_sensor_data', (payload) => {
      setParticipants((prev) => {
        // Here we could update specific participant state based on payload.user_id
        // For now, we will just force a re-render or push the latest HR/RR
        return prev.map(p => {
          if (p.id === payload.user_id || p._id === payload.user_id) {
            // Update the participant with latest data
            const lastReading = payload.readings?.[payload.readings.length - 1];
            return {
              ...p,
              hrMean: lastReading?.hr || p.hrMean,
              anomalyScore: lastReading?.rrms || payload.anomaly_score || p.anomalyScore,
              evidenceState: payload.evidence_state || p.evidenceState,
              physiologicalState: payload.physiological_state || p.physiologicalState,
              lastUpdate: lastReading?.time_created || new Date().toLocaleTimeString()
            };
          }
          return p;
        });
      });
    });

    return () => {
      socket.off('new_sensor_data');
    };
  }, [isAuthenticated, selectedCohort]);

  if (!isAuthenticated) {
    return <LoginView onLoginSuccess={() => {
      // Reload auth after successful login
      api.getMe().then(user => {
        if (user) {
          setUserRole(user);
          setIsAuthenticated(true);
        }
      });
    }} />;
  }

  const handleSelectParticipant = (id) => {
    setSelectedParticipantId(id);
    setActiveTab('live-monitor');
  };

  return (
    <div className="app-shell">
      {/* Production Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userRole={userRole}
        isOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Production App Body */}
      <div className="flex-grow-1 d-flex flex-column">
        {/* Top Header Bar */}
        <Topbar
          cohorts={cohorts}
          selectedCohort={selectedCohort}
          setSelectedCohort={setSelectedCohort}
          participants={participants}
          activeParticipantId={targetPatientId}
          globalParticipantFilter={globalParticipantFilter}
          setGlobalParticipantFilter={setGlobalParticipantFilter}
          globalDateFilter={globalDateFilter}
          setGlobalDateFilter={setGlobalDateFilter}
          availableDates={availableDates}
          user={userRole}
          onLogout={() => setIsAuthenticated(false)}
          onOpenNotifications={() => setShowNotifications(true)}
          onToggleSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        />

        {/* Scrollable Main Content Workspace */}
        <main className="app-main">
          {(activeTab === 'overview' || activeTab === 'w1') && (
            <CohortOverviewView
              participants={participants}
              onSelectParticipant={handleSelectParticipant}
              onNavigate={(tab) => setActiveTab(tab)}
              globalParticipantFilter={globalParticipantFilter}
            />
          )}

          {(activeTab === 'live-monitor' || activeTab === 'w2') && (
            <LiveMonitorView 
              participants={participants} 
              initialSelectedId={selectedParticipantId}
              onClearSelection={() => setSelectedParticipantId(null)}
              globalParticipantFilter={globalParticipantFilter}
              globalDateFilter={globalDateFilter}
            />
          )}

          {(activeTab === 'activity-context' || activeTab === 'w3b') && (
            <StateTimelineView 
              participantId={globalParticipantFilter !== 'ALL' ? globalParticipantFilter : (selectedParticipantId || 'P-014')} 
              globalDateFilter={globalDateFilter}
            />
          )}

          {(activeTab === 'baseline-maturity' || activeTab === 'w2e') && (
            <BaselineMaturityView 
              participantId={globalParticipantFilter !== 'ALL' ? globalParticipantFilter : (selectedParticipantId || 'P-014')} 
              globalDateFilter={globalDateFilter}
            />
          )}

          {(activeTab === 'state-timeline') && (
            <ExperienceView 
              experienceModels={experienceModels}
              globalParticipantFilter={globalParticipantFilter}
              globalDateFilter={globalDateFilter}
            />
          )}

          {(activeTab === 'episode' || activeTab === 'w3') && (
            <EpisodeView 
              episodes={episodes}
              globalParticipantFilter={globalParticipantFilter}
              globalDateFilter={globalDateFilter}
            />
          )}

          {(activeTab === 'reports' || activeTab === 'w7') && (
            <AuditView 
              auditTrail={auditTrail}
              globalParticipantFilter={globalParticipantFilter}
              globalDateFilter={globalDateFilter}
            />
          )}

          {(activeTab === 'pipeline-monitor' || activeTab === 'w5') && (
            <ModelRulesView modelConfig={modelConfig} />
          )}

          {(activeTab === 'settings' || activeTab === 'w8') && (
            <SettingsView user={userRole} />
          )}
          
          {(activeTab === 'user-management') && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray)' }}>
              <h2>User Management</h2>
              <p>Module is being integrated from backoffice...</p>
            </div>
          )}

          {(activeTab === 'profile') && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray)' }}>
              <h2>My Profile</h2>
              <p>Profile module is being integrated from backoffice...</p>
            </div>
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
