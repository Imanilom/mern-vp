import React, { useEffect, useState } from 'react';
import { FaSync, FaExclamationTriangle, FaCheckCircle, FaUserMd, FaBell, FaNotesMedical, FaLevelUpAlt } from 'react-icons/fa';
import { Skeleton, Badge, fmtTime, fmtDate } from './DashboardShared';
import { analysisApi } from '../../utls/api';

export default function AnomalyDetection({ data, loading, fetchFor, sessionUser }) {
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [validationNote, setValidationNote] = useState('');
  const [toastMsg, setToastMsg] = useState(null);

  // Automatically fetch on mount if empty
  useEffect(() => {
    if (!data.detection && !loading.detection && sessionUser) {
      fetchFor('detection', () => analysisApi.getEvents(sessionUser._id, 30));
    }
  }, [data.detection, loading.detection, sessionUser, fetchFor]);

  const events = data.detection?.data || [];

  // Set the first event as selected by default when loaded
  useEffect(() => {
    if (events.length > 0 && !selectedEventId) {
      setSelectedEventId(events[0]._id);
    }
  }, [events, selectedEventId]);

  const selectedEvent = events.find(e => e._id === selectedEventId);

  // Actions
  const refreshList = () => fetchFor('detection', () => analysisApi.getEvents(sessionUser._id, 30));
  
  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleUpdateStatus = async (status) => {
    try {
      await analysisApi.updateEventStatus(selectedEventId, status);
      refreshList();
      showToast(`Status updated to ${status}`);
    } catch (e) { alert(e.message); }
  };

  const handleValidate = async (label) => {
    try {
      await analysisApi.validateEvent(selectedEventId, label, validationNote);
      setValidationNote('');
      refreshList();
      showToast(`Event validated as: ${label}`);
    } catch (e) { alert(e.message); }
  };

  const handleAssign = async () => {
    try {
      await analysisApi.assignReviewer(selectedEventId);
      refreshList();
      showToast('You have been assigned as the reviewer.');
    } catch (e) { alert(e.message); }
  };

  const handleEscalate = async () => {
    const isEscalated = !selectedEvent?.escalated;
    try {
      await analysisApi.escalateEvent(selectedEventId, isEscalated);
      refreshList();
      showToast(isEscalated ? 'Event escalated to specialist.' : 'Escalation removed.');
    } catch (e) { alert(e.message); }
  };

  const handleNotify = () => {
    // Mock mobile notification
    showToast('Push notification sent to patient mobile app.');
  };

  // UI Helpers
  const getStatusColor = (status) => {
    switch(status) {
      case 'New': return 'alert';
      case 'Under Review': return 'info';
      case 'Validated': return 'stable';
      case 'False Positive': return 'neutral';
      case 'Closed': return 'neutral';
      default: return 'neutral';
    }
  };

  return (
    <div className="space-y-6 relative animate-htm-page-in">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="absolute top-4 right-4 z-50 htm-card shadow-lg flex items-center gap-3 animate-bounce" style={{ padding: '12px 24px', background: 'var(--htm-ink)', color: 'var(--htm-canvas)', border: 'none' }}>
          <span className="htm-body-sm font-medium">{toastMsg}</span>
        </div>
      )}

      <div className="grid md:grid-cols-12 gap-6 h-[75vh]">
        
        {/* LEFT PANE: Event List */}
        <div className="md:col-span-7 flex flex-col htm-card p-0 overflow-hidden h-full">
          <div className="p-4 border-b border-htm-hairline flex justify-between items-center bg-htm-surface shrink-0">
            <div>
              <h4 className="htm-title flex items-center gap-2">
                <FaExclamationTriangle style={{ color: 'var(--htm-caution)' }} /> Anomaly Event List
              </h4>
              <p className="htm-body-sm text-htm-muted mt-1">Select an event to view details and validate.</p>
            </div>
            <button 
              onClick={refreshList} 
              className="htm-btn htm-btn-ghost htm-btn-sm" 
              style={{ color: 'var(--htm-sub)' }}
            >
              <FaSync className={loading.detection ? 'animate-spin' : ''} style={{ marginRight: 6 }} /> Refresh
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {loading.detection && !events.length ? (
              <div className="p-6 space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : events.length === 0 ? (
              <div className="p-10 text-center htm-body-sm text-htm-muted">No anomalies detected. System is stable.</div>
            ) : (
              <table className="htm-table" style={{ width: '100%' }}>
                <thead className="sticky top-0 z-10 bg-htm-surface">
                  <tr>
                    <th className="p-3">Event</th>
                    <th className="p-3">Time</th>
                    <th className="p-3">Activity</th>
                    <th className="p-3">Magnitude</th>
                    <th className="p-3">Duration</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map(evt => {
                    const isSelected = evt._id === selectedEventId;
                    return (
                      <tr 
                        key={evt._id} 
                        onClick={() => setSelectedEventId(evt._id)}
                        className="cursor-pointer transition-colors"
                        style={{
                          background: isSelected ? 'var(--htm-primary-bg)' : 'transparent',
                          borderLeft: `3px solid ${isSelected ? 'var(--htm-primary)' : 'transparent'}`,
                        }}
                      >
                        <td className="p-3 htm-mono" style={{ fontWeight: 600 }}>EVT-{evt._id.slice(-4).toUpperCase()}</td>
                        <td className="p-3">
                          <div className="htm-mono" style={{ fontWeight: 500 }}>{fmtTime(evt.onset_time)}</div>
                          <div className="htm-mono" style={{ fontSize: 10, color: 'var(--htm-muted)' }}>{fmtDate(evt.onset_time)}</div>
                        </td>
                        <td className="p-3">{evt.activity}</td>
                        <td className="p-3 htm-mono" style={{ 
                          fontWeight: 600, 
                          color: evt.classification === 'Alert' ? 'var(--htm-alert)' : 'var(--htm-caution)' 
                        }}>
                          {evt.peak_score?.toFixed(1) || '-'} SD
                        </td>
                        <td className="p-3 htm-mono text-htm-muted">{evt.duration_ms ? `${Math.round(evt.duration_ms / 60000)} min` : 'Active'}</td>
                        <td className="p-3">
                          <Badge label={evt.review_status || 'New'} color={getStatusColor(evt.review_status || 'New')} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* RIGHT PANE: Event Detail & Validation */}
        <div className="md:col-span-5 flex flex-col htm-card p-0 overflow-hidden h-full">
          {!selectedEvent ? (
            <div className="flex-1 flex items-center justify-center text-htm-muted htm-body-sm p-6 text-center">
              Select an event from the list to view details and start the validation workflow.
            </div>
          ) : (
            <>
              {/* Event Header */}
              <div className="p-6 border-b border-htm-hairline bg-htm-raised flex justify-between items-start shrink-0">
                <div>
                  <h3 className="htm-display text-2xl">EVT-{selectedEvent._id.slice(-4).toUpperCase()}</h3>
                  <div className="htm-mono-sm mt-1" style={{ color: 'var(--htm-muted)', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span>{fmtDate(selectedEvent.onset_time)}</span>
                    <span>•</span>
                    <span>{fmtTime(selectedEvent.onset_time)}</span>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-2">
                  <Badge label={selectedEvent.review_status || 'New'} color={getStatusColor(selectedEvent.review_status || 'New')} />
                  {selectedEvent.escalated && <Badge label="ESCALATED" color="alert" />}
                </div>
              </div>

              {/* Event Details */}
              <div className="p-6 flex-1 overflow-y-auto scrollbar-hide space-y-8">
                
                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                  <div>
                    <span className="htm-eyebrow block mb-1">Detected Features</span>
                    <span className="htm-body-sm font-medium" style={{ color: 'var(--htm-caution)' }}>HR, ΔHR, RMSSD, DFA Alpha-1</span>
                  </div>
                  <div>
                    <span className="htm-eyebrow block mb-1">Context</span>
                    <span className="htm-body-sm font-medium">{selectedEvent.activity}</span>
                  </div>
                  <div>
                    <span className="htm-eyebrow block mb-1">Deviation</span>
                    <span className="htm-body-sm font-medium" style={{ color: 'var(--htm-alert)' }}>{selectedEvent.peak_score?.toFixed(2)} SD above baseline</span>
                  </div>
                  <div>
                    <span className="htm-eyebrow block mb-1">Duration</span>
                    <span className="htm-body-sm font-medium">{selectedEvent.duration_ms ? `${Math.round(selectedEvent.duration_ms / 60000)} minutes` : 'Ongoing'}</span>
                  </div>
                  <div>
                    <span className="htm-eyebrow block mb-1">Recovery</span>
                    <span className="htm-body-sm font-medium" style={{ color: selectedEvent.status === 'closed' ? 'var(--htm-stable)' : 'var(--htm-caution)' }}>
                      {selectedEvent.status === 'closed' ? 'Complete' : 'Incomplete'}
                    </span>
                  </div>
                  <div>
                    <span className="htm-eyebrow block mb-1">Validation Label</span>
                    <span className="htm-body-sm font-medium" style={{ color: 'var(--htm-info)' }}>{selectedEvent.validation_label || 'Pending'}</span>
                  </div>
                </div>

                {/* Validation Panel */}
                <div className="pt-6 border-t border-htm-hairline">
                  <h4 className="htm-eyebrow mb-4 flex items-center gap-2">
                    <FaCheckCircle /> Clinical Validation Panel
                  </h4>
                  
                  {/* Status Workflow Controls */}
                  <div className="flex gap-2 mb-6 p-1 bg-htm-raised" style={{ borderRadius: 'var(--htm-r-md)' }}>
                    {['New', 'Under Review', 'Closed'].map(st => {
                      const isActive = (selectedEvent.review_status||'New') === st;
                      return (
                        <button
                          key={st}
                          onClick={() => handleUpdateStatus(st)}
                          className="flex-1 py-1.5 htm-body-sm font-medium transition-colors"
                          style={{
                            borderRadius: 'var(--htm-r-sm)',
                            background: isActive ? 'var(--htm-surface)' : 'transparent',
                            color: isActive ? 'var(--htm-ink)' : 'var(--htm-muted)',
                            boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                          }}
                        >
                          {st}
                        </button>
                      );
                    })}
                  </div>

                  {/* Validation Actions */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => handleValidate('Valid anomaly')} 
                        className="htm-btn htm-btn-outline"
                        style={{ justifyContent: 'flex-start', color: 'var(--htm-stable)', borderColor: 'rgba(46,107,74,0.3)', background: 'var(--htm-stable-bg)' }}
                      >
                        ✓ Valid anomaly
                      </button>
                      <button 
                        onClick={() => handleValidate('False positive')} 
                        className="htm-btn htm-btn-outline"
                        style={{ justifyContent: 'flex-start', color: 'var(--htm-sub)' }}
                      >
                        ✕ False positive
                      </button>
                      <button 
                        onClick={() => handleValidate('Sensor artifact')} 
                        className="htm-btn htm-btn-outline"
                        style={{ justifyContent: 'flex-start', color: 'var(--htm-sub)' }}
                      >
                        ⚠ Sensor artifact
                      </button>
                      <button 
                        onClick={() => handleValidate('Activity mislabeled')} 
                        className="htm-btn htm-btn-outline"
                        style={{ justifyContent: 'flex-start', color: 'var(--htm-sub)' }}
                      >
                        ↻ Activity mislabeled
                      </button>
                      <button 
                        onClick={() => handleValidate('Clinical follow-up needed')} 
                        className="htm-btn htm-btn-outline col-span-2"
                        style={{ justifyContent: 'center', color: 'var(--htm-caution)', borderColor: 'rgba(180,83,9,0.3)', background: 'var(--htm-caution-bg)' }}
                      >
                        Clinical follow-up needed
                      </button>
                    </div>
                  </div>

                  {/* Note Input */}
                  <div className="mt-6">
                    <textarea 
                      placeholder="Add reviewer notes here before validating..." 
                      className="htm-input w-full min-h-[80px]"
                      value={validationNote}
                      onChange={e => setValidationNote(e.target.value)}
                    ></textarea>
                  </div>
                  
                  {selectedEvent.reviewer_notes && (
                    <div className="mt-4 p-4 bg-htm-raised" style={{ borderRadius: 'var(--htm-r-md)', borderLeft: '3px solid var(--htm-info)' }}>
                      <span className="htm-eyebrow block mb-2">Reviewer Note:</span>
                      <p className="htm-body-sm" style={{ fontStyle: 'italic', color: 'var(--htm-sub)' }}>{selectedEvent.reviewer_notes}</p>
                    </div>
                  )}

                  {/* Function Buttons */}
                  <div className="mt-8 grid grid-cols-3 gap-3">
                    <button onClick={handleAssign} className="flex flex-col items-center justify-center gap-2 p-3 htm-btn-ghost rounded-xl transition-colors htm-body-sm" style={{ color: 'var(--htm-sub)' }}>
                      <FaUserMd className="text-lg" /> Assign to Me
                    </button>
                    <button onClick={handleNotify} className="flex flex-col items-center justify-center gap-2 p-3 htm-btn-ghost rounded-xl transition-colors htm-body-sm" style={{ color: 'var(--htm-sub)' }}>
                      <FaBell className="text-lg" /> Send Notify
                    </button>
                    <button 
                      onClick={handleEscalate} 
                      className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl transition-colors htm-body-sm font-medium" 
                      style={{
                        background: selectedEvent.escalated ? 'var(--htm-alert-bg)' : 'transparent',
                        color: selectedEvent.escalated ? 'var(--htm-alert)' : 'var(--htm-sub)',
                        border: selectedEvent.escalated ? '1px solid rgba(185,28,28,0.2)' : '1px solid transparent'
                      }}
                    >
                      <FaLevelUpAlt className="text-lg" /> Escalate
                    </button>
                  </div>
                </div>

              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
