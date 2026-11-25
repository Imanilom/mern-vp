import mongoose from 'mongoose';
import PolarData from '../models/data.model.js';
import Segment from '../models/segment.model.js';
import CaparActivityTimeSeries from '../models/capar_activity_time_series.model.js';
import { getDoctorPatientAccounts } from './doctor.controller.js';
import {
  buildCaparActivityTimeSeries,
} from '../utils/caparActivityTimeSeries.js';
import { getJakartaDayRange } from '../utils/caparWindowAnalytics.js';

const NODE_LIMIT = 5000;

function getDateProjection(field) {
  return {
    $dateToString: {
      date: {
        $toDate: {
          $cond: [
            { $lt: [`$${field}`, 100_000_000_000] },
            { $multiply: [`$${field}`, 1000] },
            `$${field}`,
          ],
        },
      },
      format: '%Y-%m-%d',
      timezone: 'Asia/Jakarta',
    },
  };
}

async function getDates(model, accountId, timeField) {
  const rows = await model.aggregate([
    {
      $match: {
        user_id: accountId,
        [timeField]: { $type: 'number' },
      },
    },
    { $project: { day: getDateProjection(timeField) } },
    { $group: { _id: '$day' } },
    { $sort: { _id: -1 } },
  ]);
  return rows.map(({ _id }) => _id);
}

function getDateRange(dates, { date, allDates }) {
  if (allDates) {
    if (!dates.length) return null;
    const oldestDay = getJakartaDayRange(dates[dates.length - 1]);
    const newestDay = getJakartaDayRange(dates[0]);
    return { startMs: oldestDay.startMs, endMs: newestDay.endMs };
  }
  const selectedDate = date || dates[0] || null;
  return selectedDate ? getJakartaDayRange(selectedDate) : null;
}

function validateDateQuery(query, allowedFields) {
  const unknownFields = Object.keys(query).filter((field) => !allowedFields.has(field));
  if (unknownFields.length) {
    return `Query tidak dikenal: ${unknownFields.join(', ')}.`;
  }
  if (query.all_dates !== undefined && !['true', 'false'].includes(String(query.all_dates))) {
    return 'all_dates harus bernilai true atau false.';
  }
  if (query.all_dates === 'true' && query.date !== undefined) {
    return 'Pilih date atau all_dates, bukan keduanya.';
  }
  if (query.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(query.date))) {
    return 'Tanggal harus berformat YYYY-MM-DD.';
  }
  return null;
}

async function getPatientAccount(patientId) {
  if (!mongoose.isValidObjectId(patientId)) {
    return { error: { status: 400, message: 'patient_id tidak valid.' } };
  }
  const patients = await getDoctorPatientAccounts();
  const patient = patients.find((item) => String(item._id) === patientId);
  if (!patient) return { error: { status: 404, message: 'Pasien tidak ditemukan.' } };
  const userAccount = patient.account_refs?.find((ref) => ref.account_type === 'user');
  if (!userAccount) {
    return { error: { status: 404, message: 'Akun CAPAR pasien tidak tersedia.' } };
  }
  return { accountId: userAccount.account_id };
}

function timestampRangeFilter(timeField, range) {
  return {
    $or: [
      { [timeField]: { $gte: range.startMs, $lt: range.endMs } },
      {
        [timeField]: {
          $gte: Math.floor(range.startMs / 1000),
          $lt: Math.floor(range.endMs / 1000),
        },
      },
    ],
  };
}

function buildSelectedRange(dates, query) {
  const allDates = query.all_dates === 'true';
  const selectedDate = allDates ? null : String(query.date || dates[0] || '');
  if (!allDates && !selectedDate) {
    return { allDates, selectedDate: null, range: null };
  }
  try {
    return {
      allDates,
      selectedDate,
      range: getDateRange(dates, { date: selectedDate, allDates }),
    };
  } catch (error) {
    return { error };
  }
}

