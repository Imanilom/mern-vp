/**
 * validateLog.js
 * Pure functions untuk validasi data log wearable per-row.
 * Tidak ada dependency ke DB agar mudah di-test secara terpisah.
 */

// Aturan validasi fisiologis
const RULES = {
  HR_MIN: 30,
  HR_MAX: 220,
  RR_MIN: 300,  // ms
  RR_MAX: 2000, // ms
};

/**
 * Validasi satu row CSV yang sudah diparsing.
 * @param {Object} row - Row dari CSV yang sudah dinormalisasi (lowercase key)
 * @param {string} userId - MongoDB ObjectId user (sudah divalidasi keberadaannya)
 * @returns {{ valid: boolean, errors: string[], data: Object|null }}
 */
export function validateLogRow(row, userId) {
  const errors = [];

  // --- Validasi User ID ---
  if (!userId) {
    errors.push('user_id kosong');
    return { valid: false, errors, data: null };
  }

  // --- Validasi Timestamp ---
  const timestamp = Number(row.timestamp);
  if (!row.timestamp || isNaN(timestamp) || timestamp <= 0) {
    errors.push('timestamp kosong atau tidak valid');
    return { valid: false, errors, data: null };
  }

  // --- Validasi HR ---
  const hr = Number(row.hr);
  if (isNaN(hr)) {
    errors.push('hr bukan angka');
    return { valid: false, errors, data: null };
  }
  if (hr < RULES.HR_MIN || hr > RULES.HR_MAX) {
    errors.push(`hr tidak masuk akal: ${hr} (harus ${RULES.HR_MIN}–${RULES.HR_MAX})`);
    return { valid: false, errors, data: null };
  }

  // --- Validasi RR ---
  const rr = Number(row.rr);
  if (isNaN(rr)) {
    errors.push('rr bukan angka');
    return { valid: false, errors, data: null };
  }
  if (rr < RULES.RR_MIN || rr > RULES.RR_MAX) {
    errors.push(`rr tidak valid: ${rr} ms (harus ${RULES.RR_MIN}–${RULES.RR_MAX} ms)`);
    return { valid: false, errors, data: null };
  }

  // --- Data valid, kembalikan objek yang sudah dinormalisasi ---
  const data = {
    user_id: userId,
    timestamp,
    date_created: row.date_created || null,
    time_created: row.time_created || null,
    hr,
    rr,
    rrms: Number(row.rrms) || rr, // fallback ke rr jika rrms tidak ada
    acc_x: Number(row.acc_x) || 0,
    acc_y: Number(row.acc_y) || 0,
    acc_z: Number(row.acc_z) || 0,
    step_count: Number(row.step_count) || 0,
    ecg: Number(row.ecg) || 0,
    device_id: row.device_id || 'UNKNOWN',
    activity: normalizeActivity(row.activity),
    isChecked: false,
    created_at: new Date(),
  };

  return { valid: true, errors: [], data };
}

/**
 * Normalisasi label aktivitas dari diary manual.
 * @param {string} activity
 * @returns {string}
 */
export function normalizeActivity(activity) {
  if (!activity || typeof activity !== 'string') return 'Rest';
  const map = {
    rest: 'Rest',
    tidur: 'Rest',
    sleep: 'Rest',
    light: 'Light',
    ringan: 'Light',
    jalan: 'Light',
    walk: 'Light',
    moderate: 'Moderate',
    sedang: 'Moderate',
    intense: 'Intense',
    berat: 'Intense',
    exercise: 'Intense',
    olahraga: 'Intense',
    lari: 'Intense',
    run: 'Intense',
  };
  return map[activity.trim().toLowerCase()] || 'Rest';
}

/**
 * Cek apakah kombinasi (user_id, timestamp) sudah ada di Set eksisting.
 * Digunakan untuk deduplication di-memory sebelum insert.
 * @param {Set<string>} existingKeys - Set berisi string "userId_timestamp"
 * @param {string} userId
 * @param {number} timestamp
 * @returns {boolean}
 */
export function isDuplicateTimestamp(existingKeys, userId, timestamp) {
  return existingKeys.has(`${userId}_${timestamp}`);
}

/**
 * Bangun Set key duplikat dari data yang sudah ada di DB.
 * @param {Array<{user_id: string, timestamp: number}>} existingDocs
 * @returns {Set<string>}
 */
export function buildDuplicateKeySet(existingDocs) {
  const keys = new Set();
  for (const doc of existingDocs) {
    keys.add(`${doc.user_id}_${doc.timestamp}`);
  }
  return keys;
}
