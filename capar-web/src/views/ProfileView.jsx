import React, { useState } from 'react';
import { User, Key, CheckCircle } from 'lucide-react';
import { api } from '../services/api';

export const ProfileView = ({ user }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.updateUser(user._id || user.id, { password });
      setMessage('Password updated successfully!');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError('Failed to update password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">My Profile</h1>
        <p className="page-sub">Manage your personal details and security</p>
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {/* Profile Details */}
        <div className="card-panel" style={{ flex: '1 1 300px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--teal-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={24} color="var(--teal)" />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy)', margin: 0 }}>Profile Information</h3>
              <div style={{ fontSize: 11.5, color: 'var(--gray)' }}>Account Details</div>
            </div>
          </div>
          
          <div style={{ marginBottom: 12, borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>
            <div className="mini-label mb-1">Name</div>
            <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>{user?.name || 'Unknown'}</div>
          </div>

          <div style={{ marginBottom: 12, borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>
            <div className="mini-label mb-1">Email</div>
            <div style={{ fontSize: 13, color: 'var(--ink)' }}>{user?.email || 'Unknown'}</div>
          </div>

          <div>
            <div className="mini-label mb-1">Role</div>
            <span className={`badge-soft ${user?.role === 'admin' ? 'chip-purple' : user?.role === 'reviewer' ? 'chip-blue' : 'chip-green'}`}>
              {user?.role?.toUpperCase() || 'USER'}
            </span>
          </div>
        </div>

        {/* Change Password */}
        <div className="card-panel" style={{ flex: '1 1 300px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <Key size={16} color="var(--navy)" />
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)', margin: 0 }}>Change Password</h3>
          </div>

          {message && (
            <div style={{ padding: '8px 12px', background: 'var(--teal-soft)', color: 'var(--teal)', fontSize: 12, borderRadius: 6, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={14} /> {message}
            </div>
          )}

          {error && (
            <div style={{ padding: '8px 12px', background: 'var(--red-soft)', color: 'var(--red)', fontSize: 12, borderRadius: 6, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleUpdatePassword}>
            <div style={{ marginBottom: 14 }}>
              <div className="mini-label mb-1">New Password</div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter new password"
                style={{ width: '100%', padding: '9px 12px', background: 'var(--gray-soft)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 12.5, outline: 'none' }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <div className="mini-label mb-1">Confirm New Password</div>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Confirm new password"
                style={{ width: '100%', padding: '9px 12px', background: 'var(--gray-soft)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 12.5, outline: 'none' }}
              />
            </div>

            <button type="submit" className="btn-teal w-100" disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
