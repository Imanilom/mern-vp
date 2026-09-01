import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
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
import systemRouter from './routes/system.route.js';
import episodesRouter from './routes/episodes.route.js';
import { syncAllBaselineLearnedTau } from './utils/capar.thresholds.js';
import http from "http";
import { Server as SocketIOServer } from "socket.io";

// import './controllers/cornjob.controller.js';
// import './controllers/health.controller.js'; // Import file cronJobs untuk menjalankan cron job saat startup
import { startLogTransportConsumer } from './utils/logTransport.js';
import doctorRouter from './routes/doctor.route.js';
import userpatientRouter from './routes/userpatient.route.js';
import aipipelineRouter from './routes/aipipeline.route.js';
import zeroshotRouter from './routes/zeroshot.route.js';
import phenotypeProfileRouter from './routes/phenotype_profile.route.js';
import { verifyToken } from './utils/verifyUser.js';
dotenv.config();

const mongoUri = process.env.MONGO;
const localMongoUri = "mongodb://127.0.0.1:27017/healthdevice";

async function connectMongoDB() {
  const options = {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  };

  // If MONGO env var is not set, skip straight to local fallback
  if (!mongoUri) {
    console.warn("[MongoDB] MONGO env variable is not set. Falling back to local MongoDB...");
    try {
      await mongoose.connect(localMongoUri, options);
      console.log("Connected to Local MongoDB fallback!");
      startLogTransportConsumer().catch((e) => console.error("[RabbitMQ Consumer] Launch error:", e.message));
    } catch (localErr) {
      console.error("[MongoDB] Local fallback connection also failed:", localErr.message);
    }
    return;
  }

  try {
    await mongoose.connect(mongoUri, options);
    const connType = (mongoUri.includes('127.0.0.1') || mongoUri.includes('localhost')) ? 'Local' : 'Cloud Atlas';
    console.log(`Connected to MongoDB (${connType})!`);
    startLogTransportConsumer().catch((err) => console.error("[RabbitMQ Consumer] Launch error:", err.message));
    syncAllBaselineLearnedTau().catch((err) => console.error("[syncAllBaselineLearnedTau] Error:", err.message));
  } catch (err) {
    console.error(`[MongoDB] Primary connection error (${mongoUri}):`, err.message);
    const isRemote = !mongoUri.includes('127.0.0.1') && !mongoUri.includes('localhost');
    if (isRemote) {
      console.log(`[MongoDB] Attempting fallback connection to local MongoDB (${localMongoUri})...`);
      try {
        await mongoose.connect(localMongoUri, options);
        console.log("Connected to Local MongoDB fallback!");
        startLogTransportConsumer().catch((e) => console.error("[RabbitMQ Consumer] Launch error:", e.message));
      } catch (localErr) {
        console.error("[MongoDB] Local fallback connection also failed:", localErr.message);
      }
    }
  }
}

connectMongoDB();

const __dirname = path.resolve();

const app = express();
const httpServer = http.createServer(app);

// Initialize Socket.io
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.replace(/['"]/g, '').split(',').map(o => o.trim())
      : ['http://localhost:3031', 'https://healthtrajectory.cloud', 'http://localhost:5173', 'http://localhost:59674', '*'],
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ['polling', 'websocket'],
  allowEIO3: true,
});

