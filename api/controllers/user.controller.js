import bcryptjs from 'bcryptjs';
import User from '../models/user.model.js';
import Log from '../models/log.model.js';
import Aktivitas from '../models/activity.model.js';
import { errorHandler } from '../utils/error.js';
import {  calculateAdvancedMetrics} from './metrics.controller.js';
import { formatTimestamp, groupDataByThreeAndAverage, filterIQ } from './data.controller.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Convert import.meta.url to __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const test = async (req, res, next) => {
  try {
    const folderMap = {
      Raw: 'hrv-results-Raw',
      Kalman: 'hrv-results-Kalman',
      IQ: 'hrv-results-IQ',
    };

    const { method = 'Raw', startDate, endDate } = req.query; // Default to "Raw"
    const folderChoose = folderMap[method] || folderMap['Raw']; // Default folder "Raw"
    const resultsDir = path.join(__dirname, `../controllers/${folderChoose}`);

    const files = fs.readdirSync(resultsDir).filter((file) => /^\d{2}-\d{2}-\d{4}\.json$/.test(file));

    if (startDate && endDate) {
      const dateStart = new Date(startDate).getTime();
      const dateEndTimestamp = new Date(endDate).setHours(23, 59, 59);

      let filteredLogs = [];
      let dailyMetrics = [];
      let activityMetrics = [];

      files.forEach((file) => {
        const fileDate = new Date(file.split('.')[0].split('-').reverse().join('-')).getTime();
        if (fileDate >= dateStart && fileDate <= dateEndTimestamp) {
          const filePath = path.join(resultsDir, file);
          const fileData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

          if (method === 'Raw') {
            filteredLogs.push(...fileData); // Directly use raw data
          } else {
            filteredLogs.push(...fileData.filteredLogs || []);
          }

          if (fileData.dailyMetrics) {
            dailyMetrics.push({ ...fileData.dailyMetrics, date: file.split('.')[0] });
          }

          if (fileData.activityMetrics) {
            activityMetrics.push(fileData.activityMetrics);
          }
        }
      });

      if (!filteredLogs.length) {
        return res.status(404).json({ message: 'Tidak ada log yang sesuai rentang tanggal.' });
      }

      const validLogs = filteredLogs.filter((log) => log.RR !== null);
      if (!validLogs.length) {
        return res.status(404).json({ message: 'Tidak ada log valid dalam rentang tanggal.' });
      }

      const formattedLogs = validLogs.map((log) => ({
        ...log,
        datetime: log.timestamp ? new Date(log.timestamp * 1000).toISOString() : null,
      }));
      return res.status(200).json({ logs: formattedLogs, dailyMetrics, activityMetrics, method });
    } else {
      const latestFile = files.sort((a, b) => {
        const dateA = new Date(a.split('.')[0].split('-').reverse().join('-'));
        const dateB = new Date(b.split('.')[0].split('-').reverse().join('-'));
        return dateB - dateA;
      })[0];

      if (!latestFile) {
        return res.status(404).json({ message: 'Tidak ada data harian tersedia.' });
      }

      const filePath = path.join(resultsDir, latestFile);
      const fileData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      let logs = [];

      if (method === 'Raw') {
        logs = fileData;
      } else {
        logs = fileData.filteredLogs.filter((log) => log.RR !== null);
      }

      const formattedLogs = logs.map((log) => ({
        ...log,
        datetime: log.timestamp ? new Date(log.timestamp * 1000).toISOString() : null,
      }));

      const dailyMetrics = fileData.dailyMetrics
        ? { ...fileData.dailyMetrics, date: latestFile.split('.')[0] }
        : null;

      const activityMetrics = fileData.activityMetrics || null;
     
      return res.status(200).json({ logs: formattedLogs, dailyMetrics, activityMetrics, method });
    }
  } catch (error) {
    console.error('Error in /api/user/test:', error.message);
    next(error);
  }
};

