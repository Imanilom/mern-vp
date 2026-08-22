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
import UserManagementView from './views/UserManagementView';
import { ProfileView } from './views/ProfileView';
import { api } from './services/api';
import { io } from 'socket.io-client';

const apiUrl = import.meta.env.VITE_API_URL || '';
const socketUrl = apiUrl ? apiUrl.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' ? window.location.origin : '/');

const socket = io(socketUrl, {
  transports: ['polling', 'websocket'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
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
  
  // New state to hold raw stream data
  const [liveSensorData, setLiveSensorData] = useState(null);

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

    Promise.all([
      api.getAnalyzedSegments(targetPatientId, 500).catch(() => null),
      api.getRawData(targetPatientId).catch(() => null)
    ]).then(([segmentsRes, rawRes]) => {
      const dates = new Set();
      
      const segments = Array.isArray(segmentsRes?.data) ? segmentsRes.data : (Array.isArray(segmentsRes) ? segmentsRes : []);
      segments.forEach(seg => {
        const val = seg.window_start || seg.timestamp || seg.createdAt;
        if (val) {
          let ts = NaN;
          if (typeof val === 'number') {
             ts = val < 10000000000 ? val * 1000 : val;
          } else if (typeof val === 'object' && val.$date) {
             ts = new Date(val.$date).getTime();
          } else {
             ts = new Date(val).getTime();
          }
          if (!isNaN(ts)) {
            const dt = new Date(ts);
            const dateStr = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
            dates.add(dateStr);
          }
        }
      });

      const rawLogs = Array.isArray(rawRes?.data) ? rawRes.data : (Array.isArray(rawRes) ? rawRes : []);
      rawLogs.forEach(log => {
        let ts = NaN;
        if (log.timestamp) {
          const nts = Number(log.timestamp);
          ts = nts < 10000000000 ? nts * 1000 : nts;
        } else if (log.createdAt) {
          ts = new Date(log.createdAt).getTime();
        } else if (log.date_created) {
          const sep = log.date_created.includes('-') ? '-' : '/';
          const parts = log.date_created.split(sep);
          if (parts.length === 3) {
            const yyyy = parts[0].length === 4 ? parts[0] : parts[2];
            const mm = parts[1];
            const dd = parts[0].length === 4 ? parts[2] : parts[0];
            ts = new Date(`${yyyy}-${mm}-${dd}T${log.time_created || '00:00:00'}`).getTime();
          }
        }
        if (!isNaN(ts)) {
          const dt = new Date(ts);
          const dateStr = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
          dates.add(dateStr);
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
      setLiveSensorData(payload);
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

  // Force 'user' role to only see their own data
  useEffect(() => {
    if (userRole?.role === 'user' && participants.length > 0) {
      if (globalParticipantFilter === 'ALL') {
        const selfId = participants[0].id || participants[0]._id;
        setGlobalParticipantFilter(selfId);
        setSelectedParticipantId(selfId);
        if (activeTab === 'overview') {
          setActiveTab('live-monitor');
        }
      }
    }
  }, [userRole, participants, globalParticipantFilter, activeTab]);

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
      <div className="flex-grow-1 d-flex flex-column" style={{ minWidth: 0 }}>
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
          {(activeTab === 'overview') && (
            <CohortOverviewView
              participants={participants}
              onSelectParticipant={handleSelectParticipant}
              onNavigate={(tab) => setActiveTab(tab)}
              globalParticipantFilter={globalParticipantFilter}
            />
          )}

          {(activeTab === 'live-monitor') && (
            <LiveMonitorView 
              participants={participants} 
              initialSelectedId={selectedParticipantId}
              onClearSelection={() => setSelectedParticipantId(null)}
              globalParticipantFilter={globalParticipantFilter}
              globalDateFilter={globalDateFilter}
              liveSensorData={liveSensorData}
            />
          )}

          {(activeTab === 'signal-quality') && (
            <SignalQualityView
              participantId={globalParticipantFilter !== 'ALL' ? globalParticipantFilter : (selectedParticipantId || null)}
              globalDateFilter={globalDateFilter}
            />
          )}

          {(activeTab === 'baseline-maturity') && (
            <BaselineMaturityView 
              participantId={globalParticipantFilter !== 'ALL' ? globalParticipantFilter : (selectedParticipantId || null)}
              globalDateFilter={globalDateFilter}
            />
          )}

          {(activeTab === 'state-timeline') && (
            <StateTimelineView 
              participantId={globalParticipantFilter !== 'ALL' ? globalParticipantFilter : (selectedParticipantId || null)}
              globalDateFilter={globalDateFilter}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {(activeTab === 'episode') && (
            <EpisodeView 
              episodes={episodes}
              globalParticipantFilter={globalParticipantFilter}
              globalDateFilter={globalDateFilter}
            />
          )}

          {(activeTab === 'experience') && (
            <ExperienceView 
              experienceModels={experienceModels}
              globalParticipantFilter={globalParticipantFilter}
              globalDateFilter={globalDateFilter}
            />
          )}

          {(activeTab === 'prediction-eval') && (
            <PredictionEvalView 
              globalParticipantFilter={globalParticipantFilter}
            />
          )}

          {(activeTab === 'model-rules') && (
            <ModelRulesView modelConfig={modelConfig} />
          )}

          {(activeTab === 'export') && (
            <ExportView 
              exportJobs={exportJobs}
              onRefresh={async () => {
                const exports = await api.getExportJobs();
                setExportJobs(exports);
              }}
            />
          )}

          {(activeTab === 'audit') && (
            <AuditView 
              auditTrail={auditTrail}
              globalParticipantFilter={globalParticipantFilter}
              globalDateFilter={globalDateFilter}
            />
          )}

          {(activeTab === 'settings') && (
            <SettingsView user={userRole} />
          )}
          
          {(activeTab === 'user-management') && (
            <UserManagementView />
          )}

          {(activeTab === 'profile') && (
            <ProfileView user={userRole} />
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
