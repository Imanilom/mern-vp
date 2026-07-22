import express from 'express';
import { verifyToken } from '../utils/verifyUser.js';
import {
  getPipelineStatus,
  purgeQueue,
  getQueueMessages,
  pauseQueue,
  getRabbitMQNodes,
  getRecentData,
  getJobs,
  rerunJob,
  pauseJob,
  cancelJob,
  restartWorker,
  getSettings,
  saveSettings,
  getMetrics,
} from '../controllers/pipeline.controller.js';

const router = express.Router();

// Role-guard middleware — only operator / administrator
function requireOperator(req, res, next) {
  const role = req.user?.role;
  if (!['operator', 'administrator', 'admin', 'Doctor'].includes(role)) {
    return res.status(403).json({ success: false, message: 'Operator or Administrator role required.' });
  }
  next();
}

/** GET /api/pipeline/status — full pipeline status incl. RabbitMQ live stats */
router.get('/status', verifyToken, getPipelineStatus);

/** GET /api/pipeline/nodes — RabbitMQ cluster nodes */
router.get('/nodes', verifyToken, requireOperator, getRabbitMQNodes);

/** DELETE /api/pipeline/queue/:queueName/purge — clear failed/dead-letter queue */
router.delete('/queue/:queueName/purge', verifyToken, requireOperator, purgeQueue);

/** POST /api/pipeline/queue/:queueName/pause — pause a queue */
router.post('/queue/:queueName/pause', verifyToken, requireOperator, pauseQueue);

/** POST /api/pipeline/queue/:queueName/messages — peek messages */
router.post('/queue/:queueName/messages', verifyToken, requireOperator, getQueueMessages);

// Backoffice Routes
router.get('/recent-data', verifyToken, getRecentData);
router.get('/jobs', verifyToken, getJobs);
router.post('/job/:jobId/rerun', verifyToken, requireOperator, rerunJob);
router.post('/job/:jobId/pause', verifyToken, requireOperator, pauseJob);
router.post('/job/:jobId/cancel', verifyToken, requireOperator, cancelJob);
router.post('/worker/restart', verifyToken, requireOperator, restartWorker);
router.get('/settings', verifyToken, getSettings);
router.post('/settings', verifyToken, requireOperator, saveSettings);
router.get('/metrics', verifyToken, getMetrics);

export default router;
