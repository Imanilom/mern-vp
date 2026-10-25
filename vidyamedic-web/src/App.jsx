import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  Check,
  LockKeyhole,
  LoaderCircle,
  Menu,
  RefreshCw,
  X,
} from 'lucide-react';
import { api } from './api';
import { INITIAL_DASHBOARD, NAV_ITEMS } from './constants/navigation';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import { formatDate, getInitial } from './utils/formatters';
import DashboardPage from './pages/DashboardPage';
import DevicePrivacyPage from './pages/DevicePrivacyPage';
import EarlyDetectionPage from './pages/EarlyDetectionPage';
import InsightsPage from './pages/InsightsPage';
import MonitoringPage from './pages/MonitoringPage';
import PredictionPage from './pages/PredictionPage';
import ProfilePage from './pages/ProfilePage';
import ReportsPage from './pages/ReportsPage';

export default function App() {
  const [account, setAccount] = useState(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [active, setActive] = useState('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dashboard, setDashboard] = useState(INITIAL_DASHBOARD);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await api.loadDashboard();
      setDashboard(data);
      if (data.errors.length === 5) {
        setLoadError(data.errors[0]?.message || 'Data dari server belum dapat dimuat.');
      }
    } catch (error) {
      setLoadError(error.message || 'Gagal memuat data Vidyamedic.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    api.me()
      .then((user) => {
        if (!alive) return;
        setAccount(user);
        setAuthenticated(true);
      })
      .catch(() => {
        if (alive) setAuthenticated(false);
      })
      .finally(() => {
        if (alive) setCheckingAuth(false);
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (authenticated) refresh();
  }, [authenticated, refresh]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function saveProfile(body) {
    await api.updateProfile(body);
    setToast('Profil berhasil disimpan.');
    await refresh();
  }

  async function signout() {
    await api.signout();
    setAccount(null);
    setAuthenticated(false);
    setDashboard(INITIAL_DASHBOARD);
  }

  if (checkingAuth) {
    return (
      <div className="boot-screen">
        <LoaderCircle className="spin" size={26} />
        <span>Menyiapkan Vidyamedic...</span>
      </div>
    );
  }
  if (!authenticated) {
    return <Login onLogin={(user) => { setAccount(user); setAuthenticated(true); }} />;
  }

  const sectionName = NAV_ITEMS.find((item) => item.id === active)?.label || 'Monitoring';
  let pageContent;
  if (active === 'dashboard') {
    pageContent = <DashboardPage account={account} dashboard={dashboard} onNavigate={setActive} />;
  } else if (active === 'profil') {
    pageContent = <ProfilePage account={account} dashboard={dashboard} onSave={saveProfile} />;
  } else if (active === 'deteksi') {
    pageContent = <EarlyDetectionPage dashboard={dashboard} />;
  } else if (active === 'prediksi') {
    pageContent = <PredictionPage dashboard={dashboard} onNavigate={setActive} />;
  } else if (active === 'insight') {
    pageContent = <InsightsPage dashboard={dashboard} />;
  } else if (active === 'laporan') {
    pageContent = <ReportsPage dashboard={dashboard} />;
  } else if (active === 'perangkat') {
    pageContent = <DevicePrivacyPage dashboard={dashboard} onNavigate={setActive} />;
  } else {
    pageContent = (
      <MonitoringPage
        account={account}
        dashboard={dashboard}
        loading={loading}
        onNavigate={setActive}
        refresh={refresh}
      />
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        account={account}
        active={active}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onNavigate={setActive}
        onSignout={signout}
      />
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              aria-label="Buka menu"
              className="icon-button menu-button"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={21} />
            </button>
            <div className="breadcrumbs">
              <span>Vidyamedic</span>
              <span className="breadcrumb-slash">/</span>
              <strong>{sectionName}</strong>
            </div>
          </div>
          <div className="topbar-actions">
            <div className="date-chip">
              <CalendarDays size={16} />
              <span>{formatDate(new Date(), { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
            <button
              aria-label="Perbarui data"
              className="icon-button top-refresh"
              disabled={loading}
              onClick={refresh}
              title="Perbarui data"
            >
              {loading ? <LoaderCircle className="spin" size={18} /> : <RefreshCw size={18} />}
            </button>
            <div className="top-avatar">{getInitial(account?.name)}</div>
          </div>
        </header>
        <div className="page-content">
          {loadError && (
            <div className="notice notice-warning page-error">
              <AlertCircle size={18} />
              <span>{loadError}</span>
              <button
                aria-label="Tutup pesan"
                className="icon-button"
                onClick={() => setLoadError('')}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {pageContent}
        </div>
        <footer className="app-footer">
          <span>© {new Date().getFullYear()} Vidyamedic</span>
          <span><LockKeyhole size={13} /> Data pribadi Anda</span>
        </footer>
      </main>
      {toast && <div className="toast"><Check size={17} />{toast}</div>}
    </div>
  );
}
