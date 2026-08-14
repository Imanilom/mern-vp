import React from 'react';
import { Settings, Shield, User, Smartphone, Lock, Eye } from 'lucide-react';

export const SettingsView = ({ user }) => {
  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">Settings &amp; System Configuration</h1>
        <p className="page-sub">
          Pengaturan hak akses role, privasi consent partisipan, integrasi perangkat sensor, dan tata kelola keamanan.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Left: Role & Permissions */}
        <div className="card-panel">
          <div className="mini-label" style={{ marginBottom: 4 }}>Role &amp; Permissions Governance</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--navy)', marginBottom: 14 }}>
            User Role: {user?.role || 'Reviewer'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
            {[
              { label: 'View Cohort & Live Streams', granted: true },
              { label: 'Review Episodes & Submit Notes', granted: true },
              { label: 'Simulate What-If Rules', granted: true },
              { label: 'Export Pseudonymized Datasets', granted: true },
              { label: 'Promote Active Rules to Production', granted: false },
              { label: 'Withdraw Participant Consent', granted: false },
            ].map((p, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--gray-soft)', borderRadius: 8, fontSize: 12 }}>
                <span>{p.label}</span>
                <span className={`badge-soft ${p.granted ? 'chip-green' : 'chip-red'}`} style={{ fontSize: 9 }}>
                  {p.granted ? 'GRANTED' : 'RESTRICTED'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Privacy & Consent Control */}
        <div className="card-panel">
          <div className="mini-label" style={{ marginBottom: 4 }}>Privacy &amp; Data Control</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--navy)', marginBottom: 14 }}>
            Consent Protocol Version: v2.4 (2026)
          </div>

          <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.5, marginBottom: 16 }}>
            Setiap unggahan data dari Android Participant App terikat dengan dokumen <b>Informed Consent Version v2.4</b>. Pencabutan consent akan menghentikan unggahan data baru dan menandai sesi terkait di audit log.
          </div>

          <div style={{ background: 'var(--gray-soft)', padding: 12, borderRadius: 8, fontSize: 11, color: 'var(--gray)' }}>
            <div>Session Idle Timeout: <b>30 minutes</b></div>
            <div>Deny-by-default logic: <b>Active</b></div>
            <div>API Host Proxy: <b>http://localhost:5000</b></div>
          </div>
        </div>
      </div>
    </div>
  );
};
