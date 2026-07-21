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
      // Annotate the most recent open event, or create a new symptom log (backend route dependent)
      // Here we assume annotateEvent exists for the latest event
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
    if (cls === 'Alert') return 'bg-red-500';
    if (cls === 'Deviation') return 'bg-orange-500';
    return 'bg-green-500';
  };
  const getStatusText = (cls) => {
    if (cls === 'Alert') return 'text-red-500';
    if (cls === 'Deviation') return 'text-orange-500';
    return 'text-green-500';
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
    <div className="min-h-screen bg-brand-dark flex flex-col md:flex-row items-center justify-center p-4 font-sans">
      
      {/* Device Info (for web dashboard context) */}
      <div className="hidden md:block mr-12 max-w-sm text-brand-text">
        <h2 className="text-3xl font-black mb-2">Android Simulator</h2>
        <p className="text-brand-muted text-sm mb-6">
          This live simulator mirrors the exact UI of the Flutter VidyaMedic patient app. 
          It is connected natively to the Node.js backend.
        </p>

        <div className="bg-brand-card border border-brand-border rounded-2xl p-5 mb-4">
          <label className="block text-[10px] font-bold text-brand-muted uppercase mb-2">Simulated Patient</label>
          <select 
            className="w-full bg-brand-dark border border-brand-border rounded-xl px-3 py-2 text-sm text-brand-text outline-none focus:border-sys-blue"
            value={patient?._id || ''}
            onChange={(e) => setPatient(patientsList.find(p => p._id === e.target.value))}
          >
            {patientsList.map(p => (
              <option key={p._id} value={p._id}>{p.name} ({p.email})</option>
            ))}
          </select>
        </div>

        <button onClick={() => navigate('/web')} className="px-5 py-3 bg-sys-blue text-white rounded-xl font-bold text-sm hover:bg-sys-blue/80 transition-colors flex items-center gap-2">
          <FaChevronRight className="rotate-180" /> Back to Dashboard
        </button>
      </div>

      {/* Mobile Frame Wrapper */}
      <div className="relative w-full max-w-[400px] h-[850px] bg-black rounded-[50px] p-2 shadow-2xl border-4 border-[#2a2a2a] overflow-hidden shrink-0">
        
        {/* Notch */}
        <div className="absolute top-0 inset-x-0 h-7 flex justify-center z-50 pointer-events-none">
          <div className="w-32 h-7 bg-[#2a2a2a] rounded-b-3xl"></div>
        </div>

        {/* Android Screen Container */}
        <div className="relative w-full h-full bg-[#f4f7f6] rounded-[40px] overflow-hidden flex flex-col text-gray-900">
          
          {/* Status Bar */}
          <div className="h-12 pt-4 px-6 flex justify-between items-center text-xs font-bold shrink-0 bg-[#f4f7f6] z-40">
            <span>{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            <div className="flex items-center gap-2 text-gray-600">
              <FaSignal /> <FaWifi /> <FaBatteryThreeQuarters className="text-base" />
            </div>
          </div>

          {!patient || loading ? (
            <div className="flex-1 flex flex-col justify-center items-center">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-xs font-bold text-gray-500">Connecting to Backend...</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col relative overflow-hidden">
              
              {/* --- MAIN VIEWS --- */}
              <div className="flex-1 overflow-y-auto pb-20 scrollbar-hide relative">
                
                {/* 1. HOME (BERANDA) */}
                {activeTab === 'home' && (
                  <div className="p-6 pt-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    
                    {/* Header */}
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Hi, {patient.name.split(' ')[0]}</p>
                        <h1 className="text-2xl font-black tracking-tight text-gray-900">Pemantauan<br/>Aktif</h1>
                      </div>
                      <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center border border-gray-100">
                        <FaBluetooth className="text-blue-500 text-lg" />
                      </div>
                    </div>

                    {/* Sensor Connection Banner */}
                    <div className="bg-blue-50 rounded-2xl p-4 mb-6 flex items-center gap-4 border border-blue-100">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <FaHeartbeat className="text-blue-600 animate-pulse" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-blue-900">Polar H10 Connected</h3>
                        <p className="text-xs text-blue-600">Battery: 82% · Signal: Excellent</p>
                      </div>
                    </div>

                    {/* Main HR Circle */}
                    <div className="flex justify-center mb-6">
                      <div className={`relative w-64 h-64 rounded-full flex flex-col items-center justify-center shadow-xl transition-colors duration-500 ${getStatusColor(sysStatus)}`}>
                        <div className="absolute inset-2 rounded-full border-4 border-white/20"></div>
                        <FaHeartbeat className="text-4xl text-white/80 mb-2 animate-bounce-slow" />
                        <div className="flex items-baseline gap-1">
                          <span className="text-7xl font-black text-white tracking-tighter">{hrValue}</span>
                          <span className="text-lg font-bold text-white/80">bpm</span>
                        </div>
                        <span className="mt-2 text-sm font-bold text-white/90 bg-black/10 px-4 py-1 rounded-full backdrop-blur-sm shadow-sm">
                          {sysStatus}
                        </span>
                      </div>
                    </div>

                    {/* Mini Sparkline Chart */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6">
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-xs font-bold text-gray-400">Detak Jantung (15 menit)</span>
                        <FaChartLine className="text-gray-300" />
                      </div>
                      <div className="h-16 w-full relative">
                        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                          <path d={pathData} fill="none" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-2 text-gray-400 mb-2">
                          <FaSignal className="text-xs" /> <span className="text-xs font-bold">RR Interval</span>
                        </div>
                        <span className="text-2xl font-black text-gray-800">{rrValue}</span> <span className="text-xs text-gray-500">ms</span>
                      </div>
                      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-2 text-gray-400 mb-2">
                          <FaRunning className="text-xs" /> <span className="text-xs font-bold">Aktivitas</span>
                        </div>
                        <span className="text-lg font-black text-gray-800 leading-tight">{activityLabel}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. ACTIVITY / SYMPTOMS (AKTIVITAS) */}
                {activeTab === 'activity' && (
                  <div className="p-6 pt-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h1 className="text-2xl font-black tracking-tight text-gray-900 mb-6">Aktivitas & Gejala</h1>
                    
                    <div className="bg-blue-600 rounded-3xl p-6 shadow-lg shadow-blue-600/30 text-white mb-6">
                      <h3 className="text-sm font-semibold text-blue-100 mb-1">Aktivitas Saat Ini</h3>
                      <p className="text-3xl font-black tracking-tight mb-4">{activityLabel}</p>
                      
                      <div className="flex items-center gap-4 text-xs font-bold bg-white/10 p-3 rounded-2xl backdrop-blur-sm">
                        <FaExclamationTriangle className="text-orange-300 text-lg" />
                        <p>Merasa tidak nyaman?<br/><span className="text-blue-100 font-normal">Laporkan gejala langsung ke dokter.</span></p>
                      </div>
                    </div>

                    <button 
                      onClick={() => setActiveSubView('add_symptom')}
                      className="w-full bg-white border-2 border-dashed border-gray-300 rounded-3xl p-6 flex flex-col items-center justify-center text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-colors"
                    >
                      <FaNotesMedical className="text-3xl mb-3" />
                      <span className="font-bold text-sm text-gray-700">Catat Gejala Baru</span>
                      <span className="text-xs mt-1">Pusing, Nyeri Dada, Sesak</span>
                    </button>
                  </div>
                )}

                {/* 3. HISTORY (RIWAYAT) */}
                {activeTab === 'history' && (
                  <div className="p-6 pt-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h1 className="text-2xl font-black tracking-tight text-gray-900 mb-6">Riwayat Anomali</h1>
                    
                    {events.length === 0 ? (
                      <div className="text-center text-gray-400 py-10">Belum ada riwayat anomali tercatat.</div>
                    ) : (
                      <div className="space-y-4">
                        {events.map((ev, i) => (
                          <div key={ev._id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex gap-4">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-gray-50 border border-gray-100">
                              <FaExclamationTriangle className={`text-lg ${getStatusText(ev.classification)}`} />
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between items-start mb-1">
                                <h4 className="font-black text-sm text-gray-900">{ev.activity}</h4>
                                <span className="text-[10px] font-bold text-gray-400">{fmtDate(ev.onset_time)}</span>
                              </div>
                              <p className="text-xs text-gray-500 mb-2">Terjadi deviasi {ev.peak_score?.toFixed(1)} SD dari baseline normal Anda.</p>
                              <div className="flex gap-2">
                                <span className={`text-[9px] px-2 py-1 rounded-md font-bold ${getStatusColor(ev.classification)} text-white`}>{ev.classification}</span>
                                <span className="text-[9px] px-2 py-1 rounded-md font-bold bg-gray-100 text-gray-600">{ev.review_status}</span>
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
                    <h1 className="text-2xl font-black tracking-tight text-gray-900 mb-6">Profil</h1>
                    
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 text-center mb-6">
                      <div className="w-24 h-24 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl text-gray-300">
                        <FaUser />
                      </div>
                      <h3 className="text-lg font-black text-gray-900">{patient.name}</h3>
                      <p className="text-sm text-gray-500">{patient.email}</p>
                    </div>

                    <div className="space-y-3">
                      <button className="w-full bg-white rounded-2xl p-4 flex items-center justify-between border border-gray-100 active:bg-gray-50">
                        <span className="font-bold text-sm text-gray-700">Pengaturan Sensor</span>
                        <FaChevronRight className="text-gray-400 text-xs" />
                      </button>
                      <button className="w-full bg-white rounded-2xl p-4 flex items-center justify-between border border-gray-100 active:bg-gray-50">
                        <span className="font-bold text-sm text-gray-700">Kontak Darurat</span>
                        <FaChevronRight className="text-gray-400 text-xs" />
                      </button>
                      <button onClick={() => navigate('/web')} className="w-full bg-red-50 text-red-600 rounded-2xl p-4 flex items-center justify-center font-bold text-sm mt-8 active:bg-red-100">
                        Keluar (Exit Simulator)
                      </button>
                    </div>
                  </div>
                )}


                {/* --- SUB VIEWS (Overlays) --- */}
                {activeSubView === 'add_symptom' && (
                  <div className="absolute inset-0 bg-[#f4f7f6] z-30 flex flex-col animate-in slide-in-from-right-4 duration-300">
                    <div className="p-6 pt-2 flex-1 overflow-y-auto">
                      <button onClick={() => setActiveSubView(null)} className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm mb-6 active:scale-95 transition-transform">
                        <FaArrowLeft className="text-gray-600" />
                      </button>
                      
                      <h2 className="text-2xl font-black text-gray-900 mb-2">Catat Gejala</h2>
                      <p className="text-sm text-gray-500 mb-8">Data ini akan langsung terkirim ke dashboard dokter Anda untuk dianalisis bersama data detak jantung.</p>

                      <form onSubmit={handleAddSymptom} className="space-y-6">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Deskripsi Gejala</label>
                          <textarea 
                            required
                            value={symptomText}
                            onChange={(e) => setSymptomText(e.target.value)}
                            placeholder="Contoh: Saya merasa pusing dan dada sedikit nyeri setelah menaiki tangga..."
                            className="w-full h-32 bg-white border border-gray-200 rounded-2xl p-4 text-sm text-gray-800 focus:outline-none focus:border-blue-500 resize-none shadow-sm"
                          ></textarea>
                        </div>

                        <button 
                          type="submit" 
                          disabled={submittingSymptom}
                          className="w-full bg-blue-600 text-white font-black text-sm py-4 rounded-2xl shadow-lg shadow-blue-600/30 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          {submittingSymptom ? 'Mengirim...' : <><FaCheckCircle /> Kirim Laporan</>}
                        </button>
                      </form>
                    </div>
                  </div>
                )}

              </div>

              {/* --- BOTTOM NAVIGATION BAR --- */}
              <div className="absolute bottom-0 inset-x-0 h-20 bg-white border-t border-gray-100 flex items-center justify-around px-2 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] rounded-b-[40px] z-20 pb-2">
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
                      className={`flex flex-col items-center justify-center w-16 h-12 relative transition-all duration-300 ${isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      <tab.icon className={`text-xl mb-1 transition-transform duration-300 ${isActive ? '-translate-y-1' : ''}`} />
                      <span className={`text-[9px] font-bold transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0'}`}>{tab.label}</span>
                      {isActive && <div className="absolute -bottom-1 w-1 h-1 bg-blue-600 rounded-full"></div>}
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
