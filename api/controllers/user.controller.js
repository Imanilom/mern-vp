import bcryptjs from 'bcryptjs';
import User from '../models/user.model.js';
import Log from '../models/log.model.js';
import Aktivitas from '../models/activity.model.js';
import { errorHandler } from '../utils/error.js';
import { calculateDFA } from './data.controller.js';

const calculateMetrics = (logs) => {
  const rrIntervals = logs.map((log) => log.RR);
  const nnIntervals = [];
  if (rrIntervals.length < 2) {
    // Not enough data points to calculate metrics
    return { sdnn: null, rmssd: null, pnn50: null, s1: null, s2: null };
  }
  let sumSquaredDiffs = 0; // For RMSSD
  let sumSuccessiveDiffs = 0; // For RMSSD
  let nn50Count = 0;

  for (let i = 1; i < rrIntervals.length; i++) {
    const diff = Math.abs(rrIntervals[i] - rrIntervals[i - 1]);
    nnIntervals.push(diff);

    sumSquaredDiffs += diff * diff; // Square the difference and add to sum (for RMSSD)
    if (diff > 50) {
      nn50Count++;
    }
  }

  const avgNN = nnIntervals.reduce((sum, interval) => sum + interval, 0) / nnIntervals.length;

  const squaredDiffsFromMean = nnIntervals.map((interval) => Math.pow(interval - avgNN, 2));
  const sumSquaredDiffsFromMean = squaredDiffsFromMean.reduce((sum, diff) => sum + diff, 0);

  const variance = sumSquaredDiffsFromMean / (nnIntervals.length - 1);
  const sdnn = Math.sqrt(variance);

  const rmssd = Math.sqrt(sumSquaredDiffs / nnIntervals.length);
  const pnn50 = (nn50Count / nnIntervals.length) * 100;

  // Calculate S1 & S2
  const diff1 = rrIntervals.slice(1).map((val, index) => val - rrIntervals[index]);
  const sum1 = rrIntervals.slice(1).map((val, index) => val + rrIntervals[index]);

  const s1 = Math.sqrt(diff1.reduce((sum, val) => sum + Math.pow(val, 2), 0) / diff1.length) / Math.sqrt(2);
  const s2 = Math.sqrt(sum1.reduce((sum, val) => sum + Math.pow(val, 2), 0) / sum1.length) / Math.sqrt(2);

  // task calculate DFA
  return { sdnn, rmssd, pnn50, s1, s2 };
};

export const test = async (req, res, next) => {
  try {
    await Log.deleteMany({
      $or: [{ HR: 0 }, { RR: 0 }, { rrRMS: 0 }],
    });

    let user = await User.findById(req.user.id);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10000;
    const { startDate, endDate } = req.query;

    let filter = {
      guid_device: user.current_device || 'C0680226'
    };

    if (startDate && endDate) {

      // filter date by column date_created
      const dateStartF = `${String(new Date(startDate).getDate()).padStart(2, '0')}-${String(new Date(startDate).getMonth()).padStart(2, '0')}-${new Date(startDate).getFullYear()}`
      const dateEndF = `${String(new Date(endDate).getDate()).padStart(2, '0')}-${String(new Date(endDate).getMonth()).padStart(2, '0')}-${new Date(endDate).getFullYear()}`

      filter.date_created = {
        $gte: dateStartF,
        $lte: dateEndF,
      };

      console.log(filter)
    }

    if (req.user.role == 'doctor') {
      filter.guid_device = req.params.device;
    }

    const logs = await Log.find(filter)
      .sort({ create_at: -1 })
      .limit(limit);

    // console.log(logs, filter)

    if (logs.length === 0) {
      return res.status(404).json({ message: 'Log not found!' });
    }

    const calculate = calculateMetrics(logs);
    res.status(200).json({ logs, calculate });
  } catch (error) {
    console.error('Error in /api/user/test:', error.message);
    next(error);
  }
};

export const getRiwayatDeteksiWithDfa = async (req, res) => {
  let result = [];
  const theActivities = await Aktivitas.find({ userRef: req.params.userId }).sort({ Date: -1 });
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

  // console.log('testing', result);
  res.json({ message: 'oke', riwayat: result })
}

export const updateUser = async (req, res, next) => {
  if (req.user.id !== req.params.id)
    return next(errorHandler(401, 'You can only update your own account!'));
  try {
    if (req.body.password) {
      req.body.password = bcryptjs.hashSync(req.body.password, 10);
    }
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
      return res.status(200).json({ message: 'All log have relations now.', result : null });
    }

    if (!gap) gap = 30
    console.log({ gap })

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
      const [hour, minute] = time.split(":").map(Number);
      const startMinute = Math.floor(minute / parseInt(gap)) * parseInt(gap);
      const endMinute = startMinute + parseInt(gap);
      const startTime = `${hour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;
      const endHour = endMinute >= 60 ? hour + 1 : hour;
      const endTime = `${endHour.toString().padStart(2, '0')}:${(endMinute % 60).toString().padStart(2, '0')}`;
      return `${startTime}-${endTime}`;
    };

    // Loop melalui setiap kelompok tanggal
    Object.keys(groupedData).forEach((dateKey) => {
      const logsForDate = groupedData[dateKey];

      logsForDate.forEach((log) => {
        const logTime = new Date(log.create_at);
        const timeInterval = getTimeInterval(log.time);

        const key = `${dateKey}/${timeInterval}`;

        if (!result[key]) {
          result[key] = [];
        }
        result[key].push(log);
      });
    });

    // Urutkan hasil berdasarkan tanggal dengan urutan terbaru paling atas
    // result = Object.keys(result)
    //   .sort((a, b) => new Date(a.split('/')[0]) - new Date(b.split('/')[0]))
    //   .reduce((acc, key) => {
    //     acc[key] = result[key];
    //     return acc;
    //   }, {});

    // console.log({ result });

    // const result = groupLogsByTimeGap(logs, parseInt(gap));
    res.status(200).json({ result });

  } catch (error) {
    console.error('Error in /api/user/test:', error.message);
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

    console.log({ body: req.body });
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
      console.log({ timestampAwal, timestampAkhir });

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

      console.log({date : new Date(year, month - 1, day)})

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


