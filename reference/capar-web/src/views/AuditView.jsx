import React, { useState } from 'react';
import { ShieldCheck, Filter, Clock, User, FileText, CheckCircle2, Lock } from 'lucide-react';

export const AuditView = ({ auditTrail }) => {
  const [filterAction, setFilterAction] = useState('ALL');

  const filtered = auditTrail.filter(item => {
    if (filterAction !== 'ALL' && item.action !== filterAction) return false;
    return true;
  });

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">Audit &amp; Provenance Log</h1>
        <p className="page-sub">
          Jejak audit tidak dapat diubah (immutable event log) yang merekam seluruh transisi state, keputusan reviewer, ekspor data, dan perubahan aturan.
        </p>
      </div>

      {/* Filter Row */}
      <div className="filter-bar" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>
          <Filter size={14} color="var(--teal)" />
          <span>Filter Action:</span>
        </div>

        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            padding: '5px 10px',
            fontSize: 11.5,
            color: 'var(--ink)'
          }}
        >
          <option value="ALL">All Actions</option>
          <option value="STATE_TRANSITION">STATE_TRANSITION</option>
          <option value="REVIEWER_DECISION">REVIEWER_DECISION</option>
          <option value="EXPORT_GENERATE">EXPORT_GENERATE</option>
          <option value="RULE_PROMOTE">RULE_PROMOTE</option>
          <option value="EMA_SUBMIT">EMA_SUBMIT</option>
        </select>
      </div>

      {/* Audit Events Table */}
      <div className="card-panel" style={{ padding: 0 }}>
        <div className="table-responsive">
          <table className="dtable">
          <thead>
            <tr>
              <th>Audit ID</th>
              <th>Timestamp</th>
              <th>Actor ID</th>
              <th>Action Event</th>
              <th>Detail &amp; Provenance Metadata</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id}>
                <td className="mono" style={{ fontWeight: 800, color: 'var(--navy)' }}>{item.id}</td>
                <td className="mono" style={{ fontSize: 11, color: 'var(--gray)' }}>{item.timestamp}</td>
                <td style={{ fontSize: 11.5, fontWeight: 600 }}>{item.actor}</td>
                <td>
                  <span className={`badge-soft ${item.action === 'STATE_TRANSITION' ? 'chip-blue' : item.action === 'REVIEWER_DECISION' ? 'chip-green' : item.action === 'RULE_PROMOTE' ? 'chip-purple' : 'chip-neutral'}`}>
                    {item.action}
                  </span>
                </td>
                <td style={{ fontSize: 11.5, color: 'var(--ink)' }}>{item.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
};
