import React, { useState, useEffect } from 'react';
import { FaSync, FaDownload, FaFilePdf, FaFileCsv, FaFileCode, FaFilter, FaFileImage } from 'react-icons/fa';
import { Skeleton, Badge, fmtDate, fmtTime } from './DashboardShared';
import { analysisApi } from '../../utls/api';

export default function Reports({ sessionUser }) {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Filters
  const [type, setType] = useState('daily');
  const [userId, setUserId] = useState(sessionUser?._id || '');
  const [activity, setActivity] = useState('All');
  const [status, setStatus] = useState('All');
  
  // Quick date presets
  const today = new Date();
  today.setHours(0,0,0,0);
  const [startDate, setStartDate] = useState(today.getTime());
  const [endDate, setEndDate] = useState(Date.now());

  const generateReport = async () => {
    setLoading(true);
    try {
      const res = await analysisApi.generateReport({
        type, userId, activity, status, startDate, endDate
      });
      if (res.success) {
        setReportData(res);
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionUser && !reportData) {
      generateReport();
    }
    // eslint-disable-next-line
  }, [sessionUser]);

  // Export functions
  const exportJSON = () => {
    if(!reportData) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(reportData, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `vidyamedic_report_${type}_${Date.now()}.json`);
    dlAnchorElem.click();
  };

  const exportCSV = (isExcel = false) => {
    if(!reportData || !reportData.data || reportData.data.length === 0) return alert('No data to export');
    const items = reportData.data;
    const replacer = (key, value) => value === null ? '' : value;
    const header = Object.keys(items[0]);
    const csv = [
      header.join(','),
      ...items.map(row => header.map(fieldName => JSON.stringify(row[fieldName], replacer)).join(','))
    ].join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `vidyamedic_report_${type}_${Date.now()}.${isExcel ? 'csv' : 'csv'}`);
    a.click();
  };

  const exportPDF = () => {
    window.print();
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[75vh] animate-htm-page-in print:block print:w-full print:h-auto print:m-0 print:p-0">
      
      {/* Sidebar: Report Builder (Hidden on print) */}
      <div className="w-full md:w-80 shrink-0 space-y-4 print:hidden h-full flex flex-col">
        <div className="htm-card flex-1 flex flex-col p-6 overflow-y-auto scrollbar-hide">
          <h4 className="htm-title mb-6 flex items-center gap-2">
            <FaFilter style={{ color: 'var(--htm-info)' }} /> Report Builder
          </h4>
          
          <div className="space-y-5 flex-1">
            <div>
              <label className="htm-eyebrow block mb-2">Report Type</label>
              <div className="htm-input-wrap">
                <select value={type} onChange={e => setType(e.target.value)} className="htm-input">
                  <option value="daily">Individual Daily Report</option>
                  <option value="trajectory">Weekly Trajectory Report</option>
                  <option value="anomaly">Anomaly Report</option>
                  <option value="activity">Activity-based Report</option>
                  <option value="quality">Data Quality Report</option>
                  <option value="population">Population Report</option>
                  <option value="adherence">Device Adherence Report</option>
                  <option value="performance">System Performance Report</option>
                </select>
              </div>
            </div>

            <div>
              <label className="htm-eyebrow block mb-2">Participant / Group</label>
              <div className="htm-input-wrap">
                <select value={userId} onChange={e => setUserId(e.target.value)} className="htm-input">
                  <option value="All">All Participants</option>
                  <option value={sessionUser?._id}>Myself ({sessionUser?.email})</option>
                </select>
              </div>
            </div>

            <div>
              <label className="htm-eyebrow block mb-2">Activity Context</label>
              <div className="htm-input-wrap">
                <select value={activity} onChange={e => setActivity(e.target.value)} className="htm-input">
                  <option value="All">All Activities</option>
                  <option value="Rest">Rest</option>
                  <option value="Walking">Walking</option>
                  <option value="Intense">Intense</option>
                </select>
              </div>
            </div>

            <div>
              <label className="htm-eyebrow block mb-2">Time Range</label>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" className="htm-input text-[11px]" />
                <input type="date" className="htm-input text-[11px]" />
              </div>
            </div>
            
            <div className="pt-4 mt-auto">
              <button onClick={generateReport} className="htm-btn htm-btn-primary w-full">
                <FaSync className={loading ? 'animate-spin' : ''} style={{ marginRight: 6 }} /> Generate Report
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Area: Report Preview & Export */}
      <div className="flex-1 flex flex-col min-h-0 htm-card p-0 overflow-hidden print:border-none print:shadow-none print:bg-white print:text-black">
        
        {/* Header Actions (Hidden on print) */}
        <div className="p-6 border-b border-htm-hairline bg-htm-surface flex justify-between items-center shrink-0 print:hidden">
          <div>
            <h3 className="htm-title">Report Preview</h3>
            <p className="htm-body-sm text-htm-muted mt-1">Review data before exporting.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={exportPDF} className="htm-btn htm-btn-outline htm-btn-sm" style={{ color: 'var(--htm-alert)', borderColor: 'rgba(185,28,28,0.3)', background: 'var(--htm-alert-bg)' }}>
              <FaFilePdf /> PDF
            </button>
            <button onClick={() => exportCSV(true)} className="htm-btn htm-btn-outline htm-btn-sm" style={{ color: 'var(--htm-stable)', borderColor: 'rgba(46,107,74,0.3)', background: 'var(--htm-stable-bg)' }}>
              <FaFileCsv /> Excel / CSV
            </button>
            <button onClick={exportJSON} className="htm-btn htm-btn-outline htm-btn-sm">
              <FaFileCode /> JSON
            </button>
          </div>
        </div>

        {/* Report Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-htm-canvas print:p-0 print:overflow-visible">
          {loading ? (
            <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : !reportData ? (
            <div className="text-center p-12 htm-body-sm text-htm-muted">Run a query to generate report data.</div>
          ) : (
            <div className="space-y-10 report-document">
              
              {/* Document Header */}
              <div className="border-b-2 border-htm-ink pb-6 print:border-black">
                <div className="flex justify-between items-end">
                  <div>
                    <h1 className="text-3xl font-serif text-htm-ink print:text-black tracking-tight" style={{ fontFamily: 'Fraunces' }}>VidyaMedic Analytical Report</h1>
                    <h2 className="htm-eyebrow mt-3" style={{ color: 'var(--htm-info)', fontSize: 13 }}>{type} REPORT</h2>
                  </div>
                  <div className="text-right htm-mono-sm text-htm-muted print:text-gray-600">
                    <p>Generated: {fmtDate(reportData.generated_at)} {fmtTime(reportData.generated_at)}</p>
                    <p className="mt-1">Parameters: User={userId==='All'?'ALL':userId.slice(-4)}, Activity={activity}</p>
                  </div>
                </div>
              </div>

              {/* Summary Widgets */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 print:grid-cols-4 print:gap-4">
                {Object.entries(reportData.summary || {}).map(([key, val]) => (
                  <div key={key} className="p-5 border border-htm-hairline print:border-gray-300 print:bg-transparent" style={{ background: 'var(--htm-raised)', borderRadius: 'var(--htm-r-md)' }}>
                    <span className="htm-eyebrow block mb-2 print:text-gray-600">{key.replace(/_/g, ' ')}</span>
                    <span className="htm-display text-2xl print:text-black">{typeof val === 'number' && val % 1 !== 0 ? val.toFixed(2) : val}</span>
                  </div>
                ))}
              </div>

              {/* Data Table */}
              <div>
                <h3 className="htm-eyebrow mb-4 border-b border-htm-hairline print:border-gray-400 pb-3 print:text-black">
                  Detailed Records ({reportData.data?.length || 0})
                </h3>
                
                {reportData.data?.length === 0 ? (
                  <div className="htm-body-sm text-htm-muted italic py-6">No records found for the given criteria.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="htm-table" style={{ width: '100%', fontSize: '0.75rem' }}>
                      <thead className="bg-htm-surface print:bg-gray-100">
                        <tr>
                          {Object.keys(reportData.data[0]).slice(0, 7).map(k => (
                            <th key={k} className="p-3 whitespace-nowrap">{k.replace(/_/g, ' ')}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.data.slice(0, 50).map((row, i) => (
                          <tr key={i} className="print:hover:bg-transparent hover:bg-htm-surface transition-colors">
                            {Object.keys(row).slice(0, 7).map(k => (
                              <td key={k} className="p-3">
                                {typeof row[k] === 'object' ? JSON.stringify(row[k]) : 
                                 typeof row[k] === 'number' && row[k] > 1000000000000 ? <span className="htm-mono">{fmtDate(row[k])} {fmtTime(row[k])}</span> : 
                                 typeof row[k] === 'number' ? <span className="htm-mono">{row[k].toFixed(2)}</span> : row[k]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {reportData.data.length > 50 && (
                      <div className="text-center p-4 htm-body-sm text-htm-muted italic print:text-gray-500">
                        Showing first 50 rows. Export to CSV/JSON to view all {reportData.data.length} records.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="pt-12 border-t border-htm-hairline print:border-gray-300 text-center">
                <p className="htm-eyebrow tracking-widest print:text-gray-500">VidyaMedic Expert System • End of Report</p>
              </div>

            </div>
          )}
        </div>
      </div>

    </div>
  );
}
