import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import userRouter from './routes/user.route.js';
import authRouter from './routes/auth.route.js';
import garminRouter from './routes/garmin.route.js';
import activityRouter from './routes/activity.route.js';
import recomendationRouter from './routes/recomendation.route.js';
import patientRouter from './routes/patient.route.js';
import actionRecomendation from './routes/action.recomendation.rout.js';
import cookieParser from 'cookie-parser';
import path from 'path';
import cors from 'cors';
// import cors from 'cors';
import './controllers/health.controller.js'; // Import file cronJobs untuk menjalankan cron job saat startup
import './controllers/data.controller.js';

dotenv.config({path : '../.env'});
console.log(process.env.MONGO);

mongoose
  .connect(process.env.MONGO, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}!`);
});
