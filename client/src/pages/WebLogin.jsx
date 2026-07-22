import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../utls/api.js';

// ── Heartbeat Pulse SVG — signature motif (only on Splash & Login) ───────────
function HeartbeatLine({ color = 'var(--htm-primary)', width = 280, height = 44 }) {
  const strokeDash = 600;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden="true"
      style={{ overflow: 'visible' }}
    >
      <path
        d={`M 0 ${height / 2}
            L ${width * 0.3} ${height / 2}
            L ${width * 0.36} ${height / 2 - 14}
            L ${width * 0.40} ${height / 2 + 18}
            L ${width * 0.44} ${height / 2 - 10}
            L ${width * 0.48} ${height / 2 + 6}
            L ${width * 0.52} ${height / 2}
            L ${width} ${height / 2}`}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={strokeDash}
        strokeDashoffset={strokeDash}
        style={{
          animation: 'htm-draw-heartbeat 1.4s ease-out 0.3s forwards',
        }}
      />

      {/* Glowing dot on the peak */}
      <circle
        cx={width * 0.40}
        cy={height / 2 - 14}
        r="3"
        fill={color}
        opacity="0"
        style={{ animation: 'htm-fade-dot 0.4s ease 1.6s forwards' }}
      />

      <style>{`
        @keyframes htm-draw-heartbeat {
          to { stroke-dashoffset: 0; }
        }
        @keyframes htm-fade-dot {
          to { opacity: 0.6; }
        }
      `}</style>
    </svg>
  );
}

export default function WebLogin() {
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await authApi.signIn(email, password);
      sessionStorage.setItem('webDashUser', JSON.stringify({
        _id:   user._id,
        name:  user.name,
        role:  user.role,
        email: user.email,
      }));
      navigate('/web');
    } catch (err) {
      setError(err.message || 'Login failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--htm-canvas)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--htm-lg)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* ── Logo & Heartbeat ── */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--htm-xl)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--htm-md)' }}>
            <HeartbeatLine />
          </div>

          <p className="htm-eyebrow" style={{ marginBottom: 8 }}>Health Trajectory Monitor</p>
          <h1
            className="htm-display htm-display-lg"
            style={{ color: 'var(--htm-ink)', margin: 0 }}
          >
            Web Console
          </h1>
          <p
            className="htm-body-sm"
            style={{ color: 'var(--htm-muted)', marginTop: 6 }}
          >
            Researcher &amp; Clinician Access
          </p>
        </div>

        {/* ── Login Form Card ── */}
        <div
          className="htm-card animate-htm-page-in"
          style={{
            padding: 'var(--htm-xl)',
            borderRadius: 'var(--htm-r-lg)',
          }}
        >
          {/* Error Banner */}
          {error && (
            <div
              style={{
                background: 'var(--htm-alert-bg)',
                border: '1px solid rgba(185,28,28,0.2)',
                borderRadius: 'var(--htm-r-sm)',
                color: 'var(--htm-alert)',
                fontFamily: 'var(--htm-font-mono)',
                fontSize: 12,
                padding: '10px var(--htm-md)',
                marginBottom: 'var(--htm-md)',
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Email Field */}
            <div className="htm-input-wrap" style={{ marginBottom: 'var(--htm-lg)' }}>
              <label className="htm-input-label" htmlFor="login-email">
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16" height="16" viewBox="0 0 24 24"
                  fill="none" stroke="var(--htm-muted)" strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round"
                  style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)' }}
                >
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="researcher@hospital.ac.id"
                  className="htm-input"
                  style={{ paddingLeft: 28 }}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="htm-input-wrap" style={{ marginBottom: 'var(--htm-xl)' }}>
              <label className="htm-input-label" htmlFor="login-password">
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16" height="16" viewBox="0 0 24 24"
                  fill="none" stroke="var(--htm-muted)" strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round"
                  style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)' }}
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="htm-input"
                  style={{ paddingLeft: 28, paddingRight: 32 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--htm-muted)', padding: 0, lineHeight: 0,
                  }}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="htm-btn htm-btn-primary htm-btn-lg"
              style={{
                width: '100%',
                opacity: loading ? 0.6 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16" height="16" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2"
                    style={{ animation: 'spin 1s linear infinite' }}
                  >
                    <line x1="12" y1="2" x2="12" y2="6"/>
                    <line x1="12" y1="18" x2="12" y2="22"/>
                    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
                    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
                    <line x1="2" y1="12" x2="6" y2="12"/>
                    <line x1="18" y1="12" x2="22" y2="12"/>
                    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
                    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
                  </svg>
                  Signing in…
                </>
              ) : 'Sign in to Console'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 'var(--htm-md)' }}>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="htm-btn htm-btn-ghost htm-btn-sm"
                style={{ fontFamily: 'var(--htm-font-mono)', fontSize: 11, letterSpacing: '0.04em' }}
              >
                ← Back to Portal
              </button>
            </div>
          </form>
        </div>

        {/* Footer note */}
        <p
          className="htm-eyebrow"
          style={{ textAlign: 'center', marginTop: 'var(--htm-md)', color: 'var(--htm-muted)' }}
        >
          Access restricted to authorised researchers, clinicians, and operators
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-htm-page-in { animation: htm-page-in 0.22s ease-out; }
        @keyframes htm-page-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
