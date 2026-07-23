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
              id: u.guid || u.email?.split('@')[0].toUpperCase() || 'UNKNOWN',
              name: u.name || 'Unknown',
              device: u.current_device || 'Polar H10'
            }));
            if (isMounted) {
              setList(mapped);
              if (!selectedId && mapped.length > 0) {
                onChange(mapped[0].id);
              } else if (selectedId && !mapped.some(m => m.id === selectedId) && mapped.length > 0) {
                if (selectedId === 'P012') {
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
  }, [selectedId, onChange]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span className="eyebrow" style={{ color: 'var(--muted)' }}>Select Device:</span>
        <span className="select-chip font-mono" style={{ padding: '5px 12px', background: 'var(--surface)', color: 'var(--muted)' }}>Loading...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span className="eyebrow" style={{ color: 'var(--muted)' }}>Select Device:</span>
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
          <option value={selectedId || ''}>{selectedId || 'No Devices'}</option>
        ) : (
          list.map(p => (
            <option key={p.id} value={p.id}>
              {p.id} ({p.device})
            </option>
          ))
        )}
      </select>
    </div>
  );
};
