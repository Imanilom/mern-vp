import { Activity } from 'lucide-react';
import { groupRecoveryMetricsByDay } from '../utils/physiologyDistributions';

function formatWibDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Belum tersedia'
    : new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Jakarta',
    }).format(date);
}

function formatDelta(current, previous, digits, unit = '') {
  if (current == null || previous == null) return '—';
  const delta = current - previous;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(digits)}${unit}`;
}

export default function RecoveryTrend({ episodes = [] }) {
  const days = groupRecoveryMetricsByDay(episodes);

  return (
    <section className="panel recovery-trend-panel">
      <div className="panel-heading">
        <div>
          <h2>Periksa tren pemulihan hari ke hari</h2>
          <p>Bandingkan rerata AUC deviasi dan waktu ke pemulihan (TTR) setiap hari</p>
        </div>
        <span className="panel-icon green-icon"><Activity size={17} /></span>
      </div>
      {days.length ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tanggal (WIB)</th>
                <th>Rerata AUC</th>
                <th>Δ AUC vs hari sebelumnya</th>
                <th>Rerata TTR</th>
                <th>Δ TTR vs hari sebelumnya</th>
                <th>Episode tercatat</th>
              </tr>
            </thead>
            <tbody>{days.map((day, index) => {
              const previousDay = days[index - 1];
              return (
                <tr key={day.dateKey}>
                  <td>{formatWibDate(day.date)}</td>
                  <td>{day.auc == null ? '—' : day.auc.toFixed(2)}</td>
                  <td>{formatDelta(day.auc, previousDay?.auc, 2)}</td>
                  <td>{day.ttrMinutes == null ? '—' : `${day.ttrMinutes.toFixed(1)} menit`}</td>
                  <td>{formatDelta(day.ttrMinutes, previousDay?.ttrMinutes, 1, ' menit')}</td>
                  <td>{day.episodes}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state small-empty">
          <strong>Belum ada AUC atau TTR CAPAR untuk dibandingkan</strong>
          <p>Nilai tidak diisi dari data lain dan akan muncul setelah episode menyimpan metrik pemulihan.</p>
        </div>
      )}
      <p className="baseline-footnote">
        Selisih dihitung terhadap hari sebelumnya yang memiliki episode. Data yang tidak tercatat ditampilkan sebagai “—”; perubahan AUC/TTR tidak membuktikan bahwa rekomendasi menyebabkan pemulihan.
      </p>
    </section>
  );
}
