import React, { useEffect } from 'react';
import { FaSync } from 'react-icons/fa';
import { Skeleton, Badge } from './DashboardShared';
import { analysisApi } from '../../utls/api';

export default function ActivityContext({ data, loading, fetchFor, sessionUser }) {
  const baselines = data.context?.data || [];

  // Automatically fetch on mount if empty
  useEffect(() => {
    if (!data.context && !loading.context && sessionUser) {
      fetchFor('context', () => analysisApi.getBaselines(sessionUser._id));
    }
  }, [data.context, loading.context, sessionUser, fetchFor]);

  // Confidence heuristic
  const getConfidence = (count) => Math.min(100, Math.round((count / 20) * 100));

  return (
    <div className="space-y-6">
      <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden shadow-lg">
        <div className="p-5 border-b border-brand-border flex justify-between items-center">
          <div>
            <h4 className="font-bold text-sm">Activity Context Baseline</h4>
            <p className="text-[10px] text-brand-muted mt-1">Membentuk baseline berdasarkan aktivitas pengguna.</p>
          </div>
          <button onClick={() => fetchFor('context', () => analysisApi.getBaselines(sessionUser._id))} className="text-sys-blue text-xs flex items-center gap-1">
            <FaSync className={loading.context ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
        
        {loading.context && baselines.length === 0 ? (
          <div className="p-6 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : (
          <table className="w-full text-xs text-left">
            <thead className="bg-brand-cardLight border-b border-brand-border text-brand-muted text-[9px] uppercase font-bold">
              <tr>
                <th className="p-4">Activity & Time</th>
                <th className="p-4">Windows</th>
                <th className="p-4">Duration</th>
                <th className="p-4">HR Mean</th>
                <th className="p-4">HR SD</th>
                <th className="p-4">Confidence</th>
                <th className="p-4">Readiness</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border text-brand-muted">
              {baselines.length > 0 ? (
                baselines.map(b => {
                  const hrMean = b.stats?.mean_hr?.mean || 0;
                  const hrStd = b.stats?.std_hr?.mean || 0;
                  const conf = getConfidence(b.segment_count);
                  const durationMins = b.segment_count * 3; // each window is 3 mins
                  const durationStr = durationMins >= 60 
                    ? `${(durationMins/60).toFixed(1)} hrs`
                    : `${durationMins} mins`;

                  return (
                    <tr key={b._id} className="hover:bg-brand-cardLight transition-colors">
                      <td className="p-4">
                        <span className="font-bold text-brand-text block">{b.activity}</span>
                        <span className="text-[10px] text-brand-muted">{b.time_period}</span>
                      </td>
                      <td className="p-4">{b.segment_count}</td>
                      <td className="p-4">{durationStr}</td>
                      <td className="p-4 font-bold text-brand-text">{hrMean.toFixed(1)}</td>
                      <td className="p-4">{hrStd.toFixed(1)}</td>
                      <td className="p-4">
                        <span className={`font-bold ${conf >= 80 ? 'text-sys-green' : conf >= 50 ? 'text-sys-orange' : 'text-sys-red'}`}>{conf}%</span>
                      </td>
                      <td className="p-4">
                        <Badge 
                          label={b.is_mature ? 'Ready' : 'Learning'} 
                          color={b.is_mature ? 'green' : 'orange'} 
                        />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="p-6 text-center text-brand-muted">
                    No contextual baseline data found. Wait for the analysis pipeline to process new data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
