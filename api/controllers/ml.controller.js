import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Segment from '../models/segment.model.js';
import User from '../models/user.model.js';
import pkg from 'ml-cart';
const { DecisionTree } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MODEL_PATH = path.join(__dirname, '../models/dt_model.json');

// --- Global In-Memory Model ---
let currentTree = null;

// Helper to load model if it exists
function loadModel() {
  if (currentTree) return true;
  if (fs.existsSync(MODEL_PATH)) {
    try {
      const data = fs.readFileSync(MODEL_PATH, 'utf-8');
      currentTree = DecisionTree.load(JSON.parse(data));
      return true;
    } catch (err) {
      console.error('Error loading Decision Tree:', err.message);
    }
  }
  return false;
}

// Ensure model is loaded on startup
loadModel();

/**
 * Endpoint to train the Decision Tree based on historic Segment data.
 * POST /api/ml/train
 */
export const trainDecisionTree = async (req, res) => {
  try {
    // 1. Fetch training data from Segment
    // We only use segments that have a valid activity_label and are fully processed
    const segments = await Segment.find({ 
      is_valid: true,
      activity_label: { $nin: [null, '', 'Lainnya'] } // Ignore undefined or 'Lainnya'
    }).populate('user_id', 'age gender weight height');

    if (segments.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid training data found.' });
    }

    const X = [];
    const y = []; // Target: Activity

    for (const seg of segments) {
      const user = seg.user_id || {};
      const hr = seg.features?.hr_mean || 75;
      const rmssd = seg.features?.rmssd || 30;
      const acc = seg.features?.motion_intensity || 0;
      const age = user.age || 30;
      const gender = user.gender === 'female' ? 1 : (user.gender === 'male' ? 0 : 0.5);
      const bmi = (user.weight && user.height) ? (user.weight / ((user.height/100)**2)) : 22;

      // X: [HR, RMSSD, ACC, Age, Gender, BMI]
      X.push([hr, rmssd, acc, age, gender, bmi]);
      y.push(seg.activity_label);
    }

    // 2. Train the model using ml-cart
    // config: minNumSamples, maxDepth, etc.
    const options = {
      gainFunction: 'gini',
      maxDepth: 10,
      minNumSamples: 3
    };
    
    const tree = new DecisionTree(options);
    tree.train(X, y);

    // 3. Save model to disk
    const modelJson = tree.toJSON();
    fs.writeFileSync(MODEL_PATH, JSON.stringify(modelJson));

    // 4. Update in-memory model
    currentTree = tree;

    res.json({
      success: true,
      message: 'Decision Tree trained successfully',
      samples_used: X.length,
      // We can also calculate training accuracy here if needed
    });
  } catch (error) {
    console.error('DT Train Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Helper function to predict Activity & Anomaly for a single Segment.
 * Used internally by data.controller.js
 */
export const predictSegment = (features, user) => {
  if (!loadModel()) {
    return { activity: null, anomalyScore: 0 };
  }

  try {
    const hr = features.hr_mean || 75;
    const rmssd = features.rmssd || 30;
    const acc = features.motion_intensity || 0;
    const age = user?.age || 30;
    const gender = user?.gender === 'female' ? 1 : (user?.gender === 'male' ? 0 : 0.5);
    const bmi = (user?.weight && user?.height) ? (user.weight / ((user.height/100)**2)) : 22;

    const x = [hr, rmssd, acc, age, gender, bmi];
    
    // Predict Activity
    const predActivity = currentTree.predict([x])[0];

    // Predict Fatigue/Anomaly level (heuristics based on Tree + HR/RMSSD ratio)
    // ml-cart classification tree doesn't inherently predict a secondary "anomaly" target unless trained on it.
    // For fatigue/anomaly, we use a hybrid approach:
    const hr_rmssd_ratio = rmssd > 0 ? (hr / rmssd) : 1;
    let anomalyScore = 0;
    if (hr_rmssd_ratio > 4.0 && predActivity === 'Tidur') {
      anomalyScore = 80; // High HR during sleep = anomaly
    } else if (hr_rmssd_ratio > 3.0 && predActivity === 'Duduk') {
      anomalyScore = 60; // Elevated stress while sitting
    } else if (hr_rmssd_ratio < 1.0) {
      anomalyScore = 20; // Very relaxed
    }

    return {
      activity: predActivity,
      anomalyScore
    };
  } catch (err) {
    console.error('Prediction error:', err.message);
    return { activity: null, anomalyScore: 0 };
  }
};
