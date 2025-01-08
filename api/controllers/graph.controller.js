import { createCanvas } from "canvas";
import fs from "fs";
import { Chart, CategoryScale, LinearScale, TimeScale, LineController, LineElement, PointElement, Tooltip, Legend } from "chart.js";
import 'chartjs-adapter-date-fns';
import Log from "../models/log.model.js";
import { dbscan } from "./metrics.controller.js"; // Import the dbscan function if needed

// Register the components
Chart.register(CategoryScale, LinearScale, TimeScale, LineController, LineElement, PointElement, Tooltip, Legend);

// Function to generate graph and save as PNG
export const generateGraph = async (guid_device) => {
  try {
    const dataPoints = await Log.find({ guid_device }).sort({ create_at: -1 }).limit(1000);
    if (dataPoints.length === 0) {
      console.log(`No data available for GUID Device: ${guid_device}`);
      return;
    }

    const hrValues = dataPoints.map(point => point.HR);
    const timestamps = dataPoints.map(point => new Date(point.create_at));

    const epsilon = 2.5;
    const minPoints = 4;
    const { clusters, noise } = dbscan(hrValues, epsilon, minPoints);

    const pairedData = hrValues.map((hr, index) => ({
      hr,
      timestamp: timestamps[index]
    }));

    pairedData.sort((a, b) => a.timestamp - b.timestamp);

    const sortedHrValues = pairedData.map(data => data.hr);
    const sortedTimestamps = pairedData.map(data => data.timestamp);

    const canvas = createCanvas(800, 400);
    const ctx = canvas.getContext('2d');

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: sortedTimestamps,
        datasets: [{
          label: `Heart Rate Data for GUID Device: ${guid_device}`,
          data: sortedHrValues,
          borderColor: 'rgba(75, 192, 192, 1)',
          fill: false
        }]
      },
      options: {
        scales: {
          x: { type: 'time', time: { unit: 'minute' } },
          y: { beginAtZero: false }
        }
      }
    });

    const dir = './graphs';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);

    const buffer = canvas.toBuffer('image/png');
    const filename = `./graphs/heart_rate_${guid}_${Date.now()}.png`;
    fs.writeFileSync(filename, buffer);
    console.log(`Graph saved successfully for GUID Device ${guid} as`, filename);

  } catch (error) {
    console.error(`Error generating graph for GUID Device ${guid}:`, error);
  }
};

const generateGraphForFolder = async (folderName) => {
  try {
    const dirPath = `./${folderName}`;
    const files = fs.readdirSync(dirPath);
    
    // Mengumpulkan data dari semua file JSON di folder
    let allData = [];
    for (const file of files) {
      const filePath = `${dirPath}/${file}`;
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (data.filteredLogs) {
        allData = allData.concat(data.filteredLogs);
      }
    }

    // Mengurutkan data berdasarkan timestamp
    allData.sort((a, b) => a.timestamp - b.timestamp);
    const sortedRrValues = allData.map(data => data.RR);
    const sortedHrValues = allData.map(data => data.HR);
    const sortedTimestamps = allData.map(data => {
      const date = new Date(data.timestamp * 1000); // Konversi ke objek Date
      return date.toISOString().replace('T', ' ').substring(0, 19); // Format yyyy-mm-dd hh:mm:ss
    });

    // Membuat canvas untuk grafik
    const canvas = createCanvas(800, 400);
    const ctx = canvas.getContext('2d');

    // Membuat grafik menggunakan Chart.js
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: sortedTimestamps,
        datasets: [
          {
            label: 'Heart Rate (HR)',
            data: sortedHrValues,
            borderColor: 'rgba(75, 192, 192, 1)',
            fill: false,
          },
          {
            label: 'Respiratory Rate (RR)',
            data: sortedRrValues,
            borderColor: 'rgba(255, 99, 132, 1)',
            fill: false,
          }
        ]
      },
      options: {
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'minute' // Atur unit waktu di sumbu X
            }
          },
          y: {
            beginAtZero: false
          }
        }
      }
    });

    // Menyimpan grafik ke folder yang sesuai
    const outputDir = `./graphs/${folderName}`;
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const buffer = canvas.toBuffer('image/png');
    const filename = `${outputDir}/heart_rate_rr_${folderName}_${Date.now()}.png`;
    fs.writeFileSync(filename, buffer);
    console.log(`Graph saved successfully in ${folderName} as`, filename);

  } catch (error) {
    console.error(`Error generating graph in ${folderName}:`, error);
  }
};

// Fungsi utama untuk memanggil generateGraphForFolder untuk semua folder
export const generateGraphsForAllFolders = async () => {
  const folders = ['controllers/hrv-results-IQ', 'controllers/hrv-results-BC', 'controllers/hrv-results-OC']; // Ganti dengan nama folder sesuai kebutuhan
  for (const folder of folders) {
    await generateGraphForFolder(folder);
  }
};