export async function listDoctorCaparRows(req, res) {
  try {
    const queryError = validateDateQuery(
      req.query,
      new Set(['patient_id', 'date', 'all_dates'])
    );
    if (queryError) return res.status(400).json({ success: false, message: queryError });

    const patientResult = await getPatientAccount(String(req.query.patient_id || ''));
    if (patientResult.error) {
      return res.status(patientResult.error.status).json({
        success: false,
        message: patientResult.error.message,
      });
    }

    const dates = await getDates(PolarData, patientResult.accountId, 'timestamp');
    const selection = buildSelectedRange(dates, req.query);
    if (selection.error) {
      return res.status(400).json({ success: false, message: selection.error.message });
    }
    if (!selection.range) {
      return res.json({
        success: true,
        count: 0,
        dates,
        selected_date: selection.selectedDate,
        date_mode: selection.allDates ? 'all' : 'day',
        truncated: false,
        data: [],
      });
    }

    const rows = await PolarData.aggregate([
      {
        $match: {
          user_id: patientResult.accountId,
          ...timestampRangeFilter('timestamp', selection.range),
        },
      },
      {
        $addFields: {
          timestamp_ms: {
            $cond: [
              { $lt: ['$timestamp', 100_000_000_000] },
              { $multiply: ['$timestamp', 1000] },
              '$timestamp',
            ],
          },
        },
      },
      { $sort: { timestamp_ms: -1, _id: -1 } },
      { $limit: NODE_LIMIT + 1 },
      {
        $project: {
          _id: 1,
          timestamp: 1,
          timestamp_ms: 1,
          hr: 1,
          rr: 1,
          rrms: 1,
          signal_quality: 1,
          acc_x: 1,
          acc_y: 1,
          acc_z: 1,
          step_count: 1,
          activity: 1,
          device_id: 1,
        },
      },
    ]);
    const truncated = rows.length > NODE_LIMIT;
    const data = rows.slice(0, NODE_LIMIT).reverse();
    return res.json({
      success: true,
      count: data.length,
      dates,
      selected_date: selection.selectedDate,
      date_mode: selection.allDates ? 'all' : 'day',
      truncated,
      data,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function listDoctorCaparActivityEpisodes(req, res) {
  try {
    const queryError = validateDateQuery(
      req.query,
      new Set(['patient_id', 'date', 'all_dates'])
    );
    if (queryError) return res.status(400).json({ success: false, message: queryError });

    const patientResult = await getPatientAccount(String(req.query.patient_id || ''));
    if (patientResult.error) {
      return res.status(patientResult.error.status).json({
        success: false,
        message: patientResult.error.message,
      });
    }

    const dates = await getDates(Segment, patientResult.accountId, 'window_start');
    const selection = buildSelectedRange(dates, req.query);
    if (selection.error) {
      return res.status(400).json({ success: false, message: selection.error.message });
    }
    const filter = { account_id: patientResult.accountId };
    if (selection.range) {
      filter.episode_start = {
        $gte: selection.range.startMs,
        $lt: selection.range.endMs,
      };
    } else {
      filter.episode_start = { $exists: false };
    }
    const aggregates = await CaparActivityTimeSeries.find(filter)
      .sort({ episode_start: 1, _id: 1 })
      .limit(NODE_LIMIT + 1)
      .lean();
    const truncated = aggregates.length > NODE_LIMIT;
    const data = aggregates.slice(0, NODE_LIMIT);
    return res.json({
      success: true,
      count: data.length,
      dates,
      selected_date: selection.selectedDate,
      date_mode: selection.allDates ? 'all' : 'day',
      truncated,
      data,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function rebuildDoctorCaparActivityEpisodes(req, res) {
  try {
    const { patient_id: patientId, date, all_dates: allDatesValue } = req.body || {};
    if (Object.keys(req.body || {}).some((key) => (
      !['patient_id', 'date', 'all_dates'].includes(key)
    ))) {
      return res.status(400).json({ success: false, message: 'Field body tidak dikenal.' });
    }
    const allDates = allDatesValue === true;
    if (allDatesValue !== undefined && typeof allDatesValue !== 'boolean') {
      return res.status(400).json({ success: false, message: 'all_dates harus boolean.' });
    }
    if (allDates && date !== undefined) {
      return res.status(400).json({ success: false, message: 'Pilih date atau all_dates, bukan keduanya.' });
    }
    if (date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return res.status(400).json({ success: false, message: 'Tanggal harus berformat YYYY-MM-DD.' });
    }

    const patientResult = await getPatientAccount(String(patientId || ''));
    if (patientResult.error) {
      return res.status(patientResult.error.status).json({
        success: false,
        message: patientResult.error.message,
      });
    }
    if (!mongoose.isValidObjectId(req.user?.id)) {
      return res.status(401).json({ success: false, message: 'Identitas dokter tidak valid.' });
    }

    const dates = await getDates(Segment, patientResult.accountId, 'window_start');
    const selection = buildSelectedRange(dates, {
      date: date === undefined ? undefined : String(date),
      all_dates: allDates ? 'true' : 'false',
    });
    if (selection.error) {
      return res.status(400).json({ success: false, message: selection.error.message });
    }
    if (!selection.range) {
      return res.status(404).json({
        success: false,
        message: 'Data window CAPAR tidak tersedia untuk pasien ini.',
      });
    }

    const segments = await Segment.find({
      user_id: patientResult.accountId,
      ...timestampRangeFilter('window_start', selection.range),
    })
      .select('_id device_id window_type window_start window_end activity_label raw_count is_valid rr_status features.mean_hr features.mean_rr features.motion_intensity features.rmssd features.dfa_alpha1')
      .lean();
    if (!segments.length) {
      return res.status(404).json({
        success: false,
        message: 'Window CAPAR tidak ditemukan pada rentang tanggal tersebut.',
      });
    }

    const generated = buildCaparActivityTimeSeries(segments, {
      accountId: patientResult.accountId,
      generatedBy: new mongoose.Types.ObjectId(req.user.id),
    });
    if (!generated.length) {
      return res.status(422).json({
        success: false,
        message: 'Window CAPAR tidak memiliki timestamp yang dapat diagregasikan.',
      });
    }
    const episodeKeys = generated.map((item) => item.episode_key);
    await CaparActivityTimeSeries.bulkWrite(generated.map((item) => ({
      updateOne: {
        filter: {
          account_id: item.account_id,
          episode_key: item.episode_key,
        },
        update: { $set: item },
        upsert: true,
      },
    })));
    await CaparActivityTimeSeries.deleteMany({
      account_id: patientResult.accountId,
      episode_start: {
        $gte: selection.range.startMs,
        $lt: selection.range.endMs,
      },
      episode_key: { $nin: episodeKeys },
    });

    return res.json({
      success: true,
      message: 'Agregat episode aktivitas CAPAR berhasil diperbarui.',
      count: generated.length,
      selected_date: selection.selectedDate,
      date_mode: allDates ? 'all' : 'day',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