export const Dailymetrics = async (req, res, next) => {
  try {
    const folderMap = {
      Kalman: 'hrv-results-Kalman',
      IQ: 'hrv-results-IQ',
    };

    const { method = 'Kalman', startDate, endDate } = req.query;
    const folderChoose = folderMap[method] || folderMap['Kalman']; // Default folder "Kalman"
    const resultsDir = path.join(__dirname, `../controllers/${folderChoose}`);

    const files = fs.readdirSync(resultsDir).filter((file) => /^\d{2}-\d{2}-\d{4}\.json$/.test(file));

    if (startDate && endDate) {
      const dateStart = new Date(startDate).getTime();
      const dateEndTimestamp = new Date(endDate).setHours(23, 59, 59);

      let filteredLogs = [];
      let dailyMetrics = [];
      let activityMetrics = [];

      files.forEach((file) => {
        const fileDate = new Date(file.split('.')[0].split('-').reverse().join('-')).getTime();
        if (fileDate >= dateStart && fileDate <= dateEndTimestamp) {
          const filePath = path.join(resultsDir, file);
          const fileData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

          filteredLogs.push(...fileData.filteredLogs || []);

          if (fileData.dailyMetrics) {
            dailyMetrics.push({ ...fileData.dailyMetrics, date: file.split('.')[0] });
          }

          if (fileData.activityMetrics) {
            activityMetrics.push(fileData.activityMetrics);
          }
        }
      });

      if (!filteredLogs.length) {
        return res.status(404).json({ message: 'Tidak ada log yang sesuai rentang tanggal.' });
      }

      const validLogs = filteredLogs.filter((log) => log.RR !== null);
      if (!validLogs.length) {
        return res.status(404).json({ message: 'Tidak ada log valid dalam rentang tanggal.' });
      }

      const formattedLogs = validLogs.map((log) => ({
        ...log,
        datetime: log.timestamp ? new Date(log.timestamp * 1000).toISOString() : null,
      }));

      return res.status(200).json({ dailyMetrics, activityMetrics, method });
    } else {
      const latestFile = files.sort((a, b) => {
        const dateA = new Date(a.split('.')[0].split('-').reverse().join('-'));
        const dateB = new Date(b.split('.')[0].split('-').reverse().join('-'));
        return dateB - dateA;
      })[0];

      if (!latestFile) {
        return res.status(404).json({ message: 'Tidak ada data harian tersedia.' });
      }

      const filePath = path.join(resultsDir, latestFile);
      const fileData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      const logs = fileData.filteredLogs.filter((log) => log.RR !== null);

      const formattedLogs = logs.map((log) => ({
        ...log,
        datetime: log.timestamp ? new Date(log.timestamp * 1000).toISOString() : null,
      }));

      const dailyMetrics = fileData.dailyMetrics
        ? { ...fileData.dailyMetrics, date: latestFile.split('.')[0] }
        : null;

      const activityMetrics = fileData.activityMetrics || null;
      return res.status(200).json({ dailyMetrics, activityMetrics, method });
    }
  } catch (error) {
    console.error('Error in /api/user/test:', error.message);
    next(error);
  }
};



const processFile = (resultsDir, file, allFilteredLogs, allDailyMetrics) => {
  const filePath = path.join(resultsDir, file);
  const fileData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  allFilteredLogs.push(...fileData.filteredLogs);

  const finalMetric = {
    ...fileData.metrics,
    date: file.split('filtered_logs_')[1].split('.')[0]
  };

  allDailyMetrics.push(finalMetric);
};


export const fetchDailyData = async (req, res, next) => {
  try {
    const resultsDir = path.join(__dirname, '../controllers/hrv-results');
    const files = fs.readdirSync(resultsDir);
    // Filter and sort files to get the latest daily data file
    const latestDailyFile = files
      .filter(file => file.startsWith('filtered_logs_'))
      .sort((a, b) => {
        const dateA = new Date(a.match(/filtered_logs_(.+)\.json/)[1]);
        const dateB = new Date(b.match(/filtered_logs_(.+)\.json/)[1]);
        return dateB - dateA;
      })[0];
    if (!latestDailyFile) {
      return res.status(404).json({ message: 'No daily data available' });
    }
    const dailyFilePath = path.join(resultsDir, latestDailyFile);
    const dailyData = JSON.parse(fs.readFileSync(dailyFilePath, 'utf-8'));
    // Check if dailyData contains logs
    const logs = dailyData.filteredLogs || [];
    if (logs.length === 0) {
      return res.status(404).json({ message: 'No logs available in the daily data' });
    }
    // Filter logs based on startDate and endDate from query parameters
    const { startDate, endDate } = req.query;
    let filteredLogs = logs;
    if (startDate && endDate) {
      const dateStart = new Date(startDate).getTime() / 1000;
      const dateEnd = new Date(endDate);
      dateEnd.setHours(dateEnd.getHours() + 7);
      const dateEndTimestamp = dateEnd.getTime() / 1000;
      filteredLogs = logs.filter(log => log.timestamp >= dateStart && log.timestamp <= dateEndTimestamp);
    }
    // Filter out logs with null RR values
    const validLogs = filteredLogs.filter(log => log.RR !== null);
    if (validLogs.length === 0) {
      return res.status(404).json({ message: 'No valid logs available in the daily data' });
    }
    // Convert timestamp to readable date and time
    const formattedLogs = validLogs.map(log => ({
      ...log,
      datetime: new Date(log.timestamp * 1000).toISOString() // Convert timestamp to ISO string
    }));
    // Apply the filterIQ function to the valid logs
    const { filteredLogs: filterIQRResult, anomalies } = await filterIQ(formattedLogs);
    // Log the variables for comparison

    // Send the logs and filterIQRResult to the frontend
    res.status(200).json({ logs: formattedLogs, filterIQRResult });
  } catch (error) {
    console.error('Error fetching daily data:', error.message);
    next(error);
  }
};


