export function unwrapDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value, options = { day: 'numeric', month: 'long' }) {
  const date = unwrapDate(value);
  return date
    ? new Intl.DateTimeFormat('id-ID', options).format(date)
    : 'Belum tersedia';
}

export function formatTime(value) {
  const date = unwrapDate(value);
  return date
    ? new Intl.DateTimeFormat('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(date)
    : '--:--';
}

export function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function getInitial(name = '') {
  return name.trim().charAt(0).toUpperCase() || 'V';
}

export function getStatusLabel(status) {
  const labels = {
    available: 'Data CAPAR tersedia',
    insufficient_data: 'Data belum cukup',
    consent_required: 'Persetujuan AI diperlukan',
    link_required: 'Akun CAPAR belum tertaut',
    recovered: 'Pemulihan tercatat',
    recovering: 'Dalam pemantauan',
    active: 'Perlu perhatian',
    not_exposed: 'Belum tersedia',
  };
  return labels[status] || status || 'Belum ada status';
}

export function getChartPoints(samples) {
  const values = samples
    .filter((item) => !item.is_simulated)
    .map((item) => numberOrNull(item.heart_rate_bpm))
    .filter((value) => value != null);
  if (values.length < 2) return '';
  const low = Math.min(...values);
  const high = Math.max(...values);
  const range = Math.max(high - low, 1);
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 600;
      const y = 120 - ((value - low) / range) * 100;
      return `${x},${y}`;
    })
    .join(' ');
}
