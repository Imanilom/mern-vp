import React from 'react';

export const ActivityMetricsTable = ({ activityMetrics }) => {
  if (!activityMetrics || Object.keys(activityMetrics).length === 0) {
    return <p>No activity metrics data available</p>;
  }

  return (
    <div>
      <h3>Activity Metrics</h3>
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
          {Object.entries(activityMetrics).map(([activity, data], index) => (
            <tr key={index}>
              <td>{activity}</td>
              <td>{data.timestamps.start || 'N/A'}</td>
              <td>{data.timestamps.end || 'N/A'}</td>
              <td>{JSON.stringify(data.metrics) || 'No metrics available'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
