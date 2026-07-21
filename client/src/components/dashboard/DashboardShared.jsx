import React, { useState, useRef } from 'react';

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-brand-cardLight rounded-xl ${className}`} />;
}

export function Badge({ label, color }) {
  const map = {
    green: 'bg-sys-green/10 text-sys-green border-sys-green/20',
    yellow: 'bg-sys-yellow/10 text-sys-yellow border-sys-yellow/20',
    orange: 'bg-sys-orange/10 text-sys-orange border-sys-orange/20',
    red: 'bg-sys-red/10 text-sys-red border-sys-red/20',
    blue: 'bg-sys-blue/10 text-sys-blue border-sys-blue/20',
    purple: 'bg-sys-purple/10 text-sys-purple border-sys-purple/20',
    gray: 'bg-brand-muted/10 text-brand-muted border-brand-muted/20',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full font-bold border text-[9px] ${map[color] || map.gray}`}>
      {label}
    </span>
  );
}

export function SmoothLineChart({ points = [], height = 180, color = '#3b82f6', fillId = 'grad-default', baselineBand = null }) {
  const [hover, setHover] = useState(null);
  const ref = useRef(null);

  if (!points.length) {
    return (
      <div className="flex items-center justify-center text-brand-muted text-xs" style={{ height }}>
        No data
      </div>
    );
  }

  const W = 500;
  const H = height;
  const min = Math.min(...points) - 4;
  const max = Math.max(...points) + 4;
  const range = (max - min) || 1;
  const toY = (v) => H - ((v - min) / range) * H;
  const toX = (i) => (i / (points.length - 1)) * W;

  const pts = points.map((v, i) => ({ x: toX(i), y: toY(v), v }));

  let line = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const cp1x = pts[i].x + (pts[i + 1].x - pts[i].x) / 3;
    const cp2x = pts[i].x + (2 * (pts[i + 1].x - pts[i].x)) / 3;
    line += ` C ${cp1x} ${pts[i].y}, ${cp2x} ${pts[i + 1].y}, ${pts[i + 1].x} ${pts[i + 1].y}`;
  }

  const fill = `${line} L ${pts[pts.length - 1].x} ${H} L ${pts[0].x} ${H} Z`;

  const onMove = (e) => {
    if (!ref.current) return;
    const { left, width } = ref.current.getBoundingClientRect();
    const mx = ((e.clientX - left) / width) * W;
    let ci = 0, cd = Infinity;
    pts.forEach((p, i) => { const d = Math.abs(p.x - mx); if (d < cd) { cd = d; ci = i; } });
    setHover(ci);
  };

  const bbMinY = baselineBand ? toY(baselineBand.max) : 0;
  const bbMaxY = baselineBand ? toY(baselineBand.min) : 0;

  return (
    <div ref={ref} className="relative w-full" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg className="w-full overflow-visible" viewBox={`0 0 ${W} ${H}`} height={H}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" y1={H * f} x2={W} y2={H * f} stroke="#1e293b" strokeWidth="0.6" strokeDasharray="3 4" />
        ))}

        {/* Baseline band */}
        {baselineBand && (
          <rect
            x="0" y={Math.min(bbMinY, bbMaxY)}
            width={W} height={Math.abs(bbMinY - bbMaxY)}
            fill={color} fillOpacity="0.07"
            stroke={color} strokeOpacity="0.2" strokeWidth="0.8" strokeDasharray="3 3"
          />
        )}

        {/* Gradient fill */}
        <path d={fill} fill={`url(#${fillId})`} />
        {/* Smooth line */}
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Dots */}
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={color} stroke="#0a0d14" strokeWidth="1" />
        ))}

        {/* Hover */}
        {hover !== null && (
          <>
            <line x1={pts[hover].x} y1="0" x2={pts[hover].x} y2={H} stroke="#475569" strokeWidth="0.8" strokeDasharray="2 3" />
            <circle cx={pts[hover].x} cy={pts[hover].y} r="7" fill={color} fillOpacity="0.25" />
            <circle cx={pts[hover].x} cy={pts[hover].y} r="4" fill="#fff" stroke={color} strokeWidth="1.5" />
          </>
        )}
      </svg>

      {/* Tooltip */}
      {hover !== null && (
        <div
          className="absolute z-20 pointer-events-none bg-brand-cardLight border border-brand-border px-3 py-1.5 rounded-xl shadow-xl text-[10px] font-bold text-brand-text"
          style={{
            left: `${(pts[hover].x / W) * 100}%`,
            top: `${(pts[hover].y / H) * 100 - 50}%`,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="text-brand-muted text-[8px] uppercase tracking-wide">Value</div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
            {pts[hover].v.toFixed(1)}
          </div>
        </div>
      )}
    </div>
  );
}

// Data formatters
export const classColor = (cls) => {
  if (!cls) return 'gray';
  const c = cls.toLowerCase();
  if (c.includes('alert')) return 'red';
  if (c.includes('caution')) return 'orange';
  if (c.includes('deviation')) return 'orange';
  if (c.includes('stable') || c.includes('normal')) return 'green';
  if (c.includes('monitoring')) return 'blue';
  if (c.includes('recovering')) return 'yellow';
  return 'gray';
};

export const fmtTime = (ms) => ms ? new Date(ms).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '—';
export const fmtDate = (ms) => ms ? new Date(ms).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
