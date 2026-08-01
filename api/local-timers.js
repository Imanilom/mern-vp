import cron from 'node-cron';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

// Kunci internal untuk autentikasi endpoint
const INTERNAL_KEY = process.env.INTERNAL_KEY || 'mern-vp-internal-systemd-2026';
const PORT = process.env.PORT || 3030;
const BASE_URL = `http://localhost:${PORT}/api/internal/run-pipeline`;

console.log('===================================================');
console.log('Memulai Local Timers (Pengganti systemd di Windows)');
console.log(`Target URL: ${BASE_URL}`);
console.log('===================================================');

// Layer 2: Setiap 3 menit
cron.schedule('*/3 * * * *', async () => {
    console.log(`\n[${new Date().toISOString()}] Triggering Layer 2 Pipeline...`);
    try {
        const response = await fetch(BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Key': INTERNAL_KEY
            },
            body: JSON.stringify({ layer: '2' })
        });
        const data = await response.json();
        console.log(`[Layer 2 Response]:`, data);
    } catch (error) {
        console.error(`[Layer 2 Error]:`, error.message);
    }
});

// Layer 3: Setiap 5 menit
cron.schedule('*/5 * * * *', async () => {
    console.log(`\n[${new Date().toISOString()}] Triggering Layer 3 Pipeline...`);
    try {
        const response = await fetch(BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Key': INTERNAL_KEY
            },
            body: JSON.stringify({ layer: '3' })
        });
        const data = await response.json();
        console.log(`[Layer 3 Response]:`, data);
    } catch (error) {
        console.error(`[Layer 3 Error]:`, error.message);
    }
});

console.log('Jadwal Timer yang aktif:');
console.log('- Layer 2: Setiap 3 menit');
console.log('- Layer 3: Setiap 5 menit');
console.log('\nBiarkan terminal ini terbuka untuk terus menjalankan timer.');
