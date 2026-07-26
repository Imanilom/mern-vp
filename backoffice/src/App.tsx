import { useState, useEffect } from 'react';
import {
  House, Users, UploadSimple, Sliders, Footprints, ChartBar, ChartLine,
  Warning, FileText, Cpu, UserGear, Gear, Bell, Moon, Sun, List,
  MagnifyingGlass, ArrowsClockwise, SignOut, ActivityIcon
} from '@phosphor-icons/react';
import { Overview } from './features/Overview';
import {
  DataAcquisition, Preprocessing, ActivityContext, BaselineModel,
  TrajectoryAnalysis, AnomalyDetection, Reports, PipelineMonitor,
  UserManagement, Settings
} from './features/RemainingViews';
import { Login } from './features/Login';
import { RawDataView } from './features/RawDataView';
import { Profile } from './features/Profile';

type ViewType =
  | 'view-overview'
  | 'view-participants'
  | 'view-participant-detail'
  | 'view-data-acquisition'
  | 'view-raw-data'
  | 'view-preprocessing'
  | 'view-activity-context'
  | 'view-baseline'
  | 'view-trajectory'
  | 'view-anomaly'
  | 'view-reports'
  | 'view-pipeline'
  | 'view-users'
  | 'view-settings'
  | 'view-profile';

const getNavSections = (role: string | undefined, selectedParticipantId: string | null) => {
  const isDoctor = role === 'doctor';
  
  if (isDoctor) {
    if (selectedParticipantId) {
      // Doctor viewing a specific patient
      return [
        {
          label: 'Kembali',
          items: [
            { id: 'view-overview' as ViewType, label: 'Daftar Pasien', icon: House },
          ],
        },
        {
          label: 'Patient Dashboard',
          items: [
            { id: 'view-raw-data' as ViewType, label: 'Live Monitoring', icon: ActivityIcon },
            { id: 'view-activity-context' as ViewType, label: 'Activity Context', icon: Footprints },
            { id: 'view-baseline' as ViewType, label: 'Baseline Model', icon: ChartBar },
            { id: 'view-trajectory' as ViewType, label: 'Trajectory Analysis', icon: ChartLine },
            { id: 'view-anomaly' as ViewType, label: 'Anomaly Detection', icon: Warning },
            { id: 'view-reports' as ViewType, label: 'Reports', icon: FileText },
          ],
        },
        {
          label: 'System & Admin',
          items: [
            { id: 'view-pipeline' as ViewType, label: 'Pipeline Monitor', icon: Cpu },
            { id: 'view-users' as ViewType, label: 'User Management', icon: UserGear },
            { id: 'view-profile' as ViewType, label: 'My Profile', icon: UserGear },
            { id: 'view-settings' as ViewType, label: 'Settings', icon: Gear },
          ],
        }
      ];
    } else {
      // Doctor overview (no specific patient selected yet)
      return [
        {
          label: 'Workspace',
          items: [
            { id: 'view-overview' as ViewType, label: 'Daftar Pasien', icon: House },
          ],
        },
        {
          label: 'System & Admin',
          items: [
            { id: 'view-pipeline' as ViewType, label: 'Pipeline Monitor', icon: Cpu },
            { id: 'view-users' as ViewType, label: 'User Management', icon: UserGear },
            { id: 'view-profile' as ViewType, label: 'My Profile', icon: UserGear },
            { id: 'view-settings' as ViewType, label: 'Settings', icon: Gear },
          ],
        }
      ];
    }
  } else {
    // Regular User
    return [
      {
        label: 'My Dashboard',
        items: [
          { id: 'view-raw-data' as ViewType, label: 'Live Monitoring', icon: ActivityIcon },
          { id: 'view-activity-context' as ViewType, label: 'Activity Context', icon: Footprints },
          { id: 'view-baseline' as ViewType, label: 'Baseline Model', icon: ChartBar },
          { id: 'view-trajectory' as ViewType, label: 'Trajectory Analysis', icon: ChartLine },
          { id: 'view-anomaly' as ViewType, label: 'Anomaly Detection', icon: Warning },
          { id: 'view-reports' as ViewType, label: 'Reports', icon: FileText },
          { id: 'view-profile' as ViewType, label: 'My Profile', icon: UserGear },
          { id: 'view-settings' as ViewType, label: 'Settings', icon: Gear },
        ],
      }
    ];
  }
};

