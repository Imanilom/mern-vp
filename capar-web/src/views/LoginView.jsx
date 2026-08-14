import React, { useState } from 'react';
import { Shield, Key, HeartPulse, CheckCircle2, Lock, ArrowRight } from 'lucide-react';
import { api } from '../services/api';

export const LoginView = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('admin@htm.id');
  const [password, setPassword] = useState('123456');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.signin(email, password);
      onLoginSuccess();
    } catch (err) {
      alert("Login failed: " + (err.response?.data?.message || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(160deg, var(--navy) 0%, var(--navy-2) 100%)',
    }}>
      <div style={{
        width: 360,
        background: '#fff',
        borderRadius: 14,
        padding: '26px 24px',
        boxShadow: '0 20px 40px -14px rgba(15,30,45,.4)'
      }}>
        <div className="d-flex align-items-center gap-2 mb-3">
          <HeartPulse style={{ color: 'var(--teal)' }} size={22} />
          <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 16, color: 'var(--navy)' }}>CAPAR Console</span>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="mini-label mb-1">Step 1 of 2 — Credentials</div>
          
          <div className="mb-2">
            <div className="frame-note m-0 mb-1">Institutional email</div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="card-panel py-2 px-2 mono w-100"
              style={{ background: 'var(--gray-soft)', fontSize: 11.5, color: 'var(--ink)', border: '1px solid var(--line)', outline: 'none' }}
            />
          </div>
          
          <div className="mb-3">
            <div className="frame-note m-0 mb-1">Password</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="card-panel py-2 px-2 mono w-100"
              style={{ background: 'var(--gray-soft)', fontSize: 11.5, color: 'var(--ink)', border: '1px solid var(--line)', outline: 'none' }}
            />
          </div>
          
          <button type="submit" className="btn-teal w-100 mb-2" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Continue'}
          </button>
          
          <div className="frame-note m-0 text-center">
            Lupa password? <span style={{ color: 'var(--teal)', fontWeight: 700, cursor: 'pointer' }}>Hubungi admin</span>
          </div>
          
          <hr style={{ margin: '16px 0' }} />
          
          <div className="mini-label mb-1">Step 2 — MFA (TOTP)</div>
          <div className="frame-note mb-2" style={{ marginTop: 0 }}>Kode 6 digit dari authenticator app terdaftar untuk akun ini.</div>
          
          <div className="d-flex gap-2 mb-3">
            <div className="card-panel py-2 text-center flex-fill mono" style={{ background: 'var(--gray-soft)', color: 'var(--gray)' }}>·</div>
            <div className="card-panel py-2 text-center flex-fill mono" style={{ background: 'var(--gray-soft)', color: 'var(--gray)' }}>·</div>
            <div className="card-panel py-2 text-center flex-fill mono" style={{ background: 'var(--gray-soft)', color: 'var(--gray)' }}>·</div>
            <div className="card-panel py-2 text-center flex-fill mono" style={{ background: 'var(--gray-soft)', color: 'var(--gray)' }}>·</div>
            <div className="card-panel py-2 text-center flex-fill mono" style={{ background: 'var(--gray-soft)', color: 'var(--gray)' }}>·</div>
            <div className="card-panel py-2 text-center flex-fill mono" style={{ background: 'var(--gray-soft)', color: 'var(--gray)' }}>·</div>
          </div>
          
          <button type="button" className="btn-teal w-100" style={{ opacity: 0.5, cursor: 'not-allowed' }}>Verify & sign in</button>
          
          <div className="frame-note m-0 mt-3 text-center d-flex align-items-center justify-content-center gap-1" style={{ fontSize: 10 }}>
            <Lock size={10} color="var(--teal)" />
            Sesi berakhir otomatis 30 menit idle · perangkat dicatat
          </div>
        </form>
      </div>
    </div>
  );
};
