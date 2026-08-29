import mongoose from 'mongoose';

/**
 * EpisodeMeta — Koleksi metadata ringkasan episode.
 * 
 * Menyimpan data peserta, tanggal, waktu onset, ID episode,
 * serta status (candidate / persistent / recovered)
 * dan terhubung (linked) langsung ke EpisodeAnalysis.
 */
const EpisodeMetaSchema = new mongoose.Schema({
  episode_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AnomalyEvent',
    required: true,
    unique: true,
    index: true,
  },
  analysis_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EpisodeAnalysis',
    default: null,
    index: true,
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  participant_id: { type: String }, // GUID / Email / User Name
  date: { type: String, required: true }, // Format "YYYY-MM-DD" (e.g., "2026-08-27")
  time: { type: String, required: true }, // Format "HH:mm:ss" (e.g., "16:22:19")
  onset_timestamp: { type: Number, required: true }, // Epoch ms
  
  // Status episode (candidate vs persistent vs recovered vs transient)
  status: {
    type: String,
    enum: ['candidate', 'persistent', 'recovering', 'recovered', 'transient', 'unresolved'],
    required: true,
  },
  current_state: { type: String }, // e.g. "DEVIATION_CANDIDATE", "PERSISTENT_DEVIATION", "RECOVERED"
  activity: { type: String, default: 'Unknown' },
  classification: { type: String, default: 'Alert' },
  peak_score: { type: Number, default: 0 },
  duration_ms: { type: Number, default: 0 },
}, { timestamps: true });

// Index untuk query cepat
EpisodeMetaSchema.index({ user_id: 1, date: -1 });
EpisodeMetaSchema.index({ status: 1 });

const EpisodeMeta = mongoose.model('EpisodeMeta', EpisodeMetaSchema);
export default EpisodeMeta;
