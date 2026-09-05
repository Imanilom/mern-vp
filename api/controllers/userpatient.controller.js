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

    const confScores = segments.map(s => {
      const minfo = s.missing_data_info;
      if (typeof minfo?.confidence_score === 'number' && !isNaN(minfo.confidence_score)) {
        return minfo.confidence_score;
      }
      if (typeof minfo?.missing_ratio === 'number' && !isNaN(minfo.missing_ratio)) {
        return Math.max(0, Math.min(100, (1.0 - minfo.missing_ratio) * 100));
      }
      if (minfo?.expected_count && minfo?.received_count) {
        return Math.max(0, Math.min(100, (minfo.received_count / minfo.expected_count) * 100));
      }
      return 90.0;
    });

    const avgConfidence = confScores.length ? (confScores.reduce((a, b) => a + b, 0) / confScores.length) : 0.0;

    res.json({
      success: true,
      data: {
        avg_confidence_score: parseFloat(avgConfidence.toFixed(2)),
        quality_status: confScores.length === 0
          ? 'No Data Recorded'
          : avgConfidence < 80
          ? 'Warning Low Quality Data'
          : avgConfidence < 90
          ? 'Moderate Quality Data'
          : 'Good Quality Data',
        recent_windows: segments,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
