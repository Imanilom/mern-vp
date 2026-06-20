import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import Side from '../../components/Side';
import AOS from 'aos';
import { 
  FaExclamationTriangle, 
  FaCheckCircle, 
  FaClock, 
  FaChevronDown, 
  FaChevronUp, 
  FaChartLine, 
  FaHeartbeat, 
  FaRunning,
  FaRedo
} from 'react-icons/fa';

function AnomalyHistory() {
  const { currentUser, DocterPatient } = useSelector((state) => state.user);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(20);
  const [expandedEventId, setExpandedEventId] = useState(null);

  // Determine patient info based on logged-in user role
  const isDoctor = currentUser.role === 'doctor';
  const targetPatient = isDoctor ? DocterPatient : currentUser;

  const fetchEvents = async () => {
    if (!targetPatient?._id) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/analysis/events/${targetPatient._id}?limit=${limit}`);
      const result = await res.json();
      if (result.success) {
        setEvents(result.data || []);
      } else {
        setEvents([]);
      }
    } catch (error) {
      console.error("Error fetching anomaly events:", error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    AOS.init({ duration: 700 });
    fetchEvents();
  }, [targetPatient?._id, limit]);

  const toggleExpandEvent = (eventId) => {
    setExpandedEventId(expandedEventId === eventId ? null : eventId);
  };

  // Helper to format timestamps to readable strings
  const formatTime = (ts) => {
    if (!ts) return '-';
    return new Date(ts).toLocaleString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Helper to format milliseconds to minutes & seconds
  const formatDuration = (ms) => {
    if (ms === null || ms === undefined || isNaN(ms)) return '-';
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins} menit ${secs} detik`;
  };

  // Helper to choose Z-score bar color
  const getZScoreColor = (zValue) => {
    const absZ = Math.abs(zValue || 0);
    if (absZ >= 3.0) return 'bg-red-500 text-white';
    if (absZ >= 1.5) return 'bg-amber-500 text-black';
    return 'bg-green-500 text-white';
  };

  // Helper to choose Z-score text description
  const getZScoreStatusText = (zValue) => {
    const absZ = Math.abs(zValue || 0);
    if (absZ >= 3.0) return 'Deviasi Alert (Tinggi)';
    if (absZ >= 1.5) return 'Deviasi Caution (Sedang)';
    return 'Normal';
  };

  return (
    <main className="bg-[#101010] dark:bg-[#FEFCF5] dark:text-[#073B4C] text-white flex min-h-screen">
      <Side />
      <div className="w-11/12 lg:w-full xl:w-9/12 mb-12 px-4 mx-auto mt-8 lg:mt-16">
        <div data-aos="fade-up" className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold capitalize lg:text-4xl mb-3 flex items-center gap-3">
              <FaExclamationTriangle className="text-amber-500 animate-pulse text-2xl md:text-3xl" />
              Riwayat Deteksi Anomali
            </h1>
            <p className="text-gray-400 dark:text-gray-600">
              Visualisasi kejadian anomali fisiologis (Layer 3) beserta parameter pemulihan (Recovery Time).
            </p>
          </div>

          <div className="mt-4 md:mt-0 flex items-center gap-3">
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="lg:p-2 p-2 bg-[#2C2C2C] dark:bg-[#E7E7E7] rounded text-sm text-white dark:text-[#073B4C] border border-gray-700 dark:border-gray-300 focus:outline-none"
            >
              <option value={10}>10 Terakhir</option>
              <option value={20}>20 Terakhir</option>
              <option value={50}>50 Terakhir</option>
              <option value={100}>100 Terakhir</option>
            </select>
            
            <button
              onClick={fetchEvents}
              className="p-2 bg-[#005A8F] hover:bg-[#005A8F]/80 text-white rounded text-sm flex items-center gap-2 transition duration-200"
              title="Refresh Data"
            >
              <FaRedo className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>

        {/* Patient Info Card (For Doctor Role) */}
        {isDoctor && DocterPatient && (
          <div data-aos="fade-right" className="bg-[#1f1f1f] dark:bg-[#E7E7E7] border border-[#005A8F]/30 dark:border-[#217170]/30 rounded-lg p-4 mb-6 flex items-center gap-4 shadow-md">
            <img 
              src={DocterPatient.profilePicture} 
              alt={DocterPatient.name} 
              className="w-12 h-12 rounded-full object-cover border border-[#005A8F] dark:border-[#217170]"
            />
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Memantau Pasien</p>
              <h2 className="font-semibold text-lg">{DocterPatient.name}</h2>
              <p className="text-xs text-gray-400 dark:text-gray-600">Alamat: {DocterPatient.address || '-'}</p>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-t-[#005A8F] border-r-[#005A8F]/30 border-b-[#005A8F]/30 border-l-[#005A8F]/30 dark:border-t-[#217170] dark:border-r-[#217170]/30 dark:border-b-[#217170]/30 dark:border-l-[#217170]/30 rounded-full animate-spin"></div>
            <p className="mt-4 font-semibold text-gray-400 dark:text-gray-600">Memuat riwayat anomali...</p>
          </div>
        ) : events.length === 0 ? (
          <div data-aos="fade-up" className="bg-[#1a1a1a] dark:bg-[#CBCBCB]/30 border border-gray-800 dark:border-gray-300 rounded-xl p-10 text-center shadow-lg">
            <FaCheckCircle className="text-green-500 text-5xl mx-auto mb-4 animate-bounce" />
            <h3 className="text-xl font-medium mb-2">Semua Sistem Stabil</h3>
            <p className="text-gray-400 dark:text-gray-600">
              Tidak ada riwayat kejadian anomali yang terdeteksi untuk {isDoctor ? 'pasien ini' : 'Anda'}.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => {
              const isExpanded = expandedEventId === event._id;
              const isAlert = event.classification === 'Alert';
              const isClosed = event.status === 'closed';

              return (
                <div 
                  key={event._id}
                  data-aos="fade-up"
                  className={`bg-[#1c1c1c] dark:bg-[#E7E7E7] border transition-all duration-300 rounded-xl shadow-lg overflow-hidden ${
                    isExpanded 
                      ? 'border-[#005A8F] dark:border-[#217170]' 
                      : 'border-transparent hover:border-gray-800 dark:hover:border-gray-300'
                  }`}
                >
                  {/* Collapsed Header */}
                  <div 
                    onClick={() => toggleExpandEvent(event._id)}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-4">
                      {/* Classification Badge */}
                      <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase ${
                        isAlert 
                          ? 'bg-red-600 text-white animate-pulse' 
                          : 'bg-amber-500 text-black'
                      }`}>
                        {event.classification}
                      </span>

                      {/* Status Badge */}
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                        isClosed 
                          ? 'border-green-500 text-green-500 bg-green-500/10' 
                          : 'border-blue-500 text-blue-500 bg-blue-500/10'
                      }`}>
                        {isClosed ? 'Resolved' : 'Active / Open'}
                      </span>

                      <div>
                        <h4 className="font-semibold text-base flex items-center gap-2">
                          <FaRunning className="text-gray-400 text-sm" />
                          Aktivitas: {event.activity || 'Rest'}
                        </h4>
                        <span className="text-xs text-gray-500 dark:text-gray-600 flex items-center gap-1 mt-1">
                          <FaClock /> {formatTime(event.onset_time)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-6">
                      <div className="text-right">
                        <p className="text-xs text-gray-500 dark:text-gray-600">Peak Score</p>
                        <p className="font-bold text-lg text-[#07AC7B] dark:text-[#217170]">
                          {event.peak_score ? event.peak_score.toFixed(2) : '-'}
                        </p>
                      </div>

                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-gray-500 dark:text-gray-600">Recovery Time</p>
                        <p className="font-semibold text-sm">
                          {event.trajectory?.recovery_time_ms ? `${(event.trajectory.recovery_time_ms / 1000 / 60).toFixed(1)} menit` : '-'}
                        </p>
                      </div>

                      <div>
                        {isExpanded ? <FaChevronUp className="text-gray-400" /> : <FaChevronDown className="text-gray-400" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-gray-800 dark:border-gray-300 pt-5 bg-[#141414]/30 dark:bg-white/30 grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
                      
                      {/* Left: Trajectory & Timeline Details */}
                      <div className="space-y-4">
                        <h5 className="font-semibold text-sm uppercase tracking-wider text-gray-400 dark:text-gray-600 border-b border-gray-800 dark:border-gray-300 pb-2 flex items-center gap-2">
                          <FaChartLine className="text-[#07AC7B] dark:text-[#217170]" />
                          Analisis Trajectory & Timeline
                        </h5>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="p-3 bg-[#1e1e1e] dark:bg-[#CBCBCB]/30 rounded-lg">
                            <span className="text-xs text-gray-500 dark:text-gray-600 block">Onset Time</span>
                            <span className="font-medium text-xs sm:text-sm">{formatTime(event.onset_time)}</span>
                          </div>

                          <div className="p-3 bg-[#1e1e1e] dark:bg-[#CBCBCB]/30 rounded-lg">
                            <span className="text-xs text-gray-500 dark:text-gray-600 block">Peak Time</span>
                            <span className="font-medium text-xs sm:text-sm">{formatTime(event.peak_time)}</span>
                          </div>

                          <div className="p-3 bg-[#1e1e1e] dark:bg-[#CBCBCB]/30 rounded-lg">
                            <span className="text-xs text-gray-500 dark:text-gray-600 block">Resolved Time</span>
                            <span className="font-medium text-xs sm:text-sm">{formatTime(event.resolved_time)}</span>
                          </div>

                          <div className="p-3 bg-[#1e1e1e] dark:bg-[#CBCBCB]/30 rounded-lg">
                            <span className="text-xs text-gray-500 dark:text-gray-600 block">Total Durasi</span>
                            <span className="font-bold text-xs sm:text-sm text-[#07AC7B] dark:text-[#217170]">
                              {formatDuration(event.duration_ms)}
                            </span>
                          </div>

                          <div className="p-3 bg-[#1e1e1e] dark:bg-[#CBCBCB]/30 rounded-lg border border-[#005A8F]/20 dark:border-[#217170]/20">
                            <span className="text-xs text-gray-500 dark:text-gray-600 block">Recovery Time (Waktu Pemulihan)</span>
                            <span className="font-bold text-sm text-green-500">
                              {formatDuration(event.trajectory?.recovery_time_ms)}
                            </span>
                            <span className="text-[10px] text-gray-400 block mt-1">Durasi parameter kembali stabil dari puncak.</span>
                          </div>

                          <div className="p-3 bg-[#1e1e1e] dark:bg-[#CBCBCB]/30 rounded-lg">
                            <span className="text-xs text-gray-500 dark:text-gray-600 block">Kenaikan Fisiologis (Delta HR)</span>
                            <span className="font-bold text-sm flex items-center gap-1">
                              <FaHeartbeat className="text-red-500" />
                              {event.trajectory?.delta_hr ?? 0} bpm
                            </span>
                          </div>

                          <div className="p-3 bg-[#1e1e1e] dark:bg-[#CBCBCB]/30 rounded-lg">
                            <span className="text-xs text-gray-500 dark:text-gray-600 block">Slope HR (Kemiringan Puncak)</span>
                            <span className="font-medium text-sm">{event.trajectory?.slope_hr ?? 0}</span>
                          </div>

                          <div className="p-3 bg-[#1e1e1e] dark:bg-[#CBCBCB]/30 rounded-lg">
                            <span className="text-xs text-gray-500 dark:text-gray-600 block">Persistensi Segmen</span>
                            <span className="font-medium text-sm">{event.trajectory?.persistence ?? 0} segmen</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Z-Scores Contributor Breakdown */}
                      <div className="space-y-4">
                        <h5 className="font-semibold text-sm uppercase tracking-wider text-gray-400 dark:text-gray-600 border-b border-gray-800 dark:border-gray-300 pb-2 flex items-center gap-2">
                          <FaHeartbeat className="text-red-500" />
                          Z-score Deviasi Kontributor (At Peak)
                        </h5>

                        <div className="space-y-3.5">
                          {/* HR */}
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-semibold">Heart Rate (HR)</span>
                              <span className="text-gray-400 dark:text-gray-600">
                                Z-score: {event.z_scores_at_peak?.z_hr?.toFixed(2) || '0'} ({getZScoreStatusText(event.z_scores_at_peak?.z_hr)})
                              </span>
                            </div>
                            <div className="w-full bg-[#2a2a2a] dark:bg-gray-300 h-2.5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${getZScoreColor(event.z_scores_at_peak?.z_hr)}`}
                                style={{ width: `${Math.min((Math.abs(event.z_scores_at_peak?.z_hr || 0) / 4) * 100, 100)}%` }}
                              ></div>
                            </div>
                          </div>

                          {/* RR */}
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-semibold">RR Interval (HRV)</span>
                              <span className="text-gray-400 dark:text-gray-600">
                                Z-score: {event.z_scores_at_peak?.z_rr?.toFixed(2) || '0'} ({getZScoreStatusText(event.z_scores_at_peak?.z_rr)})
                              </span>
                            </div>
                            <div className="w-full bg-[#2a2a2a] dark:bg-gray-300 h-2.5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${getZScoreColor(event.z_scores_at_peak?.z_rr)}`}
                                style={{ width: `${Math.min((Math.abs(event.z_scores_at_peak?.z_rr || 0) / 4) * 100, 100)}%` }}
                              ></div>
                            </div>
                          </div>

                          {/* SDNN */}
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-semibold">SDNN (Variabilitas)</span>
                              <span className="text-gray-400 dark:text-gray-600">
                                Z-score: {event.z_scores_at_peak?.z_sdnn?.toFixed(2) || '0'} ({getZScoreStatusText(event.z_scores_at_peak?.z_sdnn)})
                              </span>
                            </div>
                            <div className="w-full bg-[#2a2a2a] dark:bg-gray-300 h-2.5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${getZScoreColor(event.z_scores_at_peak?.z_sdnn)}`}
                                style={{ width: `${Math.min((Math.abs(event.z_scores_at_peak?.z_sdnn || 0) / 4) * 100, 100)}%` }}
                              ></div>
                            </div>
                          </div>

                          {/* RMSSD */}
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-semibold">RMSSD</span>
                              <span className="text-gray-400 dark:text-gray-600">
                                Z-score: {event.z_scores_at_peak?.z_rmssd?.toFixed(2) || '0'} ({getZScoreStatusText(event.z_scores_at_peak?.z_rmssd)})
                              </span>
                            </div>
                            <div className="w-full bg-[#2a2a2a] dark:bg-gray-300 h-2.5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${getZScoreColor(event.z_scores_at_peak?.z_rmssd)}`}
                                style={{ width: `${Math.min((Math.abs(event.z_scores_at_peak?.z_rmssd || 0) / 4) * 100, 100)}%` }}
                              ></div>
                            </div>
                          </div>

                          {/* MOTION */}
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-semibold">Motion Intensity (Gerak)</span>
                              <span className="text-gray-400 dark:text-gray-600">
                                Z-score: {event.z_scores_at_peak?.z_motion?.toFixed(2) || '0'} ({getZScoreStatusText(event.z_scores_at_peak?.z_motion)})
                              </span>
                            </div>
                            <div className="w-full bg-[#2a2a2a] dark:bg-gray-300 h-2.5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${getZScoreColor(event.z_scores_at_peak?.z_motion)}`}
                                style={{ width: `${Math.min((Math.abs(event.z_scores_at_peak?.z_motion || 0) / 4) * 100, 100)}%` }}
                              ></div>
                            </div>
                          </div>

                          {/* DFA */}
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-semibold">DFA Alpha 1</span>
                              <span className="text-gray-400 dark:text-gray-600">
                                Z-score: {event.z_scores_at_peak?.z_dfa?.toFixed(2) || '0'} ({getZScoreStatusText(event.z_scores_at_peak?.z_dfa)})
                              </span>
                            </div>
                            <div className="w-full bg-[#2a2a2a] dark:bg-gray-300 h-2.5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${getZScoreColor(event.z_scores_at_peak?.z_dfa)}`}
                                style={{ width: `${Math.min((Math.abs(event.z_scores_at_peak?.z_dfa || 0) / 4) * 100, 100)}%` }}
                              ></div>
                            </div>
                          </div>

                        </div>
                      </div>

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

export default AnomalyHistory;
