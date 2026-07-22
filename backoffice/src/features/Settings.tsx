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


export const Settings: React.FC = () => {
  const [toast, setToast] = useState<string | null>(null);

  // Settings states
  const [devThreshold, setDevThreshold] = useState('2.0');
  const [alertThreshold, setAlertThreshold] = useState('3.0');
  const [recoveryThreshold, setRecoveryThreshold] = useState('80');
  const [minObsWindow, setMinObsWindow] = useState('100');
  const [resampling, setResampling] = useState('1 Hz');
  const [ectopic, setEctopic] = useState('Aktif');
  const [webhookUrl, setWebhookUrl] = useState('https://hooks.htm.internal/anomaly');
  const [apiKey, setApiKey] = useState('htm_live_9a8b7c6d5e4f2a');

  React.useEffect(() => {
    const fetchSettings = async () => {
      try {
        const token = sessionStorage.getItem('htm_token');
        const res = await fetch('/api/pipeline/settings', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) {
            setDevThreshold(data.data.devThreshold || '2.0');
            setAlertThreshold(data.data.alertThreshold || '3.0');
            setRecoveryThreshold(data.data.recoveryThreshold || '80');
            setMinObsWindow(data.data.minObsWindow || '100');
            setResampling(data.data.resampling || '1 Hz');
            setEctopic(data.data.ectopic || 'Aktif');
            setWebhookUrl(data.data.webhookUrl || '');
            setApiKey(data.data.apiKey || '');
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    try {
      const token = sessionStorage.getItem('htm_token');
      const res = await fetch('/api/pipeline/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          devThreshold, alertThreshold, recoveryThreshold, minObsWindow, resampling, ectopic, webhookUrl, apiKey
        })
      });
      if (res.ok) {
        setToast('Configuration settings saved successfully!');
      } else {
        setToast('Failed to save settings.');
      }
    } catch (err) {
      setToast('Network error while saving settings.');
    }
  };

  return (
    <section>
      <div className="page-head"><h1 className="page-title">Settings</h1></div>

      <div className="card mb-4">
        <p className="card-title border-b border-hairline pb-2 mb-3">Threshold model</p>
        <div className="kv-grid font-sans text-xs">
          <div className="kv-item">
            <span className="eyebrow">Deviation threshold (SD)</span>
            <input
              type="text"
              className="select-chip py-1 px-2 mt-1 w-full"
              value={devThreshold}
              onChange={(e) => setDevThreshold(e.target.value)}
            />
          </div>
          <div className="kv-item">
            <span className="eyebrow">Alert threshold (SD)</span>
            <input
              type="text"
              className="select-chip py-1 px-2 mt-1 w-full"
              value={alertThreshold}
              onChange={(e) => setAlertThreshold(e.target.value)}
            />
          </div>
          <div className="kv-item">
            <span className="eyebrow">Recovery threshold (%)</span>
            <input
              type="text"
              className="select-chip py-1 px-2 mt-1 w-full"
              value={recoveryThreshold}
              onChange={(e) => setRecoveryThreshold(e.target.value)}
            />
          </div>
          <div className="kv-item">
            <span className="eyebrow">Min observation window</span>
            <input
              type="text"
              className="select-chip py-1 px-2 mt-1 w-full"
              value={minObsWindow}
              onChange={(e) => setMinObsWindow(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <p className="card-title border-b border-hairline pb-2 mb-3">Parameter model</p>
        <div className="kv-grid font-sans text-xs">
          <div className="kv-item">
            <span className="eyebrow">Resampling frequency</span>
            <select className="select-chip py-1 px-2 mt-1 w-full" value={resampling} onChange={(e) => setResampling(e.target.value)}>
              <option value="1 Hz">1 Hz</option>
              <option value="2 Hz">2 Hz</option>
              <option value="5 Hz">5 Hz</option>
            </select>
          </div>
          <div className="kv-item">
            <span className="eyebrow">Ectopic correction</span>
            <select className="select-chip py-1 px-2 mt-1 w-full" value={ectopic} onChange={(e) => setEctopic(e.target.value)}>
              <option value="Aktif">Aktif (Koreksi RR otomatis)</option>
              <option value="Non-aktif">Non-aktif</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <p className="card-title border-b border-hairline pb-2 mb-3">Integrasi</p>
        <div className="kv-grid font-sans text-xs">
          <div className="kv-item" style={{ gridColumn: 'span 2' }}>
            <span className="eyebrow">Webhook URL</span>
            <input
              type="text"
              className="select-chip py-1 px-2 mt-1 w-full font-mono"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
          </div>
          <div className="kv-item" style={{ gridColumn: 'span 2' }}>
            <span className="eyebrow">API key</span>
            <input
              type="password"
              className="select-chip py-1 px-2 mt-1 w-full font-mono"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
        </div>
      </div>

      <button className="btn btn-primary flex items-center gap-1" onClick={handleSave}>
        <FloppyDisk size={14} /> Simpan perubahan
      </button>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </section>
  );
};
