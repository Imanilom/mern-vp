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
    // We use window.print() for PDF generation as it's highly optimized and requires no heavy server libraries.
    // CSS media queries (@media print) will format the page.
    window.print();
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 h-full print:block print:w-full print:m-0 print:p-0">
      
      {/* Sidebar: Report Builder (Hidden on print) */}
      <div className="w-full md:w-72 shrink-0 space-y-4 print:hidden">
        <div className="bg-brand-card border border-brand-border rounded-2xl p-5 shadow-lg">
          <h4 className="font-bold text-sm mb-4 flex items-center gap-2 text-brand-text">
            <FaFilter className="text-sys-blue" /> Report Builder
          </h4>
          
          <div className="space-y-4">
            <div>
              <label className="block text-[9px] uppercase font-bold text-brand-muted mb-1">Report Type</label>
              <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-brand-dark border border-brand-border rounded-xl px-3 py-2 text-xs text-brand-text outline-none focus:border-sys-blue">
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

            <div>
              <label className="block text-[9px] uppercase font-bold text-brand-muted mb-1">Participant / Group</label>
              <select value={userId} onChange={e => setUserId(e.target.value)} className="w-full bg-brand-dark border border-brand-border rounded-xl px-3 py-2 text-xs text-brand-text outline-none focus:border-sys-blue">
                <option value="All">All Participants</option>
                <option value={sessionUser?._id}>Myself ({sessionUser?.email})</option>
                {/* Normally we'd load all users here if admin */}
              </select>
            </div>

            <div>
              <label className="block text-[9px] uppercase font-bold text-brand-muted mb-1">Activity Context</label>
              <select value={activity} onChange={e => setActivity(e.target.value)} className="w-full bg-brand-dark border border-brand-border rounded-xl px-3 py-2 text-xs text-brand-text outline-none focus:border-sys-blue">
                <option value="All">All Activities</option>
                <option value="Rest">Rest</option>
                <option value="Walking">Walking</option>
                <option value="Intense">Intense</option>
              </select>
            </div>

            <div>
              <label className="block text-[9px] uppercase font-bold text-brand-muted mb-1">Time Range</label>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" className="bg-brand-dark border border-brand-border rounded-xl px-2 py-1.5 text-[10px] text-brand-text" />
                <input type="date" className="bg-brand-dark border border-brand-border rounded-xl px-2 py-1.5 text-[10px] text-brand-text" />
              </div>
            </div>

            <button onClick={generateReport} className="w-full mt-4 bg-sys-blue text-white font-bold text-xs py-2.5 rounded-xl hover:bg-sys-blue/80 transition-colors flex items-center justify-center gap-2">
              <FaSync className={loading ? 'animate-spin' : ''} /> Generate Report
            </button>
          </div>
        </div>
      </div>

      {/* Main Area: Report Preview & Export */}
      <div className="flex-1 flex flex-col min-h-0 bg-brand-card border border-brand-border rounded-2xl shadow-lg overflow-hidden print:border-none print:shadow-none print:bg-white print:text-black">
        
        {/* Header Actions (Hidden on print) */}
        <div className="p-4 border-b border-brand-border bg-brand-cardLight flex justify-between items-center shrink-0 print:hidden">
          <div>
            <h3 className="font-bold text-sm">Report Preview</h3>
            <p className="text-[10px] text-brand-muted">Review data before exporting.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportPDF} className="px-3 py-1.5 bg-sys-red/10 text-sys-red border border-sys-red/20 rounded-lg text-[10px] font-bold flex items-center gap-1.5 hover:bg-sys-red hover:text-white transition-colors">
              <FaFilePdf /> PDF
            </button>
            <button onClick={() => exportCSV(true)} className="px-3 py-1.5 bg-sys-green/10 text-sys-green border border-sys-green/20 rounded-lg text-[10px] font-bold flex items-center gap-1.5 hover:bg-sys-green hover:text-white transition-colors">
              <FaFileCsv /> Excel / CSV
            </button>
            <button onClick={exportJSON} className="px-3 py-1.5 bg-brand-border text-brand-text border border-brand-border rounded-lg text-[10px] font-bold flex items-center gap-1.5 hover:bg-brand-muted transition-colors">
              <FaFileCode /> JSON
            </button>
          </div>
        </div>

        {/* Report Content */}
        <div className="flex-1 overflow-y-auto p-8 print:p-0 print:overflow-visible">
          {loading ? (
            <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : !reportData ? (
            <div className="text-center p-10 text-brand-muted text-xs">Run a query to generate report data.</div>
          ) : (
            <div className="space-y-8 report-document">
              
              {/* Document Header */}
              <div className="border-b-2 border-brand-border print:border-gray-800 pb-6 mb-6">
                <div className="flex justify-between items-end">
                  <div>
                    <h1 className="text-2xl font-black text-brand-text print:text-black uppercase tracking-tight">VidyaMedic Analytical Report</h1>
                    <h2 className="text-sm font-bold text-sys-blue print:text-gray-600 mt-1 uppercase">{type} REPORT</h2>
                  </div>
                  <div className="text-right text-[10px] text-brand-muted print:text-gray-500 font-mono">
                    <p>Generated: {fmtDate(reportData.generated_at)} {fmtTime(reportData.generated_at)}</p>
                    <p>Parameters: User={userId==='All'?'ALL':userId.slice(-4)}, Activity={activity}</p>
                  </div>
                </div>
              </div>

              {/* Summary Widgets */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4 print:gap-4">
                {Object.entries(reportData.summary || {}).map(([key, val]) => (
                  <div key={key} className="bg-brand-cardLight border border-brand-border p-4 rounded-xl print:border-gray-300 print:bg-transparent">
                    <span className="block text-[9px] uppercase font-bold text-brand-muted print:text-gray-500 mb-1">{key.replace(/_/g, ' ')}</span>
                    <span className="text-lg font-black text-brand-text print:text-black">{typeof val === 'number' && val % 1 !== 0 ? val.toFixed(2) : val}</span>
                  </div>
                ))}
              </div>

              {/* Data Table */}
              <div>
                <h3 className="font-bold text-xs uppercase tracking-wide text-brand-muted print:text-gray-800 mb-3 border-b border-brand-border print:border-gray-400 pb-2">Detailed Records ({reportData.data?.length || 0})</h3>
                
                {reportData.data?.length === 0 ? (
                  <div className="text-[10px] text-brand-muted italic py-4">No records found for the given criteria.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[10px] print:text-[8px]">
                      <thead className="bg-brand-cardLight print:bg-gray-100 border-b border-brand-border print:border-gray-400 font-bold uppercase text-brand-muted print:text-gray-700">
                        <tr>
                          {Object.keys(reportData.data[0]).slice(0, 7).map(k => (
                            <th key={k} className="p-2 whitespace-nowrap">{k.replace(/_/g, ' ')}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-border print:divide-gray-200 text-brand-text print:text-black">
                        {reportData.data.slice(0, 50).map((row, i) => (
                          <tr key={i} className="hover:bg-brand-cardLight print:hover:bg-transparent">
                            {Object.keys(row).slice(0, 7).map(k => (
                              <td key={k} className="p-2">
                                {typeof row[k] === 'object' ? JSON.stringify(row[k]) : 
                                 typeof row[k] === 'number' && row[k] > 1000000000000 ? fmtDate(row[k]) + ' ' + fmtTime(row[k]) : 
                                 typeof row[k] === 'number' ? row[k].toFixed(2) : row[k]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {reportData.data.length > 50 && (
                      <div className="text-center p-3 text-[9px] text-brand-muted italic print:text-gray-500">
                        Showing first 50 rows. Export to CSV/JSON to view all {reportData.data.length} records.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="pt-10 border-t border-brand-border print:border-gray-300 text-center">
                <p className="text-[9px] text-brand-muted print:text-gray-500 font-bold uppercase tracking-widest">VidyaMedic Expert System • End of Report</p>
              </div>

            </div>
          )}
        </div>
      </div>

    </div>
  );
}
