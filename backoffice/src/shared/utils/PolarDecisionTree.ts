/**
 * PolarDecisionTree.ts
 * Pre-trained Decision Tree classifier for Polar sensor raw data streams & window features.
 */

export interface PolarFeatures {
  mean_hr: number;
  sdnn?: number;
  rmssd?: number;
  motion_intensity?: number;
  dfa_alpha1?: number;
  missing_ratio?: number;
}

export interface DTPredictionResult {
  predictedActivity: 'Rest' | 'Light' | 'Moderate' | 'Intense';
  signalType: 'Normal' | 'Anomaly' | 'Artifact';
  confidence: number; // 0.0 - 1.0
  reasoning: string;
}

export class PolarDecisionTree {
  /**
   * Evaluates feature window and predicts activity context + signal quality.
   */
  public static predict(features: PolarFeatures): DTPredictionResult {
    const hr = features.mean_hr || 75;
    const rmssd = features.rmssd ?? 40;
    const motion = features.motion_intensity ?? 0.2;
    const missingRatio = features.missing_ratio ?? 0.005;

    // Node 1: Check for Sensor Artifact (noise / contact loss / dropouts)
    if (missingRatio > 0.20 || (hr > 180 && motion < 0.3) || (rmssd < 3 && hr > 150)) {
      return {
        predictedActivity: 'Rest',
        signalType: 'Artifact',
        confidence: 0.95,
        reasoning: 'Unrealistic sensor spike or signal dropout detected (Contact loss / Noise).',
      };
    }

    // Node 2: Check for Physiological Anomaly
    if ((hr > 105 && motion < 0.25) || (rmssd < 15 && hr > 100 && motion < 0.3)) {
      return {
        predictedActivity: 'Rest',
        signalType: 'Anomaly',
        confidence: 0.91,
        reasoning: 'Elevated HR and low HRV during rest indicates physiological anomaly.',
      };
    }

    // Node 3: Activity Context Decision Tree Classification
    if (motion < 0.3) {
      if (hr < 80) {
        return {
          predictedActivity: 'Rest',
          signalType: 'Normal',
          confidence: 0.96,
          reasoning: 'Low motion and baseline HR (Resting state).',
        };
      } else {
        return {
          predictedActivity: 'Light',
          signalType: 'Normal',
          confidence: 0.88,
          reasoning: 'Low motion with slightly elevated HR (Light cognitive/sedentary effort).',
        };
      }
    } else if (motion >= 0.3 && motion < 0.7) {
      if (hr < 100) {
        return {
          predictedActivity: 'Light',
          signalType: 'Normal',
          confidence: 0.94,
          reasoning: 'Moderate motion with low/medium HR (Light activity).',
        };
      } else {
        return {
          predictedActivity: 'Moderate',
          signalType: 'Normal',
          confidence: 0.90,
          reasoning: 'Moderate motion with elevated HR (Brisk walking / chores).',
        };
      }
    } else {
      // High motion >= 0.7
      if (hr > 120) {
        return {
          predictedActivity: 'Intense',
          signalType: 'Normal',
          confidence: 0.97,
          reasoning: 'High motion and high HR (Vigorous exercise / workout).',
        };
      } else {
        return {
          predictedActivity: 'Moderate',
          signalType: 'Normal',
          confidence: 0.89,
          reasoning: 'High motion with moderate HR (Moderate physical effort).',
        };
      }
    }
  }
}
