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

// Multer: simpan sementara di uploads/
export const upload = multer({ dest: 'uploads/' });

/**
 * POST /api/log/logs
 * Menerima CSV dari mobile app (upload file).
 *
 * CSV wajib punya kolom: user_id, timestamp, hr, rr
 * Kolom opsional: rrms, acc_x, acc_y, acc_z, step_count, ecg, device_id, activity,
 *                 date_created, time_created
 *
 * Validasi Layer 1:
 *  - user_id wajib ada & harus terdaftar di DB
 *  - timestamp wajib ada & positif
 *  - HR: 30–220 bpm
 *  - RR: 300–2000 ms
 *  - Duplikasi (user_id + timestamp) → dilewati, tidak error
 */
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

    // ── Langkah 5: Insert ke database (ordered: false agar partial success) ─
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