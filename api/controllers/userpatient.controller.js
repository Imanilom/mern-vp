import Segment from '../models/segment.model.js';
import DataTransformation from '../models/datatransformation.model.js';
import User from '../models/user.model.js';

export const getUserLive = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const latestTransform = await DataTransformation.find({ user_id: userId })
      .sort({ timestamp: -1 })
      .limit(10);

    const latestSegment = await Segment.findOne({ user_id: userId, is_valid: true })
      .sort({ window_start: -1 });

    res.json({
      success: true,
      data: {
        latest_segment: latestSegment,
        live_stream: latestTransform,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getUserHistory = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const limit = parseInt(req.query.limit) || 30;
    const history = await Segment.find({ user_id: userId, is_valid: true })
      .sort({ window_start: -1 })
      .limit(limit);

    res.json({ success: true, count: history.length, data: history });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getUserPredictions = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const predictions = await Segment.find({ user_id: userId, analyzed: true })
      .select('window_start window_end anomaly_score classification dt_prediction signal_quality activity_label')
      .sort({ window_start: -1 })
      .limit(30);

    res.json({ success: true, count: predictions.length, data: predictions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getUserConfidence = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const segments = await Segment.find({ user_id: userId, is_valid: true })
      .select('window_start missing_data_info')
      .sort({ window_start: -1 })
      .limit(30);

    const confScores = segments.map(s => s.missing_data_info?.confidence_score || 99.5);
    const avgConfidence = confScores.length ? (confScores.reduce((a, b) => a + b, 0) / confScores.length) : 99.5;

    res.json({
      success: true,
      data: {
        avg_confidence_score: parseFloat(avgConfidence.toFixed(2)),
        quality_status: avgConfidence < 90 ? 'Warning Low Quality Data' : 'Good Quality Data',
        recent_windows: segments,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
