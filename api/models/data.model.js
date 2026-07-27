import mongoose from 'mongoose';

const logSchema = new mongoose.Schema({
  // Relasi ke User — wajib untuk personalized baseline & segmentasi per-user
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  timestamp: {
    type: Number,
    required: true,
  },
  date_created: {
    type: String,
  },
  time_created: {
    type: String,
  },
  hr: {
    type: Number,
    required: true,
    min: 30,
    max: 220,
  },
  rr: {
    type: Number,
    required: true,
    min: 300,
    max: 2000,
  },
  rrms: {
    type: Number,
  },
  acc_x: {
    type: Number,
    default: 0,
  },
  acc_y: {
    type: Number,
    default: 0,
  },
  acc_z: {
    type: Number,
    default: 0,
  },
  step_count: {
    type: Number,
    default: 0,
  },
  ecg: {
    type: Number,
    default: 0,
  },
  activity: {
    type: String,
    enum: [
      // Istirahat / Low intensity
      'Tidur',
      'Berbaring',
      'Duduk',
      'Berdiri',
      // Mobilitas ringan
      'Berjalan',
      'Berjalan Cepat',
      'Naik Tangga',
      // Olahraga sedang
      'Bersepeda',
      'Berenang',
      'Senam',
      'Yoga',
      // Olahraga berat
      'Berlari',
      'Lari Cepat',
      'Olahraga Berat',
      // Aktivitas harian
      'Makan',
      'Memasak',
      'Berkendara',
      'Bekerja',
      // Fallback
      'Lainnya',
    ],
    default: 'Duduk',
  },
  device_id: {
    type: String,
    default: 'UNKNOWN',
  },
  // Status pemrosesan pipeline (enum, menggantikan isChecked yang hanya boolean)
  processStatus: {
    type: String,
    enum: ['PENDING', 'PROCESSING', 'DONE', 'FAILED'],
    default: 'PENDING',
    index: true,
  },
  // isChecked dipertahankan sebagai alias untuk backward compatibility
  isChecked: {
    type: Boolean,
    default: false,
    index: true,
  },
}, { timestamps: true });

// Compound index: query utama & pencegahan duplikasi (user + timestamp)
logSchema.index({ user_id: 1, isChecked: 1 });
logSchema.index({ user_id: 1, timestamp: 1 }, { unique: true });

const PolarData = mongoose.model('PolarData', logSchema);

export default PolarData;
