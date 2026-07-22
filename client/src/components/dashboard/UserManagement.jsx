import React from 'react';
import { FaSync } from 'react-icons/fa';
import { Skeleton, Badge } from './DashboardShared';
import { usersApi } from '../../utls/api';

export default function UserManagement({ data, loading, fetchFor }) {
  return (
    <div className="space-y-6 animate-htm-page-in">
      <div className="htm-card p-0 overflow-hidden">
        <div className="p-6 border-b border-htm-hairline flex justify-between items-center bg-htm-surface">
          <h4 className="htm-title">System Users & Roles</h4>
          <button onClick={() => fetchFor('patients')} className="htm-btn htm-btn-ghost htm-btn-sm" style={{ color: 'var(--htm-sub)' }}>
            <FaSync className={loading.patients ? 'animate-spin' : ''} style={{ marginRight: 6 }} /> Refresh
          </button>
        </div>
        {loading.patients ? (
          <div className="p-8 space-y-4">{[1,2,3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : (
          <table className="htm-table" style={{ width: '100%' }}>
            <thead className="bg-htm-surface">
              <tr>
                <th className="p-4">Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Role</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data.patients || []).map((p, i) => (
                <tr key={i} className="hover:bg-htm-surface transition-colors">
                  <td className="p-4 font-medium" style={{ color: 'var(--htm-ink)' }}>{p.name}</td>
                  <td className="p-4 htm-mono-sm text-htm-muted">{p.email}</td>
                  <td className="p-4"><Badge label={p.role} color={p.role === 'Doctor' ? 'info' : 'neutral'} /></td>
                  <td className="p-4"><Badge label={p.is_active ? 'Active' : 'Inactive'} color={p.is_active ? 'stable' : 'neutral'} /></td>
                </tr>
              ))}
              {!(data.patients?.length) && (
                <tr><td colSpan="4" className="p-8 text-center htm-body-sm text-htm-muted">No users found.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
