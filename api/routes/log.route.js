// Di server, pastikan route untuk upload sudah benar
import express from 'express';
import multer from 'multer';
import PolarData from "../models/data.model.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Endpoint untuk upload CSV
router.post('/logs', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const filePath = req.file.path;
    console.log("Processing file:", filePath);

    let logs = [];
    const hardcodedDeviceId = "E4F82A29";

    fs.createReadStream(filePath)
      .pipe(csv({
        separator: ",", // Sekarang menggunakan koma karena format sudah diperbaiki
        mapHeaders: ({ header, index }) => header.trim().toLowerCase() // Normalisasi header
      }))
      .on("data", (row) => {
        console.log("Row read:", row);

        // Validasi data yang diperlukan
        if (row.timestamp && row.hr) {
          logs.push({
            timestamp: Number(row.timestamp),
            date_created: row.date_created,
            time_created: row.time_created,
            hr: Number(row.hr) || 0,
            rr: Number(row.rr) || 0,
            rrms: Number(row.rrms) || 0,
            acc_x: Number(row.acc_x) || 0,
            acc_y: Number(row.acc_y) || 0,
            acc_z: Number(row.acc_z) || 0,
            ecg: Number(row.ecg) || 0,
            device_id: row.device_id || hardcodedDeviceId,
            activity: row.activity || "Rest",
            created_at: new Date(),
          });
        }
      })
      .on("end", async () => {
        console.log("All rows processed. Total:", logs.length);

        if (logs.length === 0) {
          fs.unlinkSync(filePath);
          return res.status(400).json({ message: "No valid data found in CSV" });
        }

        const savedLogs = await PolarData.insertMany(logs);
        fs.unlinkSync(filePath);

        res.status(201).json({
          message: "Logs created successfully",
          data: savedLogs,
          count: savedLogs.length
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
});

export default router;