import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { LoginView } from './views/LoginView';
import { api } from './services/api';
import { io } from 'socket.io-client';

// ── Lazy imports (code-split) — hanya download saat pertama kali dibuka ────────
const CohortOverviewView   = lazy(() => import('./views/CohortOverviewView').then(m => ({ default: m.CohortOverviewView })));
const LiveMonitorView      = lazy(() => import('./views/LiveMonitorView').then(m => ({ default: m.LiveMonitorView })));
const SignalQualityView    = lazy(() => import('./views/SignalQualityView').then(m => ({ default: m.SignalQualityView })));
const BaselineMaturityView = lazy(() => import('./views/BaselineMaturityView').then(m => ({ default: m.BaselineMaturityView })));
const EpisodeView          = lazy(() => import('./views/EpisodeView').then(m => ({ default: m.EpisodeView })));
const EventGeneratorView   = lazy(() => import('./views/EventGeneratorView'));
const EpisodeDetailView    = lazy(() => import('./views/EpisodeDetailView'));
const StateTimelineView    = lazy(() => import('./views/StateTimelineView').then(m => ({ default: m.StateTimelineView })));
const ExperienceView       = lazy(() => import('./views/ExperienceView').then(m => ({ default: m.ExperienceView })));
const PredictionEvalView   = lazy(() => import('./views/PredictionEvalView').then(m => ({ default: m.PredictionEvalView })));
const ModelRulesView       = lazy(() => import('./views/ModelRulesView').then(m => ({ default: m.ModelRulesView })));
const ExportView           = lazy(() => import('./views/ExportView').then(m => ({ default: m.ExportView })));
const AuditView            = lazy(() => import('./views/AuditView').then(m => ({ default: m.AuditView })));
const SettingsView         = lazy(() => import('./views/SettingsView').then(m => ({ default: m.SettingsView })));
const UserManagementView   = lazy(() => import('./views/UserManagementView'));
const ProfileView          = lazy(() => import('./views/ProfileView').then(m => ({ default: m.ProfileView })));
const ZeroShotView         = lazy(() => import('./views/ZeroShotView').then(m => ({ default: m.ZeroShotView })));
const AutonomicProfileView = lazy(() => import('./views/AutonomicProfileView').then(m => ({ default: m.AutonomicProfileView })));
const ClinicalVulnerabilityView = lazy(() => import('./views/ClinicalVulnerabilityView').then(m => ({ default: m.ClinicalVulnerabilityView })));
const CardiovascularResilienceView = lazy(() => import('./views/CardiovascularResilienceView').then(m => ({ default: m.CardiovascularResilienceView })));
const WeeklyPhenotypingView = lazy(() => import('./views/WeeklyPhenotypingView').then(m => ({ default: m.WeeklyPhenotypingView })));

// ── Valid tab list ────────────────────────────────────────────────────────────
const VALID_TABS = [
  'overview','live-monitor','signal-quality','baseline-maturity',
  'state-timeline','episode','event-generator','episode-detail',
  'experience','prediction-eval','model-rules','export','audit',
  'settings','user-management','profile','zero-shot','autonomic-profile',
  'clinical-vulnerability','cardiovascular-resilience','weekly-phenotyping',
];

// ── Hash routing helpers ──────────────────────────────────────────────────────
function getTabFromHash() {
  const hash = window.location.hash.replace('#/', '');
  return VALID_TABS.includes(hash) ? hash : 'overview';
}

function setHashTab(tab) {
  if (window.location.hash !== `#/${tab}`) {
    window.history.pushState(null, '', `#/${tab}`);
  }
}

