import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FaHeartbeat, FaHistory, FaUser, FaRunning, FaChevronRight,
  FaSignal, FaBatteryThreeQuarters, FaWifi, FaExclamationTriangle,
  FaCheckCircle, FaBluetooth, FaHome, FaSignOutAlt, FaNotesMedical,
  FaArrowLeft, FaChartLine
} from 'react-icons/fa';
import { usersApi, analysisApi } from '../utls/api';
import { fmtTime, fmtDate } from '../components/dashboard/DashboardShared';

export default function AndroidApp() {
  const navigate = useNavigate();
  
  // Real Backend Data States
  const [patient, setPatient] = useState(null);
  const [patientsList, setPatientsList] = useState([]);
  
  const [liveSegment, setLiveSegment] = useState(null);
  const [events, setEvents] = useState([]);
  const [baselines, setBaselines] = useState([]);
  
  const [activeTab, setActiveTab] = useState('home'); // home, activity, history, profile
  const [activeSubView, setActiveSubView] = useState(null); // null, alert, add_symptom
  const [loading, setLoading] = useState(true);

  // Trajectory Sparkline
  const [hrHistory, setHrHistory] = useState([70,72,71,73,72,70,71]);

  // Polling ref
  const pollTimer = useRef(null);

  // 1. Fetch Patients & select first
  useEffect(() => {
    usersApi.getAllPatients().then(res => {
      if (res?.data?.length > 0) {
        setPatientsList(res.data);
        setPatient(res.data[0]);
      }
    }).catch(console.error);
  }, []);

  // 2. Fetch Initial Data for selected patient & start polling
  useEffect(() => {
    if (!patient) return;
    setLoading(true);

    const loadData = async () => {
      try {
        const [segRes, evtRes, bslRes] = await Promise.all([
          analysisApi.getSegments(patient._id, 15), // Last 15 segments for mini chart
          analysisApi.getEvents(patient._id, 20),
          analysisApi.getBaselines(patient._id)
        ]);

        if (segRes.data?.length > 0) {
          setLiveSegment(segRes.data[0]);
          setHrHistory(segRes.data.reverse().map(s => s.features?.mean_hr || 0));
        }
        if (evtRes.data) setEvents(evtRes.data);
        if (bslRes.data) setBaselines(bslRes.data);
      } catch (err) {
        console.error('Error loading patient data', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Live Polling (every 5 seconds)
    pollTimer.current = setInterval(async () => {
      try {
        const res = await analysisApi.getSegments(patient._id, 1);
        if (res.data?.length > 0) {
          const newSeg = res.data[0];
          setLiveSegment(newSeg);
          setHrHistory(prev => {
            const hr = newSeg.features?.mean_hr || 0;
            if (prev[prev.length - 1] === hr) return prev; // no change
            return [...prev.slice(1), hr];
          });
        }
      } catch(e) {}
    }, 5000);

    return () => clearInterval(pollTimer.current);
  }, [patient]);

  // Handle Symptom Submit
  const [symptomText, setSymptomText] = useState('');
  const [submittingSymptom, setSubmittingSymptom] = useState(false);

  const handleAddSymptom = async (e) => {
    e.preventDefault();
    if (!symptomText || !events[0]) return;
    setSubmittingSymptom(true);
    try {
      const latestEventId = events[0]._id; 
      await analysisApi.annotateEvent(latestEventId, `Symptom Reported: ${symptomText}`, Date.now());
      alert('Gejala berhasil dilaporkan!');
      setActiveSubView(null);
      setSymptomText('');
    } catch (err) {
      alert('Gagal mengirim gejala: ' + err.message);
    } finally {
      setSubmittingSymptom(false);
    }
  };


  // --- Helper UI Getters ---
  const getStatusColor = (cls) => {
    if (cls === 'Alert') return 'bg-htm-alert';
    if (cls === 'Deviation') return 'bg-htm-caution';
    return 'bg-htm-stable';
  };
  const getStatusText = (cls) => {
    if (cls === 'Alert') return 'text-htm-alert';
    if (cls === 'Deviation') return 'text-htm-caution';
    return 'text-htm-stable';
  };

  const hrValue = Math.round(liveSegment?.features?.mean_hr || 0);
  const rrValue = Math.round(liveSegment?.features?.mean_rr || 0);
  const rrmsValue = Math.round(liveSegment?.features?.rmssd || 0);
  const activityLabel = liveSegment?.activity_label || 'Duduk';
  const sysStatus = liveSegment?.classification || 'Stable';

  // Build SVG Path for HR
  const maxHr = Math.max(...hrHistory, 120);
  const minHr = Math.min(...hrHistory, 50);
  const pathData = hrHistory.map((val, i) => {
    const x = (i / Math.max(1, hrHistory.length - 1)) * 100;
    const y = 100 - (((val - minHr) / Math.max(1, maxHr - minHr)) * 100);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  return (
    <div className="min-h-screen bg-htm-canvas flex flex-col md:flex-row items-center justify-center p-4 font-plex">
      
      {/* Device Info (for web dashboard context) */}
      <div className="hidden md:block mr-12 max-w-sm text-htm-ink">
        <h2 className="font-fraunces text-4xl font-black mb-3">Android Simulator</h2>
        <p className="text-htm-muted htm-body-sm mb-8">
          This live simulator mirrors the exact UI of the VidyaMedic patient app, restyled in the "Clinical Calm" design language.
          It is connected natively to the Node.js backend.
        </p>

        <div className="htm-card p-6 mb-6">
          <label className="htm-eyebrow block mb-2">Simulated Patient</label>
          <div className="htm-input-wrap">
            <select 
              className="htm-input w-full"
              value={patient?._id || ''}
              onChange={(e) => setPatient(patientsList.find(p => p._id === e.target.value))}
            >
              {patientsList.map(p => (
                <option key={p._id} value={p._id}>{p.name} ({p.email})</option>
              ))}
            </select>
          </div>
        </div>

        <button onClick={() => navigate('/web')} className="htm-btn htm-btn-primary w-full flex items-center justify-center gap-2">
          <FaChevronRight className="rotate-180" /> Back to Dashboard
        </button>
      </div>

      {/* Mobile Frame Wrapper */}
      <div className="relative w-full max-w-[400px] h-[850px] bg-htm-ink rounded-[50px] p-2 shadow-2xl border-[6px] border-htm-ink overflow-hidden shrink-0">
        
        {/* Notch */}
        <div className="absolute top-0 inset-x-0 h-7 flex justify-center z-50 pointer-events-none">
          <div className="w-32 h-7 bg-htm-ink rounded-b-3xl"></div>
        </div>

        {/* Android Screen Container */}
        <div className="relative w-full h-full bg-htm-canvas rounded-[40px] overflow-hidden flex flex-col text-htm-ink">
          
          {/* Status Bar */}
          <div className="h-12 pt-4 px-6 flex justify-between items-center text-xs font-bold shrink-0 bg-transparent z-40 text-htm-ink htm-mono-sm">
            <span>{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            <div className="flex items-center gap-2 text-htm-sub">
              <FaSignal /> <FaWifi /> <FaBatteryThreeQuarters className="text-base" />
            </div>
          </div>

          {!patient || loading ? (
            <div className="flex-1 flex flex-col justify-center items-center">
              <div className="w-10 h-10 border-4 border-htm-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-xs font-bold text-htm-sub">Connecting to Backend...</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col relative overflow-hidden">
              
              {/* --- MAIN VIEWS --- */}
              <div className="flex-1 overflow-y-auto pb-24 scrollbar-hide relative">
                
                {/* 1. HOME (BERANDA) */}
                {activeTab === 'home' && (
                  <div className="p-6 pt-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    
                    {/* Header */}
                    <div className="flex justify-between items-center mb-8">
                      <div>
                        <p className="htm-eyebrow text-htm-muted">Hi, {patient.name.split(' ')[0]}</p>
                        <h1 className="font-fraunces text-3xl font-bold tracking-tight text-htm-ink leading-tight mt-1">Pemantauan<br/>Aktif</h1>
                      </div>
                      <div className="w-12 h-12 bg-htm-surface rounded-full shadow-sm flex items-center justify-center border border-htm-hairline">
                        <FaBluetooth className="text-htm-info text-lg" />
                      </div>
                    </div>

                    {/* Sensor Connection Banner */}
                    <div className="bg-htm-surface rounded-2xl p-4 mb-8 flex items-center gap-4 border border-htm-hairline shadow-sm">
                      <div className="w-10 h-10 rounded-full bg-htm-canvas flex items-center justify-center shrink-0 border border-htm-hairline">
                        <FaHeartbeat className="text-htm-primary animate-htm-heartbeat" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-htm-ink">Polar H10 Connected</h3>
                        <p className="text-[11px] font-medium text-htm-sub mt-0.5">Battery: 82% · Signal: Excellent</p>
                      </div>
                    </div>

                    {/* Main HR Circle */}
                    <div className="flex justify-center mb-8">
                      <div className={`relative w-[280px] h-[280px] rounded-full flex flex-col items-center justify-center shadow-lg transition-colors duration-500 ${getStatusColor(sysStatus)}`}>
                        <div className="absolute inset-3 rounded-full border border-white/20"></div>
                        <FaHeartbeat className="text-4xl text-white/90 mb-4 animate-htm-heartbeat" />
                        <div className="flex items-baseline gap-1">
                          <span className="font-fraunces text-8xl font-black text-white tracking-tighter" style={{ lineHeight: 0.9 }}>{hrValue}</span>
                          <span className="text-xl font-medium text-white/80">bpm</span>
                        </div>
                        <span className="mt-4 text-xs font-bold text-white/95 bg-black/15 px-4 py-1.5 rounded-full backdrop-blur-md shadow-sm tracking-wide uppercase">
                          {sysStatus}
                        </span>
                      </div>
                    </div>

                    {/* Mini Sparkline Chart */}
                    <div className="bg-htm-surface rounded-2xl p-5 shadow-sm border border-htm-hairline mb-6">
                      <div className="flex justify-between items-end mb-3">
                        <span className="htm-eyebrow text-htm-muted">Detak Jantung (15 menit)</span>
                        <FaChartLine className="text-htm-sub" />
                      </div>
                      <div className="h-16 w-full relative">
                        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                          <path d={pathData} fill="none" stroke="var(--htm-info)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-htm-surface rounded-2xl p-5 shadow-sm border border-htm-hairline">
                        <div className="flex items-center gap-2 mb-2">
                          <FaSignal className="text-[10px] text-htm-muted" /> <span className="htm-eyebrow text-htm-muted">RR Interval</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="font-fraunces text-2xl font-bold text-htm-ink">{rrValue}</span>
                          <span className="text-xs font-medium text-htm-sub">ms</span>
                        </div>
                      </div>
                      <div className="bg-htm-surface rounded-2xl p-5 shadow-sm border border-htm-hairline">
                        <div className="flex items-center gap-2 mb-2">
                          <FaRunning className="text-[10px] text-htm-muted" /> <span className="htm-eyebrow text-htm-muted">Aktivitas</span>
                        </div>
                        <span className="text-lg font-bold text-htm-ink leading-tight">{activityLabel}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. ACTIVITY / SYMPTOMS (AKTIVITAS) */}
                {activeTab === 'activity' && (
                  <div className="p-6 pt-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h1 className="font-fraunces text-3xl font-bold tracking-tight text-htm-ink mb-8">Aktivitas & Gejala</h1>
                    
                    <div className="bg-htm-primary rounded-3xl p-6 shadow-md text-white mb-6">
                      <h3 className="htm-eyebrow text-white/70 mb-2">Aktivitas Saat Ini</h3>
                      <p className="font-fraunces text-4xl font-bold tracking-tight mb-6">{activityLabel}</p>
                      
                      <div className="flex items-start gap-4 text-xs font-medium bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
                        <FaExclamationTriangle className="text-htm-caution text-xl shrink-0 mt-0.5" style={{ color: '#fcd34d' }} />
                        <p className="leading-relaxed">Merasa tidak nyaman?<br/><span className="text-white/80">Laporkan gejala langsung ke dokter.</span></p>
                      </div>
                    </div>

                    <button 
                      onClick={() => setActiveSubView('add_symptom')}
                      className="w-full bg-htm-surface border-2 border-dashed border-htm-divider rounded-3xl p-8 flex flex-col items-center justify-center text-htm-sub hover:border-htm-primary hover:text-htm-primary transition-colors"
                    >
                      <FaNotesMedical className="text-3xl mb-4 opacity-70" />
                      <span className="font-bold text-base text-htm-ink mb-1">Catat Gejala Baru</span>
                      <span className="text-xs font-medium opacity-80">Pusing, Nyeri Dada, Sesak</span>
                    </button>
                  </div>
                )}

                {/* 3. HISTORY (RIWAYAT) */}
                {activeTab === 'history' && (
                  <div className="p-6 pt-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h1 className="font-fraunces text-3xl font-bold tracking-tight text-htm-ink mb-8">Riwayat Anomali</h1>
                    
                    {events.length === 0 ? (
                      <div className="text-center text-htm-muted py-12 htm-body-sm">Belum ada riwayat anomali tercatat.</div>
                    ) : (
                      <div className="space-y-4">
                        {events.map((ev, i) => (
                          <div key={ev._id} className="bg-htm-surface rounded-2xl p-5 shadow-sm border border-htm-hairline flex gap-4">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-htm-canvas border border-htm-hairline">
                              <FaExclamationTriangle className={`text-lg ${getStatusText(ev.classification)}`} />
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold text-sm text-htm-ink leading-tight">{ev.activity}</h4>
                                <span className="htm-mono-sm text-htm-muted">{fmtDate(ev.onset_time)}</span>
                              </div>
                              <p className="text-xs font-medium text-htm-sub mb-3 leading-relaxed">Terjadi deviasi {ev.peak_score?.toFixed(1)} SD dari baseline normal Anda.</p>
                              <div className="flex gap-2">
                                <span className={`text-[10px] px-2.5 py-1 rounded-md font-bold ${getStatusColor(ev.classification)} text-white uppercase tracking-wider`}>{ev.classification}</span>
                                <span className="text-[10px] px-2.5 py-1 rounded-md font-bold bg-htm-raised text-htm-sub uppercase tracking-wider">{ev.review_status}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. PROFILE */}
                {activeTab === 'profile' && (
                  <div className="p-6 pt-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h1 className="font-fraunces text-3xl font-bold tracking-tight text-htm-ink mb-8">Profil</h1>
                    
                    <div className="bg-htm-surface rounded-3xl p-8 shadow-sm border border-htm-hairline text-center mb-6">
                      <div className="w-24 h-24 bg-htm-canvas rounded-full mx-auto mb-5 flex items-center justify-center text-4xl text-htm-divider border border-htm-hairline">
                        <FaUser />
                      </div>
                      <h3 className="text-xl font-bold text-htm-ink mb-1">{patient.name}</h3>
                      <p className="text-sm font-medium text-htm-sub">{patient.email}</p>
                    </div>

                    <div className="space-y-3">
                      <button className="w-full bg-htm-surface rounded-2xl p-5 flex items-center justify-between border border-htm-hairline active:bg-htm-raised transition-colors">
                        <span className="font-bold text-sm text-htm-ink">Pengaturan Sensor</span>
                        <FaChevronRight className="text-htm-divider text-xs" />
                      </button>
                      <button className="w-full bg-htm-surface rounded-2xl p-5 flex items-center justify-between border border-htm-hairline active:bg-htm-raised transition-colors">
                        <span className="font-bold text-sm text-htm-ink">Kontak Darurat</span>
                        <FaChevronRight className="text-htm-divider text-xs" />
                      </button>
                      <button onClick={() => navigate('/web')} className="w-full rounded-2xl p-5 flex items-center justify-center font-bold text-sm mt-8 active:scale-95 transition-transform" style={{ background: 'var(--htm-alert-bg)', color: 'var(--htm-alert)', border: '1px solid rgba(185,28,28,0.2)' }}>
                        Keluar (Exit Simulator)
                      </button>
                    </div>
                  </div>
                )}


                {/* --- SUB VIEWS (Overlays) --- */}
                {activeSubView === 'add_symptom' && (
                  <div className="absolute inset-0 bg-htm-canvas z-30 flex flex-col animate-in slide-in-from-right-4 duration-300">
                    <div className="p-6 pt-2 flex-1 overflow-y-auto">
                      <button onClick={() => setActiveSubView(null)} className="w-12 h-12 bg-htm-surface rounded-full flex items-center justify-center shadow-sm mb-8 active:scale-95 transition-transform border border-htm-hairline">
                        <FaArrowLeft className="text-htm-sub" />
                      </button>
                      
                      <h2 className="font-fraunces text-3xl font-bold text-htm-ink mb-3">Catat Gejala</h2>
                      <p className="text-sm font-medium text-htm-sub mb-8 leading-relaxed">Data ini akan langsung terkirim ke dashboard dokter Anda untuk dianalisis bersama data detak jantung.</p>

                      <form onSubmit={handleAddSymptom} className="space-y-8">
                        <div>
                          <label className="htm-eyebrow block mb-3">Deskripsi Gejala</label>
                          <textarea 
                            required
                            value={symptomText}
                            onChange={(e) => setSymptomText(e.target.value)}
                            placeholder="Contoh: Saya merasa pusing dan dada sedikit nyeri setelah menaiki tangga..."
                            className="w-full h-32 bg-htm-surface border border-htm-divider rounded-2xl p-5 text-sm text-htm-ink focus:outline-none focus:border-htm-primary resize-none shadow-sm transition-colors"
                          ></textarea>
                        </div>

                        <button 
                          type="submit" 
                          disabled={submittingSymptom}
                          className="w-full bg-htm-primary text-white font-bold text-sm py-4 rounded-2xl shadow-md hover:bg-htm-stable active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          {submittingSymptom ? 'Mengirim...' : <><FaCheckCircle className="text-lg" /> Kirim Laporan</>}
                        </button>
                      </form>
                    </div>
                  </div>
                )}

              </div>

              {/* --- BOTTOM NAVIGATION BAR --- */}
              <div className="absolute bottom-0 inset-x-0 h-24 bg-htm-surface border-t border-htm-hairline flex items-center justify-around px-2 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] rounded-b-[40px] z-20 pb-4">
                {[
                  { id: 'home', icon: FaHome, label: 'Beranda' },
                  { id: 'activity', icon: FaRunning, label: 'Aktivitas' },
                  { id: 'history', icon: FaHistory, label: 'Riwayat' },
                  { id: 'profile', icon: FaUser, label: 'Profil' }
                ].map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button 
                      key={tab.id}
                      onClick={() => { setActiveTab(tab.id); setActiveSubView(null); }}
                      className={`flex flex-col items-center justify-center w-16 h-14 relative transition-all duration-300 ${isActive ? 'text-htm-primary' : 'text-htm-muted hover:text-htm-sub'}`}
                    >
                      <tab.icon className={`text-2xl mb-1.5 transition-transform duration-300 ${isActive ? '-translate-y-1' : ''}`} />
                      <span className={`text-[10px] font-bold transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0'}`}>{tab.label}</span>
                      {isActive && <div className="absolute -bottom-1 w-1.5 h-1.5 bg-htm-primary rounded-full"></div>}
                    </button>
                  );
                })}
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
