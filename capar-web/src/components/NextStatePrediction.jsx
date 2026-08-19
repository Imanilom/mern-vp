import React from "react";

const STATE_LABEL = {
  BASELINE_COMPATIBLE: "Baseline Compatible",
  DEVIATION_CANDIDATE: "Deviation Candidate",
  PERSISTENT_DEVIATION: "Persistent Deviation",
  RECOVERY_START: "Recovery Start",
  RECOVERED: "Recovered"
};

const STATE_COLOR = {
  BASELINE_COMPATIBLE: "#10b981",
  DEVIATION_CANDIDATE: "#f59e0b",
  PERSISTENT_DEVIATION: "#ef4444",
  RECOVERY_START: "#8b5cf6",
  RECOVERED: "#06b6d4"
};

export default function NextStatePrediction({
  predictedState = "BASELINE_COMPATIBLE",
  confidence = 0.91,
  horizonWindows = 3,
  windowMinutes = 5,
  probabilities = {}
}) {
  const horizonMinutes = horizonWindows * windowMinutes;
  const confPct = ((confidence || 0) * 100).toFixed(1);
  const color = STATE_COLOR[predictedState] || "#0d9488";

  return (
    <div className="card-panel" style={{ background: '#ffffff', borderRadius: 16, border: '1px solid var(--line)', padding: 20 }}>
      <div className="mini-label" style={{ marginBottom: 6, letterSpacing: '0.05em' }}>
        Markov Prediction Engine
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)', margin: '0 0 14px 0' }}>
        Next State Prediction
      </h3>

      <div style={{ background: 'var(--gray-soft)', borderRadius: 12, padding: 16, textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 4 }}>
          Predicted State (+{horizonWindows} windows)
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: color, marginBottom: 4 }}>
          {STATE_LABEL[predictedState] || predictedState}
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, color: color }}>
          {confPct}% <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray)' }}>confidence</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--gray)', marginTop: 6 }}>
          Horizon: +{horizonWindows} windows (~{horizonMinutes} menit kedepan)
        </div>
      </div>

      {/* Probabilities vector breakdown */}
      {probabilities && Object.keys(probabilities).length > 0 && (
        <div>
          <div className="mini-label" style={{ marginBottom: 8 }}>Probabilities Distribution</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Object.entries(probabilities).map(([stateKey, probVal]) => {
              const pct = (probVal * 100).toFixed(1);
              const barColor = STATE_COLOR[stateKey] || '#0d9488';
              const isTarget = stateKey === predictedState;

              return (
                <div key={stateKey} style={{ fontSize: 11 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontWeight: isTarget ? 700 : 500, color: isTarget ? 'var(--navy)' : 'var(--gray)' }}>
                      {STATE_LABEL[stateKey] || stateKey} {isTarget && '★'}
                    </span>
                    <span className="mono" style={{ fontWeight: 700, color: isTarget ? barColor : 'var(--gray)' }}>
                      {pct}%
                    </span>
                  </div>
                  <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        backgroundColor: barColor,
                        borderRadius: 3,
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
