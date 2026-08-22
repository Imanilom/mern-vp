import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Edit2, Trash2, Plus, X } from 'lucide-react';

const UserManagementView = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'user',
    docter: '',
    current_device: '',
  });

  const doctors = users.filter(u => u.role === 'doctor');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get('/user/all');
      setUsers(data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name || '',
        email: user.email || '',
        role: user.role || 'user',
        docter: user.docter?._id || user.docter || '',
        current_device: user.current_device || '',
      });
    } else {
      setEditingUser(null);
      setFormData({
        name: '',
        email: '',
        role: 'user',
        docter: '',
        current_device: '',
      });
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingUser(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        // Update user
        await axios.post(`/user/update/${editingUser._id}`, formData);
      } else {
        // Create user
        await axios.post('/auth/backoffice-register', formData);
      }
      closeModal();
      fetchUsers();
    } catch (err) {
      console.error('Failed to save user:', err);
      alert(err.response?.data?.message || 'Error saving user');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await axios.delete(`/user/delete/${id}`);
      fetchUsers();
    } catch (err) {
      console.error('Failed to delete user:', err);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-sub">
            Kelola data pasien, perangkat, dan penugasan dokter
          </p>
        </div>
        <button className="btn-teal" onClick={() => openModal()}>
          <Plus size={14} style={{ marginRight: 6 }} /> Tambah User
        </button>
      </div>

      <div className="card-panel" style={{ padding: 0 }}>
        <div className="table-responsive">
          <table className="dtable">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Email</th>
                <th>Role</th>
                <th>Device ID</th>
                <th>Dokter (Assigned)</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: 'var(--gray)' }}>Memuat data...</td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: 'var(--gray)' }}>Belum ada data user.</td>
              </tr>
            ) : (
              users.map(user => (
                <tr key={user._id}>
                  <td style={{ fontWeight: 600, color: 'var(--navy)' }}>{user.name}</td>
                  <td style={{ color: 'var(--gray)', fontSize: 11.5 }}>{user.email}</td>
                  <td>
                    <span className={`badge-soft ${user.role === 'doctor' ? 'chip-blue' : user.role === 'admin' ? 'chip-purple' : 'chip-green'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--gray)' }}>{user.current_device || '-'}</td>
                  <td>
                    {user.docter ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: 'var(--cat2)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
                          Dr
                        </div>
                        <span style={{ fontSize: '14px' }}>{user.docter.name}</span>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--gray)', fontSize: '13px' }}>-</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button onClick={() => openModal(user)} style={{ background: 'none', border: 'none', color: 'var(--teal)', cursor: 'pointer', padding: 4 }}>
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDelete(user._id)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: 4 }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {modalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 35, 55, 0.5)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div className="card-panel" style={{ width: '100%', maxWidth: '500px', padding: '24px', animation: 'fadeIn 0.2s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--navy)' }}>{editingUser ? 'Edit User' : 'Tambah User Baru'}</h2>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', color: 'var(--gray)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--gray)' }}>Nama Lengkap</label>
                <input 
                  type="text" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  required 
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--gray)' }}>Email</label>
                <input 
                  type="email" 
                  value={formData.email} 
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  required 
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}
                />
              </div>

              <div className="grid-2col" style={{ gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--gray)' }}>Role</label>
                  <select 
                    value={formData.role} 
                    onChange={e => setFormData({...formData, role: e.target.value})}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}
                  >
                    <option value="user">User (Pasien)</option>
                    <option value="doctor">Doctor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--gray)' }}>Device ID</label>
                  <input 
                    type="text" 
                    value={formData.current_device} 
                    onChange={e => setFormData({...formData, current_device: e.target.value})}
                    placeholder="Opsional"
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              {formData.role !== 'doctor' && formData.role !== 'admin' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--gray)' }}>Assign ke Dokter</label>
                  <select 
                    value={formData.docter} 
                    onChange={e => setFormData({...formData, docter: e.target.value})}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}
                  >
                    <option value="">Tidak ada dokter</option>
                    {doctors.map(doc => (
                      <option key={doc._id} value={doc._id}>{doc.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button type="button" onClick={closeModal} className="btn-outline-navy" style={{ flex: 1 }}>
                  Batal
                </button>
                <button type="submit" className="btn-teal" style={{ flex: 1 }}>
                  {editingUser ? 'Simpan Perubahan' : 'Buat User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementView;
