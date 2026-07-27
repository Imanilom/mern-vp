import mongoose from 'mongoose';

/**
 * ProcessingJob — merekam setiap eksekusi pipeline Layer 2 atau Layer 3.
 * 
 * Menggantikan data mock di pipeline.controller.js agar job bisa dilacak
 * secara persisten dan ditampilkan di Backoffice Pipeline Monitor.
 */
const processingJobSchema = new mongoose.Schema({
  // Tipe pipeline yang dijalankan
  type: {
    type: String,
    enum: ['LAYER2', 'LAYER3'],
    required: true,
    index: true,
  },

  // Status job saat ini (enum, bukan angka)
  status: {
    type: String,
    enum: ['WAITING', 'RUNNING', 'DONE', 'FAILED'],
    default: 'WAITING',
    index: true,
  },

  // User yang data-nya sedang diproses (opsional, bisa beberapa user sekaligus)
  user_ids: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],

  // Statistik eksekusi
  processed_count: { type: Number, default: 0 },
  segments_created: { type: Number, default: 0 },
  events_created: { type: Number, default: 0 },

  // Waktu eksekusi
  start_time: { type: Date },
  end_time: { type: Date },
  duration_ms: { type: Number },

  // Penanganan error & retry
  error: { type: String, default: null },
  retry_count: { type: Number, default: 0 },

  // Trigger: apakah dijalankan manual atau oleh cron?
  triggered_by: {
    type: String,
    enum: ['CRON', 'MANUAL', 'EVENT'],
    default: 'CRON',
  },
}, { timestamps: true });

// Index untuk query dashboard: ambil job terbaru
processingJobSchema.index({ createdAt: -1 });
processingJobSchema.index({ type: 1, status: 1, createdAt: -1 });

const ProcessingJob = mongoose.model('ProcessingJob', processingJobSchema);

export default ProcessingJob;
