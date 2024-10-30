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

dotenv.config();

mongoose
  // .connect("mongodb://healthdevice:Q3afzxiAb!@database2.pptik.id:27017/healthdevice", {
  .connect("mongodb://localhost:27017/healthdevice", {
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


