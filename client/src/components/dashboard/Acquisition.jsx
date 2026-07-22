import React from 'react';
import { FaUpload, FaSpinner } from 'react-icons/fa';
import { Badge, SmoothLineChart, SectionHeader } from './DashboardShared';

export default function Acquisition({ mqRate, w1State, w2State, uploadFile, setUploadFile, uploadResult, uploading, uploadError, handleUpload }) {
  return (
    <div className="space-y-6 animate-htm-page-in">
      <SectionHeader 
        title="Data Acquisition" 
        subtitle="Ingestion Pipeline & Raw Data Upload"
      />

      {/* Pipeline Visual */}
      <div className="htm-card overflow-x-auto p-6" style={{ padding: '24px' }}>
        <h4 className="htm-title mb-6">Data Acquisition Pipeline</h4>
        <div className="min-w-[800px] flex items-center justify-between px-2 py-4">
          {[
            { label: 'Flutter App', sub: 'BLE \u2192 CSV \u2192 API', col: 'var(--htm-stable)' },
            { label: 'RabbitMQ', sub: `${mqRate} msg/s`, col: 'var(--htm-info)' },
            { label: 'DB Raw', sub: 'POST /api/log/logs', col: 'var(--htm-info)' },
            { label: 'Layer 2 Cron', sub: 'IQR + Segments (3min)', col: 'var(--htm-info)' },
            { label: 'Layer 3 Cron', sub: 'Z-score + Events (5min)', col: 'var(--htm-caution)' },
            { label: 'Backend API', sub: '/api/analysis/*', col: 'var(--htm-stable)' },
          ].map((node, i, arr) => (
            <React.Fragment key={i}>
              <div 
                className="text-center shrink-0" 
                style={{ 
                  border: `2px solid ${node.col}`, 
                  borderRadius: 'var(--htm-r-md)', 
                  padding: '12px', 
                  width: '144px', 
                  background: 'var(--htm-raised)' 
                }}
              >
                <span className="htm-eyebrow block" style={{ color: node.col, letterSpacing: '0.05em' }}>{node.label}</span>
                <span className="htm-mono" style={{ fontSize: 10, color: 'var(--htm-muted)', display: 'block', marginTop: 4 }}>{node.sub}</span>
              </div>
              {i < arr.length - 1 && (
                <div className="flex-1 h-px relative overflow-hidden" style={{ background: 'var(--htm-hairline)', margin: '0 8px' }}>
                  <div className="absolute inset-0 animate-pulse" style={{ background: 'var(--htm-info)' }} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* CSV Upload */}
        <div className="htm-card space-y-4">
          <h4 className="htm-title">Upload Raw CSV</h4>
          <p className="htm-body-sm text-htm-muted">Simulate data ingestion bypassing RabbitMQ (POST /api/log/logs)</p>
          <div 
            className="text-center transition-colors" 
            style={{ 
              border: '2px dashed var(--htm-hairline)', 
              borderRadius: 'var(--htm-r-md)', 
              padding: '24px', 
              background: 'var(--htm-canvas)' 
            }}
          >
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setUploadFile(e.target.files[0])}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center">
              <FaUpload className="text-2xl mb-2" style={{ color: 'var(--htm-muted)' }} />
              <span className="htm-title">{uploadFile ? uploadFile.name : 'Choose CSV File'}</span>
              <span className="htm-body-sm" style={{ color: 'var(--htm-muted)', marginTop: 4 }}>or drag and drop</span>
            </label>
          </div>
          <button
            onClick={handleUpload}
            disabled={!uploadFile || uploading}
            className="htm-btn htm-btn-primary"
            style={{ width: '100%', opacity: (!uploadFile || uploading) ? 0.5 : 1 }}
          >
            {uploading ? <FaSpinner className="animate-spin" /> : 'Upload Data'}
          </button>
          
          {uploadError && (
            <div className="htm-body-sm" style={{ color: 'var(--htm-alert)', background: 'var(--htm-alert-bg)', padding: '12px', borderRadius: 'var(--htm-r-sm)', border: '1px solid rgba(185,28,28,0.2)' }}>
              {uploadError}
            </div>
          )}
          {uploadResult && (
            <div className="htm-body-sm" style={{ color: 'var(--htm-stable)', background: 'var(--htm-stable-bg)', padding: '12px', borderRadius: 'var(--htm-r-sm)', border: '1px solid rgba(46,107,74,0.2)' }}>
              {uploadResult.message || 'Upload successful'}
            </div>
          )}
        </div>

        {/* Live Ingestion Metric */}
        <div className="htm-card space-y-4">
          <h4 className="htm-title">Real-time Ingestion</h4>
          <div className="flex items-end justify-between">
            <div>
              <span className="htm-eyebrow block mb-1">Throughput</span>
              <span className="htm-display" style={{ fontSize: 32, color: 'var(--htm-info)' }}>{mqRate}</span>
              <span className="htm-mono" style={{ fontSize: 12, color: 'var(--htm-muted)', marginLeft: 4 }}>msg/s</span>
            </div>
            <div className="text-right">
              <span className="htm-eyebrow block mb-1">Dropped</span>
              <span className="htm-display" style={{ fontSize: 24, color: 'var(--htm-stable)' }}>0.0%</span>
            </div>
          </div>
          <SmoothLineChart
            points={[120, 150, 110, 180, 190, mqRate-30, mqRate+20, mqRate-10, mqRate]}
            color="var(--htm-info)"
            fillId="acq-grad"
            height={100}
          />
        </div>
      </div>
    </div>
  );
}
