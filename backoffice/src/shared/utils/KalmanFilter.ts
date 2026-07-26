/**
 * KalmanFilter.ts
 * 1D / 2D Kalman Filter algorithm for trajectory prediction and trend smoothing.
 */

export interface KalmanState {
  estimate: number;
  upperBound: number;
  lowerBound: number;
  kalmanGain: number;
}

export class KalmanFilter1D {
  private q: number; // Process noise variance
  private r: number; // Measurement noise variance
  private x: number; // Estimated state
  private p: number; // Estimation error covariance

  constructor(q = 0.05, r = 2.0, initialX = 75, initialP = 5) {
    this.q = q;
    this.r = r;
    this.x = initialX;
    this.p = initialP;
  }

  /**
   * Predicts and updates state with new measurement z
   */
  public step(z: number): KalmanState {
    // 1. Time Update (Prediction)
    const xPred = this.x;
    const pPred = this.p + this.q;

    // 2. Measurement Update (Correction)
    const k = pPred / (pPred + this.r);
    this.x = xPred + k * (z - xPred);
    this.p = (1 - k) * pPred;

    const stdDev = Math.sqrt(this.p);
    return {
      estimate: parseFloat(this.x.toFixed(1)),
      upperBound: parseFloat((this.x + 1.96 * stdDev).toFixed(1)),
      lowerBound: parseFloat((this.x - 1.96 * stdDev).toFixed(1)),
      kalmanGain: parseFloat(k.toFixed(3)),
    };
  }

  /**
   * Runs Kalman Filter batch over time series data points
   */
  public static processSeries(series: { time: string; value: number }[], q = 0.05, r = 2.0) {
    if (series.length === 0) return [];
    const filter = new KalmanFilter1D(q, r, series[0].value, 4);

    return series.map((item) => {
      const res = filter.step(item.value);
      return {
        ...item,
        kalmanEstimate: res.estimate,
        upperBound: res.upperBound,
        lowerBound: res.lowerBound,
      };
    });
  }
}