io.on("connection", (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  socket.on("join_room", (room) => {
    socket.join(room);
    console.log(`[Socket.io] Client ${socket.id} joined room: ${room}`);
  });

  socket.on("disconnect", () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});


// ── Security Headers (Helmet) ────────────────────────────────────────────────
app.use(helmet());

// ── CORS — Whitelist dari environment variable ALLOWED_ORIGINS ──────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.replace(/['"]/g, '').split(',').map(o => o.trim())
  : ['http://localhost:3031', 'https://healthtrajectory.cloud', 'http://localhost:5173', 'http://localhost:56710'];

// Regex untuk allow semua localhost port (development Flutter web / Vite / dev servers)
// Pattern ini TIDAK berlaku di production karena origin production tidak pernah localhost.
const localhostRegex = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

// Agar jika ada typo https://https:// di .env tetap aman:
if (!allowedOrigins.includes('https://healthtrajectory.cloud')) {
  allowedOrigins.push('https://healthtrajectory.cloud');
}

app.use(cors({
  origin: (origin, callback) => {
    // Izinkan request tanpa origin (server-to-server / curl / Postman)
    if (!origin) return callback(null, true);
    // Izinkan semua localhost:* untuk keperluan development
    if (localhostRegex.test(origin)) return callback(null, true);
    // Cek whitelist eksplisit (production origins)
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS: Origin '${origin}' tidak diizinkan.`));
  },
  credentials: true, // Izinkan cookie di-kirim bersama request
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Key', 'ngrok-skip-browser-warning'],
}));

// ── Body Parser dengan batas ukuran ─────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// ── Rate Limiter global (untuk semua endpoint) ───────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 menit
  max: 500,            // Maks 500 request per key per menit
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Gunakan user ID dari JWT sebagai key, bukan IP
  // Ini mencegah seluruh user di jaringan yang sama (1 IP) terkena limit bersama
  keyGenerator: (req) => {
    // Coba ambil user id dari JWT payload jika sudah diparse sebelumnya
    // (verifyToken di-apply per-route, jadi di sini kita parse manual tanpa verify)
    try {
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        // Decode payload tanpa verify (aman untuk rate-limit key saja)
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
        if (payload?.id) return `user:${payload.id}`;
      }
    } catch (_) { /* fall through ke IP */ }
    return req.ip;
  },
  skip: (req) => req.path === '/api/health', // Jangan rate-limit health check
  message: { success: false, message: 'Terlalu banyak request. Silakan tunggu sebentar.' },
});

app.use(globalLimiter);

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
app.use("/api/participants", analysisRouter);
app.use("/api/prediction-eval", analysisRouter);
app.use("/api/pipeline", pipelineRouter);
app.use("/api/reports", reportRouter);
app.use("/api/doctor", doctorRouter);
app.use("/api/patient-user", userpatientRouter);
app.use("/api/ai", aipipelineRouter);
app.use("/api/ai/zero-shot", zeroshotRouter);
app.use("/api/phenotype-profile", phenotypeProfileRouter);
app.use("/api/ml", mlRouter);
app.use("/api/system", systemRouter);
app.use("/api/episodes", episodesRouter);
app.use("/api/v1/episodes", episodesRouter); // Alias for compatibility with spec
app.use("/api/v1/events", analysisRouter); // Alias for event generator

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


// ── Health Check (untuk Docker HEALTHCHECK) ──────────────────────────────────
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, status: 'OK', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  // Jangan expose stack trace di production
  const isProduction = process.env.NODE_ENV === 'production';
  return res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    ...(isProduction ? {} : { stack: err.stack }),
  });
});

const PORT = process.env.PORT || 3030;

httpServer.listen(PORT, () => {
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
  } else if (String(layer) === '3rr') {
    const { runRRAnalysisPipeline } = await import('./controllers/analysis.controller.js');
    runRRAnalysisPipeline('SYSTEMD').catch(err =>
      console.error('[SystemD L3-RR] Error:', err.message)
    );
    return res.json({ success: true, message: 'Layer 3-RR pipeline triggered.' });
  } else if (String(layer) === '2rr') {
    const { processOneMinuteRRSegments } = await import('./controllers/data.controller.js');
    processOneMinuteRRSegments('SYSTEMD').catch(err =>
      console.error('[SystemD L2-RR] Error:', err.message)
    );
    return res.json({ success: true, message: 'Layer 2-RR (1-min) pipeline triggered.' });
  } else {
    const { processHeartRateData } = await import('./controllers/data.controller.js');
    processHeartRateData('SYSTEMD').catch(err =>
      console.error('[SystemD L2] Error:', err.message)
    );
    return res.json({ success: true, message: 'Layer 2 pipeline triggered by systemd timer.' });
  }
});

// ── CAPAR EpisodeAnalysis Auto-Sync Job Scheduler ──────────────────────────────────
// Membangkitkan & menyinkronkan dokumen EpisodeAnalysis dari AnomalyEvent setiap 3 menit
setInterval(async () => {
  try {
    const { syncAndGenerateEpisodeAnalyses } = await import('./controllers/analysis.controller.js');
    await syncAndGenerateEpisodeAnalyses();
  } catch (err) {
    console.error('[EpisodeAnalysis Job Scheduler Error]:', err.message);
  }
}, 180000);
