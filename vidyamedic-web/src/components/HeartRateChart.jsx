import { Activity } from 'lucide-react';
import { formatTime, getChartPoints } from '../utils/formatters';

export default function HeartRateChart({ samples }) {
  const points = getChartPoints(samples);
  const realSamples = samples.filter((item) => !item.is_simulated);

  if (realSamples.length < 2 || !points) {
    return (
      <div className="empty-chart">
        <div className="empty-chart-icon"><Activity size={22} /></div>
        <strong>Belum ada grafik pemantauan</strong>
        <span>Rekam data wearable nyata untuk melihat tren denyut jantung.</span>
      </div>
    );
  }

  return (
    <div className="chart-wrap">
      <div className="chart-y-labels"><span>120</span><span>90</span><span>60</span></div>
      <svg
        aria-label="Grafik denyut jantung berdasarkan rekaman nyata"
        className="hr-chart"
        role="img"
        viewBox="0 0 600 140"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#28a77d" stopOpacity=".22" />
            <stop offset="100%" stopColor="#28a77d" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[20, 70, 120].map((y) => (
          <line key={y} x1="0" x2="600" y1={y} y2={y} className="chart-grid" />
        ))}
        <polyline fill="url(#chart-fill)" points={`0,140 ${points} 600,140`} />
        <polyline className="chart-line" fill="none" points={points} />
      </svg>
      <div className="chart-x-labels">
        <span>{formatTime(realSamples[0].recorded_at)}</span>
        <span>{formatTime(realSamples[Math.floor(realSamples.length / 2)].recorded_at)}</span>
        <span>{formatTime(realSamples.at(-1).recorded_at)}</span>
      </div>
    </div>
  );
}
