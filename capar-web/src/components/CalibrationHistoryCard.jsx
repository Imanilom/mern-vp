import React, { useEffect, useState } from "react";
import axios from "axios";
import Pagination from './Pagination';

export default function CalibrationHistoryCard({ participantId = "P00" }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    let isMounted = true;
    const fetchHistory = async () => {
      try {
        setLoading(true);
        let res = await axios.get(`/analysis/calibration-history/${participantId}`).catch(() => null);
        if (!res?.data?.success) {
          res = await axios.get(`/analysis/calibration-history/ALL`).catch(() => null);
        }
        if (res?.data?.success) {
          const json = res.data;
          if (isMounted && Array.isArray(json.data)) {
            let fetchedData = json.data;
            if (participantId && participantId !== "ALL" && participantId !== "undefined" && participantId !== "null") {
              fetchedData = fetchedData.filter(d => d.participantId === participantId || d.participant_id === participantId);
            }
            fetchedData.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
            setHistory(fetchedData);
          }
        }
      } catch (err) {
        console.error("[CalibrationHistoryCard] Fetch error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchHistory();
    return () => {
      isMounted = false;
    };
  }, [participantId]);

  return (
    <div className="card-panel" style={{ background: '#ffffff', borderRadius: 16, border: '1px solid var(--line)', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div className="mini-label" style={{ marginBottom: 4, letterSpacing: '0.05em' }}>
            PERSONAL BASELINE GOVERNANCE
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy)', margin: 0 }}>
            Riwayat Kalibrasi Baseline &amp; Personal Thresholds
          </h3>
        </div>
        <div style={{ background: 'var(--gray-soft)', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, color: 'var(--navy)' }}>
          {history.length} Versi Kalibrasi
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--gray)', fontSize: 12 }}>
          Memuat riwayat kalibrasi personal...
        </div>
      ) : (
        <div className="table-responsive">
          <table className="dtable w-100" style={{ fontSize: 11.5 }}>
            <thead>
              <tr>
                <th>Versi &amp; Waktu</th>
                <th>Konteks Aktivitas</th>
                <th>Liputan Data</th>
                <th>Threshold Terkalibrasi (τin / τout / τnorm)</th>
                <th>Fisiologis (HR / RMSSD)</th>
                <th>Status &amp; Mutu</th>
              </tr>
            </thead>
            <tbody>
              {history.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((item) => (
                <tr key={item.id}>
                  <td>
                    <div style={{ fontWeight: 800, color: 'var(--navy)' }}>{item.version}</div>
                    <div style={{ fontSize: 10, color: 'var(--teal)', fontWeight: 700 }}>{item.participantId || item.participant_id || participantId}</div>
                    <div style={{ fontSize: 9.5, color: 'var(--gray)' }}>
                      {new Date(item.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>

                  <td>
                    <span style={{ textTransform: 'capitalize', fontWeight: 700, color: 'var(--navy)' }}>{item.activity}</span>
                    <div style={{ fontSize: 10, color: 'var(--gray)' }}>{item.time_period}</div>
                  </td>

                  <td>
                    <b style={{ color: 'var(--navy)' }}>{item.distinct_days} Hari</b> clean data
                    <div style={{ fontSize: 10, color: 'var(--gray)' }}>{item.segment_count} windows</div>
                  </td>

                  <td>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span className="mono fw-bold text-danger" style={{ background: '#fef2f2', padding: '2px 6px', borderRadius: 4, fontSize: 10 }}>
                        τin: {item.learned_tau?.tau_in ?? '1.86'}
                      </span>
                      <span className="mono fw-bold text-amber" style={{ background: '#fffbeb', padding: '2px 6px', borderRadius: 4, fontSize: 10 }}>
                        τout: {item.learned_tau?.tau_out ?? '1.18'}
                      </span>
                      <span className="mono fw-bold text-green" style={{ background: '#f0fdf4', padding: '2px 6px', borderRadius: 4, fontSize: 10 }}>
                        τnorm: {item.learned_tau?.tau_normal ?? '0.75'}
                      </span>
                    </div>
                  </td>

                  <td>
                    <div className="mono" style={{ fontWeight: 700, color: 'var(--navy)' }}>
                      {item.hr_mean} BPM
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--gray)' }}>RMSSD: {item.rmssd_mean} ms</div>
                  </td>

                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className={`chip-${item.is_mature ? 'green' : 'amber'}`} style={{ fontSize: 9.5, padding: '2px 8px' }}>
                        {item.status || (item.is_mature ? 'Approved' : 'Provisional')}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--gray)', fontWeight: 600 }}>
                        {item.quality_score}% Mutu
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && history.length > 0 && (
        <Pagination 
          currentPage={currentPage}
          totalPages={Math.ceil(history.length / itemsPerPage)}
          onPageChange={setCurrentPage}
          totalItems={history.length}
          pageSize={itemsPerPage}
        />
      )}
    </div>
  );
}
