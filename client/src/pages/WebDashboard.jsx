import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaChartLine, FaUsers, FaDatabase, FaCogs, FaRunning,
  FaHeartbeat, FaExclamationTriangle, FaFileAlt, FaNetworkWired,
  FaUserShield, FaSlidersH, FaSignOutAlt, FaBars
} from 'react-icons/fa';

import { usersApi, analysisApi, logApi } from '../utls/api';

// Dashboard modules
import Overview from '../components/dashboard/Overview';
import Participants from '../components/dashboard/Participants';
import Acquisition from '../components/dashboard/Acquisition';
import Preprocessing from '../components/dashboard/Preprocessing';
import ActivityContext from '../components/dashboard/ActivityContext';
import BaselineModels from '../components/dashboard/BaselineModels';
import TrajectoryAnalysis from '../components/dashboard/TrajectoryAnalysis';
import AnomalyDetection from '../components/dashboard/AnomalyDetection';
import Reports from '../components/dashboard/Reports';
import PipelineMonitor from '../components/dashboard/PipelineMonitor';
import UserManagement from '../components/dashboard/UserManagement';
import SystemSettings from '../components/dashboard/SystemSettings';

export default function WebDashboard() {
  const navigate = useNavigate();

  // Auth: read session user
  const [sessionUser, setSessionUser] = useState(null);
  useEffect(() => {
    try {
      const u = JSON.parse(sessionStorage.getItem('webDashUser') || 'null');
      if (!u) { navigate('/web/login'); return; }
      setSessionUser(u);
    } catch {
      navigate('/web/login');
    }
  }, [navigate]);

  const logout = () => {
    sessionStorage.removeItem('webDashUser');
    navigate('/web/login');
  };

  const [activeMenu, setActiveMenu] = useState('overview');
  const [menuOpen, setMenuOpen] = useState(true);

  // Top-level HOOKS (Fixes React Rules of Hooks)
  const [tlHover, setTlHover] = useState(null);

  // Single data store for all menus
  const [data, setData] = useState({});
  const [loading, setLoading] = useState({ overview: true });
  const [errors, setErrors] = useState({});

  // ── Sub-States for specific menus ──
  // Participants
  const [selectedPt, setSelectedPt] = useState(null);
  const [ptDetailTab, setPtDetailTab] = useState('overview');
  const [ptData, setPtData] = useState({});
  const [ptLoading, setPtLoading] = useState(false);

  // Anomaly Detection Kanban
  const [anomalyKanban, setAnomalyKanban] = useState([]);

  // Acquisition (Upload)
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // Simulated Workers & Pipeline
  const [mqRate, setMqRate] = useState(120);
  const [w1Prog, setW1Prog] = useState(0);
  const [w1State, setW1State] = useState('Running');
  const [w2Prog, setW2Prog] = useState(0);
  const [w2State, setW2State] = useState('Running');

  // Generic fetcher factory
  const fetchFor = useCallback(async (key, apiCall) => {
    setLoading(p => ({ ...p, [key]: true }));
    setErrors(p => ({ ...p, [key]: null }));
    try {
      const res = await apiCall();
      setData(p => ({ ...p, [key]: res })); // Store raw res in data
      return res;
    } catch (err) {
      setErrors(p => ({ ...p, [key]: err.response?.data?.message || err.message || 'Error loading data' }));
      return null;
    } finally {
      setLoading(p => ({ ...p, [key]: false }));
    }
  }, []);

  // Initial load effect
  useEffect(() => {
    if (!sessionUser) return;
    
    // Load data based on active menu
    if (activeMenu === 'overview' && !data.overview) fetchFor('overview', () => analysisApi.getEvents(sessionUser._id, 10));
    else if (activeMenu === 'patients' && !data.patients) fetchFor('patients', () => usersApi.getAllPatients());
    else if (activeMenu === 'context' && !data.context) fetchFor('context', () => analysisApi.getBaselines(sessionUser._id));
    else if (activeMenu === 'baseline' && !data.baseline) fetchFor('baseline', () => analysisApi.getBaselines(sessionUser._id));
    else if (activeMenu === 'trajectory' && !data.trajectory) fetchFor('trajectory', () => analysisApi.getSegments(sessionUser._id, 60));
    else if (activeMenu === 'detection' && !data.detection) {
      fetchFor('detection', () => analysisApi.getEvents(sessionUser._id, 30)).then(res => {
        if (res?.data) setAnomalyKanban(res.data.map(e => ({ ...e, kanbanStatus: e.status === 'open' ? 'New' : 'Closed' })));
      });
    }
    else if (activeMenu === 'reports' && !data.metrics) fetchFor('metrics', () => analysisApi.getMetrics(sessionUser._id));
    else if (activeMenu === 'users' && !data.patients) fetchFor('patients', () => usersApi.getAllPatients());
  }, [activeMenu, sessionUser, fetchFor, data]);

  // Simulation intervals
  useEffect(() => {
    const timer = setInterval(() => {
      setMqRate(prev => {
        const noise = Math.floor(Math.random() * 20) - 10;
        return Math.max(0, Math.min(500, prev + noise));
      });
      if (w1State === 'Running') setW1Prog(p => p >= 100 ? 0 : p + Math.random() * 15);
      if (w2State === 'Running') setW2Prog(p => p >= 100 ? 0 : p + Math.random() * 10);
    }, 1500);
    return () => clearInterval(timer);
  }, [w1State, w2State]);

  // Handle participant click
  const openParticipant = async (pt) => {
    setSelectedPt(pt);
    setPtDetailTab('overview');
    setPtLoading(true);
    try {
      const [seg, ev, bsl] = await Promise.all([
        analysisApi.getSegments(pt._id, 60),
        analysisApi.getEvents(pt._id, 10),
        analysisApi.getBaselines(pt._id)
      ]);
      setPtData({ segments: seg.data?.data, events: ev.data?.data, baselines: bsl.data?.data });
    } catch (err) {
      console.error(err);
    } finally {
      setPtLoading(false);
    }
  };

  // Upload handler
  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setUploadError(null);
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const res = await logApi.uploadCSV(formData);
      setUploadResult(res.data);
      setUploadFile(null);
    } catch (err) {
      setUploadError(err.response?.data?.message || err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Kanban movement
  const moveKanban = (id, to) => {
    setAnomalyKanban(prev => prev.map(e => e._id === id ? { ...e, kanbanStatus: to } : e));
  };

  if (!sessionUser) return null;

  // ── Navigation Configuration ──
  const MENUS = [
    { id: 'overview', label: 'Overview', icon: FaChartLine, section: 'MAIN' },
    { id: 'patients', label: 'Participants', icon: FaUsers, section: 'MAIN' },
    { id: 'acquisition', label: 'Data Acquisition', icon: FaDatabase, section: 'PIPELINE' },
    { id: 'preprocessing', label: 'Preprocessing', icon: FaCogs, section: 'PIPELINE' },
    { id: 'context', label: 'Activity Context', icon: FaRunning, section: 'ANALYSIS' },
    { id: 'baseline', label: 'Baseline Models', icon: FaHeartbeat, section: 'ANALYSIS' },
    { id: 'trajectory', label: 'Trajectory Analysis', icon: FaChartLine, section: 'ANALYSIS' },
    { id: 'detection', label: 'Anomaly Detection', icon: FaExclamationTriangle, section: 'ANALYSIS' },
    { id: 'reports', label: 'Reports', icon: FaFileAlt, section: 'OUTPUTS' },
    { id: 'pipeline', label: 'Pipeline Monitor', icon: FaNetworkWired, section: 'SYSTEM' },
    { id: 'users', label: 'User Management', icon: FaUserShield, section: 'SYSTEM' },
    { id: 'settings', label: 'System Settings', icon: FaSlidersH, section: 'SYSTEM' },
  ];

  return (
    <div className="flex h-screen bg-brand-dark text-brand-text overflow-hidden selection:bg-sys-blue selection:text-white font-sans">
      {/* ── SIDEBAR ── */}
      <aside className={`bg-brand-cardLight border-r border-brand-border flex flex-col transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${menuOpen ? 'w-64' : 'w-20'}`}>
        <div className="h-16 flex items-center justify-between px-5 border-b border-brand-border shrink-0">
          {menuOpen && (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-sys-blue rounded flex items-center justify-center text-white font-black text-xs">V</div>
              <span className="font-black text-sm tracking-wide">VidyaMedic</span>
            </div>
          )}
          <button onClick={() => setMenuOpen(!menuOpen)} className="text-brand-muted hover:text-brand-text p-1.5 rounded-lg hover:bg-brand-border/50 transition-colors mx-auto">
            <FaBars />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-3 scrollbar-hide space-y-6">
          {['MAIN', 'PIPELINE', 'ANALYSIS', 'OUTPUTS', 'SYSTEM'].map((section) => {
            const sectionMenus = MENUS.filter(m => m.section === section);
            if (!sectionMenus.length) return null;
            return (
              <div key={section} className="space-y-1">
                {menuOpen && <span className="px-3 text-[9px] font-black tracking-widest text-brand-muted uppercase block mb-2">{section}</span>}
                {sectionMenus.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { setActiveMenu(m.id); setSelectedPt(null); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group text-xs font-semibold ${
                      activeMenu === m.id
                        ? 'bg-sys-blue text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                        : 'text-brand-muted hover:bg-brand-border/40 hover:text-brand-text'
                    }`}
                  >
                    <m.icon className={`text-base shrink-0 ${activeMenu === m.id ? 'text-white' : 'group-hover:text-sys-blue transition-colors'}`} />
                    {menuOpen && <span className="truncate">{m.label}</span>}
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-brand-border shrink-0">
          <div className={`flex items-center gap-3 bg-brand-border/30 p-3 rounded-xl ${!menuOpen && 'justify-center p-2'}`}>
            <div className="w-8 h-8 rounded-full bg-sys-purple/20 border border-sys-purple/50 flex items-center justify-center text-sys-purple font-bold shrink-0">
              {sessionUser.name.charAt(0).toUpperCase()}
            </div>
            {menuOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate text-brand-text">{sessionUser.name}</p>
                <p className="text-[10px] text-brand-muted truncate capitalize">{sessionUser.role}</p>
              </div>
            )}
            <button onClick={logout} className="text-brand-muted hover:text-sys-red transition-colors" title="Logout">
              <FaSignOutAlt />
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-brand-dark relative">
        <header className="h-16 px-8 border-b border-brand-border flex items-center justify-between shrink-0 bg-brand-card/50 backdrop-blur-md sticky top-0 z-10">
          <div>
            <h1 className="text-lg font-black tracking-tight uppercase">{MENUS.find(m => m.id === activeMenu)?.label} Panel</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-sys-green animate-pulse" />
              <span className="text-[10px] text-brand-muted font-mono tracking-wider">SYSTEM ONLINE · {new Date().toLocaleTimeString()}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/android')} className="text-xs font-bold text-sys-green px-3 py-1.5 rounded-lg border border-sys-green/20 bg-sys-green/10 hover:bg-sys-green/20 transition-colors">
              Android Simulator
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 scroll-smooth">
          <div className="max-w-6xl mx-auto">
            {activeMenu === 'overview' && (
              <Overview data={data} loading={loading} errors={errors} fetchFor={fetchFor} sessionUser={sessionUser} mqRate={mqRate} w1State={w1State} w2State={w2State} />
            )}
            {activeMenu === 'patients' && (
              <Participants data={data} loading={loading} errors={errors} fetchFor={fetchFor} selectedPt={selectedPt} setSelectedPt={setSelectedPt} ptDetailTab={ptDetailTab} setPtDetailTab={setPtDetailTab} ptData={ptData} ptLoading={ptLoading} openParticipant={openParticipant} />
            )}
            {activeMenu === 'acquisition' && (
              <Acquisition mqRate={mqRate} w1State={w1State} w2State={w2State} uploadFile={uploadFile} setUploadFile={setUploadFile} uploadResult={uploadResult} uploading={uploading} uploadError={uploadError} handleUpload={handleUpload} />
            )}
            {activeMenu === 'preprocessing' && (
              <Preprocessing w1Prog={w1Prog} w1State={w1State} setW1State={setW1State} w2Prog={w2Prog} w2State={w2State} setW2State={setW2State} />
            )}
            {activeMenu === 'context' && (
              <ActivityContext data={data} loading={loading} fetchFor={fetchFor} sessionUser={sessionUser} />
            )}
            {activeMenu === 'baseline' && (
              <BaselineModels data={data} loading={loading} sessionUser={sessionUser} />
            )}
            {activeMenu === 'trajectory' && (
              <TrajectoryAnalysis data={data} loading={loading} fetchFor={fetchFor} sessionUser={sessionUser} />
            )}
            {activeMenu === 'detection' && (
              <AnomalyDetection data={data} loading={loading} errors={errors} fetchFor={fetchFor} sessionUser={sessionUser} tlHover={tlHover} setTlHover={setTlHover} anomalyKanban={anomalyKanban} moveKanban={moveKanban} />
            )}
            {activeMenu === 'reports' && (
              <Reports data={data} loading={loading} errors={errors} fetchFor={fetchFor} sessionUser={sessionUser} />
            )}
            {activeMenu === 'pipeline' && (
              <PipelineMonitor mqRate={mqRate} w1Prog={w1Prog} w1State={w1State} setW1State={setW1State} w2Prog={w2Prog} w2State={w2State} setW2State={setW2State} sessionUser={sessionUser} />
            )}
            {activeMenu === 'users' && (
              <UserManagement data={data} loading={loading} fetchFor={fetchFor} />
            )}
            {activeMenu === 'settings' && (
              <SystemSettings />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