export const getRiwayatDeteksiWithDfa = async (req, res) => {
  let result = [];
  let limit = 4;
  const page = parseInt(req.query.page) || 0;
  const startDate = req.query.startDate;
  const endDate = req.query.endDate;

  let filter = {
    userRef: req.params.userId
  }

  if (startDate && endDate) {
    filter.Date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  }

  const [countDoc, theActivities] = await Promise.all([
    Aktivitas.countDocuments(filter),
    Aktivitas.find(filter)
      .sort({ Date: -1 })
      .limit(limit)
      .skip(limit * page)
  ]);

  let totalPagination = Math.floor(countDoc / limit) + 1;
  for (let i = 0; i < theActivities.length; i++) {
    const singleactivity = theActivities[i];
    let date = new Date(singleactivity.Date);
    let dateFormat = `${String(date.getDate()).padStart(2, '0')}-${String((date.getMonth() + 1)).padStart(2, '0')}-${date.getFullYear()}`;
    const logs = await Log.find({
      date: dateFormat,
      time: {
        $gte: singleactivity.awal,
        $lte: singleactivity.akhir
      }
    });

    let dfa = 0;
    if (logs.length > 0) {
      const colelctionHR = logs.map(val => val.HR);

      if (colelctionHR.length >= 8) {
        dfa = calculateDFA(colelctionHR);
      }
    }

    let dataOutput = {
      date: dateFormat,
      time: `${singleactivity.awal} - ${singleactivity.akhir}`,
      aktifitas: singleactivity.aktivitas,
      dfa: dfa
    }

    result.push(dataOutput);
  }

  res.json({ message: 'oke', riwayat: result, totalPagination })
}

export const updateUser = async (req, res, next) => {
  if (req.user.id !== req.params.id)
    return next(errorHandler(401, 'You can only update your own account!'));
  try {
    if (req.body.password) {
      req.body.password = bcryptjs.hashSync(req.body.password, 10);
    }

    let user = await User.findById(req.params.id);

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          guid: req.body.guid,
          name: req.body.name,
          email: req.body.email,
          password: req.body.password,
          current_device: req.body.current_device,
          phone_number: req.body.phone_number,
          address: req.body.address,
          otp: req.body.otp,
          profilePicture: req.body.profilePicture,
        },
      },
      { new: true }
    );


    const { password, ...rest } = updatedUser._doc;

    res.status(200).json(rest);
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  if (req.user.id !== req.params.id)
    return next(errorHandler(401, 'You can only delete your own account!'));
  try {
    await User.findByIdAndDelete(req.params.id);
    res.clearCookie('access_token');
    res.status(200).json('User has been deleted!');
  } catch (error) {
    next(error);
  }
};

export const getUser = async (req, res, next) => {
  try {

    const user = await User.findById(req.params.id);

    if (!user) return next(errorHandler(404, 'User not found!'));

    const { password: pass, ...rest } = user._doc;

    res.status(200).json(rest);
  } catch (error) {
    next(error);
  }
};

// imputeData();

