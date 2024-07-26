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
import anamnesa from './routes/anamnesa.route.js';

import cookieParser from 'cookie-parser';
import path from 'path';
import cors from 'cors';
import amqp from 'amqplib';

import './controllers/health.controller.js'; // Import file cronJobs untuk menjalankan cron job saat startup
import './controllers/data.controller.js';

dotenv.config();
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
app.use('/api/anamnesa', anamnesa);

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


// Models
import PolarData from './models/Data.models.js';

// Connect to RabbitMQ
async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URI);
    const channel = await connection.createChannel();
    await channel.assertQueue(process.env.QUEUE_NAME, { durable: true });
    console.log('Connected to RabbitMQ, waiting for messages...');
d
    channel.consume(process.env.QUEUE_NAME, async (msg) => {
      if (msg !== null) {
        const data = JSON.parse(msg.content.toString());
        console.log('Received data:', data);

        // Security: Encrypt password before storing (Adapt for your encryption scheme)
        const encryptPassword = (password, secretKey) => {
          const cipher = crypto.createCipher('aes-256-cbc', secretKey);
          let encrypted = cipher.update(password, 'utf8', 'hex');
          encrypted += cipher.final('hex');
          return encrypted;
        };
        data.encryptedPassword = encryptPassword(data.password, process.env.ENCRYPTION_KEY);
        delete data.password; // Remove plain-text password

        // Save data to MongoDB
        const polarData = new PolarData(data);
        try {
          await polarData.save();
          console.log('Data saved to MongoDB');
          channel.ack(msg);
        } catch (err) {
          console.error('Failed to save data to MongoDB:', err);
        }
      }
    }, { noAck: false });
  } catch (err) {
    console.error('Failed to connect to RabbitMQ:', err);
  }
}

connectRabbitMQ();