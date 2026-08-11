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
    <header className="backoffice-topbar">
      {/* Left Group: Mobile Menu Button + Cohort & Date Controls */}
      <div className="d-flex align-items-center gap-2 flex-nowrap" style={{ minWidth: 0 }}>
        {/* Mobile Sidebar Hamburger Toggle */}
        <button
          className="d-lg-none flex-shrink-0"
          onClick={onToggleSidebar}
          style={{
            background: 'var(--gray-soft)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--navy)'
          }}
          title="Toggle Navigation Menu"
        >
          <i className="fa-solid fa-bars" style={{ fontSize: 15 }}></i>
        </button>

        {/* Cohort Selector Pill */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--gray-soft)',
          border: '1px solid var(--line)',
          borderRadius: 8,
          padding: '5px 10px',
          height: 36,
          maxWidth: 220,
          minWidth: 0
        }}>
          <i className="fa-solid fa-users flex-shrink-0" style={{ color: 'var(--teal)', fontSize: 12 }}></i>
          <select
            value={selectedCohort}
            onChange={(e) => setSelectedCohort(e.target.value)}
            style={{
              appearance: 'none',
              background: 'transparent',
              border: 'none',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--navy)',
              outline: 'none',
              cursor: 'pointer',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              maxWidth: 160,
              paddingRight: 12
            }}
          >
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <i className="fa-solid fa-chevron-down flex-shrink-0" style={{ fontSize: 9, color: 'var(--gray)', marginLeft: -10, pointerEvents: 'none' }}></i>
        </div>

        {/* Participant Selector Pill */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--gray-soft)',
          border: '1px solid var(--line)',
          borderRadius: 8,
          padding: '5px 10px',
          height: 36,
          maxWidth: 220,
          minWidth: 0
        }}>
          <i className="fa-solid fa-user flex-shrink-0" style={{ color: 'var(--teal)', fontSize: 12 }}></i>
          <select
            value={globalParticipantFilter}
            onChange={(e) => setGlobalParticipantFilter(e.target.value)}
            style={{
              appearance: 'none',
              background: 'transparent',
              border: 'none',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--navy)',
              outline: 'none',
              cursor: 'pointer',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              maxWidth: 160,
              paddingRight: 12
            }}
          >
            <option value="ALL">Semua Pasien</option>
            {participants.map((p) => (
              <option key={p.id || p._id} value={p.id || p._id}>
                {p.id || p._id}
              </option>
            ))}
          </select>
          <i className="fa-solid fa-chevron-down flex-shrink-0" style={{ fontSize: 9, color: 'var(--gray)', marginLeft: -10, pointerEvents: 'none' }}></i>
        </div>

        {/* Dynamic Patient Date Dropdown */}
        {activeParticipantId && availableDates.length > 0 && (
          <div className="d-flex" style={{
            alignItems: 'center',
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            padding: '4px 8px',
            position: 'relative'
          }}>
            <i className="fa-regular fa-calendar" style={{ fontSize: 12, color: 'var(--teal)', marginRight: 6 }}></i>
            <select
              value={globalDateFilter || ''}
              onChange={(e) => setGlobalDateFilter(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--ink)',
                fontSize: 12,
                fontWeight: 500,
                outline: 'none',
                cursor: 'pointer',
                appearance: 'none',
                paddingRight: 16
              }}
            >
              <option value="" disabled>Pilih Tanggal</option>
              {availableDates.map(dateStr => (
                <option key={dateStr} value={dateStr}>
                  {dateStr}
                </option>
              ))}
            </select>
            <i className="fa-solid fa-chevron-down flex-shrink-0" style={{ fontSize: 9, color: 'var(--gray)', position: 'absolute', right: 8, pointerEvents: 'none' }}></i>
          </div>
        )}

        {/* Search Input (Hidden on Small Screens) */}
        <div className="d-none d-lg-flex" style={{
          alignItems: 'center',
          gap: 8,
          background: 'var(--gray-soft)',
          border: '1px solid var(--line)',
          borderRadius: 8,
          padding: '5px 12px',
          height: 36,
          minWidth: 180,
          maxWidth: 280,
          flex: 1
        }}>
          <i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--gray)', fontSize: 12 }}></i>
          <input
            type="text"
            placeholder="Cari Participant, Episode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 12,
              outline: 'none',
              color: 'var(--ink)',
              width: '100%'
            }}
          />
        </div>
      </div>

      {/* Right Group: Notifications & User Profile */}
      <div className="d-flex align-items-center gap-2 flex-nowrap flex-shrink-0">
        {/* Notification Bell */}
        <button
          onClick={onOpenNotifications}
          style={{
            background: 'var(--gray-soft)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            position: 'relative'
          }}
          title="Notifikasi & Peringatan Operational"
        >
          <i className="fa-regular fa-bell" style={{ color: 'var(--navy)', fontSize: 14 }}></i>
          <span style={{
            position: 'absolute',
            top: 5,
            right: 5,
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--red)',
            border: '1.5px solid white'
          }} />
        </button>

        {/* User Role Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderLeft: '1px solid var(--line)',
          paddingLeft: 10
        }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--navy)',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: 11,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            {user?.avatar || 'RS'}
          </div>

          <div className="d-none d-sm-flex" style={{ flexDirection: 'column', justifyContent: 'center', lineHeight: 1.2 }}>
            <span style={{ fontWeight: 800, fontSize: 12, color: 'var(--navy)', whiteSpace: 'nowrap' }}>
              {user?.name || 'Dr. Rina S.'}
            </span>
            <span style={{ fontSize: 10.5, color: 'var(--teal)', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {user?.role || 'Reviewer'}
            </span>
          </div>

          <button
            onClick={onLogout}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--gray)',
              padding: 4,
              display: 'flex',
              alignItems: 'center'
            }}
            title="Keluar / Logout"
          >
            <i className="fa-solid fa-right-from-bracket" style={{ fontSize: 13 }}></i>
          </button>
        </div>
      </div>
    </header>
  );
};
