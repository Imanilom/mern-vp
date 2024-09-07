import Log from '../models/log.model.js';

// Metode untuk memeriksa log dengan HR tetapi tidak ada RR
export const checkLogsWithHRNoRR = async () => {
    try {
        console.log('Checking logs with HR but no RR...');
        const logsWithHRNoRR = await Log.find({ HR: { $ne: null }, RR: null }).sort({ create_at: 1 });

        if (!logsWithHRNoRR.length) {
            console.log('No logs found with HR but no RR.');
            return { message: 'No logs found with HR but no RR.', status: 404 };
        }

        console.log(`Found ${logsWithHRNoRR.length} logs with HR but no RR.`);
        return { message: 'Logs with HR but no RR found successfully.', logs: logsWithHRNoRR, status: 200 };
    } catch (error) {
        console.error('Error checking logs with HR but no RR:', error);
        return { message: 'Internal server error.', status: 500 };
    }
};

// Metode untuk memeriksa log dengan HR dan RR
export const checkLogsWithHRAndRR = async () => {
    try {
        console.log('Checking logs with both HR and RR...');
        const logsWithHRAndRR = await Log.find({ HR: { $ne: null }, RR: { $ne: null } }).sort({ create_at: 1 });

        if (!logsWithHRAndRR.length) {
            console.log('No logs found with both HR and RR.');
            return { message: 'No logs found with both HR and RR.', status: 404 };
        }

        console.log(`Found ${logsWithHRAndRR.length} logs with both HR and RR.`);
        return { message: 'Logs with both HR and RR found successfully.', logs: logsWithHRAndRR, status: 200 };
    } catch (error) {
        console.error('Error checking logs with both HR and RR:', error);
        return { message: 'Internal server error.', status: 500 };
    }
};

// Metode untuk mengisi nilai RR yang hilang untuk log dengan HR tetapi tidak ada RR
export const fillMissingRRForLogsWithHR = async () => {
    try {
        console.log('Starting to fill missing RR and rrRMS values for logs with HR but no RR...');
        const logsWithHRNoRR = await Log.find({ HR: { $ne: null }, RR: null }).sort({ create_at: 1 });
        const logsWithHRAndRR = await Log.find({ HR: { $ne: null }, RR: { $ne: null } }).sort({ create_at: 1 });

        if (!logsWithHRNoRR.length) {
            console.log('No logs found with HR but no RR.');
            return { message: 'No logs found with HR but no RR.', status: 404 };
        }

        console.log(`Found ${logsWithHRNoRR.length} logs with HR but no RR.`);
        console.log(`Found ${logsWithHRAndRR.length} logs with both HR and RR.`);

        let totalUpdated = 0;
        let totalFailed = 0;
        let logsWithHRNoRRIds = [];

        const bulkOps = logsWithHRNoRR.map((log, index) => {
            logsWithHRNoRRIds.push(log._id); // Mencatat ID log dengan HR tetapi tidak ada RR
            let nearestRRValue = null;
            let sourceLogId = null;

            for (let i = 1; i < logsWithHRAndRR.length; i++) {
                const prevIndex = index - i;
                const nextIndex = index + i;

                if (prevIndex >= 0 && logsWithHRAndRR[prevIndex].RR !== null) {
                    nearestRRValue = logsWithHRAndRR[prevIndex].RR;
                    sourceLogId = logsWithHRAndRR[prevIndex]._id;
                    break;
                }
                if (nextIndex < logsWithHRAndRR.length && logsWithHRAndRR[nextIndex].RR !== null) {
                    nearestRRValue = logsWithHRAndRR[nextIndex].RR;
                    sourceLogId = logsWithHRAndRR[nextIndex]._id;
                    break;
                }
            }

            if (nearestRRValue !== null) {
                // Membuat objek baru dengan RR dan rrRMS ditempatkan setelah HR
                const updatedLog = {
                    ...log.toObject(),
                    RR: nearestRRValue,
                    rrRMS: 0 
                };
                delete updatedLog._id;

                console.log(`Filled missing RR for log at index ${index} (ID: ${log._id}) with value ${nearestRRValue} from log ID: ${sourceLogId}.`);
                console.log(`Set rrRMS to 0 for log at index ${index} (ID: ${log._id}).`);
                return {
                    updateOne: {
                        filter: { _id: log._id },
                        update: { $set: updatedLog }
                    }
                };
            }
            return null;
        }).filter(op => op !== null);

        if (bulkOps.length > 0) {
            const bulkWriteResult = await Log.bulkWrite(bulkOps);
            totalUpdated = bulkWriteResult.modifiedCount;
            totalFailed = bulkOps.length - totalUpdated;
        }

        // Memeriksa kembali log dengan HR tetapi tidak ada RR
        const remainingLogsWithHRNoRR = await Log.find({ HR: { $ne: null }, RR: null }).sort({ create_at: 1 });
        const remainingCount = remainingLogsWithHRNoRR.length;

        console.log(`RR and rrRMS values filled successfully. Total updated: ${totalUpdated}, Total failed: ${totalFailed}, Remaining logs with HR but no RR: ${remainingCount}`);
        return { 
            message: 'RR and rrRMS values filled successfully.', 
            totalUpdated, 
            totalFailed, 
            logsWithHRNoRRIds, 
            remainingCount,
            status: 200 
        };
    } catch (error) {
        console.error('Error filling missing RR and rrRMS values:', error);
        return { message: 'Internal server error.', status: 500 };
    }
};

