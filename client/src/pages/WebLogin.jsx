import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaHeartbeat, FaLock, FaEnvelope, FaEye, FaEyeSlash } from 'react-icons/fa';
import { authApi } from '../utls/api.js';

export default function WebLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await authApi.signIn(email, password);
      // Store minimal user info in sessionStorage for the dashboard
      sessionStorage.setItem('webDashUser', JSON.stringify({
        _id: user._id,
        name: user.name,
        role: user.role,
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
    <div className="min-h-screen bg-brand-dark text-brand-text flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Decorative blurs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-sys-blue/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-sys-purple/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-sys-blue/10 border border-sys-blue/20 rounded-2xl flex items-center justify-center text-sys-blue text-3xl animate-pulse-slow">
              <FaHeartbeat />
            </div>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Health Trajectory</h1>
          <p className="text-brand-muted text-sm mt-1">Web Console — Researcher & Clinician Access</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-brand-card border border-brand-border rounded-3xl p-8 space-y-5 shadow-2xl">
          {error && (
            <div className="bg-sys-red/10 border border-sys-red/20 text-sys-red text-xs font-semibold px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-brand-muted uppercase tracking-wider block mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <FaEnvelope className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted text-sm" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="researcher@hospital.ac.id"
                className="w-full bg-brand-dark border border-brand-border rounded-xl pl-10 pr-4 py-3 text-sm text-brand-text focus:outline-none focus:border-sys-blue transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-brand-muted uppercase tracking-wider block mb-1.5">
              Password
            </label>
            <div className="relative">
              <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted text-sm" />
              <input
                type={showPass ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-brand-dark border border-brand-border rounded-xl pl-10 pr-12 py-3 text-sm text-brand-text focus:outline-none focus:border-sys-blue transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-text"
              >
                {showPass ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-sys-blue hover:opacity-90 disabled:opacity-50 text-white font-extrabold rounded-xl text-sm transition-opacity mt-2"
          >
            {loading ? 'Signing in…' : 'Sign In to Web Console'}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-xs text-brand-muted hover:text-brand-text"
            >
              ← Back to Portal
            </button>
          </div>
        </form>

        <p className="text-center text-[10px] text-brand-muted mt-6">
          Access restricted to authorised researchers, clinicians, and system operators.
        </p>
      </div>
    </div>
  );
}
