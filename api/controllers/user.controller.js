import bcryptjs from 'bcryptjs';
import User from '../models/user.model.js';
import Log from '../models/log.model.js';
import Aktivitas from '../models/activity.model.js';
import { errorHandler } from '../utils/error.js';

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

  return { sdnn, rmssd, pnn50, s1, s2 };
};

export const test = async (req, res, next) => {
  try {
    await Log.deleteMany({
      $or: [{ HR: 0 }, { RR: 0 }, { rrRMS: 0 }],
    });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10000;
    const { startDate, endDate } = req.query;
    let filter = {};

    if (startDate && endDate) {
      const start = new Date(startDate).getTime() / 1000; // Convert to Unix time
      const end = new Date(endDate).getTime() / 1000; // Convert to Unix time

      filter.timestamp = {
        $gte: start,
        $lte: end,
      };
    }

    const logs = await Log.find(filter)
      .sort({ create_at: -1 })
      .limit(limit);

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