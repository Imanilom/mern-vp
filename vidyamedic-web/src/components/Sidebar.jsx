import {
  HeartPulse,
  LogOut,
  X,
} from 'lucide-react';
import { NAV_ITEMS } from '../constants/navigation';
import { getInitial } from '../utils/formatters';
import Brand from './Brand';

export default function Sidebar({
  active,
  onNavigate,
  account,
  onSignout,
  mobileOpen,
  onClose,
}) {
  return (
    <>
      {mobileOpen && <button aria-label="Tutup menu" className="mobile-scrim" onClick={onClose} />}
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <Brand />
          <button aria-label="Tutup menu" className="icon-button sidebar-close" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        <div className="sidebar-section-label">MENU UTAMA</div>
        <nav className="main-nav" aria-label="Navigasi utama">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              aria-current={active === id ? 'page' : undefined}
              className={`nav-item ${active === id ? 'nav-active' : ''}`}
              key={id}
              onClick={() => { onNavigate(id); onClose(); }}
            >
              <Icon size={19} strokeWidth={active === id ? 2.3 : 1.9} />
              <span>{label}</span>
              {active === id && <span className="nav-indicator" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-help">
          <div className="help-icon"><HeartPulse size={17} /></div>
          <strong>Jaga ritme sehat</strong>
          <p>Catat data secara konsisten untuk melihat pola personal Anda.</p>
        </div>
        <div className="sidebar-account">
          <div className="account-avatar">{getInitial(account?.name)}</div>
          <div className="account-info">
            <strong>{account?.name || 'Peserta'}</strong>
            <span>{account?.email || 'Akun Vidyamedic'}</span>
          </div>
          <button
            aria-label="Keluar"
            className="icon-button signout-button"
            onClick={onSignout}
            title="Keluar"
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
    </>
  );
}