function App() {
  const [view, setView] = useState<ViewType>('view-overview');
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>(() => {
    const stored = sessionStorage.getItem('htm_user');
    if (stored) {
      const user = JSON.parse(stored);
      return user.role === 'user' ? (user._id || user.guid || '') : '';
    }
    return '';
  });
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [contentKey, setContentKey] = useState(0);

  // ── Auth state — initialized from sessionStorage ──
  const [token, setToken] = useState<string>(() => sessionStorage.getItem('htm_token') || '');
  const [authUser, setAuthUser] = useState<{ email: string; name: string; role: string; guid?: string } | null>(() => {
    const stored = sessionStorage.getItem('htm_user');
    return stored ? JSON.parse(stored) : null;
  });

  const handleLoginSuccess = (newToken: string, user: { email: string; name: string; role: string; guid?: string }) => {
    setToken(newToken);
    setAuthUser(user);
    if (user.role === 'user' && user.guid) {
      setSelectedParticipantId(user.guid);
    }
  };

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/signout', { credentials: 'include' });
    } catch (_) { /* ignore network errors on signout */ }
    sessionStorage.removeItem('htm_token');
    sessionStorage.removeItem('htm_user');
    setToken('');
    setAuthUser(null);
  };

  // Apply theme to root
  useEffect(() => {
    const root = window.document.documentElement;
    root.setAttribute('data-theme', theme);
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);

  const toggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));

  const navigateTo = (v: ViewType) => {
    setView(v);
    setContentKey(k => k + 1);
  };

  const navigateToParticipant = (id: string) => {
    setSelectedParticipantId(id);
    navigateTo('view-raw-data');
  };

  const currentView = view === 'view-participant-detail' ? 'view-participants' : view;

  // ── Show Login if not authenticated (must be after all Hook calls) ──
  if (!token || !authUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="shell">

      {/* ── SIDEBAR ── */}
      {sidebarOpen && (
        <aside className="sidebar">
          {/* Brand */}
          <div className="brand">
            <div className="brand-mark">
              <img
                src="/htm_logo.png"
                alt="HTM Logo"
                style={{ width: 22, height: 22, objectFit: 'contain' }}
              />
            </div>
            <div>
              <div className="brand-name">HTM</div>
              <div className="brand-sub">Back office</div>
            </div>
          </div>

          {/* Navigation sections */}
          {getNavSections(authUser.role, (view === 'view-overview' && authUser.role === 'doctor') ? null : selectedParticipantId).map((section) => (
            <div key={section.label}>
              <div className="nav-section">{section.label}</div>
              <nav className="nav">
                {section.items.map((item) => {
                  const IconComponent = item.icon;
                  const isActive = currentView === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`nav-item ${isActive ? 'active' : ''}`}
                      onClick={() => navigateTo(item.id)}
                    >
                      <IconComponent size={16} weight={isActive ? 'fill' : 'regular'} />
                      {item.label}
                    </div>
                  );
                })}
              </nav>
            </div>
          ))}

          {/* Bottom: sync status */}
          <div style={{ marginTop: 'auto' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 10px',
                borderRadius: 'var(--r-md)',
                background: 'var(--surface-overlay)',
                border: '1px solid var(--hairline)',
                fontSize: 11,
                color: 'var(--muted)',
              }}
            >
              <ArrowsClockwise size={13} style={{ color: 'var(--stable-text)' }} />
              <span style={{ flex: 1 }}>Backend synced</span>
              <span
                style={{
                  fontFamily: 'IBM Plex Mono',
                  fontSize: 10,
                  color: 'var(--muted-light)',
                }}
              >
                2s ago
              </span>
            </div>
          </div>
        </aside>
      )}

      {/* ── MAIN ── */}
      <div className="main">

        {/* TOPBAR — Glassmorphism */}
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <List size={19} />
            </button>

            {/* Command bar */}
            <div className="cmd-chip">
              <MagnifyingGlass size={13} />
              <span>Search…</span>
              <kbd>⌘K</kbd>
            </div>

            {/* Study chip */}
            <div className="chip">
              <span className="msym" style={{ fontSize: 13, color: 'var(--primary)' }}>science</span>
              HTM-2026
            </div>
          </div>

          <div className="topbar-right">
            {/* Backend health */}
            <div className="chip chip-green">
              <span className="status-dot"></span>
              Backend healthy
            </div>

            {/* Theme toggle */}
            <button className="theme-toggle" onClick={toggleTheme}>
              {theme === 'light' ? (
                <><Moon size={13} /> Dark</>
              ) : (
                <><Sun size={13} /> Light</>
              )}
            </button>

            {/* Notifications */}
            <button className="icon-btn" style={{ position: 'relative' }}>
              <Bell size={17} />
              <span className="notif-badge"></span>
            </button>

            {/* Avatar + user info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="avatar" title={authUser.email}>
                {authUser.name.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{authUser.name}</span>
                <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'IBM Plex Mono' }}>{authUser.role}</span>
              </div>
              <button
                className="icon-btn"
                onClick={handleSignOut}
                title="Sign out"
                style={{ marginLeft: 2 }}
              >
                <SignOut size={16} />
              </button>
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <main key={contentKey} className="content">
          {view === 'view-overview' && <Overview onViewParticipant={navigateToParticipant} />}
          {view === 'view-data-acquisition' && <DataAcquisition />}
          {view === 'view-raw-data' && (
            <RawDataView
              selectedParticipantId={selectedParticipantId}
              onParticipantChange={setSelectedParticipantId}
            />
          )}
          {view === 'view-preprocessing' && <Preprocessing />}
          {view === 'view-activity-context' && (
            <ActivityContext
              selectedParticipantId={selectedParticipantId}
              onParticipantChange={setSelectedParticipantId}
            />
          )}
          {view === 'view-baseline' && (
            <BaselineModel
              selectedParticipantId={selectedParticipantId}
              onParticipantChange={setSelectedParticipantId}
            />
          )}
          {view === 'view-trajectory' && (
            <TrajectoryAnalysis
              selectedParticipantId={selectedParticipantId}
              onParticipantChange={setSelectedParticipantId}
            />
          )}
          {view === 'view-anomaly' && (
            <AnomalyDetection
              selectedParticipantId={selectedParticipantId}
              onParticipantChange={setSelectedParticipantId}
            />
          )}
          {view === 'view-reports' && (
            <Reports
              selectedParticipantId={selectedParticipantId}
              onParticipantChange={setSelectedParticipantId}
            />
          )}
          {view === 'view-pipeline' && <PipelineMonitor />}
          { view === 'view-users' && <UserManagement /> }
          { view === 'view-settings' && <Settings /> }
          { view === 'view-profile' && <Profile /> }
        </main>
      </div>
    </div>
  );
}

export default App;
