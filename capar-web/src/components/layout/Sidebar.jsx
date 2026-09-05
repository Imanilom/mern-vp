import React from 'react';

export const Sidebar = ({ activeTab, setActiveTab, userRole, isOpen, onCloseMobile }) => {
  // Normalize roles
  let role = userRole?.role || 'user';
  if (role.toLowerCase() === 'administrator') role = 'admin';
  if (role === 'patient') role = 'user';

  const allNavItems = [
    // === 0. Subjek & Pasien ===
    { id: 'overview', label: 'Daftar Pasien & Kohort', icon: 'fa-hospital-user', roles: ['admin', 'researcher', 'doctor', 'user'] },

    // === 1. OBSERVASI & VARIABEL MASUKAN (Wearable y(k), Context u(k), Disturbance d(k)) ===
    { id: 'live-monitor', label: '1. Observasi Wearable y(k)', icon: 'fa-satellite-dish', roles: ['admin', 'researcher', 'doctor', 'user'] },
    { id: 'signal-quality', label: 'Signal Quality & Disturbance d(k)', icon: 'fa-tower-broadcast', roles: ['admin', 'researcher', 'doctor', 'user'] },
    { id: 'experience', label: 'Input Perilaku & Konteks u(k)', icon: 'fa-clipboard-user', roles: ['admin', 'researcher', 'doctor', 'user'] },

    // === 2. MODEL STATE-SPACE & 3. EKSTRAKSI METRIK EPISODE ===
    { id: 'baseline-maturity', label: '2. Model State-Space & Baseline', icon: 'fa-chart-simple', roles: ['admin', 'researcher', 'doctor', 'user'] },
    { id: 'state-timeline', label: 'Event-State Diskrit s(k)', icon: 'fa-timeline', roles: ['admin', 'researcher', 'doctor', 'user'] },
    { id: 'episode', label: '3. Ekstraksi Metrik Episode', icon: 'fa-wave-square', roles: ['admin', 'researcher', 'doctor', 'user'] },
    { id: 'episode-detail', label: 'Detail Trajektori Episode', icon: 'fa-chart-line', roles: ['admin', 'researcher', 'doctor', 'user'] },

    // === 4. PROSES FENOTIPING LONGITUDINAL (VEKTOR Φ, Q1–Q10) ===
    { id: 'weekly-phenotyping', label: '4. Fenotyping Frozen Mingguan (Φ)', icon: 'fa-snowflake', roles: ['admin', 'researcher', 'doctor', 'user'] },
    { id: 'autonomic-profile', label: 'Katalog Profil Otonomik', icon: 'fa-dna', roles: ['admin', 'researcher', 'doctor', 'user'] },

    // === 5. CAPAR CRS & 6. PHYSIOLOGICAL DIGITAL TWIN ===
    { id: 'cardiovascular-resilience', label: '5. Cardiovascular Resilience (CRS)', icon: 'fa-heart-circle-bolt', roles: ['admin', 'researcher', 'doctor', 'user'] },
    { id: 'prediction-eval', label: '6. Evaluasi Digital Twin', icon: 'fa-bullseye', roles: ['admin', 'researcher', 'doctor', 'user'] },
    { id: 'model-rules', label: 'Aturan FSM & Model Rules', icon: 'fa-sliders', roles: ['admin', 'researcher', 'doctor'] },

    // === 7 & 8. OUTPUT, XAI & DECISION SUPPORT ===
    { id: 'zero-shot', label: '7 & 8. XAI — Penjelasan Transparan', icon: 'fa-lightbulb', roles: ['admin', 'researcher', 'doctor', 'user'] },

    // === DATA, GOVERNANCE & ADMINISTRASI ===
    { id: 'audit', label: 'Audit Trail & Governance', icon: 'fa-clipboard-list', roles: ['admin', 'researcher', 'doctor', 'user'] },
    { id: 'export', label: 'Export Data', icon: 'fa-file-export', roles: ['admin', 'researcher', 'doctor'] },
    { id: 'user-management', label: 'User Management', icon: 'fa-users-gear', roles: ['admin', 'doctor'] },
    { id: 'profile', label: 'Profil Saya', icon: 'fa-user', roles: ['admin', 'researcher', 'doctor', 'user'] },
    { id: 'settings', label: 'Pengaturan Sistem', icon: 'fa-gear', roles: ['admin', 'doctor', 'researcher', 'user'] },
  ];

  const navItems = allNavItems.filter(item => item.roles.includes(role));

  const handleNavClick = (id) => {
    setActiveTab(id);
    if (onCloseMobile) onCloseMobile();
  };

  // Group labels matching the sequential flowchart
  const groupLabels = {
    'overview': 'Subjek & Kohort',
    'live-monitor': '1. Observasi & Masukan',
    'baseline-maturity': '2 & 3. State-Space & Episode',
    'weekly-phenotyping': '4. Fenotyping Longitudinal',
    'cardiovascular-resilience': '5 & 6. CRS & Digital Twin',
    'zero-shot': '7 & 8. Output & XAI Transparan',
    'audit': 'Data & Governance',
    'user-management': 'Administrasi & Akun',
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="d-lg-none"
          onClick={onCloseMobile}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 35, 55, 0.5)',
            backdropFilter: 'blur(3px)',
            zIndex: 998
          }}
        />
      )}

      <aside className={`app-sidebar ${isOpen ? 'mobile-open' : ''}`}>
        <div className="brand" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="fa-solid fa-heart-pulse"></i>
            <span>CAPAR Console</span>
          </div>

          {/* Close button on mobile */}
          <button
            className="d-lg-none"
            onClick={onCloseMobile}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8FB6C4',
              fontSize: 16,
              cursor: 'pointer'
            }}
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const groupLabel = groupLabels[item.id];
            return (
              <React.Fragment key={item.id}>
                {groupLabel && (
                  <div style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: '#4A7A8A',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    padding: '12px 16px 4px 16px',
                  }}>
                    {groupLabel}
                  </div>
                )}
                <a
                  className={`nav-link ${isActive ? 'active' : ''}`}
                  onClick={() => handleNavClick(item.id)}
                >
                  <i className={`fa-solid ${item.icon}`}></i>
                  <span>{item.label}</span>
                </a>
              </React.Fragment>
            );
          })}
        </nav>

        <div className="sb-foot">
          Research prototype<br />Non-diagnostic
        </div>
      </aside>
    </>
  );
};
