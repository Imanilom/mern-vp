import turf from '@turf/clusters-dbscan';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import fs from 'fs';
import cron from 'node-cron';

import Log from '../models/log.model.js';

async function DBSCANLogRR() {
    try {
        const timeEnd = Math.floor(Date.now() / 1000);
        const timeStart = timeEnd - 3600; // 1 jam yang lalu
   
        const logs = await Log.find({
            timestamp: {
                $gte: timeStart,
                $lte: timeEnd
            }
        }, { RR: 1, date_created: 1, time_created: 1 });

        if(logs.length == 0){
            console.log('Logs hourly is empty. create graph canceled.');
            return;
        }

        const dateWithTime = `${logs[0]['date_created']}${logs[0]['time_created']}`;
        const filteredLogs = logs.map((log) => log.RR);

        const points = filteredLogs.map((rr, i) => ({
            type: 'Feature',
            properties: { rrValue: rr },
            geometry: {
                type: "Point",
                coordinates: [i, rr]
            }
        }));

        const geojsonData = {
            type: "FeatureCollection",
            features: points
        }

        const R = 3; // ubah radius
        const MinPoint = 6; // ubah minim point to create cluster

        const clustered = turf(geojsonData, R, { minPoints: MinPoint });
        // Pisahkan data berdasarkan cluster
        const clusters = {};

        clustered.features.forEach((feature, i) => {
            const cluster_id = feature.properties.rrValue;
            // console.log({ cluster_id, i })
            if (cluster_id !== undefined) {
                if (!clusters[cluster_id]) clusters[cluster_id] = [];
                clusters[cluster_id].push(feature.geometry.coordinates);
            }
        })

        let filename = String(`graphHRPoint${dateWithTime}`).replace(':', '').replace(':', '').replace('-', '').replace('-', '');
        await DrawNodeCanvasDBSCAN(clusters, filename);
    } catch (error) {
        console.log({ error });
    }
}


async function DrawNodeCanvasDBSCAN(clusters, namefile) {
    try {

        const width = 1280;
        const height = 720;

        const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, backgroundColour: 'white' });

        const dataPoint = Object.keys(clusters).map((cluster_id, i) =>
        ({
            label: `Cluster ${cluster_id}`,
            data: clusters[cluster_id].map(([x, y]) => ({ x, y })),
            backgroundColor: `rgba(${Math.random()*255}, ${Math.random()*255}, ${Math.random()*255}, 1)`
        }));

        const configuration = {
            // type: 'scatter',
            type: 'bar',
            data: { datasets: dataPoint },
            options: {
                scales: {
                    x: { type: 'linear', position: 'bottom' },
                    y: { type: 'linear', position: 'left' }
                },
                elements: {
                    bar: {
                        barThickness: 10, // Mengatur ketebalan batang secara eksplisit
                        maxBarThickness: 15, // Ketebalan maksimum batang
                    }
                }
            }
        }

        const buffer = await chartJSNodeCanvas.renderToBuffer(configuration);
        fs.writeFileSync(`./dbscan_photo/${namefile}.png`, buffer);
        console.log(`Grafik disimpan sebagai ${namefile}.png`);
    }

    catch (error) {
        console.log({ error })
    }
}


// Start every hour
cron.schedule('0 */1 * * *', () => {
    DBSCANLogRR();
});

