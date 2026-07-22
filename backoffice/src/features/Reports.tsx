import React, { useState } from 'react';
import {
  CloudArrowUp, DownloadSimple, Eye, ArrowClockwise, Sliders, Pause, X, Receipt,
  Columns, FileText, Trash, FloppyDisk, UserPlus, Check, Lightning
} from '@phosphor-icons/react';

export interface AnalyticsProps {
  selectedParticipantId: string;
  onParticipantChange: (id: string) => void;
}

export const DeviceSelector: React.FC<{
  selectedId: string;
  onChange: (id: string) => void;
}> = ({ selectedId, onChange }) => {
  const list = ['P012', 'P002', 'P003', 'P005', 'P006'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span className="eyebrow" style={{ color: 'var(--muted)' }}>Select Device:</span>
      <select
        className="select-chip font-mono cursor-pointer"
        value={selectedId}
        onChange={(e) => onChange(e.target.value)}
        style={{
          outline: 'none',
          background: 'var(--surface)',
          color: 'var(--ink)',
          border: '1px solid var(--hairline)',
          fontWeight: 600,
          padding: '5px 12px',
        }}
      >
        {list.map(id => (
          <option key={id} value={id}>
            {id} (Polar H10)
          </option>
        ))}
      </select>
    </div>
  );
};

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

export const Reports: React.FC<AnalyticsProps> = ({
  selectedParticipantId,
  onParticipantChange
}) => {
  const [activeTab, setActiveTab] = useState('Individual');
  const [toast, setToast] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [reportType, setReportType] = useState('Daily summary');

  const tabs = ['Individual', 'Population', 'Data quality', 'System'];

  const [reportsList, setReportsList] = useState<any[]>([]);

  const fetchReports = async () => {
    try {
      const token = sessionStorage.getItem('htm_token');
      const idToFetch = selectedParticipantId || 'P012';
      const res = await fetch(`/api/reports/list/${idToFetch}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setReportsList(data.data.map((r: any) => ({
            name: `${r.report_type.charAt(0).toUpperCase() + r.report_type.slice(1)} report — ${idToFetch}`,
            time: new Date(r.createdAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
            id: r._id
          })));
        }
      }
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    }
  };

  React.useEffect(() => {
    fetchReports();
  }, [selectedParticipantId]);

  const handleGenerate = async () => {
    setGenerating(true);
    setToast(`Generating ${reportType} report for ${selectedParticipantId}...`);

    try {
      const token = sessionStorage.getItem('htm_token');
      const idToFetch = selectedParticipantId || 'P012';
      // Map report type to backend type
      let rType = 'daily';
      if (reportType === 'Weekly summary') rType = 'trajectory';
      if (reportType === 'Anomaly report') rType = 'anomaly';
      if (reportType === 'Activity report') rType = 'activity';

      const res = await fetch(`/api/reports/generate?type=${rType}&userId=${idToFetch}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        console.log('Generated report:', data);
        fetchReports(); // Refresh the list
        setToast(`Report generated: ${reportType} — ${idToFetch}`);
      }
    } catch (err) {
      console.error('Failed to generate report:', err);
      setToast('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section>
      <div className="page-head">
        <h1 className="page-title">Reports</h1>
        <DeviceSelector selectedId={selectedParticipantId} onChange={onParticipantChange} />
      </div>

      <div className="tabs">
        {tabs.map((tab) => (
          <div
            key={tab}
            className={`tab ${activeTab === tab ? 'on' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </div>
        ))}
      </div>

      <div className="form-row mb-4">
        <select className="select-chip cursor-pointer" value={reportType} onChange={(e) => setReportType(e.target.value)}>
          <option value="Daily summary">Daily summary</option>
          <option value="Weekly summary">Weekly summary</option>
          <option value="Anomaly report">Anomaly report</option>
          <option value="Activity report">Activity report</option>
        </select>
        <button
          className="btn btn-primary flex items-center gap-1"
          style={{ marginLeft: 'auto' }}
          onClick={handleGenerate}
          disabled={generating}
        >
          <Lightning size={14} className={generating ? 'animate-spin' : ''} />
          {generating ? 'Generating...' : 'Generate report'}
        </button>
      </div>

      <div className="card !p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="pl-lg py-sm">Report name</th>
              <th>Generated at</th>
              <th className="pr-lg text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {reportsList.map((r: any, i: number) => (
              <tr key={i} className="border-t border-hairline">
                <td className="pl-lg py-sm">{r.name}</td>
                <td className="mono">{r.time}</td>
                <td className="pr-lg text-right">
                  <button className="btn btn-ghost py-1 px-3 flex items-center gap-1" onClick={() => setToast(`Downloading file: ${r.name}.pdf`)}>
                    <DownloadSimple size={12} /> Download
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </section>
  );
};
