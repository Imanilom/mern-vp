import React, { useState } from 'react';
import { Eye, EyeSlash, ArrowRight, Warning } from '@phosphor-icons/react';

const API_BASE = '/api';

interface LoginProps {
  onLoginSuccess: (token: string, user: { email: string; name: string; role: string }) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Email atau password salah.');
      }

      // Extract token & user info from response
      const token = data.token || data.accessToken || data.access_token || '';
      const user = {
        email: data.user?.email || data.email || email,
        name: data.user?.name || data.name || 'Administrator',
        role: data.user?.role || data.role || 'Administrator',
      };

      // Persist token to sessionStorage
      sessionStorage.setItem('htm_token', token);
      sessionStorage.setItem('htm_user', JSON.stringify(user));

      onLoginSuccess(token, user);
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan. Periksa koneksi ke server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      {/* Left panel — branding */}
      <div className="login-left">
        <div className="login-brand">
          <img src="/htm_logo.png" alt="HTM Logo" className="login-logo" />
          <div>
            <div className="login-brand-name">Health Trajectory Monitor</div>
            <div className="login-brand-sub">Clinical Research Platform</div>
          </div>
        </div>

        <div className="login-pitch">
          <h2 className="login-pitch-title">
            Real-time trajectory<br />monitoring for<br />clinical research
          </h2>
          <p className="login-pitch-desc">
            Monitor sensor data from Polar H10 wearables, detect anomalies automatically,
            and validate clinical events — all in one platform built for research teams.
          </p>
        </div>

        <div className="login-stats">
          <div className="login-stat">
            <div className="login-stat-value">28</div>
            <div className="login-stat-label">Active participants</div>
          </div>
          <div className="login-stat-divider"></div>
          <div className="login-stat">
            <div className="login-stat-value">1.2M</div>
            <div className="login-stat-label">Data points today</div>
          </div>
          <div className="login-stat-divider"></div>
          <div className="login-stat">
            <div className="login-stat-value">94.8%</div>
            <div className="login-stat-label">Avg completeness</div>
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="login-right">
        <div className="login-form-wrap">
          {/* Form header */}
          <div className="login-form-header">
            <div className="login-form-logo-sm">
              <img src="/htm_logo.png" alt="HTM" style={{ width: 20, height: 20, objectFit: 'contain' }} />
            </div>
            <h1 className="login-form-title">Sign in to HTM</h1>
            <p className="login-form-subtitle">
              Back office for clinical &amp; research teams
            </p>
          </div>

          {/* Error alert */}
          {error && (
            <div className="login-error" role="alert">
              <Warning size={15} />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="login-form" noValidate>
            <div className="login-field">
              <label htmlFor="login-email" className="login-label">Email address</label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                autoFocus
                required
                className="login-input"
                placeholder="you@htm.research"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="login-field">
              <div className="flex justify-between items-center">
                <label htmlFor="login-password" className="login-label">Password</label>
                <button type="button" className="login-forgot" tabIndex={-1}>
                  Lupa password?
                </button>
              </div>
              <div className="login-input-wrap">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="login-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="login-eye"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="login-submit"
              disabled={loading || !email || !password}
            >
              {loading ? (
                <span className="login-spinner"></span>
              ) : (
                <>
                  Sign in <ArrowRight size={15} weight="bold" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="login-form-footer">
            <span>Backend:</span>
            <code className="login-endpoint">localhost:3030</code>
            <span className="login-backend-status">
              <span className="status-dot" style={{ width: 6, height: 6 }}></span>
              Connected
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
