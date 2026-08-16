import React, { useState } from 'react';
import {
  Download,
  CheckSquare,
  Square,
  ShieldCheck,
  Filter,
  Layers,
  FileSpreadsheet
} from 'lucide-react';

export const ExportView = ({ exportJobs }) => {
  const [datasets, setDatasets] = useState({
    featureWindows: false,
    stateTimeline: true,
    episodeTable: true,
    experienceTable: false,
    modelSnapshot: false,
    emaResponses: true,
    auditLog: false,
  });

  const [participantId, setParticipantId] = useState('P-014');
  const [dateRange, setDateRange] = useState('27-30 May 2024');
  const [contextFilter, setContextFilter] = useState('All');
  const [reviewedOnly, setReviewedOnly] = useState('No');
  const [includePredictions, setIncludePredictions] = useState('Yes');
  const [isExporting, setIsExporting] = useState(false);

  const toggleDataset = (key) => {
    setDatasets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGenerateExport = (e) => {
    e.preventDefault();
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      alert('✓ Export job EX-104 generated successfully. Ready for governed download.');
    }, 1500);
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">W06. Export — Governed Research Dataset Export</h1>
        <p className="page-sub">
          Membangun paket ekspor terkontrol untuk penelitian dan audit dengan jaminan provenance dan pseudonymization.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* New Export Job Form (W06 Addendum) */}
        <div className="card-panel">
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--navy)', marginBottom: 14 }}>
            Create New Export Job
          </div>

          <form onSubmit={handleGenerateExport}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 16 }}>
              {/* Column 1: Dataset Level Checkboxes */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 10 }}>
                  1. Dataset Selection
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', background: '#F8FAFC', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--line)' }}>
                    <input type="checkbox" checked={datasets.featureWindows} onChange={() => toggleDataset('featureWindows')} />
                    <span>Feature windows (RR metrics)</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', background: 'var(--teal-soft)', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--teal)' }}>
                    <input type="checkbox" checked={datasets.stateTimeline} onChange={() => toggleDataset('stateTimeline')} />
                    <span style={{ fontWeight: 700, color: 'var(--navy)' }}>State timeline</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', background: 'var(--teal-soft)', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--teal)' }}>
                    <input type="checkbox" checked={datasets.episodeTable} onChange={() => toggleDataset('episodeTable')} />
                    <span style={{ fontWeight: 700, color: 'var(--navy)' }}>Episode table</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', background: '#F8FAFC', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--line)' }}>
                    <input type="checkbox" checked={datasets.experienceTable} onChange={() => toggleDataset('experienceTable')} />
                    <span>Experience table</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', background: '#F8FAFC', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--line)' }}>
                    <input type="checkbox" checked={datasets.modelSnapshot} onChange={() => toggleDataset('modelSnapshot')} />
                    <span>Model / rule snapshot</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', background: 'var(--teal-soft)', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--teal)' }}>
                    <input type="checkbox" checked={datasets.emaResponses} onChange={() => toggleDataset('emaResponses')} />
                    <span style={{ fontWeight: 700, color: 'var(--navy)' }}>EMA responses</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', background: '#F8FAFC', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--line)' }}>
                    <input type="checkbox" checked={datasets.auditLog} onChange={() => toggleDataset('auditLog')} />
                    <span>Audit log</span>
                  </label>
                </div>
              </div>

              {/* Column 2: Filters */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 10 }}>
                  2. Filters Scope
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--gray)', display: 'block', marginBottom: 3 }}>Participant</label>
                    <input
                      type="text"
                      value={participantId}
                      onChange={(e) => setParticipantId(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 12 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, color: 'var(--gray)', display: 'block', marginBottom: 3 }}>Date Range</label>
                    <input
                      type="text"
                      value={dateRange}
                      onChange={(e) => setDateRange(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 12 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, color: 'var(--gray)', display: 'block', marginBottom: 3 }}>Context</label>
                    <select
                      value={contextFilter}
                      onChange={(e) => setContextFilter(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 12 }}
                    >
                      <option value="All">All contexts</option>
                      <option value="Sitting">Sitting</option>
                      <option value="Walking">Walking</option>
                      <option value="Work">Work</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, color: 'var(--gray)', display: 'block', marginBottom: 3 }}>Reviewed Only</label>
                    <select
                      value={reviewedOnly}
                      onChange={(e) => setReviewedOnly(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 12 }}
                    >
                      <option value="No">No (Include unreviewed)</option>
                      <option value="Yes">Yes (Only confirmed)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, color: 'var(--gray)', display: 'block', marginBottom: 3 }}>Include Predictions</label>
                    <select
                      value={includePredictions}
                      onChange={(e) => setIncludePredictions(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 12 }}
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="submit"
                disabled={isExporting}
                style={{ flex: 1, padding: '10px 16px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}
              >
                {isExporting ? 'Generating Export Job...' : 'Generate Export Job'}
              </button>

              <button
                type="button"
                onClick={() => alert('Column preview: participant_pseudonym, timestamp, anomaly_score, physiological_state, context_confirmed, ema_answer_hash.')}
                style={{ padding: '10px 16px', background: 'var(--surface)', color: 'var(--navy)', border: '1px solid var(--line)', borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}
              >
                Preview Columns
              </button>
            </div>
          </form>
        </div>

        {/* Export Jobs List & Governance (W06 Addendum) */}
        <div>
          <div className="card-panel" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--navy)', marginBottom: 12 }}>
              Export Jobs History
            </div>

            <div className="table-responsive">
              <table className="dtable" style={{ fontSize: 11 }}>
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Scope</th>
                    <th>Format</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="mono" style={{ fontWeight: 800 }}>EX-103</td>
                    <td>episode+EMA</td>
                    <td>CSV</td>
                    <td><span className="chip-green" style={{ fontSize: 10, fontWeight: 800 }}>Ready</span></td>
                  </tr>
                  <tr>
                    <td className="mono" style={{ fontWeight: 800 }}>EX-102</td>
                    <td>state timeline</td>
                    <td>JSON</td>
                    <td><span className="chip-green" style={{ fontSize: 10, fontWeight: 800 }}>Ready</span></td>
                  </tr>
                  <tr>
                    <td className="mono" style={{ fontWeight: 800 }}>EX-101</td>
                    <td>audit trail</td>
                    <td>PDF</td>
                    <td><span className="chip-green" style={{ fontSize: 10, fontWeight: 800 }}>Ready</span></td>
                  </tr>
                  <tr>
                    <td className="mono" style={{ fontWeight: 800 }}>EX-100</td>
                    <td>features</td>
                    <td>CSV</td>
                    <td><span style={{ color: 'var(--gray)', fontSize: 10 }}>Expired</span></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 14 }}>
              <button
                onClick={() => alert('✓ Downloading package EX-103 (episode+EMA CSV bundle).')}
                style={{ width: '100%', padding: '8px 12px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 11.5, cursor: 'pointer' }}
              >
                Download EX-103 Bundle
              </button>
            </div>
          </div>

          {/* Governance Box (W06 Addendum) */}
          <div className="card-panel" style={{ background: '#F8FAFC', fontSize: 11, color: 'var(--gray)' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--navy)', marginBottom: 6 }}>
              Governance &amp; Provenance Audit
            </div>
            <p style={{ margin: 0, lineHeight: 1.4 }}>
              Every export records requester, role, filter scope, consent status, dataset/model versions, timestamp, and file checksum. Default to pseudonymized export; raw identifiers require explicit role permissions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
