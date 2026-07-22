import React, { useState, useRef } from 'react';

// ── Skeleton Loader ─────────────────────────────────────────────────────────
export function Skeleton({ className = '' }) {
  return (
    <div
      className={`htm-skeleton ${className}`}
      style={{ borderRadius: 'var(--htm-r-sm)', minHeight: '14px' }}
    />
  );
}

// ── Status Badge / Pill ─────────────────────────────────────────────────────
/**
 * color: 'stable' | 'caution' | 'alert' | 'info' | 'neutral'
 * Maps to clinical token colors. No hardcoded Tailwind colors.
 */
export function Badge({ label, color = 'neutral' }) {
  const dotColors = {
    stable:  'var(--htm-stable)',
    caution: 'var(--htm-caution)',
    alert:   'var(--htm-alert)',
    info:    'var(--htm-info)',
    neutral: 'var(--htm-neutral)',
    // legacy map from old components
    green:   'var(--htm-stable)',
    yellow:  'var(--htm-caution)',
    orange:  'var(--htm-caution)',
    red:     'var(--htm-alert)',
    blue:    'var(--htm-info)',
    purple:  'var(--htm-info)',
    gray:    'var(--htm-neutral)',
  };

  const normalised = color?.toLowerCase()
    ?.replace('green','stable')
    ?.replace('yellow','caution')
    ?.replace('orange','caution')
    ?.replace('red','alert')
    ?.replace('blue','info')
    ?.replace('purple','info')
    ?.replace('gray','neutral');

  return (
    <span className={`htm-badge htm-badge-${normalised || 'neutral'}`}>
      <span
        className="htm-badge-dot"
        style={{ background: dotColors[color] || dotColors.neutral }}
      />
      {label}
    </span>
  );
}

// ── Smooth Line Chart ──────────────────────────────────────────────────────
export function SmoothLineChart({
  points = [],
  height = 180,
  color = 'var(--htm-primary)',
  fillId = 'grad-default',
  baselineBand = null,
}) {
  const [hover, setHover] = useState(null);
  const ref = useRef(null);

  if (!points.length) {
    return (
      <div
        className="flex items-center justify-center htm-eyebrow"
        style={{ height, color: 'var(--htm-muted)' }}
      >
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
            <stop offset="0%"   stopColor={color} stopOpacity="0.12" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid — hairline */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f} x1="0" y1={H * f} x2={W} y2={H * f}
            stroke="var(--htm-hairline)" strokeWidth="0.8" strokeDasharray="3 4"
          />
        ))}

        {/* Baseline band */}
        {baselineBand && (
          <rect
            x="0" y={Math.min(bbMinY, bbMaxY)}
            width={W} height={Math.abs(bbMinY - bbMaxY)}
            fill={color} fillOpacity="0.06"
            stroke={color} strokeOpacity="0.2" strokeWidth="0.8" strokeDasharray="3 3"
          />
        )}

        {/* Fill */}
        <path d={fill} fill={`url(#${fillId})`} />
        {/* Line */}
        <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />

        {/* Dots */}
        {pts.map((p, i) => (
          <circle
            key={i} cx={p.x} cy={p.y} r="2.5"
            fill={color} stroke="var(--htm-surface)" strokeWidth="1.5"
          />
        ))}

        {/* Hover elements */}
        {hover !== null && (
          <>
            <line
              x1={pts[hover].x} y1="0" x2={pts[hover].x} y2={H}
              stroke="var(--htm-hairline)" strokeWidth="1" strokeDasharray="2 3"
            />
            <circle cx={pts[hover].x} cy={pts[hover].y} r="7" fill={color} fillOpacity="0.15" />
            <circle cx={pts[hover].x} cy={pts[hover].y} r="4" fill="var(--htm-surface)" stroke={color} strokeWidth="1.5" />
          </>
        )}
      </svg>

      {/* Tooltip */}
      {hover !== null && (
        <div
          className="absolute z-20 pointer-events-none htm-card"
          style={{
            left: `${(pts[hover].x / W) * 100}%`,
            top: `${Math.max(0, (pts[hover].y / H) * 100 - 60)}%`,
            transform: 'translateX(-50%)',
            padding: '8px 12px',
            minWidth: '72px',
          }}
        >
          <div className="htm-eyebrow" style={{ marginBottom: 4 }}>Value</div>
          <div
            className="htm-mono"
            style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
            {pts[hover].v.toFixed(1)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section Header ───────────────────────────────────────────────────────────
export function SectionHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--htm-lg)' }}>
      <div>
        <h2 style={{ fontFamily: 'var(--htm-font-display)', fontWeight: 560, fontSize: 22, letterSpacing: '-0.01em', color: 'var(--htm-ink)', margin: 0 }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ fontFamily: 'var(--htm-font-body)', fontSize: 13, color: 'var(--htm-muted)', marginTop: 4 }}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ── KPI / Metric Card ────────────────────────────────────────────────────────
export function MetricCard({ label, value, sub, color, mono = false }) {
  return (
    <div className="htm-card" style={{ padding: 'var(--htm-md) var(--htm-lg)' }}>
      <div className="htm-eyebrow" style={{ marginBottom: 8 }}>{label}</div>
      <div
        style={{
          fontFamily: mono ? 'var(--htm-font-mono)' : 'var(--htm-font-display)',
          fontWeight: 560,
          fontSize: 26,
          letterSpacing: '-0.01em',
          color: color || 'var(--htm-ink)',
          lineHeight: 1,
          marginBottom: 6,
        }}
      >
        {value}
      </div>
      {sub && (
        <div className="htm-mono" style={{ fontSize: 11, color: 'var(--htm-muted)' }}>{sub}</div>
      )}
    </div>
  );
}

// ── Data formatters (unchanged, re-exported) ─────────────────────────────────
export const classColor = (cls) => {
  if (!cls) return 'neutral';
  const c = cls.toLowerCase();
  if (c.includes('alert'))                        return 'alert';
  if (c.includes('caution') || c.includes('deviation')) return 'caution';
  if (c.includes('stable') || c.includes('normal'))     return 'stable';
  if (c.includes('monitoring'))                   return 'info';
  if (c.includes('recovering'))                   return 'caution';
  return 'neutral';
};

export const fmtTime = (ms) =>
  ms ? new Date(ms).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '—';

export const fmtDate = (ms) =>
  ms ? new Date(ms).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
