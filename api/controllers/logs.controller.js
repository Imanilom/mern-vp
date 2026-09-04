import mongoose from 'mongoose';
import PolarData from '../models/data.model.js';
import User from '../models/user.model.js';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';
import {
  validateLogRow,
  isDuplicateTimestamp,
  buildDuplicateKeySet,
} from '../utils/validateLog.js';
import { buildTransportEnvelope, publishLogTransport } from '../utils/logTransport.js';
import { io } from '../index.js';

// Multer: simpan sementara di uploads/
export const upload = multer({ dest: 'uploads/' });

export const createTransportLog = async (req, res) => {
  try {
    const payload = req.body;

    if (!payload || !payload.readings || !Array.isArray(payload.readings)) {
      return res.status(400).json({ success: false, message: 'Payload tidak valid' });
    }

    const envelope = buildTransportEnvelope(payload);
    const publishResult = await publishLogTransport(payload);

    // Save directly to MongoDB PolarData collection
    let targetUserId = payload.user_id || payload.userId;
    if (!targetUserId || !mongoose.Types.ObjectId.isValid(targetUserId)) {
      const defaultUser = await User.findOne({});
      if (defaultUser) {
        targetUserId = defaultUser._id;
      }
    }

    let insertedCount = 0;
    if (targetUserId && mongoose.Types.ObjectId.isValid(targetUserId) && envelope.readings.length > 0) {
      let baseTs = Math.floor(Date.now() / 1000);
      const docs = envelope.readings.map((r, idx) => {
        let rawTs = (r.timestamp && r.timestamp > 100000) ? r.timestamp : (baseTs + idx);
        let secTs = rawTs > 10000000000 ? Math.floor(rawTs / 1000) : rawTs;
        const now = new Date(secTs * 1000);
        // Konversi eksplisit ke WIB (UTC+7) agar konsisten
        const wibTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
        
        const dateStr = `${String(wibTime.getUTCDate()).padStart(2, '0')}-${String(wibTime.getUTCMonth() + 1).padStart(2, '0')}-${wibTime.getUTCFullYear()}`;
        const timeStr = `${String(wibTime.getUTCHours()).padStart(2, '0')}:${String(wibTime.getUTCMinutes()).padStart(2, '0')}:${String(wibTime.getUTCSeconds()).padStart(2, '0')}`;

        let act = r.activity || r.motion_state || 'Duduk';
        const validActivities = [
          'Tidur', 'Berbaring', 'Duduk', 'Berdiri', 'Berjalan', 'Berjalan Cepat', 
          'Naik Tangga', 'Bersepeda', 'Berenang', 'Senam', 'Yoga', 'Berlari', 
          'Lari Cepat', 'Olahraga Berat', 'Makan', 'Memasak', 'Berkendara', 'Bekerja', 'Lainnya'
        ];
        if (!validActivities.includes(act)) act = 'Lainnya';

        return {
          user_id: targetUserId,
          timestamp: secTs,
          date_created: dateStr,
          time_created: timeStr,
          hr: r.heart_rate || r.hr || 0,
          rr: r.rr_interval || r.rr || 0,
          rrms: r.rmssd || r.rrms || null,
          activity: act,
          device_id: envelope.device_id || 'UNKNOWN',
          isChecked: false,
          processStatus: 'PENDING',
          acc_x: r.acc_x ?? r.accX ?? 0,
          acc_y: r.acc_y ?? r.accY ?? 0,
          acc_z: r.acc_z ?? r.accZ ?? 0,
          step_count: r.step_count ?? r.stepCount ?? 0,
          ecg: r.ecg ?? 0,
        };
      }).filter(d => d.hr >= 30 && d.hr <= 220 && d.rr >= 300 && d.rr <= 2000);

        if (docs.length === 0) {
          console.warn(`[HTTP -> MongoDB] All ${envelope.readings.length} readings were filtered out (invalid HR/RR)`);
          return res.status(200).json({ success: true, message: 'All readings filtered out (invalid HR/RR)', insertedCount: 0 });
        }

      for (const doc of docs) {
        try {
          await PolarData.updateOne(
            { user_id: doc.user_id, timestamp: doc.timestamp },
            { $setOnInsert: doc },
            { upsert: true }
          );
          insertedCount++;
        } catch (e) {
          doc.timestamp = doc.timestamp + Math.floor(Math.random() * 1000) + 1;
          await PolarData.create(doc).catch(() => {});
          insertedCount++;
        }
      }

      if (io && docs.length > 0) {
        io.emit('new_sensor_data', {
          user_id: targetUserId.toString(),
          device_id: envelope.device_id || 'UNKNOWN',
          readings: docs
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Transport payload diterima dan disimpan ke MongoDB',
      published: publishResult.published,
      insertedCount,
      envelope,
    });
  } catch (error) {
    console.error('[createTransportLog] Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const createLog = async (req, res) => {
  const filePath = req.file?.path;

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Tidak ada file yang diupload' });
    }

    // ── Langkah 1: Baca seluruh row dari CSV ──────────────────────────────
    const rawRows = await readCsvFile(filePath);

    if (rawRows.length === 0) {
      cleanup(filePath);
      return res.status(400).json({ success: false, message: 'File CSV kosong atau tidak bisa dibaca' });
    }

    // ── Langkah 2: Validasi user_id (harus satu user_id per file CSV) ──────
    // Ambil user_id unik dari seluruh CSV
    const userIds = [...new Set(rawRows.map(r => r.user_id).filter(Boolean))];

    if (userIds.length === 0) {
      cleanup(filePath);
      return res.status(400).json({
        success: false,
        message: 'Kolom user_id tidak ditemukan atau kosong di semua row CSV',
      });
    }

    // Validasi setiap user_id ke database
    const validUserMap = new Map(); // userId string → User doc
    const invalidUserIds = [];

    await Promise.all(
      userIds.map(async (uid) => {
        try {
          const user = await User.findById(uid).select('_id name').lean();
          if (user) {
            validUserMap.set(uid, user);
          } else {
            invalidUserIds.push(uid);
          }
        } catch {
          invalidUserIds.push(uid); // ObjectId format salah juga masuk sini
        }
      })
    );

    if (validUserMap.size === 0) {
      cleanup(filePath);
      return res.status(400).json({
        success: false,
        message: 'Semua user_id di CSV tidak valid atau tidak terdaftar',
        invalidUserIds,
      });
    }

    // ── Langkah 3: Validasi per-row + kumpulkan data valid ─────────────────
    const accepted = [];
    const rejected = [];

    for (const row of rawRows) {
      const userId = row.user_id;

      // Lewati row dengan user_id yang tidak valid
      if (!validUserMap.has(userId)) {
        rejected.push({ row, reason: `user_id '${userId}' tidak terdaftar` });
        continue;
      }

      const { valid, errors, data } = validateLogRow(row, userId);

      if (!valid) {
        rejected.push({ row, reason: errors.join('; ') });
      } else {
        accepted.push(data);
      }
    }

    if (accepted.length === 0) {
      cleanup(filePath);
      return res.status(400).json({
        success: false,
        message: 'Tidak ada data valid yang bisa disimpan',
        rejectedCount: rejected.length,
        reasons: rejected.slice(0, 10).map(r => r.reason), // sample 10 alasan
      });
    }

    // ── Langkah 4: Deduplication — cek timestamp yang sudah ada di DB ──────
    // Ambil timestamp range dari data accepted untuk query efisien
    const timestamps = accepted.map(d => d.timestamp);
    const minTs = Math.min(...timestamps);
    const maxTs = Math.max(...timestamps);

    // Query hanya dalam rentang timestamp yang akan diinsert
    const userIdsInBatch = [...new Set(accepted.map(d => d.user_id.toString()))];
    const existingDocs = await PolarData.find({
      user_id: { $in: userIdsInBatch },
      timestamp: { $gte: minTs, $lte: maxTs },
    }).select('user_id timestamp').lean();

    const existingKeys = buildDuplicateKeySet(existingDocs);

    // Filter duplikat dari accepted
    const deduplicated = [];
    const duplicateCount = { count: 0 };

    for (const data of accepted) {
      if (isDuplicateTimestamp(existingKeys, data.user_id.toString(), data.timestamp)) {
        duplicateCount.count++;
      } else {
        deduplicated.push(data);
        // Tambahkan ke set agar duplikat dalam file yang sama juga terdeteksi
        existingKeys.add(`${data.user_id}_${data.timestamp}`);
      }
    }

    if (deduplicated.length === 0) {
      cleanup(filePath);
      return res.status(200).json({
        success: true,
        message: 'Semua data sudah ada di database (duplikat)',
        insertedCount: 0,
        duplicateCount: duplicateCount.count,
        rejectedCount: rejected.length,
      });
    }

    // ── Langkah 5: Publish payload transport JSON (opsional) ─────────────
    const transportEnvelope = buildTransportEnvelope({
      user_id: userIdsInBatch[0],
      source: 'polar_ble',
      device_id: accepted[0]?.device_id || 'UNKNOWN',
      received_at: new Date().toISOString(),
      readings: deduplicated.slice(0, 20).map((item) => ({
        timestamp: item.timestamp,
        heart_rate: item.hr,
        rr_interval: item.rr,
        activity: item.activity,
        battery: null,
        signal_quality: null,
        rmssd: item.rrms || item.rr,
        dfa_alpha1: null,
      })),
    });

    let transportResult = null;
    try {
      transportResult = await publishLogTransport({
        user_id: userIdsInBatch[0],
        source: 'polar_ble',
        device_id: accepted[0]?.device_id || 'UNKNOWN',
        received_at: new Date().toISOString(),
        readings: deduplicated.slice(0, 20).map((item) => ({
          timestamp: item.timestamp,
          heart_rate: item.hr,
          rr_interval: item.rr,
          activity: item.activity,
          battery: null,
          signal_quality: null,
          rmssd: item.rrms || item.rr,
          dfa_alpha1: null,
        })),
      });
    } catch (transportError) {
      console.warn('[createLog] Transport publish skipped:', transportError.message);
    }

    // ── Langkah 6: Insert ke database (ordered: false agar partial success) ─
    const BATCH_SIZE = 1000;
    let totalInserted = 0;

    for (let i = 0; i < deduplicated.length; i += BATCH_SIZE) {
      const batch = deduplicated.slice(i, i + BATCH_SIZE);
      try {
        const result = await PolarData.insertMany(batch, {
          ordered: false,       // lanjutkan meski ada error di tengah batch
          lean: true,
        });
        totalInserted += result.length;
      } catch (bulkErr) {
        // insertMany dengan ordered:false lempar error tapi tetap insert yang berhasil
        if (bulkErr.insertedDocs) {
          totalInserted += bulkErr.insertedDocs.length;
        }
        console.warn(`[createLog] Batch ${i}–${i + BATCH_SIZE}: beberapa insert gagal`, bulkErr.message);
      }
    }

    cleanup(filePath);

    return res.status(201).json({
      success: true,
      message: 'Data berhasil diproses',
      insertedCount: totalInserted,
      duplicateCount: duplicateCount.count,
      rejectedCount: rejected.length,
      totalRowsInFile: rawRows.length,
      transport: transportResult ? {
        published: transportResult.published,
        reason: transportResult.reason || null,
        envelope: transportEnvelope,
      } : null,
      ...(rejected.length > 0 && {
        rejectedSample: rejected.slice(0, 5).map(r => ({
          timestamp: r.row.timestamp,
          reason: r.reason,
        })),
      }),
    });

  } catch (error) {
    cleanup(filePath);
    console.error('[createLog] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

// ── Helper: baca CSV ke array of objects ───────────────────────────────────
function readCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];

    fs.createReadStream(filePath, 'utf8')
      .pipe(csv({
        separator: ',',
        mapHeaders: ({ header }) => header.trim().toLowerCase(),
      }))
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

// ── Helper: hapus file upload sementara ────────────────────────────────────
function cleanup(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.warn('[createLog] Gagal hapus file temp:', e.message);
    }
  }
}