// ── Loading fallback ──────────────────────────────────────────────────────────
const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 12 }}>
    <div style={{ width: 36, height: 36, border: '3px solid var(--line)', borderTopColor: 'var(--teal)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <span style={{ fontSize: 13, color: 'var(--gray)', fontWeight: 600 }}>Memuat halaman...</span>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

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
  const [activeTab, setActiveTabState] = useState(getTabFromHash);
  const [selectedCohort, setSelectedCohort] = useState('pilot-01');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  const [globalParticipantFilter, setGlobalParticipantFilter] = useState('ALL');
  const [globalDateFilter, setGlobalDateFilter] = useState('');
  const [availableDates, setAvailableDates] = useState([]);

  // Domain state
  const [userRole, setUserRole] = useState(null);
  const [cohorts, setCohorts] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [modelConfig, setModelConfig] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedParticipantId, setSelectedParticipantId] = useState(null);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState(null);
  const [liveSensorData, setLiveSensorData] = useState(null);

  // ── Track which tabs have been visited (for display:none lazy mount) ────────
  const [visitedTabs, setVisitedTabs] = useState(() => new Set([getTabFromHash()]));

  // ── Tab navigation with hash sync ────────────────────────────────────────────
  const setActiveTab = useCallback((tab) => {
    setActiveTabState(tab);
    setHashTab(tab);
    setVisitedTabs(prev => new Set(prev).add(tab));
  }, []);

  // Sync hash <-> state when user presses browser back/forward
  useEffect(() => {
    const onPop = () => {
      const tab = getTabFromHash();
      setActiveTabState(tab);
      setVisitedTabs(prev => new Set(prev).add(tab));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    async function loadAuth() {
      try {
        const user = await api.getMe();
        if (user) { setUserRole(user); setIsAuthenticated(true); }
        else { setIsAuthenticated(false); }
      } catch { setIsAuthenticated(false); }
    }
    loadAuth();
  }, []);

  const targetPatientId = globalParticipantFilter !== 'ALL' ? globalParticipantFilter : selectedParticipantId;

  useEffect(() => {
    if (!targetPatientId) { setAvailableDates([]); setGlobalDateFilter(''); return; }
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
          if (typeof val === 'number') ts = val < 10000000000 ? val * 1000 : val;
          else if (typeof val === 'object' && val.$date) ts = new Date(val.$date).getTime();
          else ts = new Date(val).getTime();
          if (!isNaN(ts)) {
            const dt = new Date(ts);
            dates.add(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`);
          }
        }
      });
      const rawLogs = Array.isArray(rawRes?.data) ? rawRes.data : (Array.isArray(rawRes) ? rawRes : []);
      rawLogs.forEach(log => {
        let ts = NaN;
        if (log.timestamp) { const n = Number(log.timestamp); ts = n < 10000000000 ? n * 1000 : n; }
        else if (log.createdAt) ts = new Date(log.createdAt).getTime();
        if (!isNaN(ts)) {
          const dt = new Date(ts);
          dates.add(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`);
        }
      });
      const datesArr = Array.from(dates).sort();
      setAvailableDates(datesArr);
      setGlobalDateFilter(datesArr.length > 0 ? datesArr[datesArr.length - 1] : '');
    }).catch(() => { setAvailableDates([]); setGlobalDateFilter(''); });
  }, [targetPatientId]);

  useEffect(() => {
    if (!isAuthenticated) return;
    // Hanya ambil data global yang ringan — per tab data diload secara lazy
    Promise.all([
      api.getCohorts().catch(() => []),
      api.getParticipants(selectedCohort).catch(() => []),
      api.getModelRules().catch(() => null),
    ]).then(([cohortList, pList, config]) => {
      setCohorts(cohortList);
      setParticipants(pList);
      setModelConfig(config);
    });

    socket.on('new_sensor_data', (payload) => {
      setLiveSensorData(payload);
      setParticipants(prev => prev.map(p => {
        if (p.id === payload.user_id || p._id === payload.user_id) {
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
      }));
    });
    return () => socket.off('new_sensor_data');
  }, [isAuthenticated, selectedCohort]);

  useEffect(() => {
    if (userRole?.role === 'user' && participants.length > 0) {
      if (globalParticipantFilter === 'ALL') {
        const selfId = participants[0].id || participants[0]._id;
        setGlobalParticipantFilter(selfId);
        setSelectedParticipantId(selfId);
        if (activeTab === 'overview') setActiveTab('live-monitor');
      }
    }
  }, [userRole, participants, globalParticipantFilter, activeTab]);

  if (!isAuthenticated) {
    return <LoginView onLoginSuccess={() => {
      api.getMe().then(user => { if (user) { setUserRole(user); setIsAuthenticated(true); } });
    }} />;
  }

  const handleSelectParticipant = (id) => { setSelectedParticipantId(id); setActiveTab('live-monitor'); };
  const participantId = globalParticipantFilter !== 'ALL' ? globalParticipantFilter : (selectedParticipantId || null);

  // ── Helper: render tab dengan display:none lazy mount ────────────────────────
  // View di-mount sekali saat pertama dikunjungi. Setelah itu disembunyikan
  // lewat display:none (bukan di-unmount), sehingga tidak fetch ulang data
  // setiap kali pengguna berganti tab.
  const tab = (name, jsx) => {
    if (!visitedTabs.has(name)) return null;
    return (
      <div key={name} style={{ display: activeTab === name ? 'block' : 'none', height: '100%' }}>
        <Suspense fallback={<PageLoader />}>{jsx}</Suspense>
      </div>
    );
  };

  return (
    <div className="app-shell">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userRole={userRole}
        isOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      <div className="flex-grow-1 d-flex flex-column" style={{ minWidth: 0 }}>
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

        <main className="app-main">
          {tab('overview',
            <CohortOverviewView participants={participants} onSelectParticipant={handleSelectParticipant} onNavigate={setActiveTab} globalParticipantFilter={globalParticipantFilter} />
          )}
          {tab('live-monitor',
            <LiveMonitorView participants={participants} initialSelectedId={selectedParticipantId} onClearSelection={() => setSelectedParticipantId(null)} globalParticipantFilter={globalParticipantFilter} globalDateFilter={globalDateFilter} liveSensorData={liveSensorData} />
          )}
          {tab('signal-quality',
            <SignalQualityView participantId={participantId} globalDateFilter={globalDateFilter} />
          )}
          {tab('baseline-maturity',
            <BaselineMaturityView participantId={participantId} globalDateFilter={globalDateFilter} />
          )}
          {tab('state-timeline',
            <StateTimelineView participantId={participantId} globalDateFilter={globalDateFilter} onNavigate={setActiveTab} />
          )}
          {tab('episode',
            <EpisodeView globalParticipantFilter={globalParticipantFilter} globalDateFilter={globalDateFilter} onSelectEpisode={(id) => { setSelectedEpisodeId(id); setActiveTab('episode-detail'); }} />
          )}
          {tab('event-generator',
            <EventGeneratorView globalParticipantFilter={globalParticipantFilter} onSelectEpisode={(id) => { setSelectedEpisodeId(id); setActiveTab('episode-detail'); }} />
          )}
          {tab('episode-detail',
            <EpisodeDetailView episodeId={selectedEpisodeId} onBack={() => setActiveTab('event-generator')} />
          )}
          {tab('experience',
            <ExperienceView globalParticipantFilter={globalParticipantFilter} globalDateFilter={globalDateFilter} />
          )}
          {tab('prediction-eval',
            <PredictionEvalView globalParticipantFilter={globalParticipantFilter} />
          )}
          {tab('model-rules',
            <ModelRulesView modelConfig={modelConfig} />
          )}
          {tab('export',
            <ExportView user={userRole} onRefresh={async () => {}} />
          )}
          {tab('audit',
            <AuditView globalParticipantFilter={globalParticipantFilter} globalDateFilter={globalDateFilter} />
          )}
          {tab('settings', <SettingsView user={userRole} />)}
          {tab('user-management', <UserManagementView />)}
          {tab('profile', <ProfileView user={userRole} />)}
          {tab('zero-shot',
            <ZeroShotView globalParticipantFilter={globalParticipantFilter} />
          )}
          {tab('autonomic-profile',
            <AutonomicProfileView />
          )}
          {tab('clinical-vulnerability',
            <ClinicalVulnerabilityView targetPatientId={targetPatientId} />
          )}
          {tab('cardiovascular-resilience',
            <CardiovascularResilienceView targetPatientId={targetPatientId} />
          )}
          {tab('weekly-phenotyping',
            <WeeklyPhenotypingView participantId={participantId} targetPatientId={targetPatientId} onNavigate={setActiveTab} />
          )}
        </main>
      </div>

      {showNotifications && (
        <div className="modal-overlay" onClick={() => setShowNotifications(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fa-regular fa-bell" style={{ fontSize: 16, color: 'var(--navy)' }}></i>
                <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>Operational Alerts</h3>
              </div>
              <button onClick={() => setShowNotifications(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ padding: 12, borderRadius: 8, background: 'var(--red-soft)', border: '1px solid var(--red)', fontSize: 12 }}>
                <div style={{ fontWeight: 800, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="fa-solid fa-triangle-exclamation"></i>
                  <span>Participant P-031 — UNRESOLVED Episode</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink)', marginTop: 4 }}>Episode &gt; 90 min (exceeds horizon q=3 windows). Quality score warning active.</div>
              </div>
              <div style={{ padding: 12, borderRadius: 8, background: 'var(--amber-soft)', border: '1px solid var(--amber)', fontSize: 12 }}>
                <div style={{ fontWeight: 800, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="fa-solid fa-triangle-exclamation"></i>
                  <span>Participant P-088 — Uncertain Context</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink)', marginTop: 4 }}>Context confidence drops below 60%. Requesting EMA 1 confirmation.</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default App;
