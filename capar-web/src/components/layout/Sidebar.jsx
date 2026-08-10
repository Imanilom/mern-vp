import React from 'react';

export const Sidebar = ({ activeTab, setActiveTab, userRole, isOpen, onCloseMobile }) => {
  // Normalize roles
  let role = userRole?.role || 'user';
  if (role.toLowerCase() === 'administrator') role = 'admin';
  if (role === 'patient') role = 'user';
  
  const allNavItems = [
    // Workspace / Doctor Overview
    { id: 'overview', label: 'Daftar Pasien', icon: 'fa-house-medical', roles: ['admin', 'researcher', 'doctor', 'user'] },
    
    // Patient Dashboard
    { id: 'live-monitor', label: 'Live Monitoring', icon: 'fa-satellite-dish', roles: ['admin', 'researcher', 'doctor', 'user'] },
    { id: 'activity-context', label: 'Activity Context', icon: 'fa-shoe-prints', roles: ['admin', 'researcher', 'doctor', 'user'] },
    { id: 'baseline-maturity', label: 'Baseline Model', icon: 'fa-chart-simple', roles: ['admin', 'researcher', 'doctor', 'user'] },
    { id: 'state-timeline', label: 'Trajectory Analysis', icon: 'fa-chart-line', roles: ['admin', 'researcher', 'doctor', 'user'] },
    { id: 'episode', label: 'Anomaly Detection', icon: 'fa-triangle-exclamation', roles: ['admin', 'researcher', 'doctor', 'user'] },
    { id: 'reports', label: 'Reports', icon: 'fa-file-lines', roles: ['admin', 'researcher', 'doctor', 'user'] },
    
    // System & Admin
    { id: 'pipeline-monitor', label: 'Pipeline Monitor', icon: 'fa-microchip', roles: ['admin', 'researcher'] },
    { id: 'user-management', label: 'User Management', icon: 'fa-users-gear', roles: ['admin'] },
    { id: 'profile', label: 'My Profile', icon: 'fa-user', roles: ['admin', 'researcher', 'doctor', 'user'] },
    { id: 'settings', label: 'Settings', icon: 'fa-gear', roles: ['admin'] },
  ];

  const navItems = allNavItems.filter(item => item.roles.includes(role));

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
