import React, { useState, useEffect } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileCode,
  FileText,
  CheckCircle,
  Clock,
  ShieldCheck,
  Plus
} from 'lucide-react';

export const ExportView = ({ exportJobs, user }) => {
  const [jobs, setJobs] = useState(exportJobs || []);
  const [datasetLevels, setDatasetLevels] = useState({
    featureWindows: false,
    stateTimeline: true,
    episodeTable: true,
    experienceTable: false,
    modelSnapshot: false,
    emaResponses: true,
    auditLog: false
  });
  const [format, setFormat] = useState('CSV');
  const [includeEMA, setIncludeEMA] = useState(true);
  const [includePredictions, setIncludePredictions] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    import('../services/api').then(({ api }) => {
      api.getExportJobs().then(res => {
        if (res && res.data) {
          setJobs(res.data);
        }
      }).catch(err => console.error(err));
    });
  }, []);

  const toggleLevel = (key) => {
    setDatasetLevels(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGenerateExport = async (e) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const { api } = await import('../services/api');
      const activeScopes = Object.keys(datasetLevels).filter(k => datasetLevels[k]);
      
      const payload = {
        datasets: activeScopes,
        participantId: 'ALL',
        dateRange: 'ALL',
        contextFilter: {}
      };
      
      const res = await api.generateExportJob(payload);
      if (res && res.data) {
        setJobs([res.data, ...jobs]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (job) => {
    try {
      const jobId = job.id || job._id;
      // Gunakan instance axios yang sudah dikonfigurasi melalui proxy
      const { data, headers } = await import('../services/api').then(({ axios }) => axios.get(`/system/export-jobs/${jobId}/download`, { responseType: 'blob' }));
      
      const blob = new Blob([data], { type: headers['content-type'] });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Ekstrak nama file dari header Content-Disposition jika ada, atau buat nama file default
      const contentDisposition = headers['content-disposition'];
      let filename = `export_${jobId}.json`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?(.+)"?/);
        if (match && match[1]) filename = match[1];
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download export job:', err);
      alert('Gagal mendownload export bundle. Silakan coba lagi.');
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">Export &amp; Governed Dataset Reports</h1>
        <p className="page-sub">
          Generate paket ekspor dataset terkontrol untuk analisis eksternal, validasi statistik, atau pelaporan audit. Terdaftar di provenance log.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 24, marginBottom: 24 }}>
        {/* Left: Export Wizard Form */}
        <div className="card-panel">
          <div className="mini-label" style={{ marginBottom: 4 }}>New Export Job</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--navy)', marginBottom: 16 }}>
            Dataset Level &amp; Scope Selection
          </div>

          <form onSubmit={handleGenerateExport}>
            {/* Dataset Level Checkboxes */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: 8 }}>1. Select Dataset Level</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: 8 }}>
                {[
                  { key: 'stateTimeline', label: 'State Timeline' },
                  { key: 'episodeTable', label: 'Episode Table' },
                  { key: 'featureWindows', label: 'Feature Windows (RR/HR)' },
                  { key: 'experienceTable', label: 'Experience Memory' },
                  { key: 'emaResponses', label: 'EMA Responses' },
                  { key: 'modelSnapshot', label: 'Model/Rule Snapshot' },
                  { key: 'auditLog', label: 'Audit Provenance Log' },
                ].map((item) => (
                  <label
                    key={item.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 12,
                      background: datasetLevels[item.key] ? 'var(--teal-soft)' : 'var(--gray-soft)',
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: datasetLevels[item.key] ? '1px solid var(--teal)' : '1px solid var(--line)',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={datasetLevels[item.key]}
                      onChange={() => toggleLevel(item.key)}
                      style={{ accentColor: 'var(--teal)' }}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Format Selection */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: 8 }}>2. Select Output Format</label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {['CSV', 'JSON', 'XLSX', 'PDF Summary'].map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    className={format === fmt ? 'btn-teal' : 'btn-outline-navy'}
                    onClick={() => setFormat(fmt)}
                    style={{ flex: 1, minWidth: 80, padding: '7px 10px', fontSize: 11.5 }}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            {/* Scope Governance Check */}
            <div style={{ background: 'var(--gray-soft)', padding: 12, borderRadius: 8, marginBottom: 18, fontSize: 11, color: 'var(--ink)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>
                <ShieldCheck size={14} color="var(--teal)" />
                <span>Pseudonymization &amp; Privacy Check</span>
              </div>
              <div>Data partisipan disamarkan menggunakan pseudonym ID. Akses dievaluasi berdasarkan role <b>Reviewer</b>.</div>
            </div>

            <button type="submit" className="btn-teal" style={{ width: '100%' }} disabled={isGenerating}>
              <Download size={16} />
              <span>{isGenerating ? 'Generating Export Bundle...' : 'Generate Export Job'}</span>
            </button>
          </form>
        </div>

        {/* Right: Export Jobs Queue & Downloads */}
        <div className="card-panel">
          <div className="mini-label" style={{ marginBottom: 4 }}>Export History &amp; Downloads</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--navy)', marginBottom: 16 }}>
            Generated Export Bundles
          </div>

          <div className="table-responsive">
            <table className="dtable">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Scope</th>
                <th>Format</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td className="mono" style={{ fontWeight: 800, color: 'var(--navy)' }}>{job.id}</td>
                  <td style={{ fontSize: 11 }}>
                    <div style={{ fontWeight: 600 }}>{job.scope}</div>
                    <div style={{ fontSize: 10, color: 'var(--gray)' }}>{job.date}</div>
                  </td>
                  <td className="mono">{job.format}</td>
                  <td>
                    <span className={`badge-soft ${job.status === 'Ready' ? 'chip-green' : 'chip-neutral'}`}>
                      {job.status}
                    </span>
                  </td>
                  <td>
                    {job.status === 'Ready' ? (
                      <button className="btn-outline-navy" style={{ padding: '4px 8px', fontSize: 10 }} onClick={() => handleDownload(job)}>
                        <Download size={12} />
                        <span>Download</span>
                      </button>
                    ) : (
                      <span style={{ fontSize: 10, color: 'var(--gray)' }}>Expired</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>
  );
};
