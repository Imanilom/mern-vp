import React from 'react';

export const MetricsTable = ({ dailyMetrics, activityMetrics }) => {
  const renderDailyMetricsTable = () => {
    return dailyMetrics.map((dailyMetric, index) => {
      const { date, adfa, dfa, hf, lf, lfHfRatio, max, mean, median3dp, min, mseAndRmse, rmssd, s1, s2, sdnn } = dailyMetric;
      return (
        <table key={index} className="table table-bordered">
          <thead>
            <tr>
              <th>Date</th>
              <th>ADFA</th>
              <th>DFA</th>
              <th>HF</th>
              <th>LF</th>
              <th>LF/HF Ratio</th>
              <th>Max</th>
              <th>Mean</th>
              <th>Median 3DP</th>
              <th>Min</th>
              <th>MSE & RMSE</th>
              <th>RMSSD</th>
              <th>S1</th>
              <th>S2</th>
              <th>SDNN</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{date}</td>
              <td>{adfa.alphaPlus} / {adfa.alphaMinus}</td>
              <td>{dfa.alpha1} / {dfa.alpha2}</td>
              <td>{hf}</td>
              <td>{lf}</td>
              <td>{lfHfRatio}</td>
              <td>{max}</td>
              <td>{mean}</td>
              <td>{median3dp}</td>
              <td>{min}</td>
              <td>{`MSE: ${mseAndRmse.mse}, RMSE: ${mseAndRmse.rmse}`}</td>
              <td>{rmssd}</td>
              <td>{s1}</td>
              <td>{s2}</td>
              <td>{sdnn}</td>
            </tr>
          </tbody>
        </table>
      );
    });
  };

  const renderActivityMetricsTable = () => {
    return (
      <table className="table table-bordered">
        <thead>
          <tr>
            <th>Activity</th>
            <th>Start Time</th>
            <th>End Time</th>
            <th>Metrics</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(activityMetrics).map(([activity, { metrics, timestamps }]) => (
            <tr key={activity}>
              <td>{activity}</td>
              <td>{timestamps.start}</td>
              <td>{timestamps.end}</td>
              <td>{metrics ? JSON.stringify(metrics) : 'No metrics available'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div>
      <h3>Daily Metrics</h3>
      {dailyMetrics.length > 0 ? renderDailyMetricsTable() : <p>No daily metrics data available</p>}
      <h3>Activity Metrics</h3>
      {Object.keys(activityMetrics).length > 0 ? renderActivityMetricsTable() : <p>No activity metrics data available</p>}
    </div>
  );
};
