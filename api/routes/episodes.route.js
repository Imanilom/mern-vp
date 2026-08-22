import express from 'express';
import { verifyToken } from '../utils/verifyUser.js';
import {
  getEpisodeDetail,
  getEpisodeTrajectory,
  getEpisodeContext,
  getEpisodeAudit,
  reviewEpisode
} from '../controllers/episodes.controller.js';

const router = express.Router();

router.get('/:episodeId', getEpisodeDetail);
router.get('/:episodeId/trajectory', getEpisodeTrajectory);
router.get('/:episodeId/context', getEpisodeContext);
router.get('/:episodeId/audit', getEpisodeAudit);
router.post('/:episodeId/review', verifyToken, reviewEpisode);

export default router;
