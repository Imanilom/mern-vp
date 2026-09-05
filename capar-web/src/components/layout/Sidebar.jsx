import React from 'react';

export const Sidebar = ({ activeTab, setActiveTab, userRole, isOpen, onCloseMobile }) => {
  // Normalize roles
  let role = userRole?.role || 'user';
  if (role.toLowerCase() === 'administrator') role = 'admin';
  if (role === 'patient') role = 'user';

  const allNavItems = [
    // === 0. Subjek & Pasien ===
    { id: 'overview', label: 'Daftar Pasien & Kohort', icon: 'fa-hospital-user', roles: ['admin', 'researcher', 'doctor', 'user'] },

    // === BLOK 1: PEMBENTUKAN MODEL STATE-SPACE AUTONOMIC RECOVERY & OBSERVASI ===
    { id: 'live-monitor', label: 'Observasi Wearable y(k)', icon: 'fa-satellite-dish', roles: ['admin', 'researcher', 'doctor', 'user'] },
    { id: 'signal-quality', label: 'Signal Quality & Disturbance d(k)', icon: 'fa-tower-broadcast', roles: ['admin', 'researcher', 'doctor', 'user'] },
    { id: 'baseline-maturity', label: 'Model State-Space & Baseline', icon: 'fa-chart-simple', roles: ['admin', 'researcher', 'doctor', 'user'] },
    { id: 'state-timeline', label: 'Event-State Diskrit s(k)', icon: 'fa-timeline', roles: ['admin', 'researcher', 'doctor', 'user'] },
    { id: 'event-generator', label: 'Generator Event & Deteksi', icon: 'fa-filter', roles: ['admin', 'researcher', 'doctor', 'user'] },
    { id: 'episode', label: 'Ekstraksi Metrik Episode', icon: 'fa-wave-square', roles: ['admin', 'researcher', 'doctor', 'user'] },
    { id: 'episode-detail', label: 'Detail Trajektori Episode', icon: 'fa-chart-line', roles: ['admin', 'researcher', 'doctor', 'user'] },
    { id: 'experience', label: 'Transisi Markov & Experience', icon: 'fa-brain', roles: ['admin', 'researcher', 'doctor', 'user'] },
    { id: 'model-rules', label: 'Aturan FSM & Model Rules', icon: 'fa-sliders', roles: ['admin', 'researcher', 'doctor'] },
    { id: 'audit', label: 'Audit Trail & Provenance', icon: 'fa-clipboard-list', roles: ['admin', 'researcher', 'doctor', 'user'] },

    // === BLOK 2: FENOTIPING LONGITUDINAL ===
    { id: 'weekly-phenotyping', label: 'Fenotiping Longitudinal (Φ)', icon: 'fa-snowflake', roles: ['admin', 'researcher', 'doctor', 'user'] },
    { id: 'autonomic-profile', label: 'Katalog Profil Otonomik', icon: 'fa-dna', roles: ['admin', 'researcher', 'doctor', 'user'] },

    // === BLOK 3: CAPAR CARDIOVASCULAR RESILIENCE STATE (CRS) ===
    { id: 'cardiovascular-resilience', label: 'Cardiovascular Resilience (CRS)', icon: 'fa-heart-circle-bolt', roles: ['admin', 'researcher', 'doctor', 'user'] },
    { id: 'clinical-vulnerability', label: 'Clinical Vulnerability (CV)', icon: 'fa-shield-heart', roles: ['admin', 'researcher', 'doctor', 'user'] },

    // === BLOK 4: PHYSIOLOGICAL DIGITAL TWIN ===
    { id: 'prediction-eval', label: 'Simulasi What-If Digital Twin', wwwicon: 'fa-bullseye', roles: ['admin', 'researcher', 'doctor', 'user'] },

    // === BLOK 5: OUTPUT, DECISION SUPPORT & XAI ===
    { id: 'zero-shot', label: 'XAI — Penjelasan Transparan', icon: 'fa-lightbulb', roles: ['admin', 'researcher', 'doctor', 'user'] },

    // === ADMINISTRASI & SISTEM ===
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

  // Group labels matching the 5 canonical blocks
  const groupLabels = {
    'overview': 'Subjek & Kohort',
    'live-monitor': 'Blok 1 — State-Space & Observasi',
    'weekly-phenotyping': 'Blok 2 — Fenotiping Longitudinal',
    'cardiovascular-resilience': 'Blok 3 — Cardiovascular Resilience (CRS)',
    'prediction-eval': 'Blok 4 — Physiological Digital Twin',
    'zero-shot': 'Blok 5 — Output & Decision Support (XAI)',
    'export': 'Administrasi & Sistem',
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
