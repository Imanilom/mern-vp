import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import userRouter from './routes/user.route.js';
import authRouter from './routes/auth.route.js';
import garminRouter from './routes/garmin.route.js';
import activityRouter from './routes/activity.route.js';
import recomendationRouter from './routes/recomendation.route.js';
import patientRouter from './routes/patient.route.js';
import anamnesaRouter from './routes/anamnesa.route.js';
import actionRecomendation from './routes/action.recomendation.rout.js';
import appointmentRoute from './routes/appointment.route.js';
import predictionFactorRoute from './routes/prediction.factor.route.js';
import treatmentRoute from './routes/treatment.route.js';
import data from './routes/data.route.js';
import faktorresiko from './routes/faktorresiko.route.js';

import cookieParser from 'cookie-parser';
import path from 'path';
import cors from 'cors';

import './controllers/cornjob.controller.js';
import './controllers/health.controller.js'; // Import file cronJobs untuk menjalankan cron job saat startup
import './controllers/data.controller.js';

import Log from './models/log.model.js';
import Aktivitas from './models/activity.model.js';
import fs from 'fs';

dotenv.config();

mongoose
  .connect("mongodb://healthdevice:Q3afzxiAb!@database2.pptik.id:27017/healthdevice", {
    serverSelectionTimeoutMS: 30000, // Increase server selection timeout to 30 seconds
    socketTimeoutMS: 45000, // Increase socket timeout to 45 seconds
  })
  .then(() => {
    console.log('Connected to MongoDB!');
  })
  .catch((err) => {
    console.log(err);
  });

const __dirname = path.resolve();

const app = express();

app.use(cors());
app.use(express.json());
app.use(cookieParser());

app.use('/api/user', userRouter);
app.use('/api/auth', authRouter);
app.use('/api/garmin', garminRouter);
app.use('/api/activity', activityRouter);
app.use('/api/recomendation', recomendationRouter);
app.use('/api/patient', patientRouter);
app.use('/api/action/recomendation', actionRecomendation);
app.use('/api/anamnesa', anamnesaRouter);
app.use('/api/appointment', appointmentRoute);
app.use('/api/predictionfactor', predictionFactorRoute);
app.use('/api/treatment', treatmentRoute);
app.use('/api/data', data);
app.use('/api/faktorresiko', faktorresiko);
app.use(express.static(path.join(__dirname, '/client/dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  return res.status(statusCode).json({
    success: false,
    statusCode,
    message,
  });
});

