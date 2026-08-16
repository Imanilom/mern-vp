import React from 'react';

export const Sidebar = ({ activeTab, setActiveTab, userRole, isOpen, onCloseMobile }) => {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: 'fa-table-columns' },
    { id: 'live-monitor', label: 'Live Monitor', icon: 'fa-satellite-dish' },
    { id: 'signal-quality', label: 'Signal & Quality', icon: 'fa-tower-broadcast' },
    { id: 'baseline-maturity', label: 'Baseline Maturity', icon: 'fa-ruler' },
    { id: 'episode', label: 'Episode Review', icon: 'fa-wave-square' },
    { id: 'state-timeline', label: 'State Timeline', icon: 'fa-timeline' },
    { id: 'experience', label: 'Experience Memory', icon: 'fa-brain' },
    { id: 'prediction-eval', label: 'Prediction Eval', icon: 'fa-bullseye' },
    { id: 'model-rules', label: 'Model & Rules', icon: 'fa-sliders' },
    { id: 'export', label: 'Export Data', icon: 'fa-file-export' },
    { id: 'audit', label: 'Audit Provenance', icon: 'fa-clipboard-list' },
    { id: 'settings', label: 'Settings & Privacy', icon: 'fa-user-shield' },
  ];

  const handleNavClick = (id) => {
    setActiveTab(id);
    if (onCloseMobile) onCloseMobile();
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

      <aside className={`backoffice-sidebar ${isOpen ? 'mobile-open' : ''}`}>
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
            return (
              <a
                key={item.id}
                className={`nav-link ${isActive ? 'active' : ''}`}
                onClick={() => handleNavClick(item.id)}
              >
                <i className={`fa-solid ${item.icon}`}></i>
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>

        <div className="sb-foot">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <i className="fa-solid fa-lock" style={{ color: 'var(--teal)', fontSize: 11 }}></i>
            <span style={{ color: '#8FB6C4', fontWeight: 600 }}>Governed Console</span>
          </div>
          <div>Role: <b>{userRole?.role || 'Reviewer'}</b></div>
          <div style={{ fontSize: 10, color: '#5E7381', marginTop: 3 }}>Deny-by-default active</div>
        </div>
      </aside>
    </>
  );
};
