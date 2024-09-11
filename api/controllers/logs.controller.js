import Log from '../models/log.model.js';

// Metode untuk memeriksa dan mengisi log
export const checkAndFillLogs = async () => {
    try {
        console.log('Checking and filling logs...');
        
        // Mencari semua log yang belum diperiksa dengan batasan 100000
        const logs = await Log.find({ isChecked: false });
        console.log(`Logs found: ${logs.length}`); // Log tambahan untuk debugging

        // Jika tidak ada log yang ditemukan, kembalikan pesan dan status 404
        if (!logs.length) {
            console.log('No logs found to check and fill.');
            return { message: 'No logs found to check and fill.', status: 404 };
        }

        console.log(`Found ${logs.length} logs to check and fill.`);

        // Mencari log yang memiliki HR dan RR dengan batasan 100000
        const logsWithHRAndRR = await Log.find({ HR: { $ne: null }, RR: { $ne: null } }).sort({ create_at: 1 });
        console.log(`Logs with HR and RR found: ${logsWithHRAndRR.length}`); // Log tambahan untuk debugging

        // Memproses setiap log dan memperbarui flag isChecked
        for (const log of logs) {
            let isUpdated = false; // Flag untuk menandai apakah log diupdate

            if (log.RR === null || log.RR === undefined) {
                // Mencari nilai RR terdekat dari log dengan HR dan RR
                let nearestRRValue = null;
                for (let i = 1; i < logsWithHRAndRR.length; i++) {
                    const prevIndex = logsWithHRAndRR.findIndex(l => l._id.equals(log._id)) - i;
                    const nextIndex = logsWithHRAndRR.findIndex(l => l._id.equals(log._id)) + i;

                    if (prevIndex >= 0 && logsWithHRAndRR[prevIndex].RR !== null) {
                        nearestRRValue = logsWithHRAndRR[prevIndex].RR;
                        break;
                    }
                    if (nextIndex < logsWithHRAndRR.length && logsWithHRAndRR[nextIndex].RR !== null) {
                        nearestRRValue = logsWithHRAndRR[nextIndex].RR;
                        break;
                    }
                }

                if (nearestRRValue !== null) {
                    log.RR = nearestRRValue;
                    log.rrRMS = 0;
                    isUpdated = true; // Menandai bahwa log diupdate
                }
            }

            if (isUpdated) {
                log.isChecked = true; // Menandai log sebagai diperiksa hanya jika diupdate
                await log.save(); // Menyimpan perubahan pada database
                console.log(`Log with ID ${log._id} has been marked as checked and updated.`);
            } else {
                console.log(`Log with ID ${log._id} was not updated.`);
            }
        }

        // Mengembalikan pesan sukses dan log yang ditemukan
        return { message: 'Logs checked and filled successfully.', logs, status: 200 };
    } catch (error) {
        console.error('Error checking and filling logs:', error);
        return { message: 'Internal server error.', status: 500 };
    }
};

// Metode baru untuk menjalankan semua metode
export const runAllMethods = async (req, res) => {
    try {
        console.log('Running fill and check logs...');

        // Memanggil metode checkAndFillLogs
        const checkAndFillLogsResult = await checkAndFillLogs();

        // Jika res ada, kembalikan hasil sebagai respons JSON
        if (res) {
            return res.status(200).json({ message: 'fill and check logs successfully.', result: checkAndFillLogsResult });
        } else {
            console.log('fill and check logs successfully.', checkAndFillLogsResult);
        }
    } catch (error) {
        console.error('Error running fill and check logs:', error);
        // Jika res ada, kembalikan pesan kesalahan sebagai respons JSON
        if (res) {
            return res.status(500).json({ message: 'Internal server error.' });
        } else {
            throw error;
        }
    }
};