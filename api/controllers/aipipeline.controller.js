import ActivityContext from '../models/activitycontext.model.js';
import Segment from '../models/segment.model.js';
import mongoose from 'mongoose';

// 1. Missing Data Analyzer (Confidence formula: 1 - missing / expected)
export const analyzeMissingData = async (req, res) => {
  try {
    const { expected_sample = 1000, missing_sample = 5 } = req.body;
    const missing_rate = missing_sample / expected_sample;
    const confidence = parseFloat(((1 - missing_rate) * 100).toFixed(2));
    const warning = confidence < 90.0 ? 'Warning Low Quality Data' : null;

    res.json({
      success: true,
      data: {
        expected_sample,
        missing_sample,
        received_sample: expected_sample - missing_sample,
        missing_rate: parseFloat(missing_rate.toFixed(4)),
        confidence_score: confidence,
        warning_status: warning,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 2. Artifact Detection
export const detectArtifact = async (req, res) => {
  try {
    const { hr, rmssd, motion_intensity, missing_ratio } = req.body;
    const isArtifact = (missing_ratio > 0.20) || (hr > 180 && motion_intensity < 0.3) || (rmssd < 3 && hr > 150);

    res.json({
      success: true,
      data: {
        is_artifact: isArtifact,
        artifact_type: isArtifact ? (missing_ratio > 0.20 ? 'dropout' : 'contact_loss_noise') : null,
        confidence: isArtifact ? 0.95 : 0.05,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 3. Anomaly Detection
export const detectAnomaly = async (req, res) => {
  try {
    const { hr, rmssd, motion_intensity } = req.body;
    const isAnomaly = (hr > 105 && motion_intensity < 0.25) || (rmssd < 15 && hr > 100 && motion_intensity < 0.3);

    res.json({
      success: true,
      data: {
        is_anomaly: isAnomaly,
        anomaly_type: isAnomaly ? (hr > 100 ? 'Tachycardia' : 'Abnormal_HRV') : null,
        confidence: isAnomaly ? 0.92 : 0.08,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 4. Kalman Filter Signal Processing
export const processKalmanFilter = async (req, res) => {
  try {
    const { series = [], q = 0.05, r = 2.0 } = req.body;
    let x = series.length ? series[0] : 75;
    let p = 5.0;

    const filteredSeries = series.map((z) => {
      const x_pred = x;
      const p_pred = p + q;
      const k = p_pred / (p_pred + r);
      x = x_pred + k * (z - x_pred);
      p = (1 - k) * p_pred;

      const stdDev = Math.sqrt(p);
      return {
        measured: z,
        clean_kalman: parseFloat(x.toFixed(1)),
        upper_bound: parseFloat((x + 1.96 * stdDev).toFixed(1)),
        lower_bound: parseFloat((x - 1.96 * stdDev).toFixed(1)),
      };
    });

    res.json({ success: true, count: filteredSeries.length, data: filteredSeries });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 5. Post Activity Context
export const createActivityContext = async (req, res) => {
  try {
    const { user_id, start_time, end_time, activity } = req.body;

    const newContext = await ActivityContext.create({
      user_id,
      start_time: start_time || Date.now() - 300000,
      end_time: end_time || Date.now(),
      activity: activity || { posture: 'Sitting', movement: 'Low', location: 'Home', time_of_day: 'Morning', stress_level: 'Low' }
    });

    res.status(201).json({ success: true, data: newContext });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 6. Get Activity Context per user
export const getActivityContextByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      // If it's a dummy or invalid ID, just return empty data
      return res.json({ success: true, count: 0, data: [] });
    }
    const objectId = new mongoose.Types.ObjectId(userId);

    const contexts = await ActivityContext.find({ user_id: objectId })
      .sort({ start_time: -1 })
      .limit(30);

    res.json({ success: true, count: contexts.length, data: contexts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 7. General Prediction Endpoint
export const predictHealthRisk = async (req, res) => {
  try {
    const { features, activity_context } = req.body;
    const hr = features?.mean_hr || 75;
    const motion = features?.motion_intensity || 0.2;

    let riskLevel = 'Low';
    if (hr > 120 && motion < 0.3) riskLevel = 'High';
    else if (hr > 100) riskLevel = 'Moderate';

    res.json({
      success: true,
      data: {
        risk_level: riskLevel,
        predicted_at: new Date(),
        features_used: features,
        context: activity_context,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
