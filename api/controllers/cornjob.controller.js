import cron from "node-cron";
import { createCanvas } from "canvas";
import fs from "fs";
import { Chart, CategoryScale, LinearScale, TimeScale, LineController, LineElement, PointElement, Tooltip, Legend } from "chart.js";
import 'chartjs-adapter-date-fns';  // Import date adapter
import Log from "../models/log.model.js"; // Import your Log model

// Register the components
Chart.register(CategoryScale, LinearScale, TimeScale, LineController, LineElement, PointElement, Tooltip, Legend);

// DBSCAN Implementation (same as before)
const dbscan = (data, epsilon, minPoints) => {
  const clusters = [];
  const visited = new Set();
  const noise = [];

  const distance = (pointA, pointB) => Math.abs(pointA - pointB);

  const regionQuery = (pointIdx, points) => {
    const neighbors = [];
    points.forEach((p, idx) => {
      if (distance(p, points[pointIdx]) <= epsilon) {
        neighbors.push(idx);
      }
    });
    return neighbors;
  };

  const expandCluster = (pointIdx, neighbors, cluster, points, epsilon, minPoints) => {
    cluster.push(pointIdx);
    visited.add(pointIdx);

    for (let i = 0; i < neighbors.length; i++) {
      const neighborIdx = neighbors[i];

      if (!visited.has(neighborIdx)) {
        visited.add(neighborIdx);
        const newNeighbors = regionQuery(neighborIdx, points);
        if (newNeighbors.length >= minPoints) {
          neighbors = neighbors.concat(newNeighbors);
        }
      }

      const alreadyInCluster = clusters.some(c => c.includes(neighborIdx));
      if (!alreadyInCluster) {
        cluster.push(neighborIdx);
      }
    }
  };

  data.forEach((_, idx) => {
    if (visited.has(idx)) return;

    const neighbors = regionQuery(idx, data);
    if (neighbors.length < minPoints) {
      noise.push(idx);
    } else {
      const cluster = [];
      expandCluster(idx, neighbors, cluster, data, epsilon, minPoints);
      clusters.push(cluster);
    }
  });

  return { clusters, noise };
};

// Visualize Data and Save as PNG for each guid_device
const generateGraph = async (guid_device) => {
  try {
    // Fetch the latest 1000 HR data points from Logs collection filtered by guid_device
    const dataPoints = await Log.find({ guid_device }).sort({ timestamp: -1 }).limit(1000);

    if (dataPoints.length === 0) {
      console.log(`No data available for GUID Device: ${guid_device}`);
      return;
    }

    const hrValues = dataPoints.map(point => point.HR);
    const timestamps = dataPoints.map(point => new Date(point.timestamp));

    // Apply custom DBSCAN
    const epsilon = 5; // Example epsilon value
    const minPoints = 10; // Example minimum points value
    const { clusters, noise } = dbscan(hrValues, epsilon, minPoints);

    console.log(`Clusters for GUID Device ${guid_device}:`, clusters);
    console.log(`Noise for GUID Device ${guid_device}:`, noise);

    // Pair HR values with timestamps and then sort by timestamps
    const pairedData = hrValues.map((hr, index) => ({
      hr,
      timestamp: timestamps[index]
    }));
  
    // Sort the paired data by timestamp (to ensure the order is correct after processing)
    pairedData.sort((a, b) => a.timestamp - b.timestamp);
  
    // Extract the sorted HR and timestamps
    const sortedHrValues = pairedData.map(data => data.hr);
    const sortedTimestamps = pairedData.map(data => data.timestamp);

    // Assign cluster labels for the graph
    const clusterLabels = Array(sortedHrValues.length).fill(null); // Default null for noise
    clusters.forEach((cluster, idx) => {
      cluster.forEach(pointIdx => {
        clusterLabels[pointIdx] = `Cluster ${idx + 1}`; // Label clusters
      });
    });

    // Assign noise points
    noise.forEach(noiseIdx => {
      clusterLabels[noiseIdx] = 'Noise';
    });

    // Create a linear graph
    const canvas = createCanvas(800, 400);
    const ctx = canvas.getContext('2d');

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: sortedTimestamps,
        datasets: [
          {
            label: `Raw Heart Rate Data for GUID Device: ${guid_device}`,
            data: sortedHrValues,
            borderColor: 'rgba(75, 192, 192, 1)',
            fill: false
          },
          {
            label: 'DBSCAN Clustered Data',
            data: sortedHrValues.map((hr, i) => (clusterLabels[i] !== 'Noise' ? hr : null)), // Show HR for cluster points
            borderColor: 'rgba(255, 99, 132, 1)',
            pointBackgroundColor: clusterLabels.map(label => label === 'Noise' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 99, 132, 1)'),
            showLine: false,
            pointRadius: 5
          },
          {
            label: 'Noise Points',
            data: sortedHrValues.map((hr, i) => (clusterLabels[i] === 'Noise' ? hr : null)), // Show HR for noise points
            borderColor: 'rgba(0, 0, 0, 1)',
            pointBackgroundColor: 'rgba(0, 0, 0, 1)',
            showLine: false,
            pointRadius: 5
          }
        ]
      },
      options: {
        scales: {
          x: { 
            type: 'time', // Use the time scale
            time: { unit: 'minute' } 
          },
          y: { 
            beginAtZero: false 
          }
        }
      }
    });

    // Ensure the 'graphs' directory exists
    const dir = './graphs';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }

    // Save the chart as PNG
    const buffer = canvas.toBuffer('image/png');
    const filename = `./graphs/heart_rate_${guid_device}_${Date.now()}.png`;
    fs.writeFileSync(filename, buffer);
    console.log(`Graph saved successfully for GUID Device ${guid_device} as`, filename);

  } catch (error) {
    console.error(`Error generating graph for GUID Device ${guid_device}:`, error);
  }
};

// Schedule Cron Job to run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  console.log('Running cron job...');
  try {
    // Get unique guid_device values from the Log collection
    const uniqueGuidDevices = await Log.distinct('guid_device');
    
    // Generate a graph for each unique guid_device
    for (const guid_device of uniqueGuidDevices) {
      await generateGraph(guid_device);
    }
  } catch (error) {
    console.error('Error during cron job execution:', error);
  }
});

// For testing, you can call the function once when the script runs
// generateGraph("C0680226");
