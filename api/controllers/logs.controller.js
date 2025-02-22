import Log from '../models/log.model.js';
import dataLog from '../models/data.model.js';
import multer from "multer";
import csv from "csv-parser";
import fs from "fs";

const upload = multer({ dest: "uploads/" });

// Endpoint untuk menerima CSV dari mobile apps
export const createLog = async (req, res) => {
  try {
    upload.single("file")(req, res, async (err) => {
      if (err) return res.status(400).json({ message: "File upload failed", error: err.message });

      // Pastikan file ada
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      const filePath = req.file.path;
      const logs = [];
      const hardcodedDeviceId = "E4F82A29"

      fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", (row) => {
          // Validasi data sebelum memasukkan ke array logs
          if (row.HR && row.RR && row.rrRMS && row.date_created && row.time_created && row.aktivitas) {
            logs.push({
              timestamp: new Date(`${row.date_created}T${row.time_created}Z`), // Format waktu
              hr: Number(row.HR),
              rr: Number(row.RR),
              rrms: Number(row.rrRMS),
              acc_x: row.accData ? JSON.parse(row.accData)[0] : 0,
              acc_y: row.accData ? JSON.parse(row.accData)[1] : 0,
              acc_z: row.accData ? JSON.parse(row.accData)[2] : 0,
              ecg: row.ecgData ? JSON.parse(row.ecgData)[0] : 0,
              device_id: hardcodedDeviceId, // Hardcoded device ID
              created_at: new Date(),
            });
          }
        })
        .on("end", async () => {
          try {
            // Simpan data ke MongoDB
            const savedLogs = await dataLog.insertMany(logs);
            fs.unlinkSync(filePath); // Hapus file setelah diproses
            res.status(201).json({ message: "Logs created successfully", data: savedLogs });
          } catch (error) {
            res.status(500).json({ message: "Error saving logs", error: error.message });
          }
        });
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

// Metode untuk memeriksa dan mengisi log
export const checkAndFillLogs = async () => {
    try {
        
        // Mencari semua log yang belum diperiksa dengan batasan 100000
        const logs = await Log.find({ isChecked: false }).limit(100000);
        console.log(`Logs found: ${logs.length}`); // Log tambahan untuk debugging

        // Jika tidak ada log yang ditemukan, kembalikan pesan dan status 404
        if (!logs.length) {
            console.log('No logs found to check and fill.');
            return { message: 'No logs found to check and fill.', status: 404 };
        }

        console.log(`Found ${logs.length} logs to check and fill.`);

        // Mencari log yang memiliki HR dan RR dengan batasan 10000
        const logsWithHRAndRR = await Log.find({ HR: { $ne: null }, RR: { $ne: null } })
            .sort({ create_at: 1 })
            .limit(10000); // Reduced limit to 10,000
        console.log(`Logs with HR and RR found: ${logsWithHRAndRR.length}`); // Log tambahan untuk debugging

        // Memproses setiap log dan memperbarui flag isChecked
        for (const log of logs) {
            let isUpdated = false; // Flag untuk menandai apakah log diupdate

            // console.log(`Processing log with ID ${log._id}, current RR: ${log.RR}, current rrRMS: ${log.rrRMS}, isChecked: ${log.isChecked}`);

            if (log.RR === null || log.RR === undefined) {
                // Mencari nilai RR terdekat dari log dengan HR dan RR
                let nearestRRValue = null;
                for (let i = 1; i < logsWithHRAndRR.length; i++) {
                    const prevIndex = logsWithHRAndRR.findIndex(l => l._id.equals(log._id)) - i;
                    console.log(`Checking index ${prevIndex} for nearest RR value`);
                    if (prevIndex >= 0) {
                        nearestRRValue = logsWithHRAndRR[prevIndex].RR;
                        console.log(`Found nearest RR value: ${nearestRRValue}`);
                        break;
                    }
                }

                if (nearestRRValue !== null) {
                    log.RR = nearestRRValue;
                    isUpdated = true;
                    console.log(`Updated log with nearest RR value: ${nearestRRValue}`);
                }
            } else if (log.isChecked === false && log.RR !== null && log.rrRMS !== null) {
                // Jika log sudah memiliki nilai RR dan rrRMS, dan flag isChecked adalah false, ubah flag ke true
                log.isChecked = true;
                isUpdated = true;
                // console.log(`Log with ID ${log._id} has RR and rrRMS, marking as checked.`);
            }

            if (isUpdated) {
                await log.save(); // Menyimpan perubahan pada database
                // console.log(`Log with ID ${log._id} has been marked as checked and updated.`);
            } else {
                console.log(`Log with ID ${log._id} was not updated.`);
            }
        }

        // Mengembalikan pesan sukses dan log yang ditemukan
        return { message: 'Logs checked and filled successfully.', logs, status: 200 };
    } catch (error) {
        console.error('Error checking and filling logs:', error);
        return { message: 'Internal server error.', status: 500 };
    }
};

// Metode baru untuk menjalankan semua metode
export const runAllMethods = async (req, res) => {
    try {
        console.log('Running fill and check logs...');

        // Memanggil metode checkAndFillLogs
        const checkAndFillLogsResult = await checkAndFillLogs();

        // Jika res ada, kembalikan hasil sebagai respons JSON
        if (res) {
            return res.status(200).json({ message: 'fill and check logs successfully.', result: checkAndFillLogsResult });
        } else {
            console.log('fill and check logs successfully.', checkAndFillLogsResult);
        }
    } catch (error) {
        console.error('Error running fill and check logs:', error);
        // Jika res ada, kembalikan pesan kesalahan sebagai respons JSON
        if (res) {
            return res.status(500).json({ message: 'Internal server error.' });
        } else {
            throw error;
        }
    }
};