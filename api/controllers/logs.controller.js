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
  
        if (!req.file) return res.status(400).json({ message: "No file uploaded" });
  
        const filePath = req.file.path;
        const logs = [];
        const hardcodedDeviceId = "E4F82A29";
  
        fs.createReadStream(filePath)
          .pipe(csv())
          .on("data", (row) => {
            if (row.timestamp && row.HR && row.RR && row.rrRMS) {
              const nanoTimestamp = BigInt(row.timestamp);
              const milliTimestamp = Number(nanoTimestamp / 1_000_000n);
              const dateObj = new Date(milliTimestamp);
  
              logs.push(new PolarData({
                timestamp: milliTimestamp,
                date_created: dateObj.toISOString().split("T")[0],
                time_created: dateObj.toISOString().split("T")[1].slice(0, -1),
                HR: Number(row.HR),
                RR: Number(row.RR),
                RRms: Number(row.rrRMS), // Sesuaikan field name dengan model
                acc_x: row.accData ? JSON.parse(row.accData)[0] : 0,
                acc_y: row.accData ? JSON.parse(row.accData)[1] : 0,
                acc_z: row.accData ? JSON.parse(row.accData)[2] : 0,
                ecg: row.ecgData ? JSON.parse(row.ecgData)[0] : 0,
                device_id: hardcodedDeviceId,
                activity: "unknown", // Tambahkan field required dari model
                created_at: new Date(),
              }));
            }
          })
          .on("end", async () => {
            try {
              const savedLogs = await PolarData.insertMany(logs); // Ganti model
              fs.unlinkSync(filePath);
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
  
  // Metode untuk memeriksa dan mengisi log (DIUBAH)
  export const checkAndFillLogs = async () => {
    try {
      const logs = await PolarData.find({ isChecked: false }).limit(100000); // Ganti model
  
      if (!logs.length) {
        return { message: 'No logs found to check and fill.', status: 404 };
      }
  
      const logsWithHRAndRR = await PolarData.find({ HR: { $ne: null }, RR: { $ne: null } }) // Ganti model
        .sort({ created_at: 1 })
        .limit(10000);
  
      for (const log of logs) {
        let isUpdated = false;
  
        if (log.RR === null || log.RR === undefined) {
          for (let i = 1; i < logsWithHRAndRR.length; i++) {
            const prevIndex = logsWithHRAndRR.findIndex(l => l._id.equals(log._id)) - i;
            if (prevIndex >= 0) {
              log.RR = logsWithHRAndRR[prevIndex].RR;
              isUpdated = true;
              break;
            }
          }
        } else if (!log.isChecked && log.RR !== null && log.RRms !== null) { // Sesuaikan field RRms
          log.isChecked = true;
          isUpdated = true;
        }
  
        if (isUpdated) await log.save();
      }
  
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