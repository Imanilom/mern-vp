import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import userRouter from "./routes/user.route.js";
import authRouter from "./routes/auth.route.js";
import garminRouter from "./routes/garmin.route.js";
import activityRouter from "./routes/activity.route.js";
import recomendationRouter from "./routes/recomendation.route.js";
import patientRouter from "./routes/patient.route.js";
import anamnesaRouter from "./routes/anamnesa.route.js";
import actionRecomendation from "./routes/action.recomendation.rout.js";
import appointmentRoute from "./routes/appointment.route.js";
import predictionFactorRoute from "./routes/prediction.factor.route.js";
import treatmentRoute from "./routes/treatment.route.js";
import data from "./routes/data.route.js";
import faktorresiko from "./routes/faktorresiko.route.js";
import logRouter from "./routes/log.route.js";
import cron from 'node-cron';
import cookieParser from "cookie-parser";
import path from "path";
import cors from "cors";
import analysisRouter from './routes/analysis.route.js';
import pipelineRouter from './routes/pipeline.route.js';
import reportRouter from './routes/report.route.js';
import mlRouter from './routes/ml.route.js';

// import './controllers/cornjob.controller.js';
// import './controllers/health.controller.js'; // Import file cronJobs untuk menjalankan cron job saat startup
import { processHeartRateData } from './controllers/data.controller.js';
import { runAnalysisPipeline } from './controllers/analysis.controller.js';
import { startLogTransportConsumer } from './utils/logTransport.js';
dotenv.config();

mongoose
  .connect(process.env.MONGO, {
    serverSelectionTimeoutMS: 30000, // Increase server selection timeout to 30 seconds
    socketTimeoutMS: 45000, // Increase socket timeout to 45 seconds
  })
  .then(() => {
    console.log("Connected to MongoDB!");
    // Start RabbitMQ queue consumer to automatically persist Android sensor messages to MongoDB
    startLogTransportConsumer().catch((err) => console.error("[RabbitMQ Consumer] Launch error:", err.message));
  })
  .catch((err) => {
    console.log(err);
  });

const __dirname = path.resolve();

const app = express();

app.use(cors());
app.use(express.json());
app.use(cookieParser());

import doctorRouter from './routes/doctor.route.js';
import userpatientRouter from './routes/userpatient.route.js';
import aipipelineRouter from './routes/aipipeline.route.js';
import { verifyToken } from './utils/verifyUser.js';

app.use("/api/user", userRouter);
app.use("/api/auth", authRouter);
app.use("/api/garmin", garminRouter);
app.use("/api/activity", activityRouter);
app.use("/api/recomendation", recomendationRouter);
app.use("/api/patient", patientRouter);
app.use("/api/action/recomendation", actionRecomendation);
app.use("/api/anamnesa", anamnesaRouter);
app.use("/api/appointment", appointmentRoute);
app.use("/api/predictionfactor", predictionFactorRoute);
app.use("/api/treatment", treatmentRoute);
app.use("/api/data", data);
app.use("/api/faktorresiko", faktorresiko);
app.use("/api/log", logRouter);
app.use("/api/analysis", analysisRouter);
app.use("/api/pipeline", pipelineRouter);
app.use("/api/reports", reportRouter);
app.use("/api/doctor", doctorRouter);
app.use("/api/patient-user", userpatientRouter);
app.use("/api/ai", aipipelineRouter);
app.use("/api/ml", mlRouter);

// Role & Auth endpoints
app.get("/api/me", verifyToken, (req, res) => {
  res.json({ success: true, user: req.user });
});

app.get("/api/dashboard", verifyToken, (req, res) => {
  res.json({
    success: true,
    role: req.user?.role,
    dashboard_type: req.user?.role === 'doctor' ? 'Doctor Patient Selection Dashboard' : 'Personal Patient Monitoring Dashboard'
  });
});
// API runs purely as JSON server now
// Frontend is served separately by Nginx


app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  return res.status(statusCode).json({
    success: false,
    statusCode,
    message,
  });
});

// const PORT = process.env.PORT || 5173;
const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}!`);
});


// ── Layer 2 Cron Job: Preprocessing & Segmentasi ────────────────────────────
// Berjalan setiap 3 menit. Guard mencegah overlap.
let isProcessing = false;

cron.schedule('*/3 * * * *', () => {
  if (isProcessing) {
    console.log('[Cron L2] Job sebelumnya masih berjalan, skip.');
    return;
  }
  isProcessing = true;
  console.log('[Cron L2] Memulai pipeline Layer 2 (IQR + Segmentasi)...');

  processHeartRateData()
    .then((result) => {
      if (result?.totalRawProcessed > 0) {
        console.log(`[Cron L2] Selesai: ${result.totalRawProcessed} raw, ${result.totalSegmentsCreated} segment.`);
      }
    })
    .catch((err) => console.error('[Cron L2] Error:', err.message))
    .finally(() => { isProcessing = false; });
});

// ── Layer 3 Cron Job: Analisis, Baseline & Event Generation ──────────────
// Berjalan setiap 5 menit (offset dari Layer 2) agar tidak bersaing resource.
// Guard isAnalyzing mencegah overlap.
let isAnalyzing = false;

cron.schedule('2-59/5 * * * *', () => {
  if (isAnalyzing) {
    console.log('[Cron L3] Job sebelumnya masih berjalan, skip.');
    return;
  }
  isAnalyzing = true;
  console.log('[Cron L3] Memulai pipeline Layer 3 (Z-score, Trajectory, Events)...');

  runAnalysisPipeline()
    .then((result) => {
      if (result?.analyzed > 0) {
        console.log(`[Cron L3] Selesai: ${result.analyzed} segment dianalisis, ${result.eventsCreated} event.`);
      }
    })
    .catch((err) => console.error('[Cron L3] Error:', err.message))
    .finally(() => { isAnalyzing = false; });
});
