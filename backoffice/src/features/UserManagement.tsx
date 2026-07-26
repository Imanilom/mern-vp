import React, { useState, useEffect } from 'react';
import {
  UserPlus, Check, X, NotePencil
} from '@phosphor-icons/react';

export interface AnalyticsProps {
  selectedParticipantId: string;
  onParticipantChange: (id: string) => void;
}

export const Toast: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        background: 'var(--surface)',
        border: '1px solid var(--primary)',
        borderRadius: 'var(--r-md)',
        padding: '12px 18px',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        animation: 'fadeInUp 200ms var(--ease)',
      }}
    >
      <span className="status-dot"></span>
      <span style={{ fontSize: '13px', fontWeight: 550, color: 'var(--ink)' }}>{message}</span>
    </div>
  );
};

export const UserManagement: React.FC = () => {
  const [toast, setToast] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Researcher');

  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Edit State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem('htm_token');
      const res = await fetch('/api/patient/all', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const patients = Array.isArray(data) ? data : (data.patients || []);
        const mapped = patients.map((p: any) => {
          let role = p.role || 'Participant';
          let badgeClass = 'badge-inactive';
          
          if (role.toLowerCase() === 'admin' || role.toLowerCase() === 'administrator') {
            role = 'Administrator';
            badgeClass = 'badge-model';
          } else if (role.toLowerCase() === 'researcher' || role.toLowerCase() === 'analyst') {
            badgeClass = 'badge-monitoring';
          } else if (role.toLowerCase() === 'clinician' || role.toLowerCase() === 'doctor') {
            badgeClass = 'badge-caution';
          } else if (role.toLowerCase() === 'patient' || role.toLowerCase() === 'participant') {
            role = 'Participant';
          } else if (role.toLowerCase() === 'user') {
            role = 'User';
          }

          return {
            _id: p._id,
            email: p.email || `${p.device_id || 'user'}@htm.com`,
            name: p.name || p.device_id || 'Unknown',
            role: role,
            badgeClass: badgeClass,
            status: p.is_active === false ? 'Inactive' : 'Active',
            lastLogin: p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : '—',
            age: p.age,
            gender: p.gender,
            weight: p.weight,
            height: p.height,
            is_active: p.is_active !== false,
            originalRole: p.role || 'user'
          };
        });

        setUsersList(mapped);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) {
      setToast('Name and email are required.');
      return;
    }

    try {
      const token = sessionStorage.getItem('htm_token');
      const res = await fetch('/api/auth/backoffice-register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, email, role })
      });

      if (res.ok) {
        setToast(`User "${name}" has been registered successfully.`);
        setName('');
        setEmail('');
        setShowAddForm(false);
        fetchUsers();
      } else {
        const errorData = await res.json();
        setToast(`Error: ${errorData.message}`);
      }
    } catch (err) {
      setToast('Network error during registration.');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser || !editUser._id) return;

    try {
      const token = sessionStorage.getItem('htm_token');
      const res = await fetch(`/api/user/update/${editUser._id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editUser.name,
          email: editUser.email,
          role: editUser.originalRole,
          is_active: editUser.is_active,
          age: editUser.age,
          gender: editUser.gender,
          weight: editUser.weight,
          height: editUser.height
        })
      });

      if (res.ok) {
        setToast(`User "${editUser.name}" updated successfully.`);
        setShowEditModal(false);
        fetchUsers();
      } else {
        const err = await res.json();
        setToast(`Failed to update: ${err.message}`);
      }
    } catch (error) {
      setToast('Network error updating user.');
    }
  };

  const openEditModal = (u: any) => {
    setEditUser({ ...u });
    setShowEditModal(true);
  };

  return (
    <section>
      <div className="page-head">
        <h1 className="page-title">User management</h1>
        <button className="btn btn-primary flex items-center gap-1" onClick={() => setShowAddForm(!showAddForm)}>
          <UserPlus size={14} /> {showAddForm ? 'Close form' : 'Add user'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddUser} className="card mb-4 animate-fadein" style={{ padding: '16px', maxWidth: '400px' }}>
          <p className="card-title pb-2 border-b border-hairline mb-3">Register New User</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label className="eyebrow" style={{ fontSize: '10.5px' }}>Full Name</label>
              <input
                type="text"
                className="select-chip font-sans"
                placeholder="John Doe"
                style={{ padding: '8px', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)' }}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label className="eyebrow" style={{ fontSize: '10.5px' }}>Email Address</label>
              <input
                type="email"
                className="select-chip font-sans"
                placeholder="john@htm.com"
                style={{ padding: '8px', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)' }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label className="eyebrow" style={{ fontSize: '10.5px' }}>Access Role</label>
              <select
                className="select-chip cursor-pointer w-full"
                style={{ padding: '8px', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)' }}
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="Researcher">Researcher</option>
                <option value="Analyst">Analyst</option>
                <option value="Clinician">Clinician</option>
                <option value="Operator">Operator</option>
                <option value="Field Officer">Field Officer</option>
                <option value="Administrator">Administrator</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary mt-2 flex items-center justify-center gap-1">
              <Check size={14} /> Save user
            </button>
          </div>
        </form>
      )}

      <div className="card !p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="pl-lg py-sm">User</th>
              <th>Name</th>
              <th>Role</th>
              <th>Status</th>
              <th className="text-right">Last login</th>
              <th className="pr-lg text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-lg text-muted">Loading users...</td></tr>
            ) : usersList.map((u) => (
              <tr key={u.email} className="border-t border-hairline">
                <td className="mono pl-lg py-sm">{u.email}</td>
                <td>{u.name}</td>
                <td>
                  <span className={`badge ${u.badgeClass}`}>
                    <span className="badge-dot"></span>{u.role}
                  </span>
                </td>
                <td>
                  <span className={`badge ${u.status === 'Active' ? 'badge-stable' : 'badge-caution'}`}>
                    <span className="badge-dot"></span>{u.status}
                  </span>
                </td>
                <td className="mono text-right">{u.lastLogin}</td>
                <td className="pr-lg text-right">
                  <button className="btn btn-outline" style={{ padding: '4px 8px' }} onClick={() => openEditModal(u)}>
                    <NotePencil size={14} /> Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showEditModal && editUser && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'fadeIn 200ms ease'
        }}>
          <div className="card" style={{ width: 440, maxWidth: '90%', padding: 24, borderRadius: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <NotePencil size={20} color="var(--primary)" /> Edit User Data
              </h3>
              <button className="icon-btn" onClick={() => setShowEditModal(false)}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleUpdateUser} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="eyebrow" style={{ fontSize: '10.5px' }}>Name</label>
                <input type="text" className="select-chip font-sans w-full"
                  style={{ padding: '8px', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)' }}
                  value={editUser.name} onChange={(e) => setEditUser({...editUser, name: e.target.value})} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="eyebrow" style={{ fontSize: '10.5px' }}>Email</label>
                <input type="email" className="select-chip font-sans w-full"
                  style={{ padding: '8px', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)' }}
                  value={editUser.email} onChange={(e) => setEditUser({...editUser, email: e.target.value})} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="eyebrow" style={{ fontSize: '10.5px' }}>Role</label>
                  <select className="select-chip w-full" style={{ padding: '8px', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)' }}
                    value={editUser.originalRole} onChange={(e) => setEditUser({...editUser, originalRole: e.target.value})}>
                    <option value="user">User</option>
                    <option value="doctor">Doctor / Clinician</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="eyebrow" style={{ fontSize: '10.5px' }}>Status</label>
                  <select className="select-chip w-full" style={{ padding: '8px', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)' }}
                    value={editUser.is_active ? 'true' : 'false'} onChange={(e) => setEditUser({...editUser, is_active: e.target.value === 'true'})}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="eyebrow" style={{ fontSize: '10.5px' }}>Age</label>
                  <input type="number" className="select-chip font-sans w-full"
                    style={{ padding: '8px', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)' }}
                    value={editUser.age || ''} onChange={(e) => setEditUser({...editUser, age: e.target.value})} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="eyebrow" style={{ fontSize: '10.5px' }}>Gender</label>
                  <select className="select-chip w-full" style={{ padding: '8px', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)' }}
                    value={editUser.gender || ''} onChange={(e) => setEditUser({...editUser, gender: e.target.value})}>
                    <option value="">Unknown</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="eyebrow" style={{ fontSize: '10.5px' }}>Weight (kg)</label>
                  <input type="number" className="select-chip font-sans w-full"
                    style={{ padding: '8px', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)' }}
                    value={editUser.weight || ''} onChange={(e) => setEditUser({...editUser, weight: e.target.value})} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="eyebrow" style={{ fontSize: '10.5px' }}>Height (cm)</label>
                  <input type="number" className="select-chip font-sans w-full"
                    style={{ padding: '8px', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)' }}
                    value={editUser.height || ''} onChange={(e) => setEditUser({...editUser, height: e.target.value})} />
                </div>
              </div>
              <button type="submit" className="btn btn-primary mt-3 flex items-center justify-center gap-1 w-full">
                <Check size={14} /> Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </section>
  );
};
