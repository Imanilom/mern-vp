import React, { useEffect, useState, useRef } from 'react';
import { FaSync, FaDownload, FaPlus, FaFilter } from 'react-icons/fa';
import { Skeleton, Badge, fmtTime, fmtDate } from './DashboardShared';
import { analysisApi } from '../../utls/api';

// --- Advanced Trajectory Chart Component ---
function AdvancedTrajectoryChart({ event, segments, feature, height = 300, onAddAnnotation }) {
  const chartRef = useRef(null);
  const [hover, setHover] = useState(null);

  if (!segments || segments.length === 0) {
    return <div className="flex items-center justify-center text-brand-muted text-xs" style={{ height }}>No detailed segments available for this event.</div>;
  }

  const W = 800;
  const H = height;
  const padTop = 20;
  const padBottom = 20;

  // Extract data based on selected feature
  const dataPoints = segments.map(s => {
    let val = 0;
    if (feature === 'anomaly_score') val = s.anomaly_score;
    else if (feature === 'z_hr') val = s.z_scores?.z_hr;
    else if (feature === 'z_rmssd') val = s.z_scores?.z_rmssd;
    else if (feature === 'mean_hr') val = s.features?.mean_hr;
    return { time: s.window_start, val: val || 0 };
  });

  const minV = Math.min(...dataPoints.map(d => d.val));
  const maxV = Math.max(...dataPoints.map(d => d.val));
  
  // Define baseline bounds (mocked for demo if not anomaly_score, anomaly_score has 0-1.5 as stable)
  let baseMin = 0, baseMax = 0;
  if (feature === 'anomaly_score') {
    baseMin = 0; baseMax = 1.5;
  } else if (feature.startsWith('z_')) {
    baseMin = -1; baseMax = 1;
  } else if (feature === 'mean_hr') {
    // just some visual bounds
    baseMin = minV > 60 ? 60 : minV - 5;
    baseMax = baseMin + 15;
  }

  const chartMin = Math.min(minV, baseMin) - (maxV - minV)*0.1 || 0;
  const chartMax = Math.max(maxV, baseMax) + (maxV - minV)*0.1 || 2;
  const range = (chartMax - chartMin) || 1;

  const toY = (v) => H - padBottom - ((v - chartMin) / range) * (H - padTop - padBottom);
  const toX = (i) => (i / (dataPoints.length - 1 || 1)) * W;

  const pts = dataPoints.map((d, i) => ({ x: toX(i), y: toY(d.val), v: d.val, time: d.time }));

  // Build SVG path
  let line = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const cp1x = pts[i].x + (pts[i+1].x - pts[i].x) / 3;
    const cp2x = pts[i].x + (2 * (pts[i+1].x - pts[i].x)) / 3;
    line += ` C ${cp1x} ${pts[i].y}, ${cp2x} ${pts[i+1].y}, ${pts[i+1].x} ${pts[i+1].y}`;
  }

  // Find marker coordinates
  const findXForTime = (time) => {
    if(!time) return -1;
    const match = pts.find(p => p.time === time);
    if(match) return match.x;
    // interpolate
    const t0 = pts[0].time;
    const tN = pts[pts.length-1].time;
    if(time < t0 || time > tN) return -1;
    return ((time - t0) / (tN - t0)) * W;
  };

  const onsetX = findXForTime(event?.onset_time);
  const peakX = findXForTime(event?.peak_time);
  const recoveryX = findXForTime(event?.resolved_time);

  const onMove = (e) => {
    if (!chartRef.current) return;
    const { left, width } = chartRef.current.getBoundingClientRect();
    const mx = ((e.clientX - left) / width) * W;
    let ci = 0, cd = Infinity;
    pts.forEach((p, i) => { const d = Math.abs(p.x - mx); if (d < cd) { cd = d; ci = i; } });
    setHover(ci);
  };

  const handleChartClick = () => {
    if (hover !== null && onAddAnnotation) {
      onAddAnnotation(pts[hover].time);
    }
  };

  const exportGraph = () => {
    if (!chartRef.current) return;
    const svgData = new XMLSerializer().serializeToString(chartRef.current);
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.setAttribute("src", "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData))));
    img.onload = () => {
      ctx.fillStyle = "#0A0D14"; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0);
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.download = `trajectory_${event?._id || 'chart'}.png`;
      a.href = url;
      a.click();
    };
  };

  return (
    <div className="relative w-full flex flex-col items-end">
      <button onClick={exportGraph} className="mb-2 text-xs flex items-center gap-1 text-sys-blue hover:text-white transition-colors bg-brand-cardLight px-2 py-1 rounded">
        <FaDownload /> Export
      </button>
      <div className="relative w-full overflow-hidden" onMouseMove={onMove} onMouseLeave={() => setHover(null)} onClick={handleChartClick}>
        <svg ref={chartRef} className="w-full overflow-visible" viewBox={`0 0 ${W} ${H}`} style={{ height }}>
          
          {/* Baseline Area */}
          <rect x="0" y={toY(baseMax)} width={W} height={toY(baseMin) - toY(baseMax)} fill="#3b82f6" fillOpacity="0.05" />
          <line x1="0" y1={toY(baseMax)} x2={W} y2={toY(baseMax)} stroke="#3b82f6" strokeOpacity="0.3" strokeDasharray="4 4" strokeWidth="1" />
          <line x1="0" y1={toY(baseMin)} x2={W} y2={toY(baseMin)} stroke="#3b82f6" strokeOpacity="0.3" strokeDasharray="4 4" strokeWidth="1" />
          <text x="5" y={toY(baseMax) - 5} fill="#3b82f6" fontSize="10" opacity="0.6">Upper Bound</text>

          {/* Markers */}
          {onsetX >= 0 && (
            <g>
              <line x1={onsetX} y1={0} x2={onsetX} y2={H} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 3" />
              <rect x={onsetX - 25} y={0} width="50" height="14" fill="#ef4444" rx="2" />
              <text x={onsetX} y={10} fill="#fff" fontSize="8" fontWeight="bold" textAnchor="middle">ONSET</text>
            </g>
          )}
          {peakX >= 0 && (
            <g>
              <line x1={peakX} y1={0} x2={peakX} y2={H} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 3" />
              <rect x={peakX - 25} y={0} width="50" height="14" fill="#f59e0b" rx="2" />
              <text x={peakX} y={10} fill="#fff" fontSize="8" fontWeight="bold" textAnchor="middle">PEAK</text>
            </g>
          )}
          {recoveryX >= 0 && (
            <g>
              <line x1={recoveryX} y1={0} x2={recoveryX} y2={H} stroke="#22c55e" strokeWidth="1.5" strokeDasharray="3 3" />
              <rect x={recoveryX - 30} y={0} width="60" height="14" fill="#22c55e" rx="2" />
              <text x={recoveryX} y={10} fill="#fff" fontSize="8" fontWeight="bold" textAnchor="middle">RECOVERY</text>
            </g>
          )}

          {/* Annotations */}
          {event?.annotations?.map((a, i) => {
            const ax = findXForTime(a.timestamp);
            if(ax < 0) return null;
            const ay = H - padBottom - 15 - (i%2)*20;
            return (
              <g key={i}>
                <circle cx={ax} cy={ay} r="3" fill="#8b5cf6" />
                <line x1={ax} y1={ay} x2={ax} y2={H} stroke="#8b5cf6" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="2 2" />
                <rect x={ax - 30} y={ay - 14} width="60" height="12" fill="#8b5cf6" fillOpacity="0.2" rx="2" />
                <text x={ax} y={ay - 5} fill="#fff" fontSize="7" textAnchor="middle">{a.text}</text>
              </g>
            );
          })}

          {/* Line & Dots */}
          <path d={line} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {pts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#f59e0b" stroke="#0a0d14" strokeWidth="1" />
          ))}

          {/* Hover */}
          {hover !== null && (
            <g>
              <line x1={pts[hover].x} y1="0" x2={pts[hover].x} y2={H} stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="2 3" />
              <circle cx={pts[hover].x} cy={pts[hover].y} r="6" fill="#f59e0b" fillOpacity="0.3" />
              <circle cx={pts[hover].x} cy={pts[hover].y} r="3" fill="#fff" stroke="#f59e0b" strokeWidth="2" />
            </g>
          )}
        </svg>

        {/* Hover Tooltip */}
        {hover !== null && (
          <div
            className="absolute z-20 pointer-events-none bg-brand-cardLight border border-brand-border px-3 py-1.5 rounded-xl shadow-xl text-[10px] font-bold text-brand-text flex flex-col items-center"
            style={{
              left: `${(pts[hover].x / W) * 100}%`,
              top: `${(pts[hover].y / H) * 100}%`,
              transform: 'translate(-50%, -120%)',
            }}
          >
            <span className="text-brand-muted text-[8px] uppercase">{fmtTime(pts[hover].time)}</span>
            <span className="text-sys-orange">{pts[hover].v.toFixed(2)}</span>
            <span className="text-[8px] text-brand-muted mt-1 font-normal italic">Click to annotate</span>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Main Page Component ---
export default function TrajectoryAnalysis({ sessionUser }) {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [eventDetails, setEventDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feature, setFeature] = useState('anomaly_score');
  const [activeTab, setActiveTab] = useState('overview');

  // Annotation form
  const [annoTime, setAnnoTime] = useState(null);
  const [annoText, setAnnoText] = useState('');

  const fetchEvents = async () => {
    try {
      const res = await analysisApi.getEvents(sessionUser._id, 10);
      if (res.success) {
        setEvents(res.data);
        if (res.data.length > 0 && !selectedEventId) {
          setSelectedEventId(res.data[0]._id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDetails = async (eventId) => {
    setLoading(true);
    try {
      const res = await analysisApi.getEventSegments(eventId);
      if (res.success) {
        setEventDetails(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionUser) fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUser]);

  useEffect(() => {
    if (selectedEventId) fetchDetails(selectedEventId);
  }, [selectedEventId]);

  const handleAddAnnotation = async () => {
    if (!annoText || !annoTime) return;
    try {
      await analysisApi.annotateEvent(selectedEventId, annoText, annoTime);
      setAnnoTime(null);
      setAnnoText('');
      fetchDetails(selectedEventId); // refresh
    } catch (e) {
      alert(e.message);
    }
  };

  const evt = eventDetails?.event;
  const segs = eventDetails?.segments || [];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-brand-card border border-brand-border p-4 rounded-2xl shadow-lg">
        <div>
          <h4 className="font-bold text-sm">Advanced Trajectory Analysis</h4>
          <p className="text-[10px] text-brand-muted">Multivariate visualizer and annotation tool.</p>
        </div>
        <div className="flex gap-3">
          <select 
            className="bg-brand-cardLight border border-brand-border text-xs rounded-lg px-3 py-1.5 focus:border-sys-blue outline-none text-brand-text"
            value={selectedEventId || ''}
            onChange={(e) => setSelectedEventId(e.target.value)}
          >
            {events.map(e => (
              <option key={e._id} value={e._id}>EVT-{e._id.slice(-4).toUpperCase()} ({fmtDate(e.onset_time)})</option>
            ))}
          </select>

          <select 
            className="bg-brand-cardLight border border-brand-border text-xs rounded-lg px-3 py-1.5 focus:border-sys-blue outline-none text-brand-text"
            value={feature}
            onChange={(e) => setFeature(e.target.value)}
          >
            <option value="anomaly_score">Composite Anomaly Score</option>
            <option value="z_hr">HR Z-Score</option>
            <option value="z_rmssd">RMSSD Z-Score</option>
            <option value="mean_hr">Actual HR Mean</option>
          </select>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : !evt ? (
        <div className="text-center p-10 text-brand-muted text-xs bg-brand-card rounded-2xl border border-brand-border">No event selected or found.</div>
      ) : (
        <div className="bg-brand-card border border-brand-border rounded-2xl shadow-lg overflow-hidden">
          {/* Chart Section */}
          <div className="p-6 border-b border-brand-border">
            <AdvancedTrajectoryChart 
              event={evt} 
              segments={segs} 
              feature={feature} 
              onAddAnnotation={(t) => setAnnoTime(t)} 
            />

            {/* Annotation Inline Form */}
            {annoTime && (
              <div className="mt-4 p-3 bg-brand-cardLight border border-brand-border rounded-xl flex items-center gap-3">
                <span className="text-[10px] font-bold text-sys-purple uppercase">Annotate @ {fmtTime(annoTime)}</span>
                <input 
                  type="text" 
                  value={annoText}
                  onChange={e => setAnnoText(e.target.value)}
                  placeholder="E.g., Patient stood up, Medication taken..."
                  className="flex-1 bg-brand-dark border border-brand-border rounded px-3 py-1 text-xs text-brand-text outline-none focus:border-sys-purple"
                  autoFocus
                />
                <button onClick={handleAddAnnotation} className="px-3 py-1 bg-sys-purple text-white text-xs font-bold rounded hover:bg-sys-purple/80">Save</button>
                <button onClick={() => setAnnoTime(null)} className="px-3 py-1 bg-brand-border text-brand-text text-xs font-bold rounded hover:bg-brand-muted">Cancel</button>
              </div>
            )}
          </div>

          {/* Analysis Tabs */}
          <div className="flex bg-brand-cardLight border-b border-brand-border">
            <button onClick={() => setActiveTab('overview')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${activeTab === 'overview' ? 'text-sys-blue border-b-2 border-sys-blue bg-brand-card' : 'text-brand-muted hover:text-brand-text'}`}>Overview</button>
            <button onClick={() => setActiveTab('features')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${activeTab === 'features' ? 'text-sys-blue border-b-2 border-sys-blue bg-brand-card' : 'text-brand-muted hover:text-brand-text'}`}>Feature Contribution</button>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-brand-cardLight border border-brand-border p-4 rounded-xl">
                  <span className="block text-[9px] uppercase text-brand-muted font-bold mb-1">Magnitude</span>
                  <span className="text-lg font-black text-sys-orange">{evt.peak_score?.toFixed(2)}</span>
                </div>
                <div className="bg-brand-cardLight border border-brand-border p-4 rounded-xl">
                  <span className="block text-[9px] uppercase text-brand-muted font-bold mb-1">Duration</span>
                  <span className="text-lg font-black text-brand-text">
                    {evt.duration_ms ? Math.round(evt.duration_ms / 60000) : Math.round((Date.now() - evt.onset_time)/60000)} <span className="text-[10px] font-normal text-brand-muted">min</span>
                  </span>
                </div>
                <div className="bg-brand-cardLight border border-brand-border p-4 rounded-xl">
                  <span className="block text-[9px] uppercase text-brand-muted font-bold mb-1">Persistence</span>
                  <span className="text-lg font-black text-brand-text">{evt.trajectory?.persistence || 0} <span className="text-[10px] font-normal text-brand-muted">win</span></span>
                </div>
                <div className="bg-brand-cardLight border border-brand-border p-4 rounded-xl">
                  <span className="block text-[9px] uppercase text-brand-muted font-bold mb-1">Slope (Direction)</span>
                  <span className={`text-lg font-black ${evt.trajectory?.slope_hr > 0 ? 'text-sys-red' : 'text-sys-green'}`}>
                    {evt.trajectory?.slope_hr > 0 ? '↗' : '↘'} {Math.abs(evt.trajectory?.slope_hr || 0).toFixed(2)}
                  </span>
                </div>
                <div className="bg-brand-cardLight border border-brand-border p-4 rounded-xl">
                  <span className="block text-[9px] uppercase text-brand-muted font-bold mb-1">Status</span>
                  <Badge label={evt.status === 'closed' ? 'Recovered' : 'Active'} color={evt.status === 'closed' ? 'green' : 'red'} />
                </div>
              </div>
            )}

            {activeTab === 'features' && (
              <div className="space-y-4">
                <h5 className="font-bold text-xs uppercase tracking-wide text-brand-muted">Z-Scores at Peak Magnitude</h5>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-center">
                  {Object.entries(evt.z_scores_at_peak || {}).map(([key, val]) => {
                    const absVal = Math.abs(val);
                    return (
                      <div key={key} className="bg-brand-cardLight border border-brand-border p-3 rounded-lg flex flex-col justify-center">
                        <span className="text-[9px] uppercase text-brand-muted font-bold">{key.replace('z_','')}</span>
                        <span className={`text-sm font-black ${absVal > 1.5 ? 'text-sys-red' : absVal > 1.0 ? 'text-sys-orange' : 'text-sys-green'}`}>
                          {val.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[9px] text-brand-muted italic mt-2">* Feature contribution is heavily weighted by HR and RMSSD deviances relative to context baselines.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
