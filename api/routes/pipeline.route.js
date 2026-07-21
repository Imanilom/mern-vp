import express from 'express';
import { verifyToken } from '../utils/verifyUser.js';
import {
  getPipelineStatus,
  purgeQueue,
  getQueueMessages,
  pauseQueue,
  getRabbitMQNodes,
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

export default router;
