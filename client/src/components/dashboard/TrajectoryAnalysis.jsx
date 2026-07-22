import React, { useEffect, useState, useRef } from 'react';
import { FaSync, FaDownload, FaPlus, FaFilter } from 'react-icons/fa';
import { Skeleton, Badge, fmtTime, fmtDate, SectionHeader } from './DashboardShared';
import { analysisApi } from '../../utls/api';

// --- Advanced Trajectory Chart Component ---
function AdvancedTrajectoryChart({ event, segments, feature, height = 300, onAddAnnotation }) {
  const chartRef = useRef(null);
  const [hover, setHover] = useState(null);

  if (!segments || segments.length === 0) {
    return <div className="flex items-center justify-center text-htm-muted htm-body-sm" style={{ height }}>No detailed segments available for this event.</div>;
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
  
  // Define baseline bounds
  let baseMin = 0, baseMax = 0;
  if (feature === 'anomaly_score') {
    baseMin = 0; baseMax = 1.5;
  } else if (feature.startsWith('z_')) {
    baseMin = -1; baseMax = 1;
  } else if (feature === 'mean_hr') {
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
      ctx.fillStyle = "#F6F5F3"; // Use canvas color
      ctx.fillRect(0, 0, W, H);
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
      <button onClick={exportGraph} className="htm-btn htm-btn-ghost htm-btn-sm mb-4" style={{ color: 'var(--htm-sub)' }}>
        <FaDownload style={{ marginRight: 6 }} /> Export SVG
      </button>
      <div className="relative w-full overflow-hidden" onMouseMove={onMove} onMouseLeave={() => setHover(null)} onClick={handleChartClick}>
        <svg ref={chartRef} className="w-full overflow-visible" viewBox={`0 0 ${W} ${H}`} style={{ height, background: 'transparent' }}>
          
          {/* Baseline Area */}
          <rect x="0" y={toY(baseMax)} width={W} height={toY(baseMin) - toY(baseMax)} fill="var(--htm-primary)" fillOpacity="0.05" />
          <line x1="0" y1={toY(baseMax)} x2={W} y2={toY(baseMax)} stroke="var(--htm-primary)" strokeOpacity="0.4" strokeDasharray="4 4" strokeWidth="1" />
          <line x1="0" y1={toY(baseMin)} x2={W} y2={toY(baseMin)} stroke="var(--htm-primary)" strokeOpacity="0.4" strokeDasharray="4 4" strokeWidth="1" />
          <text x="5" y={toY(baseMax) - 5} fill="var(--htm-primary)" fontSize="10" opacity="0.8" fontFamily="IBM Plex Sans">Upper Bound</text>

          {/* Markers */}
          {onsetX >= 0 && (
            <g>
              <line x1={onsetX} y1={0} x2={onsetX} y2={H} stroke="var(--htm-alert)" strokeWidth="1.5" strokeDasharray="3 3" />
              <rect x={onsetX - 25} y={0} width="50" height="16" fill="var(--htm-alert)" rx="3" />
              <text x={onsetX} y={11} fill="#fff" fontSize="9" fontWeight="500" fontFamily="IBM Plex Sans" textAnchor="middle">ONSET</text>
            </g>
          )}
          {peakX >= 0 && (
            <g>
              <line x1={peakX} y1={0} x2={peakX} y2={H} stroke="var(--htm-caution)" strokeWidth="1.5" strokeDasharray="3 3" />
              <rect x={peakX - 25} y={0} width="50" height="16" fill="var(--htm-caution)" rx="3" />
              <text x={peakX} y={11} fill="#fff" fontSize="9" fontWeight="500" fontFamily="IBM Plex Sans" textAnchor="middle">PEAK</text>
            </g>
          )}
          {recoveryX >= 0 && (
            <g>
              <line x1={recoveryX} y1={0} x2={recoveryX} y2={H} stroke="var(--htm-stable)" strokeWidth="1.5" strokeDasharray="3 3" />
              <rect x={recoveryX - 35} y={0} width="70" height="16" fill="var(--htm-stable)" rx="3" />
              <text x={recoveryX} y={11} fill="#fff" fontSize="9" fontWeight="500" fontFamily="IBM Plex Sans" textAnchor="middle">RECOVERY</text>
            </g>
          )}

          {/* Annotations */}
          {event?.annotations?.map((a, i) => {
            const ax = findXForTime(a.timestamp);
            if(ax < 0) return null;
            const ay = H - padBottom - 15 - (i%2)*20;
            return (
              <g key={i}>
                <circle cx={ax} cy={ay} r="3.5" fill="var(--htm-info)" />
                <line x1={ax} y1={ay} x2={ax} y2={H} stroke="var(--htm-info)" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="2 2" />
                <rect x={ax - 30} y={ay - 14} width="60" height="14" fill="var(--htm-info)" fillOpacity="0.2" rx="3" />
                <text x={ax} y={ay - 4} fill="var(--htm-ink)" fontSize="8" fontFamily="IBM Plex Sans" textAnchor="middle">{a.text}</text>
              </g>
            );
          })}

          {/* Line & Dots */}
          <path d={line} fill="none" stroke="var(--htm-caution)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {pts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="var(--htm-caution)" stroke="var(--htm-surface)" strokeWidth="1" />
          ))}

          {/* Hover */}
          {hover !== null && (
            <g>
              <line x1={pts[hover].x} y1="0" x2={pts[hover].x} y2={H} stroke="var(--htm-hairline)" strokeWidth="1" strokeDasharray="2 3" />
              <circle cx={pts[hover].x} cy={pts[hover].y} r="6" fill="var(--htm-caution)" fillOpacity="0.2" />
              <circle cx={pts[hover].x} cy={pts[hover].y} r="3" fill="#fff" stroke="var(--htm-caution)" strokeWidth="2" />
            </g>
          )}
        </svg>

        {/* Hover Tooltip */}
        {hover !== null && (
          <div
            className="absolute z-20 pointer-events-none px-3 py-2 htm-card shadow-lg flex flex-col items-center"
            style={{
              left: `${(pts[hover].x / W) * 100}%`,
              top: `${(pts[hover].y / H) * 100}%`,
              transform: 'translate(-50%, -120%)',
              minWidth: '80px',
              padding: '8px 12px'
            }}
          >
            <span className="htm-eyebrow mb-1">{fmtTime(pts[hover].time)}</span>
            <span className="htm-mono" style={{ color: 'var(--htm-caution)', fontWeight: 600 }}>{pts[hover].v.toFixed(2)}</span>
            <span className="htm-body-sm" style={{ fontSize: 10, color: 'var(--htm-muted)', marginTop: 4, fontStyle: 'italic' }}>Click to annotate</span>
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
    <div className="space-y-6 animate-htm-page-in">
      <SectionHeader 
        title="Advanced Trajectory Analysis" 
        subtitle="Multivariate visualizer and annotation tool."
        action={
          <div className="flex gap-4">
            <div className="htm-input-wrap">
              <select 
                className="htm-input htm-input-mono text-sm"
                value={selectedEventId || ''}
                onChange={(e) => setSelectedEventId(e.target.value)}
                style={{ padding: '8px 12px', minWidth: '180px' }}
              >
                {events.map(e => (
                  <option key={e._id} value={e._id}>EVT-{e._id.slice(-4).toUpperCase()} ({fmtDate(e.onset_time)})</option>
                ))}
              </select>
            </div>
            <div className="htm-input-wrap">
              <select 
                className="htm-input htm-input-mono text-sm"
                value={feature}
                onChange={(e) => setFeature(e.target.value)}
                style={{ padding: '8px 12px', minWidth: '180px' }}
              >
                <option value="anomaly_score">Composite Anomaly Score</option>
                <option value="z_hr">HR Z-Score</option>
                <option value="z_rmssd">RMSSD Z-Score</option>
                <option value="mean_hr">Actual HR Mean</option>
              </select>
            </div>
          </div>
        }
      />

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : !evt ? (
        <div className="htm-card text-center p-12 htm-body-sm text-htm-muted">No event selected or found.</div>
      ) : (
        <div className="htm-card p-0 overflow-hidden">
          {/* Chart Section */}
          <div className="p-8 border-b border-htm-hairline">
            <AdvancedTrajectoryChart 
              event={evt} 
              segments={segs} 
              feature={feature} 
              onAddAnnotation={(t) => setAnnoTime(t)} 
            />

            {/* Annotation Inline Form */}
            {annoTime && (
              <div className="mt-6 p-4 bg-htm-raised border border-htm-hairline flex items-center gap-4" style={{ borderRadius: 'var(--htm-r-md)' }}>
                <span className="htm-eyebrow" style={{ color: 'var(--htm-info)' }}>Annotate @ {fmtTime(annoTime)}</span>
                <input 
                  type="text" 
                  value={annoText}
                  onChange={e => setAnnoText(e.target.value)}
                  placeholder="E.g., Patient stood up, Medication taken..."
                  className="htm-input flex-1"
                  autoFocus
                />
                <button onClick={handleAddAnnotation} className="htm-btn htm-btn-primary htm-btn-sm">Save</button>
                <button onClick={() => setAnnoTime(null)} className="htm-btn htm-btn-ghost htm-btn-sm" style={{ color: 'var(--htm-sub)' }}>Cancel</button>
              </div>
            )}
          </div>

          {/* Analysis Tabs */}
          <div className="flex border-b border-htm-hairline bg-htm-raised">
            <button 
              onClick={() => setActiveTab('overview')} 
              className="flex-1 py-4 htm-eyebrow"
              style={{
                color: activeTab === 'overview' ? 'var(--htm-primary)' : 'var(--htm-muted)',
                background: activeTab === 'overview' ? 'var(--htm-surface)' : 'transparent',
                borderBottom: `2px solid ${activeTab === 'overview' ? 'var(--htm-primary)' : 'transparent'}`,
                transition: 'all 0.2s ease'
              }}
            >
              Overview
            </button>
            <button 
              onClick={() => setActiveTab('features')} 
              className="flex-1 py-4 htm-eyebrow"
              style={{
                color: activeTab === 'features' ? 'var(--htm-primary)' : 'var(--htm-muted)',
                background: activeTab === 'features' ? 'var(--htm-surface)' : 'transparent',
                borderBottom: `2px solid ${activeTab === 'features' ? 'var(--htm-primary)' : 'transparent'}`,
                transition: 'all 0.2s ease'
              }}
            >
              Feature Contribution
            </button>
          </div>

          <div className="p-8">
            {activeTab === 'overview' && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                <div>
                  <span className="htm-eyebrow block mb-2">Magnitude</span>
                  <span className="htm-display text-2xl" style={{ color: 'var(--htm-caution)' }}>{evt.peak_score?.toFixed(2)}</span>
                </div>
                <div>
                  <span className="htm-eyebrow block mb-2">Duration</span>
                  <span className="htm-display text-2xl">
                    {evt.duration_ms ? Math.round(evt.duration_ms / 60000) : Math.round((Date.now() - evt.onset_time)/60000)} <span className="htm-mono" style={{ fontSize: 12, color: 'var(--htm-muted)', fontWeight: 400 }}>min</span>
                  </span>
                </div>
                <div>
                  <span className="htm-eyebrow block mb-2">Persistence</span>
                  <span className="htm-display text-2xl">{evt.trajectory?.persistence || 0} <span className="htm-mono" style={{ fontSize: 12, color: 'var(--htm-muted)', fontWeight: 400 }}>win</span></span>
                </div>
                <div>
                  <span className="htm-eyebrow block mb-2">Slope (Direction)</span>
                  <span className="htm-display text-2xl" style={{ color: evt.trajectory?.slope_hr > 0 ? 'var(--htm-alert)' : 'var(--htm-stable)' }}>
                    {evt.trajectory?.slope_hr > 0 ? '↗' : '↘'} {Math.abs(evt.trajectory?.slope_hr || 0).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="htm-eyebrow block mb-2">Status</span>
                  <Badge label={evt.status === 'closed' ? 'Recovered' : 'Active'} color={evt.status === 'closed' ? 'stable' : 'alert'} />
                </div>
              </div>
            )}

            {activeTab === 'features' && (
              <div className="space-y-6">
                <h5 className="htm-eyebrow">Z-Scores at Peak Magnitude</h5>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  {Object.entries(evt.z_scores_at_peak || {}).map(([key, val]) => {
                    const absVal = Math.abs(val);
                    return (
                      <div key={key} className="p-4 flex flex-col justify-center" style={{ background: 'var(--htm-raised)', borderRadius: 'var(--htm-r-md)' }}>
                        <span className="htm-eyebrow mb-2">{key.replace('z_','')}</span>
                        <span className="htm-mono font-medium" style={{ fontSize: 18, color: absVal > 1.5 ? 'var(--htm-alert)' : absVal > 1.0 ? 'var(--htm-caution)' : 'var(--htm-stable)' }}>
                          {val.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="htm-body-sm" style={{ color: 'var(--htm-muted)', fontStyle: 'italic' }}>* Feature contribution is heavily weighted by HR and RMSSD deviances relative to context baselines.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
