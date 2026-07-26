import React, { useState, useEffect } from 'react';

interface Participant {
  id: string;
  name: string;
  device: string;
}

export const DeviceSelector: React.FC<{
  selectedId: string;
  onChange: (id: string) => void;
}> = ({ selectedId, onChange }) => {
  const [list, setList] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  // Retrieve authenticated user info from session storage
  const storedUser = sessionStorage.getItem('htm_user');
  const authUser = storedUser ? JSON.parse(storedUser) : null;
  const isDoctor = authUser?.role === 'doctor';

  useEffect(() => {
    let isMounted = true;
    const fetchParticipants = async () => {
      try {
        const token = sessionStorage.getItem('htm_token');
        const res = await fetch('/api/patient/all', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const mapped = data.map((u: any) => ({
              id: u.guid || u._id || 'UNKNOWN',
              name: u.name || u.username || 'Patient',
              device: u.current_device || 'POLAR_SIM'
            }));
            if (isMounted) {
              setList(mapped);

              // Role check: If regular user, enforce viewing only their own data
              if (!isDoctor && authUser?.guid) {
                if (selectedId !== authUser.guid) {
                  onChange(authUser.guid);
                }
              } else {
                // If doctor and nothing selected or invalid selected ID, default to first patient
                if (!selectedId && mapped.length > 0) {
                  onChange(mapped[0].id);
                } else if (selectedId && !mapped.some(m => m.id === selectedId) && mapped.length > 0) {
                  onChange(mapped[0].id);
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch participants for selector:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchParticipants();
    return () => { isMounted = false; };
  }, [selectedId, onChange, isDoctor, authUser?.guid]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span className="eyebrow" style={{ color: 'var(--muted)' }}>Monitoring User:</span>
        <span className="select-chip font-mono" style={{ padding: '5px 12px', background: 'var(--surface)', color: 'var(--muted)' }}>Loading...</span>
      </div>
    );
  }

  // If regular user, render locked single user chip
  if (!isDoctor) {
    const selfName = authUser?.name || 'My Patient Account';
    const selfId = authUser?.guid || selectedId || 'dftgdrtger';
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span className="eyebrow" style={{ color: 'var(--muted)' }}>Your Data:</span>
        <span
          className="select-chip font-mono"
          style={{
            padding: '5px 14px',
            background: 'var(--surface)',
            color: 'var(--primary)',
            border: '1px solid var(--primary)',
            borderRadius: 'var(--r-md)',
            fontWeight: 600,
            fontSize: '12px',
          }}
        >
          🔒 {selfName} ({selfId})
        </span>
      </div>
    );
  }

  // Doctor view: Full patient selector dropdown
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span className="eyebrow" style={{ color: 'var(--muted)' }}>👨‍⚕️ Select Patient:</span>
      <select
        className="select-chip font-mono cursor-pointer"
        value={selectedId}
        onChange={(e) => onChange(e.target.value)}
        style={{
          outline: 'none',
          background: 'var(--surface)',
          color: 'var(--ink)',
          border: '1px solid var(--hairline)',
          fontWeight: 600,
          padding: '5px 12px',
        }}
      >
        {list.length === 0 ? (
          <option value={selectedId || ''}>{selectedId || 'No Patients'}</option>
        ) : (
          list.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} — [{p.id}] ({p.device})
            </option>
          ))
        )}
      </select>
    </div>
  );
};
