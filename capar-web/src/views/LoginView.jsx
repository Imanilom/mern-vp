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
      background: 'linear-gradient(160deg, #17324D 0%, #0F2337 100%)',
      padding: 20
    }}>
      <div style={{
        width: 380,
        background: '#ffffff',
        borderRadius: 16,
        padding: 32,
        boxShadow: '0 24px 48px -14px rgba(15, 30, 45, 0.5)',
        border: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--teal-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HeartPulse size={20} color="var(--teal)" />
          </div>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)', margin: 0 }}>CAPAR Console</h2>
            <div style={{ fontSize: 11, color: 'var(--gray)' }}>Web Research Backoffice</div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mini-label" style={{ marginBottom: 12 }}>Institutional Auth</div>

          <div style={{ marginTop: 8, marginBottom: 12, fontSize: 11, color: 'var(--gray)' }}>
            Demo admin: admin@htm.id / 123456
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: 4 }}>Institutional Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '9px 12px',
                background: 'var(--gray-soft)',
                border: '1px solid var(--line)',
                borderRadius: 8,
                fontSize: 12.5,
                outline: 'none'
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: 4 }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '9px 12px',
                background: 'var(--gray-soft)',
                border: '1px solid var(--line)',
                borderRadius: 8,
                fontSize: 12.5,
                outline: 'none'
              }}
            />
          </div>

          <button type="submit" className="btn-teal" disabled={isSubmitting} style={{ width: '100%', padding: '10px 16px' }}>
            <span>{isSubmitting ? 'Signing in...' : 'Sign In'}</span>
            <ArrowRight size={14} />
          </button>
        </form>

        <div style={{
          marginTop: 20,
          paddingTop: 14,
          borderTop: '1px solid var(--line)',
          fontSize: 10.5,
          color: 'var(--gray)',
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6
        }}>
          <Lock size={12} color="var(--teal)" />
          <span>Sesi idle berakhir dalam 30 min · Deny-by-default active</span>
        </div>
      </div>
    </div>
  );
};
