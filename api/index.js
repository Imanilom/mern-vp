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
import cookieParser from "cookie-parser";
import path from "path";
import cors from "cors";
import analysisRouter from './routes/analysis.route.js';
import pipelineRouter from './routes/pipeline.route.js';
import reportRouter from './routes/report.route.js';
import mlRouter from './routes/ml.route.js';

// import './controllers/cornjob.controller.js';
// import './controllers/health.controller.js'; // Import file cronJobs untuk menjalankan cron job saat startup
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

// ── Internal Pipeline Trigger Endpoint ───────────────────────────────────────
// Dipanggil oleh systemd timer dari host VPS melalui curl.
// Diamankan dengan INTERNAL_KEY dari environment variable.
// Tidak memerlukan JWT, hanya API key di header X-Internal-Key.
app.post('/api/internal/run-pipeline', async (req, res) => {
  const key = req.headers['x-internal-key'];
  const expectedKey = process.env.INTERNAL_KEY;

  if (!expectedKey || key !== expectedKey) {
    return res.status(401).json({ success: false, message: 'Unauthorized: invalid internal key.' });
  }

  const layer = req.body?.layer || req.query?.layer || '2';

  // Jalankan async agar HTTP response segera dikembalikan
  if (String(layer) === '3') {
    const { runAnalysisPipeline } = await import('./controllers/analysis.controller.js');
    runAnalysisPipeline('SYSTEMD').catch(err =>
      console.error('[SystemD L3] Error:', err.message)
    );
    return res.json({ success: true, message: 'Layer 3 pipeline triggered by systemd timer.' });
  } else {
    const { processHeartRateData } = await import('./controllers/data.controller.js');
    processHeartRateData('SYSTEMD').catch(err =>
      console.error('[SystemD L2] Error:', err.message)
    );
    return res.json({ success: true, message: 'Layer 2 pipeline triggered by systemd timer.' });
  }
});

