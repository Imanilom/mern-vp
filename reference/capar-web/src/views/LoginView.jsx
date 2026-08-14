import React, { useState } from 'react';
import { Shield, Key, HeartPulse, CheckCircle2, Lock, ArrowRight } from 'lucide-react';

export const LoginView = ({ onLoginSuccess }) => {
  const [step, setStep] = useState(1); // 1: credentials, 2: MFA
  const [email, setEmail] = useState('rina.s@capar-research.id');
  const [password, setPassword] = useState('••••••••••••');
  const [mfaCode, setMfaCode] = useState(['4', '8', '1', '', '', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleStep1 = (e) => {
    e.preventDefault();
    setStep(2);
  };

  const handleMfaChange = (idx, value) => {
    if (value.length > 1) value = value[0];
    const newCode = [...mfaCode];
    newCode[idx] = value;
    setMfaCode(newCode);

    // Auto focus next field
    if (value && idx < 5) {
      const nextInput = document.getElementById(`mfa-input-${idx + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleVerify = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      onLoginSuccess();
    }, 600);
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

        {step === 1 ? (
          <form onSubmit={handleStep1}>
            <div className="mini-label" style={{ marginBottom: 12 }}>Step 1 of 2 — Institutional Auth</div>

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

            <button type="submit" className="btn-teal" style={{ width: '100%', padding: '10px 16px' }}>
              <span>Lanjutkan ke MFA</span>
              <ArrowRight size={14} />
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify}>
            <div className="mini-label" style={{ marginBottom: 8 }}>Step 2 — Verifikasi TOTP (MFA)</div>
            <p style={{ fontSize: 12, color: 'var(--gray)', marginBottom: 16 }}>
              Masukkan 6 digit kode keamanan dari aplikasi Authenticator terdaftar.
            </p>

            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {mfaCode.map((digit, i) => (
                <input
                  key={i}
                  id={`mfa-input-${i}`}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleMfaChange(i, e.target.value)}
                  style={{
                    width: 44,
                    height: 48,
                    textAlign: 'center',
                    background: digit ? 'var(--teal-soft)' : 'var(--gray-soft)',
                    border: digit ? '1.5px solid var(--teal)' : '1px solid var(--line)',
                    borderRadius: 8,
                    fontSize: 18,
                    fontWeight: 800,
                    fontFamily: 'JetBrains Mono, monospace',
                    color: digit ? 'var(--teal)' : 'var(--ink)',
                    outline: 'none'
                  }}
                />
              ))}
            </div>

            <button
              type="submit"
              className="btn-teal"
              disabled={isSubmitting}
              style={{ width: '100%', padding: '10px 16px' }}
            >
              {isSubmitting ? 'Memverifikasi...' : 'Verifikasi & Sign In'}
            </button>

            <button
              type="button"
              onClick={() => setStep(1)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: 'var(--gray)',
                fontSize: 11.5,
                marginTop: 12,
                cursor: 'pointer'
              }}
            >
              ← Kembali ke email login
            </button>
          </form>
        )}

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
