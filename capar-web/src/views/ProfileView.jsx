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
    <div style={{ padding: 30 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 30 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--teal-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <User size={24} color="var(--teal)" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--navy)' }}>My Profile</h2>
          <div style={{ fontSize: 12, color: 'var(--gray)' }}>Manage your personal details and security</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {/* Profile Details */}
        <div style={{ flex: '1 1 300px', background: '#fff', borderRadius: 12, padding: 20, border: '1px solid var(--line)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 16 }}>Profile Information</h3>
          
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray)', display: 'block', marginBottom: 4 }}>Name</label>
            <div style={{ fontSize: 13, color: 'var(--ink)' }}>{user?.name || 'Unknown'}</div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray)', display: 'block', marginBottom: 4 }}>Email</label>
            <div style={{ fontSize: 13, color: 'var(--ink)' }}>{user?.email || 'Unknown'}</div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray)', display: 'block', marginBottom: 4 }}>Role</label>
            <div style={{ display: 'inline-block', padding: '4px 8px', borderRadius: 4, background: 'var(--gray-soft)', fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>
              {user?.role?.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div style={{ flex: '1 1 300px', background: '#fff', borderRadius: 12, padding: 20, border: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Key size={16} color="var(--navy)" />
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', margin: 0 }}>Change Password</h3>
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
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: 4 }}>New Password</label>
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
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: 4 }}>Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Confirm new password"
                style={{ width: '100%', padding: '9px 12px', background: 'var(--gray-soft)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 12.5, outline: 'none' }}
              />
            </div>

            <button type="submit" className="btn-teal" disabled={isSubmitting} style={{ padding: '8px 16px', fontSize: 12, border: 'none', borderRadius: 6, cursor: 'pointer', background: 'var(--teal)', color: 'white' }}>
              {isSubmitting ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
