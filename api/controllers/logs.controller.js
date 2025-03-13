import PolarData from "../models/data.model.js";
import multer from "multer";
import csv from "csv-parser";
import fs from "fs";
import path from "path";

const upload = multer({ dest: "uploads/" });

// Endpoint untuk menerima CSV dari mobile apps
export const createLog = async (req, res) => {
  try {

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const filePath = req.file.path;
    console.log("Processing file:", filePath);

    let logs = [];
    const hardcodedDeviceId = "E4F82A29";

    fs.createReadStream(filePath, "utf8")
      .pipe(csv({ separator: ";" })) // ✅ Paksa baca dengan delimiter `;`
      .on("data", (row) => {
        console.log("Row read:", row); // Debug isi file

        if (row.timestamp && row.hr && row.rr && row.rrms) {
          logs.push({
            timestamp: Number(row.timestamp),
            date_created: row.date_created,
            time_created: row.time_created,
            hr: Number(row.hr),
            rr: Number(row.rr),
            rrms: Number(row.rrms),
            acc_x: Number(row.acc_x),
            acc_y: Number(row.acc_y),
            acc_z: Number(row.acc_z),
            ecg: Number(row.ecg),
            device_id: hardcodedDeviceId,
            activity: row.activity || "Rest",
            created_at: new Date(),
          });
        }
      })
      .on("end", async () => {
        console.log("All rows processed:", logs);

        if (logs.length === 0) {
          fs.unlinkSync(filePath);
          return res.status(400).json({ message: "No valid data found in CSV" });
        }

        const savedLogs = await PolarData.insertMany(logs);
        fs.unlinkSync(filePath);

        res.status(201).json({
          message: "Logs created successfully",
          data: savedLogs,
        });
      })
      .on("error", (error) => {
        console.error("CSV Read Error:", error);
        res.status(500).json({ message: "Error reading CSV", error: error.message });
      });
  } catch (error) {
    console.error("Error:", error);
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