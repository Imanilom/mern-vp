import { Activity } from 'lucide-react';
import { formatDate, formatTime, numberOrNull } from '../utils/formatters';

export default function MetricTrendChart({ samples, field, label, unit }) {
  const readings = samples
    .filter((sample) => !sample.is_simulated)
    .map((sample) => ({
      timestamp: sample.recorded_at,
      value: numberOrNull(sample[field]),
    }))
    .filter((sample) => sample.value != null && sample.value > 0)
    .sort((first, second) => new Date(first.timestamp) - new Date(second.timestamp));

  if (readings.length < 2) {
    return (
      <div className="empty-chart trend-chart-empty">
        <div className="empty-chart-icon"><Activity size={20} /></div>
        <strong>Belum ada tren {label.toLowerCase()}</strong>
        <span>Diperlukan setidaknya dua ringkasan wearable nyata.</span>
      </div>
    );
  }

  const min = Math.min(...readings.map((item) => item.value));
  const max = Math.max(...readings.map((item) => item.value));
  const range = Math.max(max - min, 1);
  const points = readings.map((item, index) => {
    const x = 18 + (index / (readings.length - 1)) * 564;
    const y = 145 - ((item.value - min) / range) * 112;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <div className="metric-trend-chart">
      <div className="trend-chart-scale"><span>{Math.round(max)} {unit}</span><span>{Math.round(min)} {unit}</span></div>
      <svg
        aria-label={`Grafik ${label.toLowerCase()} berdasarkan rekaman nyata`}
        className="trend-chart-svg"
        preserveAspectRatio="none"
        role="img"
        viewBox="0 0 600 165"
      >
        {[32, 88, 144].map((y) => (
          <line key={y} x1="0" x2="600" y1={y} y2={y} className="chart-grid" />
        ))}
        <polyline className="metric-trend-line" fill="none" points={points} />
      </svg>
      <div className="chart-x-labels">
        <span>{formatDate(readings[0].timestamp, { day: 'numeric', month: 'short' })} {formatTime(readings[0].timestamp)}</span>
        <span>{formatDate(readings[Math.floor(readings.length / 2)].timestamp, { day: 'numeric', month: 'short' })} {formatTime(readings[Math.floor(readings.length / 2)].timestamp)}</span>
        <span>{formatDate(readings.at(-1).timestamp, { day: 'numeric', month: 'short' })} {formatTime(readings.at(-1).timestamp)}</span>
      </div>
    </div>
  );
}
