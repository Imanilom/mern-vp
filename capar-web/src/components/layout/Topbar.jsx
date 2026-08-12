import React, { useState } from 'react';

export const Topbar = ({
  cohorts,
  selectedCohort,
  setSelectedCohort,
  participants = [],
  activeParticipantId,
  globalParticipantFilter,
  setGlobalParticipantFilter,
  globalDateFilter,
  setGlobalDateFilter,
  availableDates = [],
  user,
  onLogout,
  onOpenNotifications,
  onToggleSidebar
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="app-topbar">
      <div className="d-flex gap-2 align-items-center">
        {/* Mobile Toggle */}
        <button className="d-lg-none btn-outline-navy" onClick={onToggleSidebar} style={{ padding: '6px 10px' }}>
          <i className="fa-solid fa-bars"></i>
        </button>

        <label className="cohort-pill m-0">
          <i className="fa-solid fa-users" style={{ color: 'var(--teal)' }}></i>
          <select
            value={selectedCohort}
            onChange={(e) => setSelectedCohort(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--navy)',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <i className="fa-solid fa-chevron-down" style={{ fontSize: 9 }}></i>
        </label>

        <label className="cohort-pill m-0">
          <i className="fa-solid fa-user" style={{ color: 'var(--teal)' }}></i>
          <select
            value={globalParticipantFilter}
            onChange={(e) => setGlobalParticipantFilter(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--navy)',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">Semua Pasien</option>
            {participants.map((p) => (
              <option key={p.id || p._id} value={p.id || p._id}>{p.id || p._id}</option>
            ))}
          </select>
          <i className="fa-solid fa-chevron-down" style={{ fontSize: 9 }}></i>
        </label>

        {activeParticipantId && availableDates.length > 0 && (
          <label className="topbar-search m-0" style={{ background: 'var(--surface)' }}>
            <i className="fa-regular fa-calendar" style={{ color: 'var(--teal)' }}></i>
            <select
              value={globalDateFilter || ''}
              onChange={(e) => setGlobalDateFilter(e.target.value)}
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--ink)', fontSize: 12, cursor: 'pointer'
              }}
            >
              <option value="" disabled>Pilih Tanggal</option>
              {availableDates.map(dateStr => (
                <option key={dateStr} value={dateStr}>{dateStr}</option>
              ))}
            </select>
            <i className="fa-solid fa-chevron-down" style={{ fontSize: 9 }}></i>
          </label>
        )}

        <div className="topbar-search d-none d-lg-flex m-0">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            type="text"
            placeholder="Cari Participant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', color: 'var(--ink)', width: '100%' }}
          />
        </div>
      </div>

      <div className="d-flex align-items-center gap-3">
        <i 
          className="fa-regular fa-bell" 
          style={{ color: 'var(--gray)', cursor: 'pointer', position: 'relative' }} 
          onClick={onOpenNotifications}
        >
          <span style={{ position: 'absolute', top: -2, right: -2, width: 6, height: 6, borderRadius: '50%', background: 'var(--red)' }}></span>
        </i>
        <div className="role-badge" onClick={onLogout} style={{ cursor: 'pointer' }} title="Logout">
          <div className="av">{user?.name ? user.name.substring(0, 2).toUpperCase() : 'U'}</div>
          <div className="rt">
            <b>{user?.name || 'User'}</b>
            {user?.role || 'Reviewer'}
          </div>
        </div>
      </div>
    </div>
  );
};
