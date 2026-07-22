import React, { useEffect } from 'react';
import { FaSync } from 'react-icons/fa';
import { Skeleton, Badge, SectionHeader } from './DashboardShared';
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
    <div className="space-y-6 animate-htm-page-in">
      <SectionHeader 
        title="Activity Context" 
        subtitle="Membentuk baseline berdasarkan aktivitas pengguna."
        action={
          <button 
            onClick={() => fetchFor('context', () => analysisApi.getBaselines(sessionUser._id))} 
            className="htm-btn htm-btn-outline htm-btn-sm" 
            style={{ padding: '0 12px' }}
          >
            <FaSync className={loading.context ? 'animate-spin' : ''} style={{ marginRight: 6 }} /> Refresh
          </button>
        }
      />

      <div className="htm-card p-0 overflow-hidden">
        {loading.context && baselines.length === 0 ? (
          <div className="p-6 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : (
          <table className="htm-table">
            <thead>
              <tr>
                <th>Activity & Time</th>
                <th>Windows</th>
                <th>Duration</th>
                <th>HR Mean</th>
                <th>HR SD</th>
                <th>Confidence</th>
                <th>Readiness</th>
              </tr>
            </thead>
            <tbody>
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
                    <tr key={b._id}>
                      <td>
                        <span style={{ fontWeight: 500, display: 'block' }}>{b.activity}</span>
                        <span className="htm-mono-sm muted">{b.time_period}</span>
                      </td>
                      <td className="mono">{b.segment_count}</td>
                      <td className="mono muted">{durationStr}</td>
                      <td className="mono" style={{ fontWeight: 500 }}>{hrMean.toFixed(1)}</td>
                      <td className="mono muted">{hrStd.toFixed(1)}</td>
                      <td>
                        <span className="mono" style={{
                          fontWeight: 500,
                          color: conf >= 80 ? 'var(--htm-stable)' : conf >= 50 ? 'var(--htm-caution)' : 'var(--htm-alert)'
                        }}>
                          {conf}%
                        </span>
                      </td>
                      <td>
                        <Badge 
                          label={b.is_mature ? 'Ready' : 'Learning'} 
                          color={b.is_mature ? 'stable' : 'caution'} 
                        />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="p-6 text-center htm-eyebrow">
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
