import express from 'express';
import { createLog, upload } from '../controllers/logs.controller.js';

const router = express.Router();

/**
 * POST /api/log/logs
 * Upload CSV dari mobile app wearable.
 *
 * Form-data:
 *   - file: <CSV file>
 *
 * CSV harus berisi kolom:
 *   user_id, timestamp, hr, rr
 *   (opsional: rrms, acc_x, acc_y, acc_z, step_count, ecg, device_id, activity, date_created, time_created)
 *
 * Response:
 *   201 { success, insertedCount, duplicateCount, rejectedCount, totalRowsInFile }
 *   400 { success: false, message, ... }
 *   500 { success: false, message }
 */
router.post('/logs', upload.single('file'), createLog);

export default router;