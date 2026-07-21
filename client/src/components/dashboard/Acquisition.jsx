import React from 'react';
import { FaUpload, FaSpinner } from 'react-icons/fa';
import { Badge, SmoothLineChart } from './DashboardShared';

export default function Acquisition({ mqRate, w1State, w2State, uploadFile, setUploadFile, uploadResult, uploading, uploadError, handleUpload }) {
  return (
    <div className="space-y-6">
      {/* Pipeline Visual */}
      <div className="bg-brand-card border border-brand-border p-6 rounded-2xl overflow-x-auto shadow-lg">
        <h4 className="font-bold text-sm mb-6">Data Acquisition Pipeline</h4>
        <div className="min-w-[800px] flex items-center justify-between px-4 py-4">
          {[
            { label: 'Flutter App', sub: 'BLE \u2192 CSV \u2192 API', col: 'border-sys-green text-sys-green' },
            { label: 'RabbitMQ', sub: `${mqRate} msg/s`, col: 'border-sys-blue text-sys-blue' },
            { label: 'DB Raw', sub: 'POST /api/log/logs', col: 'border-sys-purple text-sys-purple' },
            { label: 'Layer 2 Cron', sub: 'IQR + Segments (3min)', col: 'border-sys-purple text-sys-purple' },
            { label: 'Layer 3 Cron', sub: 'Z-score + Events (5min)', col: 'border-sys-yellow text-sys-yellow' },
            { label: 'Backend API', sub: '/api/analysis/*', col: 'border-sys-green text-sys-green' },
          ].map((node, i, arr) => (
            <React.Fragment key={i}>
              <div className={`border-2 rounded-2xl p-3 w-36 text-center bg-brand-cardLight ${node.col} shrink-0`}>
                <span className="text-[9px] font-black uppercase tracking-wider block">{node.label}</span>
                <span className="text-[8px] text-brand-muted block mt-1">{node.sub}</span>
              </div>
              {i < arr.length - 1 && (
                <div className="flex-1 h-0.5 bg-brand-border mx-1 relative overflow-hidden">
                  <div className="absolute inset-0 bg-sys-blue animate-pulse" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* CSV Upload */}
        <div className="bg-brand-card border border-brand-border p-6 rounded-2xl shadow-lg space-y-4">
          <h4 className="font-bold text-sm">Upload Raw CSV</h4>
          <p className="text-[10px] text-brand-muted">Simulate data ingestion bypassing RabbitMQ (POST /api/log/logs)</p>
          <div className="border-2 border-dashed border-brand-border rounded-2xl p-6 text-center hover:bg-brand-cardLight transition-colors">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setUploadFile(e.target.files[0])}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center">
              <FaUpload className="text-2xl text-brand-muted mb-2" />
              <span className="text-xs font-bold text-brand-text">{uploadFile ? uploadFile.name : 'Choose CSV File'}</span>
              <span className="text-[9px] text-brand-muted mt-1">or drag and drop</span>
            </label>
          </div>
          <button
            onClick={handleUpload}
            disabled={!uploadFile || uploading}
            className="w-full py-2.5 bg-sys-blue hover:bg-sys-blue/80 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
          >
            {uploading ? <FaSpinner className="animate-spin" /> : 'Upload Data'}
          </button>
          
          {uploadError && <div className="text-xs text-sys-red bg-sys-red/10 p-3 rounded-lg border border-sys-red/20">{uploadError}</div>}
          {uploadResult && (
            <div className="text-xs text-sys-green bg-sys-green/10 p-3 rounded-lg border border-sys-green/20">
              {uploadResult.message || 'Upload successful'}
            </div>
          )}
        </div>

        {/* Live Ingestion Metric */}
        <div className="bg-brand-card border border-brand-border p-6 rounded-2xl shadow-lg space-y-4">
          <h4 className="font-bold text-sm">Real-time Ingestion</h4>
          <div className="flex items-end justify-between">
            <div>
              <span className="text-[9px] text-brand-muted font-bold uppercase tracking-wider block">Throughput</span>
              <span className="text-3xl font-black text-sys-blue">{mqRate}</span>
              <span className="text-xs text-brand-muted ml-1 font-mono">msg/s</span>
            </div>
            <div className="text-right">
              <span className="text-[9px] text-brand-muted font-bold uppercase tracking-wider block">Dropped</span>
              <span className="text-xl font-black text-sys-red">0.0%</span>
            </div>
          </div>
          <SmoothLineChart
            points={[120, 150, 110, 180, 190, mqRate-30, mqRate+20, mqRate-10, mqRate]}
            color="#3b82f6"
            fillId="acq-grad"
            height={100}
          />
        </div>
      </div>
    </div>
  );
}
