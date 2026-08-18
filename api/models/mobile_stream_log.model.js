/**
 * MobileStreamLog — Menyimpan ping status streaming dari mobile app.
 *
 * Digunakan untuk monitoring VPS: apakah mobile sudah streaming
 * dan apakah data berhasil dikirim ke RabbitMQ.
 *
 * TTL: dokumen otomatis dihapus setelah 7 hari (via index expiredAt).
 */
import mongoose from 'mongoose';

const mobileStreamLogSchema = new mongoose.Schema({
  user_id:    { type: String, required: true, index: true },
  device_id:  { type: String, default: 'UNKNOWN' },
  event:      {
    type: String,
    enum: ['streaming_started', 'streaming_stopped', 'publish_success', 'publish_failed', 'mqtt_connected', 'mqtt_failed', 'heartbeat'],
    required: true,
  },
  readings_count: { type: Number, default: 0 },
  mqtt_connected: { type: Boolean, default: false },
  error_message:  { type: String, default: null },
  app_version:    { type: String, default: null },
  platform:       { type: String, default: null }, // 'android' | 'ios'
  created_at: { type: Date, default: Date.now },
  // TTL: dokumen otomatis dihapus setelah 7 hari
  expiredAt: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    index: { expires: 0 },
  },
});

// Index untuk query cepat per user & event terbaru
mobileStreamLogSchema.index({ user_id: 1, created_at: -1 });
mobileStreamLogSchema.index({ created_at: -1 });

const MobileStreamLog = mongoose.model('MobileStreamLog', mobileStreamLogSchema);
export default MobileStreamLog;
