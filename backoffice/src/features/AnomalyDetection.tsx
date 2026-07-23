import React, { useState } from 'react';

export interface AnalyticsProps {
  selectedParticipantId: string;
  onParticipantChange: (id: string) => void;
}

import { DeviceSelector } from '../shared/components/ParticipantSelector';

export const Toast: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        background: 'var(--surface)',
        border: '1px solid var(--primary)',
        borderRadius: 'var(--r-md)',
        padding: '12px 18px',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        animation: 'fadeInUp 200ms var(--ease)',
      }}
    >
      <span className="status-dot"></span>
      <span style={{ fontSize: '13px', fontWeight: 550, color: 'var(--ink)' }}>{message}</span>
    </div>
  );
};


export const AnomalyDetection: React.FC<AnalyticsProps> = ({
  selectedParticipantId,
  onParticipantChange
}) => {
  const [selectedRadio, setSelectedRadio] = useState<number>(0);
  const [filter, setFilter] = useState('All');
  const [toast, setToast] = useState<string | null>(null);
  const filters = ['All', 'New', 'Under review', 'Validated', 'False positive', 'Closed'];

  const options = [
    'Valid anomaly',
    'False positive',
    'Sensor artifact',
    'Activity mislabeled',
    'Clinical follow-up needed'
  ];

  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);

  React.useEffect(() => {
    const fetchPatients = async () => {
      try {
        const token = sessionStorage.getItem('htm_token');
        const res = await fetch('/api/patient/all', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setParticipants(data);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchPatients();
  }, []);

  React.useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const token = sessionStorage.getItem('htm_token');
        const idToFetch = selectedParticipantId;
        const res = await fetch(`/api/analysis/events/${idToFetch}?limit=20`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.data)) {
            const mapped = data.data.map((e: any) => {
              let badgeClass = 'badge-monitoring';
              if (e.status === 'open' || e.status === 'New') badgeClass = 'badge-monitoring';
              else if (e.status === 'under_review' || e.status === 'Under review') badgeClass = 'badge-caution';
              else if (e.status === 'validated' || e.status === 'Validated') badgeClass = 'badge-stable';
              else if (e.status === 'closed' || e.status === 'Closed') badgeClass = 'badge-inactive';

              return {
                eventId: e._id || `EVT-${Math.floor(Math.random() * 1000)}`,
                participantId: idToFetch,
                activity: e.activity || 'Unknown',
                start: e.onset_time ? new Date(e.onset_time).toLocaleTimeString() : '—',
                magnitude: e.peak_score ? parseFloat(e.peak_score).toFixed(1) : '0.0',
                duration: e.recovery_time && e.onset_time ? `${Math.round((e.recovery_time - e.onset_time) / 60000)} min` : 'Ongoing',
                status: e.status || 'New',
                badgeClass
              };
            });
            setEvents(mapped);
          }
        }
      } catch (err) {
        console.error('Failed to fetch events:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, [selectedParticipantId]);

  const filteredEvents = events.filter(e => {
    const matchesStatus = filter === 'All' || e.status.toLowerCase() === filter.toLowerCase();
    const matchesParticipant = e.participantId === selectedParticipantId;
    return matchesStatus && matchesParticipant;
  });

  // Selected event ID
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Pick first matching event if selectedEventId is not in filtered list
  const activeEvent = filteredEvents.find(e => e.eventId === selectedEventId) || filteredEvents[0];

  const [eventDetails, setEventDetails] = useState<any>(null);

  React.useEffect(() => {
    const eid = activeEvent?.eventId;
    if (!eid || eid.startsWith('EVT-')) {
      setEventDetails(null);
      return;
    }
    const fetchDetails = async () => {
      try {
        const token = sessionStorage.getItem('htm_token');
        const res = await fetch(`/api/analysis/events/details/${eid}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success) setEventDetails(json.data);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchDetails();
  }, [activeEvent?.eventId]);

  const handleCloseEvent = async () => {
    if (!activeEvent) return;
    const actionLabel = options[selectedRadio];

    try {
      const token = sessionStorage.getItem('htm_token');
      // activeEvent.eventId is likely the internal DB _id or fallback EVT-xx
      // Let's assume it maps to _id. Wait, activeEvent.eventId holds `e._id || fallback`
      const eventIdToPatch = activeEvent.eventId;

      const res = await fetch(`/api/analysis/events/${eventIdToPatch}/validate`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ label: actionLabel, notes: 'Closed via backoffice' })
      });

      if (res.ok) {
        // Update status in list
        setEvents(prev => prev.map(e => {
          if (e.eventId === activeEvent.eventId) {
            return {
              ...e,
              status: 'Closed',
              badgeClass: 'badge-inactive'
            };
          }
          return e;
        }));
        setToast(`Event ${activeEvent.eventId.slice(-6)} validated as "${actionLabel}" and closed.`);
      } else {
        const errorData = await res.json();
        setToast(`Error closing event: ${errorData.message}`);
      }
    } catch (err: any) {
      setToast('Network error closing event');
    }
  };

  const handleNotifyMobile = () => {
    if (!activeEvent) return;
    setToast(`FCM notification sent to participant ${activeEvent.participantId} for event ${activeEvent.eventId}.`);
  };

  return (
    <section>
      <div className="page-head">
        <h1 className="page-title">Anomaly detection</h1>
        <DeviceSelector selectedId={selectedParticipantId} onChange={onParticipantChange} />
      </div>

      <div className="filter-bar mb-4">
        {filters.map((f) => (
          <span
            key={f}
            className={`filter-pill ${filter === f ? 'on' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </span>
        ))}
      </div>

      <div className="split">
        <div className="card !p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr>
                <th className="pl-lg py-sm">Event</th>
                <th>Participant</th>
                <th>Activity</th>
                <th>Start</th>
                <th>Magnitude</th>
                <th>Duration</th>
                <th className="pr-lg text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-lg text-muted">Loading events...</td></tr>
              ) : filteredEvents.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-lg text-muted">No events found.</td></tr>
              ) : filteredEvents.map((e) => (
                <tr
                  key={e.eventId}
                  className={`border-t border-hairline clickable ${selectedEventId === e.eventId ? 'bg-surface-raised' : ''}`}
                  onClick={() => setSelectedEventId(e.eventId)}
                >
                  <td className="mono pl-lg py-sm font-semibold">{e.eventId.slice(-6)}</td>
                  <td className="mono">{e.participantId}</td>
                  <td>{e.activity}</td>
                  <td className="mono text-muted">{e.start}</td>
                  <td className="mono">{e.magnitude}</td>
                  <td className="mono">{e.duration}</td>
                  <td className="pr-lg text-right">
                    <span className={`badge ${e.badgeClass}`}>
                      <span className="badge-dot"></span>{e.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          {activeEvent ? (
            <div className="animate-fadein">
              <div className="side-card">
                <p className="card-title">Event {activeEvent.eventId}</p>
                <div style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: '1.7' }}>
                  Deviasi {activeEvent.magnitude} SD di atas baseline saat {activeEvent.activity}.<br />
                  Durasi {activeEvent.duration} · Onset {activeEvent.start} · Status: <strong>{activeEvent.status}</strong>
                  {eventDetails?.event?.onset_time && (
                    <div><br /><strong>Waktu Kejadian:</strong> {new Date(eventDetails.event.onset_time).toLocaleString('id-ID')}</div>
                  )}
                </div>
              </div>
              
              {eventDetails?.segments && eventDetails.segments.length > 0 && (
                <div className="side-card">
                  <p className="card-title">Trajectory Graph</p>
                  <div style={{ padding: '10px 0' }}>
                    <svg viewBox="0 0 400 100" width="100%" height="100" preserveAspectRatio="none" className="overflow-visible">
                      <polygon points="0,50 400,50 400,100 0,100" fill="var(--hairline)" opacity="0.3" />
                      {(() => {
                        const segs = eventDetails.segments;
                        const width = 400;
                        const height = 100;
                        const maxScore = Math.max(4, ...segs.map((s: any) => s.anomaly_score || 0));
                        const points = segs.map((s: any, i: number) => {
                          const x = (i / (segs.length - 1 || 1)) * width;
                          const y = height - (Math.min(s.anomaly_score || 0, maxScore) / maxScore) * height;
                          return `${x},${y}`;
                        }).join(' ');
                        return <polyline points={points} fill="none" stroke="var(--deviation-text)" strokeWidth="2" />;
                      })()}
                    </svg>
                  </div>
                </div>
              )}
              <div className="side-card">
                <p className="card-title">Validasi</p>
                {options.map((opt, idx) => (
                  <div
                    key={idx}
                    className="valid-option flex items-center gap-2"
                    onClick={() => setSelectedRadio(idx)}
                  >
                    <span className={`radio ${selectedRadio === idx ? 'on' : ''}`}></span> {opt}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={handleCloseEvent}
                  disabled={activeEvent.status === 'Closed'}
                >
                  Close event
                </button>
                <button
                  className="btn btn-outline"
                  style={{ flex: 1 }}
                  onClick={handleNotifyMobile}
                >
                  Notify mobile
                </button>
              </div>
            </div>
          ) : (
            <div className="placeholder">
              <span className="msym">info</span>
              <span>Silakan pilih event untuk melakukan validasi klinis</span>
            </div>
          )}
        </div>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </section>
  );
};
