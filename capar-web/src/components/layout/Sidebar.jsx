import React from 'react';

export const Sidebar = ({ activeTab, setActiveTab, userRole, isOpen, onCloseMobile }) => {
  // Normalize roles
  let role = userRole?.role || 'user';
  if (role.toLowerCase() === 'administrator') role = 'admin';
  if (role === 'patient') role = 'user';

  const allNavItems = [
    // === Cohort & Patient ===
    { id: 'overview', label: 'Daftar Pasien', icon: 'fa-house-medical', roles: ['admin', 'researcher', 'doctor', 'user'] },

    // === Per-Participant Monitoring ===
    { id: 'live-monitor', label: 'Live Monitoring', icon: 'fa-satellite-dish', roles: ['admin', 'researcher', 'doctor', 'user'] },
    { id: 'signal-quality', label: 'Signal & Quality', icon: 'fa-tower-broadcast', roles: ['admin', 'researcher', 'doctor', 'user'] },
    { id: 'baseline-maturity', label: 'Baseline Model', icon: 'fa-chart-simple', roles: ['admin', 'researcher', 'doctor', 'user'] },
    { id: 'state-timeline', label: 'State Timeline', icon: 'fa-timeline', roles: ['admin', 'researcher', 'doctor', 'user'] },
    { id: 'event-generator', label: 'Event Generator', icon: 'fa-filter', roles: ['admin', 'researcher', 'doctor', 'user'] },
    { id: 'episode', label: 'Episode List', icon: 'fa-wave-square', roles: ['admin', 'researcher', 'doctor', 'user'] },
    { id: 'episode-detail', label: 'Episode Detail', icon: 'fa-chart-line', roles: ['admin', 'researcher', 'doctor', 'user'] },

    // === Analysis & Learning ===
    { id: 'experience', label: 'Experience Memory', icon: 'fa-brain', roles: ['admin', 'researcher', 'doctor', 'user'] },
    { id: 'prediction-eval', label: 'Prediction Eval', icon: 'fa-bullseye', roles: ['admin', 'researcher', 'doctor', 'user'] },
    { id: 'model-rules', label: 'Model & Rules', icon: 'fa-sliders', roles: ['admin', 'researcher', 'doctor'] },

    // === Data & Governance ===
    { id: 'export', label: 'Export Data', icon: 'fa-file-export', roles: ['admin', 'researcher', 'doctor'] },
    { id: 'audit', label: 'Audit Provenance', icon: 'fa-clipboard-list', roles: ['admin', 'researcher', 'doctor'] },

    // === System & Admin ===
    { id: 'user-management', label: 'User Management', icon: 'fa-users-gear', roles: ['admin', 'doctor'] },
    { id: 'profile', label: 'My Profile', icon: 'fa-user', roles: ['admin', 'researcher', 'doctor', 'user'] },
    { id: 'settings', label: 'Settings', icon: 'fa-user-shield', roles: ['admin', 'doctor', 'researcher', 'user'] },

    // === AI Tools ===
    { id: 'zero-shot', label: 'Explain', icon: 'fa-lightbulb', roles: ['admin', 'researcher', 'doctor', 'user'] },
  ];

  const navItems = allNavItems.filter(item => item.roles.includes(role));

  const handleNavClick = (id) => {
    setActiveTab(id);
    if (onCloseMobile) onCloseMobile();
  };

  // Group labels
  const groupLabels = {
    'overview': null,
    'live-monitor': 'Monitoring',
    'signal-quality': null,
    'baseline-maturity': null,
    'state-timeline': null,
    'event-generator': null,
    'episode': null,
    'episode-detail': null,
    'experience': 'Analysis',
    'prediction-eval': null,
    'model-rules': null,
    'export': 'Data & Governance',
    'audit': null,
    'user-management': 'System',
    'profile': null,
    'settings': null,
    'zero-shot': 'AI Tools',
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
