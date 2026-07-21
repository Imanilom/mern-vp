import React from 'react';
import { FaSync } from 'react-icons/fa';
import { Skeleton, Badge } from './DashboardShared';
import { usersApi } from '../../utls/api';

export default function UserManagement({ data, loading, fetchFor }) {
  return (
    <div className="space-y-6">
      <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden shadow-lg">
        <div className="p-5 border-b border-brand-border flex justify-between items-center">
          <h4 className="font-bold text-sm">System Users & Roles</h4>
          <button onClick={() => fetchFor('patients')} className="text-sys-blue text-xs flex items-center gap-1">
            <FaSync className={loading.patients ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
        {loading.patients ? (
          <div className="p-6 space-y-3">{[1,2,3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : (
          <table className="w-full text-xs text-left">
            <thead className="bg-brand-cardLight border-b border-brand-border text-brand-muted text-[9px] uppercase font-bold">
              <tr>
                <th className="p-4">Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Role</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border text-brand-muted">
              {(data.patients || []).map((p, i) => (
                <tr key={i} className="hover:bg-brand-cardLight">
                  <td className="p-4 font-bold text-brand-text">{p.name}</td>
                  <td className="p-4">{p.email}</td>
                  <td className="p-4"><Badge label={p.role} color={p.role === 'Doctor' ? 'purple' : 'blue'} /></td>
                  <td className="p-4"><Badge label={p.is_active ? 'Active' : 'Inactive'} color={p.is_active ? 'green' : 'gray'} /></td>
                </tr>
              ))}
              {!(data.patients?.length) && (
                <tr><td colSpan="4" className="p-6 text-center text-brand-muted">No users found.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
