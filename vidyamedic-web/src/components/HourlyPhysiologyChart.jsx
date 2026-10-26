import { useMemo, useState } from 'react';
import { Activity } from 'lucide-react';
import { numberOrNull } from '../utils/formatters';
import { buildHourlySeries } from '../utils/hourlyPhysiology.js';

export default function HourlyPhysiologyChart({ samples = [] }) {
  const [field, setField] = useState('heart_rate_bpm');
  const series = useMemo(
    () => buildHourlySeries(samples, field),
    [samples, field],
  );
  const values = series.points
    .map((point) => point.value)
    .filter((value) => value != null);

  if (!values.length) {
    return (
      <div className="empty-chart">
        <div className="empty-chart-icon"><Activity size={22} /></div>
        <strong>Belum ada tren fisiologis</strong>
        <span>Grafik akan memakai bacaan hari ini atau rerata per jam dari riwayat wearable nyata.</span>
      </div>
    );
  }

  const low = Math.min(...values);
  const high = Math.max(...values);
  const padding = Math.max((high - low) * 0.18, field === 'rmssd_ms' ? 2 : 4);
  const min = Math.max(0, low - padding);
  const max = high + padding;
  const range = Math.max(max - min, 1);
  const y = (value) => 138 - ((value - min) / range) * 112;
  const path = [];
  let segment = [];
  for (const point of series.points) {
    if (point.value == null) {
      if (segment.length) path.push(segment.join(' '));
      segment = [];
      continue;
    }
    segment.push(`${18 + (point.hour / 23) * 564},${y(point.value)}`);
  }
  if (segment.length) path.push(segment.join(' '));
  const unit = field === 'heart_rate_bpm' ? 'bpm' : 'ms';
  const label = field === 'heart_rate_bpm' ? 'Denyut jantung' : 'RMSSD';
  const sourceLabel = series.mode === 'today'
    ? 'Bacaan nyata hari ini'
    : `Rerata per jam · ${series.contributingDays} hari dengan data`;

  return (
    <div className="hourly-chart">
      <div className="hourly-chart-toolbar">
        <div className="hourly-chart-switch" role="group" aria-label="Pilih metrik tren">
          {[
            ['heart_rate_bpm', 'Denyut jantung'],
            ['rmssd_ms', 'RMSSD'],
          ].map(([value, title]) => (
            <button
              aria-pressed={field === value}
              className={field === value ? 'hourly-chart-option active' : 'hourly-chart-option'}
              key={value}
              onClick={() => setField(value)}
              type="button"
            >
              {title}
            </button>
          ))}
        </div>
        <span className="hourly-chart-source">{sourceLabel}</span>
      </div>
      <div className="hourly-chart-plot">
        <div className="hourly-chart-scale">
          <span>{Math.round(max)} {unit}</span>
          <span>{Math.round((max + min) / 2)} {unit}</span>
          <span>{Math.round(min)} {unit}</span>
        </div>
        <svg
          aria-label={`${label} per jam dari pukul 00 sampai 24`}
          className="hourly-chart-svg"
          preserveAspectRatio="none"
          role="img"
          viewBox="0 0 600 150"
        >
          {[26, 82, 138].map((lineY) => (
            <line key={lineY} x1="0" x2="600" y1={lineY} y2={lineY} className="chart-grid" />
          ))}
          {[0, 6, 12, 18, 23].map((hour) => {
            const x = 18 + (hour / 23) * 564;
            return <line key={hour} x1={x} x2={x} y1="18" y2="140" className="hourly-chart-guide" />;
          })}
          {path.map((points, index) => (
            <polyline
              className="hourly-chart-line"
              fill="none"
              key={index}
              points={points}
            />
          ))}
          {series.points.map((point) => point.value == null ? null : (
            <circle
              className="hourly-chart-point"
              cx={18 + (point.hour / 23) * 564}
              cy={y(point.value)}
              key={point.hour}
              r="3.3"
            >
              <title>{`${String(point.hour).padStart(2, '0')}:00 · ${point.value.toFixed(1)} ${unit}${series.mode === 'historical' ? ` · ${point.days} hari` : ''}`}</title>
            </circle>
          ))}
        </svg>
        <div className="hourly-chart-hours">
          <span>00.00</span><span>06.00</span><span>12.00</span><span>18.00</span><span>24.00</span>
        </div>
      </div>
      <p className="hourly-chart-note">
        {series.mode === 'today'
          ? `${series.readingCount} ringkasan per jam. Jam tanpa titik berarti belum ada bacaan, bukan nilai nol.`
          : 'Rata-rata dihitung dari jam yang memiliki bacaan wearable nyata; ini menunjukkan pola harian, bukan pengukuran hari ini.'}
        {' '}Visualisasi pola 24 jam, bukan diagnosis atau interpretasi ritme sirkadian klinis.
      </p>
    </div>
  );
}