// Metode untuk menjalankan semua pemeriksaan dan mengisi nilai RR yang hilang
export const runAllChecksAndFill = async () => {
    try {
        console.log('Running all checks and filling missing RR values...');

        // Memeriksa log dengan HR tetapi tidak ada RR
        const logsWithHRNoRR = await Log.find({ HR: { $ne: null }, RR: null }).sort({ create_at: 1 });
        console.log(`Found ${logsWithHRNoRR.length} logs with HR but no RR.`);

        // Memeriksa log dengan HR dan RR
        const logsWithHRAndRR = await Log.find({ HR: { $ne: null }, RR: { $ne: null } }).sort({ create_at: 1 });
        console.log(`Found ${logsWithHRAndRR.length} logs with both HR and RR.`);

        let totalUpdated = 0;
        let totalFailed = 0;
        let logsWithHRNoRRIds = [];

        // Mengisi nilai RR yang hilang untuk log dengan HR tetapi tidak ada RR
        const bulkOps = logsWithHRNoRR.map((log, index) => {
            logsWithHRNoRRIds.push(log._id); // Mencatat ID log dengan HR tetapi tidak ada RR
            let nearestRRValue = null;

            for (let i = 1; i < logsWithHRAndRR.length; i++) {
                const prevIndex = index - i;
                const nextIndex = index + i;

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
                // Membuat objek baru dengan RR ditempatkan setelah HR
                const updatedLog = {
                    ...log.toObject(),
                    RR: nearestRRValue
                };
                delete updatedLog._id; // Menghapus _id untuk menghindari konflik dalam pembaruan

                console.log(`Filled missing RR for log at index ${index} with value ${nearestRRValue}.`);
                return {
                    updateOne: {
                        filter: { _id: log._id },
                        update: { $set: updatedLog }
                    }
                };
            }
            return null;
        }).filter(op => op !== null);

        if (bulkOps.length > 0) {
            const bulkWriteResult = await Log.bulkWrite(bulkOps);
            totalUpdated = bulkWriteResult.modifiedCount;
            totalFailed = bulkOps.length - totalUpdated;
        }

        // Memeriksa kembali log dengan HR tetapi tidak ada RR
        const remainingLogsWithHRNoRR = await Log.find({ HR: { $ne: null }, RR: null }).sort({ create_at: 1 });
        const remainingCount = remainingLogsWithHRNoRR.length;

        console.log(`RR values filled successfully. Total updated: ${totalUpdated}, Total failed: ${totalFailed}, Remaining logs with HR but no RR: ${remainingCount}`);
        return { 
            message: 'All checks run and RR values filled successfully.', 
            totalUpdated, 
            totalFailed, 
            logsWithHRNoRRIds, 
            remainingCount,
            status: 200 
        };
    } catch (error) {
        console.error('Error running all checks and filling RR values:', error);
        return { message: 'Internal server error.', status: 500 };
    }
};

// Metode untuk memeriksa dan mengisi log
export const checkAndFillLogs = async () => {
    try {
        console.log('Checking and filling logs...');
        // Implementasikan logika Anda di sini
        return { message: 'Logs checked and filled successfully.', status: 200 };
    } catch (error) {
        console.error('Error checking and filling logs:', error);
        return { message: 'Internal server error.', status: 500 };
    }
};

// Metode baru untuk menjalankan semua metode
export const runAllMethods = async () => {
    try {
        console.log('Running all methods...');

        // Memanggil setiap metode secara berurutan dan mengumpulkan hasilnya
        const results = [];

        const checkLogsWithHRNoRRResult = await checkLogsWithHRNoRR();
        results.push({ method: 'checkLogsWithHRNoRR', result: checkLogsWithHRNoRRResult });

        const checkLogsWithHRAndRRResult = await checkLogsWithHRAndRR();
        results.push({ method: 'checkLogsWithHRAndRR', result: checkLogsWithHRAndRRResult });

        if (checkLogsWithHRNoRRResult.logs && checkLogsWithHRNoRRResult.logs.length > 0) {
            const fillMissingRRForLogsWithHRResult = await fillMissingRRForLogsWithHR();
            results.push({ method: 'fillMissingRRForLogsWithHR', result: fillMissingRRForLogsWithHRResult });
        } else {
            const checkAndFillLogsResult = await checkAndFillLogs();
            results.push({ method: 'checkAndFillLogs', result: checkAndFillLogsResult });
        }

        const runAllChecksAndFillResult = await runAllChecksAndFill();
        results.push({ method: 'runAllChecksAndFill', result: runAllChecksAndFillResult });

        return res.status(200).json({ message: 'All methods executed successfully.', results });
    } catch (error) {
        console.error('Error running all methods:', error);
        return res.status(500).json({ message: 'Internal server error.' });
    }
};

// Metode yang diperbarui untuk memeriksa nilai RR dan rrRMS
export const checkLogRRAndRrRMS = async () => {
    try {
        console.log('Checking RR and rrRMS values...');
        const logs = await Log.find().sort({ create_at: 1 });

        let missingRRCount = 0;
        let missingRrRMSCount = 0;

        logs.forEach(log => {
            // Memeriksa nilai RR yang hilang
            if (log.RR === null || log.RR === undefined) {
                missingRRCount++;
            }

            // Memeriksa nilai rrRMS yang hilang
            if (log.rrRMS === null || log.rrRMS === undefined) {
                missingRrRMSCount++;
            }
        });

        console.log(`Total logs checked: ${logs.length}`);
        console.log(`Logs with missing RR: ${missingRRCount}`);
        console.log(`Logs with missing rrRMS: ${missingRrRMSCount}`);

        return {
            message: 'RR and rrRMS values checked successfully.',
            totalLogs: logs.length,
            missingRRCount,
            missingRrRMSCount,
            status: 200
        };
    } catch (error) {
        console.error('Error checking RR and rrRMS values:', error);
        return { message: 'Internal server error.', status: 500 };
    }
};