const PORT = process.env.PORT || 5173;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}!`);
});


// const updateActivityByTimeRange = async () => {
//   try {
//     let previousActivity = null; // Variabel untuk menyimpan aktivitas sebelumnya
//     let previousStartTime = null; // Variabel untuk menyimpan waktu awal aktivitas sebelumnya

//     for (let i = 0; i < dataExcel.length; i++) {
//       const singleData = dataExcel[i];


//       // Mengasumsikan format DD-MM-YYYY dari date_created
//       const dateParts = singleData.date_created.split('-'); // Memisahkan tanggal (DD-MM-YYYY)

//       const day = parseInt(dateParts[0], 10); // Hari
//       const month = parseInt(dateParts[1], 10) - 1; // Bulan (dikurangi 1 agar sesuai dengan format JavaScript)
//       const year = parseInt(dateParts[2], 10); // Tahun

//       // Buat objek Date menggunakan nilai tahun, bulan, dan hari
//       const startTime = new Date(year, month, day, ...singleData.time_created.split(':').map(t => parseInt(t, 10)));

//       // Validasi apakah startTime adalah tanggal yang valid
//       if (isNaN(startTime.getTime())) {
//         console.log("Invalid date format", singleData.date_created, singleData.time_created);
//         continue; // Skip jika ada kesalahan format tanggal
//       }

//       // Log timestamps yang valid
//       const startTimestamp = Math.floor(startTime.getTime() / 1000);
//       console.log("Start Timestamp:", startTimestamp);

//       // Periksa jika aktivitas berubah
//       if (previousActivity !== singleData.activity) {
//         // Jika ini bukan entri pertama, buat aktivitas baru dari entri sebelumnya
//         if (previousActivity && previousStartTime) {
//           const newActivity = new Aktivitas({
//             Date: previousStartTime.toISOString().split('T')[0], // Format YYYY-MM-DD
//             awal: previousStartTime.toTimeString().split(' ')[0], // Waktu awal dalam format HH:MM:SS
//             akhir: startTime.toTimeString().split(' ')[0], // Waktu akhir dalam format HH:MM:SS
//             aktivitas: previousActivity,
//             create_by: 'controller',
//             userRef: "6690c61e3600f9a934998d6f", // Ganti dengan referensi pengguna yang sebenarnya jika diperlukan
//             create_at: new Date().toISOString()
//           });

//           // Simpan aktivitas
//           await newActivity.save();
//           console.log("New activity entry created:", newActivity);
//         }

//         // Set nilai aktivitas dan waktu awal untuk entri berikutnya
//         previousActivity = singleData.activity;
//         previousStartTime = startTime;
//       }

//       // Create a new log entry (jika dibutuhkan untuk log data yang lebih mendetail)

//       // Buat entri log baru
//       const newLog = new Log({
//         guid_device: "C0680226",
//         HR: singleData.HR, // Ganti dengan nilai HR yang sebenarnya dari Excel jika perlu
//         RR: singleData.RR, // Ganti dengan nilai RR yang sebenarnya dari Excel jika perlu
//         rrRMS: null, // Asumsikan nilai default, atau hitung jika perlu
//         date_created: singleData.date_created, // Ambil langsung dari data Excel
//         time_created: singleData.time_created, // Ambil langsung dari data Excel
//         date_update: startTime.toISOString().split('T')[0].replace(/-/g, '/'), // Format YYYY/MM/DD
//         time_update: startTime.toISOString().split('T')[1].split('.')[0], // Waktu pembaruan
//         timestamp: startTimestamp, // Unix timestamp
//         date: singleData.date_created, // Ambil langsung dari data Excel
//         time: singleData.time_created, // Ambil langsung dari data Excel
//         hour: startTime.getHours().toString().padStart(2, '0'), // Jam dalam 2 digit
//         year: startTime.getFullYear().toString(), // Tahun sebagai string
//         datetime: `${singleData.date_created} ${singleData.time_created}`, // Menggunakan data dari Excel
//         create_at: new Date().toISOString(), // Waktu sekarang dalam ISO
//         isChecked: false, // Set ke false
//         activity: singleData.activity // Aktivitas dari data
//       });


//       // const newLog = new Log({
//       //   guid_device: "C0680226",
//       //   HR: singleData.HR, // Replace with actual HR value from Excel if needed
//       //   RR: singleData.RR, // Replace with actual RR value from Excel if needed
//       //   rrRMS: null, // Assume a default value, or calculate if needed
//       //   date_created: startTime.toISOString().split('T')[0].replace(/-/g, '/'), // Format YYYY/MM/DD
//       //   time_created: startTime.toISOString().split('T')[1].split('.')[0], // HH:MM:SS
//       //   date_update: startTime.toISOString().split('T')[0].replace(/-/g, '/'), // Format YYYY/MM/DD
//       //   time_update: startTime.toISOString().split('T')[1].split('.')[0], // Waktu pembaruan
//       //   timestamp: startTimestamp, // Unix timestamp
//       //   date: startTime.toISOString().split('T')[0].replace(/-/g, '/'), // Format YYYY/MM/DD
//       //   time:  startTime.toISOString().split('T')[1].split('.')[0], // HH:MM:SS
//       //   hour: startTime.getHours().toString().padStart(2, '0'), // Hour in 2 digits
//       //   year: startTime.getFullYear().toString(), // Year as a string
//       //   datetime: `${startTime.toISOString().split('T')[0].replace(/-/g, '/')} ${startTime.toTimeString().split(' ')[0]}`, // Date and Time combined
//       //   create_at: new Date().toISOString(), // Current time in ISO
//       //   isChecked: false, // Set to true
//       //   activity: singleData.activity // Activity from the data
//       // });

//       // Simpan log baru
//       const savedLog = await newLog.save();
//       console.log({ message: "New log created successfully", log: savedLog });
//     }

//     // Buat aktivitas terakhir setelah looping selesai
//     if (previousActivity && previousStartTime) {
//       const newActivity = new Aktivitas({
//         Date: previousStartTime.toISOString().split('T')[0], // Format YYYY-MM-DD
//         awal: previousStartTime.toTimeString().split(' ')[0], // Waktu awal dalam format HH:MM:SS
//         akhir: startTime.toTimeString().split(' ')[0], // Waktu akhir dalam format HH:MM:SS
//         aktivitas: previousActivity,
//         create_by: 'controller',
//         userRef: "6690c61e3600f9a934998d6f", // Ganti dengan referensi pengguna yang sebenarnya jika diperlukan
//         create_at: new Date().toISOString()
//       });

//       await newActivity.save();
//       console.log("Final activity entry created:", newActivity);
//     }

//   } catch (error) {
//     console.log({ error });
//   }
// };

// Example usage
// updateActivityByTimeRange();
