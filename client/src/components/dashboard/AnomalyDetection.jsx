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
      case 'New': return 'red';
      case 'Under Review': return 'blue';
      case 'Validated': return 'green';
      case 'False Positive': return 'gray';
      case 'Closed': return 'gray';
      default: return 'gray';
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="absolute top-4 right-4 z-50 bg-sys-blue text-white px-4 py-2 rounded-xl shadow-lg font-bold text-xs animate-bounce">
          {toastMsg}
        </div>
      )}

      <div className="grid md:grid-cols-12 gap-6 h-[75vh]">
        
        {/* LEFT PANE: Event List */}
        <div className="md:col-span-7 flex flex-col bg-brand-card border border-brand-border rounded-2xl shadow-lg overflow-hidden h-full">
          <div className="p-4 border-b border-brand-border flex justify-between items-center bg-brand-card shrink-0">
            <div>
              <h4 className="font-bold text-sm flex items-center gap-2"><FaExclamationTriangle className="text-sys-orange" /> Anomaly Event List</h4>
              <p className="text-[10px] text-brand-muted mt-0.5">Select an event to view details and validate.</p>
            </div>
            <button onClick={refreshList} className="text-sys-blue text-xs flex items-center gap-1 hover:text-white transition-colors">
              <FaSync className={loading.detection ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {loading.detection && !events.length ? (
              <div className="p-6 space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : events.length === 0 ? (
              <div className="p-10 text-center text-brand-muted text-xs font-bold">No anomalies detected. System is stable.</div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead className="bg-brand-cardLight border-b border-brand-border text-brand-muted text-[9px] uppercase font-bold sticky top-0 z-10">
                  <tr>
                    <th className="p-3">Event</th>
                    <th className="p-3">Time</th>
                    <th className="p-3">Activity</th>
                    <th className="p-3">Magnitude</th>
                    <th className="p-3">Duration</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border text-brand-text">
                  {events.map(evt => {
                    const isSelected = evt._id === selectedEventId;
                    return (
                      <tr 
                        key={evt._id} 
                        onClick={() => setSelectedEventId(evt._id)}
                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-sys-blue/10 border-l-2 border-l-sys-blue' : 'hover:bg-brand-cardLight'}`}
                      >
                        <td className="p-3 font-bold">EVT-{evt._id.slice(-4).toUpperCase()}</td>
                        <td className="p-3">
                          <div className="font-bold">{fmtTime(evt.onset_time)}</div>
                          <div className="text-[9px] text-brand-muted">{fmtDate(evt.onset_time)}</div>
                        </td>
                        <td className="p-3">{evt.activity}</td>
                        <td className={`p-3 font-bold ${evt.classification === 'Alert' ? 'text-sys-red' : 'text-sys-orange'}`}>
                          {evt.peak_score?.toFixed(1) || '-'} SD
                        </td>
                        <td className="p-3">{evt.duration_ms ? `${Math.round(evt.duration_ms / 60000)} min` : 'Active'}</td>
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
        <div className="md:col-span-5 flex flex-col bg-brand-card border border-brand-border rounded-2xl shadow-lg overflow-hidden h-full">
          {!selectedEvent ? (
            <div className="flex-1 flex items-center justify-center text-brand-muted text-xs p-6 text-center">
              Select an event from the list to view details and start the validation workflow.
            </div>
          ) : (
            <>
              {/* Event Header */}
              <div className="p-4 border-b border-brand-border bg-brand-cardLight flex justify-between items-start shrink-0">
                <div>
                  <h3 className="font-black text-lg text-brand-text">EVT-{selectedEvent._id.slice(-4).toUpperCase()}</h3>
                  <div className="text-[10px] text-brand-muted font-bold tracking-wide mt-1">
                    {fmtDate(selectedEvent.onset_time)} • {fmtTime(selectedEvent.onset_time)}
                  </div>
                </div>
                <div className="text-right">
                  <Badge label={selectedEvent.review_status || 'New'} color={getStatusColor(selectedEvent.review_status || 'New')} />
                  {selectedEvent.escalated && <div className="mt-2"><Badge label="ESCALATED" color="red" /></div>}
                </div>
              </div>

              {/* Event Details */}
              <div className="p-5 flex-1 overflow-y-auto scrollbar-hide space-y-6">
                
                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-[9px] uppercase text-brand-muted font-bold">Detected Features</span>
                    <span className="text-xs font-bold text-sys-orange">HR, ΔHR, RMSSD, DFA Alpha-1</span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase text-brand-muted font-bold">Context</span>
                    <span className="text-xs font-bold">{selectedEvent.activity}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase text-brand-muted font-bold">Deviation</span>
                    <span className="text-xs font-bold text-sys-red">{selectedEvent.peak_score?.toFixed(2)} SD above baseline</span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase text-brand-muted font-bold">Duration</span>
                    <span className="text-xs font-bold">{selectedEvent.duration_ms ? `${Math.round(selectedEvent.duration_ms / 60000)} minutes` : 'Ongoing'}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase text-brand-muted font-bold">Recovery</span>
                    <span className={`text-xs font-bold ${selectedEvent.status === 'closed' ? 'text-sys-green' : 'text-sys-orange'}`}>
                      {selectedEvent.status === 'closed' ? 'Complete' : 'Incomplete'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase text-brand-muted font-bold">Validation Label</span>
                    <span className="text-xs font-bold text-sys-purple">{selectedEvent.validation_label || 'Pending'}</span>
                  </div>
                </div>

                {/* Validation Panel */}
                <div className="pt-6 border-t border-brand-border">
                  <h4 className="font-bold text-xs uppercase tracking-wide text-brand-muted mb-4 flex items-center gap-2">
                    <FaCheckCircle /> Clinical Validation Panel
                  </h4>
                  
                  {/* Status Workflow Controls */}
                  <div className="flex gap-2 mb-4 bg-brand-dark p-1 rounded-xl">
                    {['New', 'Under Review', 'Closed'].map(st => (
                      <button
                        key={st}
                        onClick={() => handleUpdateStatus(st)}
                        className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg transition-colors ${(selectedEvent.review_status||'New') === st ? 'bg-sys-blue text-white' : 'text-brand-muted hover:text-brand-text hover:bg-brand-card'}`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>

                  {/* Validation Actions */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => handleValidate('Valid anomaly')} className="bg-sys-green/10 text-sys-green hover:bg-sys-green/20 border border-sys-green/30 px-3 py-2 rounded-xl text-[10px] font-bold text-left transition-colors">
                        <span className="block">✓ Valid anomaly</span>
                      </button>
                      <button onClick={() => handleValidate('False positive')} className="bg-brand-cardLight text-brand-text hover:bg-brand-border border border-brand-border px-3 py-2 rounded-xl text-[10px] font-bold text-left transition-colors">
                        <span className="block">✕ False positive</span>
                      </button>
                      <button onClick={() => handleValidate('Sensor artifact')} className="bg-brand-cardLight text-brand-text hover:bg-brand-border border border-brand-border px-3 py-2 rounded-xl text-[10px] font-bold text-left transition-colors">
                        <span className="block">⚠ Sensor artifact</span>
                      </button>
                      <button onClick={() => handleValidate('Activity mislabeled')} className="bg-brand-cardLight text-brand-text hover:bg-brand-border border border-brand-border px-3 py-2 rounded-xl text-[10px] font-bold text-left transition-colors">
                        <span className="block">↻ Activity mislabeled</span>
                      </button>
                      <button onClick={() => handleValidate('Clinical follow-up needed')} className="col-span-2 bg-sys-orange/10 text-sys-orange hover:bg-sys-orange/20 border border-sys-orange/30 px-3 py-2 rounded-xl text-[10px] font-bold text-center transition-colors">
                        Clinical follow-up needed
                      </button>
                    </div>
                  </div>

                  {/* Note Input */}
                  <div className="mt-4">
                    <textarea 
                      placeholder="Add reviewer notes here before validating..." 
                      className="w-full bg-brand-dark border border-brand-border rounded-xl p-3 text-xs text-brand-text outline-none focus:border-sys-blue min-h-[60px]"
                      value={validationNote}
                      onChange={e => setValidationNote(e.target.value)}
                    ></textarea>
                  </div>
                  
                  {selectedEvent.reviewer_notes && (
                    <div className="mt-3 p-3 bg-brand-dark rounded-xl border-l-2 border-sys-purple">
                      <span className="block text-[9px] uppercase text-brand-muted font-bold mb-1">Reviewer Note:</span>
                      <p className="text-xs text-brand-text italic">{selectedEvent.reviewer_notes}</p>
                    </div>
                  )}

                  {/* Function Buttons */}
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    <button onClick={handleAssign} className="flex flex-col items-center justify-center gap-1 p-2 bg-brand-cardLight hover:bg-brand-border rounded-xl text-[10px] text-brand-muted hover:text-brand-text transition-colors">
                      <FaUserMd className="text-sm" /> Assign to Me
                    </button>
                    <button onClick={handleNotify} className="flex flex-col items-center justify-center gap-1 p-2 bg-brand-cardLight hover:bg-brand-border rounded-xl text-[10px] text-brand-muted hover:text-brand-text transition-colors">
                      <FaBell className="text-sm" /> Send Notify
                    </button>
                    <button onClick={handleEscalate} className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl text-[10px] transition-colors ${selectedEvent.escalated ? 'bg-sys-red/20 text-sys-red' : 'bg-brand-cardLight text-brand-muted hover:bg-brand-border hover:text-brand-text'}`}>
                      <FaLevelUpAlt className="text-sm" /> Escalate
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