export const getLogWithActivity = async (req, res, next) => {
  try {
    let { gap } = req.query; // default gap 30 menit
    let user = await User.findById(req.user.id);
    const filter = {
      guid_device: user.current_device || 'C0680226',
      activity: { $exists: false }
    };

    if (req.user.role == 'doctor') {
      filter.guid_device = req.params.device;
    }

    const logs = await Log.find(filter)
      .sort({ create_at: -1 })
      .limit(2000);

    if (logs.length === 0) {
      return res.status(200).json({ message: 'All log have relations now.', result: null });
    }

    if (!gap) gap = 30


    const groupedData = logs.reduce((acc, log) => {
      const dateKey = log.date_created || log.date; // Gunakan `date_created` atau `date` sebagai kunci
      if (!acc[dateKey]) {
        acc[dateKey] = []; // Jika kunci belum ada, buat array kosong
      }
      acc[dateKey].push(log); // Tambahkan log ke array berdasarkan tanggal
      return acc;
    }, {});

    let result = {};

    // Fungsi untuk mendapatkan interval waktu 15 menit
    const getTimeInterval = (time) => {
      // console.log({log}, logs[i])
      const [hour, minute] = time.split(":").map(Number);
      const startMinute = Math.floor(minute / parseInt(gap)) * parseInt(gap);
      const endMinute = startMinute + parseInt(gap);
      const startTime = `${hour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;
      const endHour = endMinute >= 60 ? hour + 1 : hour;
      const endTime = `${endHour.toString().padStart(2, '0')}:${(endMinute % 60).toString().padStart(2, '0')}`;
      return `${startTime}-${endTime}`;
    }


    // Loop melalui setiap kelompok tanggal
    Object.keys(groupedData).forEach((dateKey) => {
      const logsForDate = groupedData[dateKey];

      logsForDate.forEach((log) => {
        const logTime = new Date(log.create_at);
        const timeInterval = getTimeInterval(log.time_created);

        const key = `${dateKey}/${timeInterval}`;

        if (!result[key]) {
          result[key] = [];
        }
        result[key].push(log);
      });
    });


    res.status(200).json({ result });

  } catch (error) {
    console.error('Error in /api/user/fgfgfgfg:', error.message);
    next(error);
  }
};

const groupLogsByTimeGap = (logs, gap) => {
  const groupedLogs = [];
  let currentGroup = [];
  let startTime = new Date(logs[0].create_at);

  logs.forEach((log, index) => {
    const logTime = new Date(log.create_at);
    const diffInMinutes = (logTime - startTime) / 1000 / 60; // Convert to minutes

    if (diffInMinutes < gap) {
      currentGroup.push(log);
    } else {
      groupedLogs.push({
        Date: currentGroup[0].date,
        timeStart: currentGroup[0].time_created,
        timeEnd: currentGroup[currentGroup.length - 1].time_created,
        logsCount: currentGroup.length,
      });
      startTime = logTime;
      currentGroup = [log];
    }

    // If it's the last log, push the remaining group
    if (index === logs.length - 1 && currentGroup.length) {
      groupedLogs.push({
        Date: currentGroup[0].date,
        timeStart: currentGroup[0].time_created,
        timeEnd: currentGroup[currentGroup.length - 1].time_created,
        logsCount: currentGroup.length,
      });
    }
  });

  return groupedLogs;
};


export const pushActivity = async (req, res) => {
  try {
    // type, activities, starttime, endtime
    // const { activities, starttime, endtime, userRef } = req.body;
    const { userRef, awal, akhir, tanggal, details } = req.body;

    for (let i = 0; i < details.length; i++) {
      const singleActivity = details[i];

      // Pisahkan tanggal menjadi komponen hari, bulan, dan tahun
      const [day, month, year] = tanggal.split('-').map(Number);
      const [hourAwal, minuteAwal] = singleActivity.timeStart.split(':').map(Number);
      const [hourAkhir, minuteAkhir] = singleActivity.timeEnd.split(':').map(Number);

      // Buat objek Date menggunakan komponen yang dipisah
      const dateObjectAwal = new Date(year, month - 1, day, hourAwal, minuteAwal);
      const dateObjectAkhir = new Date(year, month - 1, day, hourAkhir, minuteAkhir);

      // Konversi ke timestamp dalam detik
      const timestampAwal = Math.floor(dateObjectAwal.getTime() / 1000);
      const timestampAkhir = Math.floor(dateObjectAkhir.getTime() / 1000);

      /**
       * DO : 
       * 1. Create Activity
       * 2. Make reference with activity where timestamps isvalid, activity is not exist
       */

      const createAktivity = await Aktivitas.create({ userRef, Date: new Date(year, month - 1, day), awal: singleActivity.timeStart, akhir: singleActivity.timeEnd, aktivitas: singleActivity.aktivitas });
      let filter = {
        activity: {
          $exists: false
        },
        timestamp: {
          $gte: timestampAwal,
          $lte: timestampAkhir,
        }
      }

      let update = {
        $set: {
          activity: createAktivity.aktivitas,
          activity_ref: createAktivity._id
        }
      }
      await Log.updateMany(filter, update);
    }

    return res.json({ message: 'Succesfully set activity' })

  } catch (error) {
    console.log(error);
  }


}

export const getFilteredAndRawData = async (req, res, next) => {
  try {
    const resultsDir = path.join(__dirname, '../controllers/hrv-results');
    const files = fs.readdirSync(resultsDir);

    const latestFilteredFile = files
      .filter(file => file.startsWith('filtered_logs_'))
      .sort((a, b) => {
        const dateA = new Date(a.match(/filtered_logs_(.+)\.json/)[1]);
        const dateB = new Date(b.match(/filtered_logs_(.+)\.json/)[1]);
        return dateB - dateA;
      })[0];

    const latestRawFile = files
      .filter(file => file.startsWith('log_'))
      .sort((a, b) => {
        const dateA = new Date(a.match(/log_(.+)\.json/)[1]);
        const dateB = new Date(b.match(/log_(.+)\.json/)[1]);
        return dateB - dateA;
      })[0];

    if (!latestFilteredFile || !latestRawFile) {
      return res.status(404).json({ message: 'No data available' });
    }

    const filteredFilePath = path.join(resultsDir, latestFilteredFile);
    const rawFilePath = path.join(resultsDir, latestRawFile);

    let filteredData = JSON.parse(fs.readFileSync(filteredFilePath, 'utf-8'));
    const rawData = JSON.parse(fs.readFileSync(rawFilePath, 'utf-8')).raw;

    // Konversi 'timestamp' ke 'datetime'
    filteredData = filteredData.map(item => ({
      datetime: new Date(item.timestamp * 1000).toISOString(), // Konversi timestamp ke datetime
      HR: item.HR,
      RR: item.RR,
      metrics: item.metrics
    }));

    // Menghitung rata-rata metrics dan datetime per hari
    const metricsPerDay = {};
    const datetimePerDay = {};

    filteredData.forEach(item => {
      const date = item.datetime.split('T')[0]; // Ambil tanggal saja
      const timestamp = new Date(item.datetime).getTime();

      if (!metricsPerDay[date]) {
        metricsPerDay[date] = { count: 0, sum: {} };
        datetimePerDay[date] = { count: 0, sum: 0 };
      }

      const metrics = item.metrics;
      for (const key in metrics) {
        if (!metricsPerDay[date].sum[key]) {
          metricsPerDay[date].sum[key] = 0;
        }
        metricsPerDay[date].sum[key] += metrics[key];
      }
      metricsPerDay[date].count += 1;

      datetimePerDay[date].sum += timestamp;
      datetimePerDay[date].count += 1;
    });

    const averageMetricsPerDay = {};
    for (const date in metricsPerDay) {
      averageMetricsPerDay[date] = {};
      const { sum, count } = metricsPerDay[date];
      for (const key in sum) {
        averageMetricsPerDay[date][key] = sum[key] / count;
      }
    }

    const averageDatetimePerDay = {};
    for (const date in datetimePerDay) {
      const { sum, count } = datetimePerDay[date];
      const avgTimestamp = sum / count;
      averageDatetimePerDay[date] = new Date(avgTimestamp).toISOString();
    }

    res.status(200).json({ filtered: filteredData, raw: rawData, averages: averageMetricsPerDay, averageDatetime: averageDatetimePerDay });
  } catch (error) {
    console.error('Error reading filtered and raw data:', error);
    next(error);
  }
};

// Todo Now

export const logdfa = async (req, res, next) => {
  try {
    const folderMap = {
      Raw: 'hrv-results-Raw',
      Kalman: 'hrv-results-Kalman',
      IQ: 'hrv-results-IQ',
    };

    const { method = 'Raw', startDate, endDate } = req.query; // Default to "Raw"
    const device = req.params.device || false;
    const folderChoose = folderMap[method] || folderMap['Raw'];
    const resultsDir = path.join(__dirname, `../controllers/${folderChoose}`);
   
    // Filter files based on JSON format
    const files = fs.readdirSync(resultsDir).filter((file) => /^\d{2}-\d{2}-\d{4}\.json$/.test(file));

    if (!files.length) {
      return res.status(404).json({ message: 'No data files found in the specified directory.' });
    }

    let filteredLogs = [];
    let filteredFiles = [];

    if (startDate && endDate) {
      const dateStart = new Date(startDate).getTime();
      const dateEndTimestamp = new Date(endDate).setHours(23, 59, 59);
      console.log(dateEndTimestamp)
      filteredFiles = files.filter((file) => {
        const fileDate = new Date(file.split('.')[0].split('-').reverse().join('-')).getTime();
        return fileDate >= dateStart && fileDate <= dateEndTimestamp;
      });

      if (!filteredFiles.length) {
        return res.status(404).json({ message: 'No logs available within the given date range.' });
      }
    } else {
      filteredFiles = [files.sort((a, b) => {
        const dateA = new Date(a.split('.')[0].split('-').reverse().join('-'));
        const dateB = new Date(b.split('.')[0].split('-').reverse().join('-'));
        return dateB - dateA;
      })[0]]; // Select latest file
    }

    // Read and process files
    filteredFiles.forEach((file) => {
      const filePath = path.join(resultsDir, file);
      const fileData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      const logs = method === 'Raw' ? fileData : fileData.filteredLogs || [];
      filteredLogs.push(...logs.filter((log) => log.RR !== null && log.HR !== null));
    });

    if (!filteredLogs.length) {
      return res.status(404).json({ message: 'No valid logs available.' });
    }

    // Group logs by date and calculate DFA
    const logsByDate = filteredLogs.reduce((acc, log) => {
      const date = new Date(log.timestamp * 1000).toISOString().split('T')[0];
      if (!acc[date]) acc[date] = [];
      acc[date].push(log);
      return acc;
    }, {});

    const result = Object.entries(logsByDate).map(([date, logs]) => {
      const sortedLogs = logs.sort((a, b) => a.timestamp - b.timestamp);
      const firstLog = sortedLogs[0];
      const lastLog = sortedLogs[sortedLogs.length - 1];

      return {
        aktivitas: firstLog.aktivitas,
        dfa: calculateDFA(sortedLogs.map((log) => log.HR)),
        adfa: calculateADFA(sortedLogs.map((log) => log.HR)),
        tanggal: date,
        waktu_awal: new Date(firstLog.timestamp * 1000).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        waktu_akhir: new Date(lastLog.timestamp * 1000).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        count: sortedLogs.length,
        timestamp_tanggal: new Date(firstLog.timestamp * 1000).getTime(),
      };
    });

    result.sort((a, b) => b.timestamp_tanggal - a.timestamp_tanggal);

    res.status(200).json({ result });
  } catch (error) {
    console.error('Error in /api/user/logdfa:', error.message);
    next(error);
  }
};



export const dfaActivity = async (req, res, next) => {
  try {
    await Log.deleteMany({
      $or: [{ HR: 0 }, { RR: 0 }, { rrRMS: 0 }],
    });

    // let ip = 0; // index page

    // const device = req.params.device || false;
    // const method = req.query.method || 'OC';
    const { startDate, endDate } = req.query;

    // const splitCount = 500;
    // const HRCollection = [];
    // let splittedLog;
    let fileStartWith = "";
    // let filter = {date_created : "27-05-2024"} // 

    // let filter = {};
    let folderChoose = 'hrv-results-km';

    // console.log({ method })

    // if (method) {
    //   if (method == 'BC') folderChoose = 'hrv-results-BC';
    //   if (method == 'OC') folderChoose = 'hrv-results-OC';
    //   if (method == 'IQ') folderChoose = 'hrv-results-IQ';
    // }

    // if (method == "no-filter") {
    //   fileStartWith = "";
    //   folderChoose = 'hrv-results';
    // } else {
    //   fileStartWith = "filtered_logs_";
    // }

    // console.log({ folderChoose, method })

    const resultsDir = path.join(__dirname, `../controllers/${folderChoose}`);
    // console.log({ method, folderChoose })
    const files = fs.readdirSync(resultsDir);
    let filteredLogs = [];
    let MetricsLogs = [];

    if (startDate && endDate) {
      const dateStart = new Date(startDate).getTime() / 1000;
      const dateEnd = new Date(endDate);
      dateEnd.setHours(dateEnd.getHours() + 7);
      const dateEndTimestamp = dateEnd.getTime() / 1000;

      let filteredFiles = files
        .filter(file => file.startsWith(fileStartWith))
        .sort((a, b) => {
          // if (method != 'no-filter') {
          //   const dateA = new Date(a.match(/filtered_logs_(.+)\.json/)[1]);
          //   const dateB = new Date(b.match(/filtered_logs_(.+)\.json/)[1]);
          //   return dateB - dateA;
          // } else {

          // Ekstrak tanggal dari nama file
          const [dA, mA, yA] = a.match(/(\d{2})-(\d{2})-(\d{4})\.json/).slice(1);
          const [dB, mB, yB] = b.match(/(\d{2})-(\d{2})-(\d{4})\.json/).slice(1);

          // const dateA = new Date(a.match(/(.+)\.json/));
          const dateA = new Date(`${yA}-${mA}-${dA}`);
          // const dateB = new Date(b.match(/(.+)\.json/));
          const dateB = new Date(`${yB}-${mB}-${dB}`);

          return dateA - dateB;
          // }
        });


      filteredFiles = filteredFiles.filter(file => file.endsWith('.json'));
      let fileDate;

      let tanggals = [];

      filteredFiles.forEach((file, i) => {
        if (file.endsWith('.json')) {
          // console.log({file, dateStart, dateEnd}, new Date(file.match(/filtered_logs_(.+)\.json/)[1]).getTime() / 1000)
          // if (method != 'no-filter') {
          //   fileDate = new Date(file.match(/filtered_logs_(.+)\.json/)[1]).getTime() / 1000;
          // } else {
          const [day, month, year] = file.match(/(.+)\.json/)[1].split('-');
          fileDate = new Date(`${year}-${month}-${day}`).getTime() / 1000;
          // }
          if (fileDate >= dateStart && fileDate <= dateEndTimestamp) {
            const filePath = path.join(resultsDir, file);
            const fileData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            filteredLogs.push(...fileData.filteredLogs);
            MetricsLogs.push(fileData.activityMetrics);
            tanggals.push(filteredFiles[i]);
          }
        }
      });


      if (filteredLogs.length === 0) {
        return res.status(404).json({ message: 'Tidak ada log yang tersedia dalam rentang tanggal yang diberikan' });
      }

      // const validLogs = filteredLogs.filter(log => log.RR !== null || log.HR !== null);
      // if (validLogs.length === 0) {
      //   return res.status(404).json({ message: 'Tidak ada log valid yang tersedia dalam data harian' });
      // }

      // ubah dlu date nya
      // if (method == "no-filter") {
      filteredLogs.map((_val, _i) => {

        // Buat objek Date
        const [day, month, year] = _val.date_created.split('/');
        const formattedDate = `${year}-${month}-${day}T${_val.time_created}`; // Format ISO 8601

        const tanggal = new Date(formattedDate);
        filteredLogs[_i]["timestamp"] = tanggal.getTime() / 1000;
        filteredLogs[_i]['datetime'] = formattedDate;
      })
      // }


      const groupLogsByActivity = [];

      let activity = "";
      let groups = [];

      for (let i = 0; i < filteredLogs.length; i++) {
        if (filteredLogs[i]['aktivitas'] != activity) {
          // array groups masukin ke groupLogsWithActivty, set ulang groups baru dan set activity 
          if (activity != "") {
            let result = {
              Aktivitas: activity,
              startTime: groups[0]['time_created'],
              endTime: groups[groups.length - 1]['time_created'],
              tanggal: groups[0]['date_created'],
              details: [...groups]
            }

            groupLogsByActivity.push(result);
          }

          activity = filteredLogs[i]['aktivitas'];
          groups = [];

          groups.push(filteredLogs[i]);
        } else {
          // masukin data ke group yang sudah di set karena activity nya sama
          groups.push(filteredLogs[i]);

          if (filteredLogs.length - i === 1) {
            // untuk memasukan LogsActivity terakhir
            let result = {
              Aktivitas: activity,
              startTime: groups[0]['time_created'],
              endTime: groups[groups.length - 1]['time_created'],
              tanggal: groups[0]['date_created'],
              details: [...groups]
            }

            groupLogsByActivity.push(result);
          }
        }
      }

      let Metrics = [];
      for (let i = 0; i < MetricsLogs.length; i++) {

        let metric = MetricsLogs[i];

        let tanggal = tanggals[i].split('.')[0];
        let [day, month, year] = tanggal.split('-');
        for (const [key, value] of Object.entries(metric)) {
          Metrics.push({
            aktivitas: key,
            tanggal: `${day}-${month}-${year}`,
            metrics: value,
          })
        }
      }


      res.json({ logs: filteredLogs, groupLogsByActivity, Metrics });
    } else {
      // Filter dan urutkan file untuk mendapatkan file data harian terbaru
      const latestDailyFile = files
        .filter(file => file.startsWith(fileStartWith))
        .sort((a, b) => {

          // Ekstrak tanggal dari nama file
          const [dA, mA, yA] = a.match(/(\d{2})-(\d{2})-(\d{4})\.json/).slice(1);
          const [dB, mB, yB] = b.match(/(\d{2})-(\d{2})-(\d{4})\.json/).slice(1);

          // const dateA = new Date(a.match(/(.+)\.json/));
          const dateA = new Date(`${yA}-${mA}-${dA}`);
          // const dateB = new Date(b.match(/(.+)\.json/));
          const dateB = new Date(`${yB}-${mB}-${dB}`);

          return dateB - dateA;

        })[0];


      if (!latestDailyFile) {
        return res.status(404).json({ message: 'Tidak ada data harian yang tersedia' });
      }

      const dailyFilePath = path.join(resultsDir, latestDailyFile);
      const dailyData = JSON.parse(fs.readFileSync(dailyFilePath, 'utf-8'));

      // Periksa apakah dailyData mengandung logs
      const logs = dailyData.filteredLogs || [];
      const MetricsActivities = dailyData.activityMetrics;

      if (logs.length === 0) {
        return res.status(404).json({ message: 'Tidak ada log yang tersedia dalam data harian' });
      }

      // FILTERING METHD NO FILTER FOR TIMESTAMP
      // if (method == "no-filter") {
      logs.map((_val, _i) => {
        const [day, month, year] = _val.date_created.split('/');
        let dateWithTime = `${year}-${month}-${day}T${_val.time_created}`;

        let date = new Date(dateWithTime);
        logs[_i]['timestamp'] = date.getTime() / 1000;
        logs[_i]['datetime'] = dateWithTime;
      })

      const groupLogsByActivity = [];

      let activity = "";
      let groups = [];

      for (let i = 0; i < logs.length; i++) {
        if (logs[i]['aktivitas'] != activity) {
          // array groups masukin ke groupLogsWithActivty, set ulang groups baru dan set activity 
          if (activity != "") {
            let result = {
              Aktivitas: activity,
              startTime: groups[0]['time_created'],
              endTime: groups[groups.length - 1]['time_created'],
              tanggal: groups[0]['date_created'],
              details: [...groups]
            }

            groupLogsByActivity.push(result);
          }

          activity = logs[i]['aktivitas'];
          groups = [];

          groups.push(logs[i]);
        } else {
          // masukin data ke group yang sudah di set karena activity nya sama
          groups.push(logs[i]);

          if (logs.length - i === 1) {
            // untuk memasukan LogsActivity terakhir
            let result = {
              Aktivitas: activity,
              startTime: groups[0]['time_created'],
              endTime: groups[groups.length - 1]['time_created'],
              tanggal: groups[0]['date_created'],
              details: [...groups]
            }

            groupLogsByActivity.push(result);
          }
        }
      }

      let Metrics = [];
      for (const [key, value] of Object.entries(MetricsActivities)) {

        Metrics.push({
          aktivitas: key,
          tanggal: logs[0]["date_created"],
          metrics: value,
        })
      }
      res.json({ logs, groupLogsByActivity, Metrics });
    }
    // titik yang bisa digunakan kedua kondisi
  }
  catch (error) {
    console.error('Error in /api/user/logdfa:', error.message);
    next(error);
  }
}