import React, { useState } from 'react';
import {
  CloudArrowUp, DownloadSimple, Eye, ArrowClockwise, Sliders, Pause, X, Receipt,
  Columns, FileText, Trash, FloppyDisk, UserPlus, Check, Lightning
} from '@phosphor-icons/react';

export interface AnalyticsProps {
  selectedParticipantId: string;
  onParticipantChange: (id: string) => void;
}



export const Toast: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => {
  React.useEffect(() => {
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

  React.useEffect(() => {
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
            
            // Map known roles to colors based on design language
            if (role.toLowerCase() === 'admin' || role.toLowerCase() === 'administrator') {
              role = 'Administrator';
              badgeClass = 'badge-model';
            } else if (role.toLowerCase() === 'researcher' || role.toLowerCase() === 'analyst') {
              badgeClass = 'badge-monitoring';
            } else if (role.toLowerCase() === 'clinician') {
              badgeClass = 'badge-caution';
            } else if (role.toLowerCase() === 'patient' || role.toLowerCase() === 'participant') {
              role = 'Participant';
            }

            return {
              email: p.email || `${p.device_id || 'user'}@htm.com`,
              name: p.name || p.device_id || 'Unknown',
              role: role,
              badgeClass: badgeClass,
              status: p.status || 'Active',
              lastLogin: p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : '—'
            };
          });

          // Set real users from db
          setUsersList(mapped);
        }
      } catch (err) {
        console.error('Failed to fetch users:', err);
      } finally {
        setLoading(false);
      }
    };
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
        const data = await res.json();

        let badgeClass = 'badge-inactive';
        if (role === 'Administrator') badgeClass = 'badge-model';
        else if (role === 'Researcher' || role === 'Analyst') badgeClass = 'badge-monitoring';
        else if (role === 'Clinician') badgeClass = 'badge-caution';

        setUsersList(prev => [
          ...prev,
          { email, name, role, badgeClass, status: 'Active', lastLogin: 'Just registered' }
        ]);

        setToast(`User "${name}" has been registered successfully.`);
        setName('');
        setEmail('');
        setShowAddForm(false);
      } else {
        const errorData = await res.json();
        setToast(`Error: ${errorData.message}`);
      }
    } catch (err) {
      setToast('Network error during registration.');
    }
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
              <th className="pr-lg text-right">Last login</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-lg text-muted">Loading users...</td></tr>
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
                  <span className="badge badge-stable">
                    <span className="badge-dot"></span>{u.status}
                  </span>
                </td>
                <td className="mono pr-lg text-right">{u.lastLogin}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </section>
  );
};
