import mongoose from 'mongoose';
import PolarData from '../models/data.model.js';
import Segment from '../models/segment.model.js';
import CaparActivityTimeSeries from '../models/capar_activity_time_series.model.js';
import PatientAppWearableSample from '../models/patient_app_wearable_sample.model.js';
import MobileStreamLog from '../models/mobile_stream_log.model.js';
import Baseline from '../models/baseline.model.js';
import AnomalyEvent from '../models/anomalyevent.model.js';
import CaparDynamicProfile from '../models/capar_dynamic_profile.model.js';
import { getDoctorPatientAccounts } from './doctor.controller.js';
import {
  buildCaparActivityTimeSeries,
} from '../utils/caparActivityTimeSeries.js';
import {
  getJakartaDayRange,
  normalizeEpochMs,
} from '../utils/caparWindowAnalytics.js';
import {
  buildCaparTemporalTimeline,
  buildTemporalEdges,
} from '../utils/caparTemporalTimeline.js';
import {
  findGraphPath,
  getGraphNeighbors,
  projectCaparGraph,
} from '../utils/caparGraph.js';

const NODE_LIMIT = 5000;
const TIMELINE_SOURCE_LIMIT = 50_000;
const GRAPH_PAGE_LIMIT = 500;
const GRAPH_OFFSET_LIMIT = 500_000;

function getDateProjection(field) {
  return {
    $dateToString: {
      date: {
        $toDate: {
          $cond: [
            { $eq: [{ $type: `$${field}` }, 'date'] },
            `$${field}`,
            {
              $cond: [
                { $lt: [`$${field}`, 100_000_000_000] },
                { $multiply: [`$${field}`, 1000] },
                `$${field}`,
              ],
            },
          ],
        },
      },
      format: '%Y-%m-%d',
      timezone: 'Asia/Jakarta',
    },
  };
}

async function getDates(model, accountId, timeField, {
  accountField = 'user_id',
  extraMatch = {},
  accountValue = accountId,
} = {}) {
  const rows = await model.aggregate([
    {
      $match: {
        [accountField]: accountValue,
        ...extraMatch,
        [timeField]: { $type: ['number', 'date'] },
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
  return {
    accountId: userAccount.account_id,
    patient: { _id: patient._id, name: patient.name, email: patient.email },
  };
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

function meanOfFinite(values = []) {
  const finite = values.map(Number).filter(Number.isFinite);
  return finite.length
    ? finite.reduce((total, value) => total + value, 0) / finite.length
    : null;
}

function averageAcceleration(samples = [], axis) {
  return meanOfFinite(samples.map((sample) => sample?.[axis]));
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

function parseBoundedInteger(value, fallback, minimum, maximum) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(String(value))) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : null;
}

export async function listDoctorCaparTemporalTimeline(req, res) {
  try {
    const queryError = validateDateQuery(
      req.query,
      new Set(['patient_id', 'date', 'all_dates', 'device_id', 'include_detail'])
    );
    if (queryError) return res.status(400).json({ success: false, message: queryError });
    if (req.query.include_detail !== undefined
      && !['true', 'false'].includes(String(req.query.include_detail))) {
      return res.status(400).json({
        success: false,
        message: 'include_detail harus bernilai true atau false.',
      });
    }
    const includeDetail = req.query.include_detail !== 'false';
    const deviceId = req.query.device_id === undefined
      ? null
      : String(req.query.device_id).trim();
    if (req.query.device_id !== undefined && !deviceId) {
      return res.status(400).json({ success: false, message: 'device_id tidak boleh kosong.' });
    }

    const patientResult = await getPatientAccount(String(req.query.patient_id || ''));
    if (patientResult.error) {
      return res.status(patientResult.error.status).json({
        success: false,
        message: patientResult.error.message,
      });
    }
    const accountId = patientResult.accountId;
    const dateLists = includeDetail
      ? await Promise.all([
        getDates(PolarData, accountId, 'timestamp'),
        getDates(Segment, accountId, 'window_start'),
        getDates(PatientAppWearableSample, accountId, 'recorded_at', {
          accountField: 'account_id',
          extraMatch: { account_type: 'user' },
          accountValue: accountId,
        }),
        getDates(AnomalyEvent, accountId, 'onset_time'),
        getDates(MobileStreamLog, accountId, 'created_at', {
          accountField: 'user_id',
          accountValue: String(accountId),
        }),
      ])
      : await Promise.all([
        getDates(Segment, accountId, 'window_start'),
        getDates(CaparActivityTimeSeries, accountId, 'episode_start', {
          accountField: 'account_id',
        }),
      ]);
    const dates = [...new Set(dateLists.flat())].sort((first, second) => second.localeCompare(first));
    const selection = buildSelectedRange(dates, req.query);
    if (selection.error) {
      return res.status(400).json({ success: false, message: selection.error.message });
    }
    if (!selection.range) {
      return res.json({
        success: true,
        detail_included: includeDetail,
        dates,
        selected_date: selection.selectedDate,
        count: { rows: 0, windows: 0, activities: 0, episodes: 0 },
        rows: [],
        windows: [],
        activities: [],
        episodes: [],
        anchors: [],
        device_sessions: [],
        temporal_edges: { rows: [], windows: [], activities: [], episodes: [] },
        truncated: {
          rows: false,
          wearable_samples: false,
          windows: false,
          activities: false,
          episodes: false,
          evidence: false,
        },
      });
    }

    const sourceFilter = deviceId ? { device_id: deviceId } : {};
    const windowQuery = Segment.find({
      user_id: accountId,
      ...sourceFilter,
      ...timestampRangeFilter('window_start', selection.range),
    });
    windowQuery.select(includeDetail
      ? '_id device_id window_type window_start window_end activity_label raw_count is_valid analyzed classification anomaly_score rr_status signal_quality_detail missing_data_info.confidence_score missing_data_info.missing_ratio features'
      : '_id device_id window_type window_start window_end activity_label raw_count is_valid analyzed classification anomaly_score rr_status signal_quality_detail.q_signal signal_quality_detail.q_complete signal_quality_detail.artifact_fraction signal_quality_detail.reasons missing_data_info.confidence_score missing_data_info.missing_ratio features.mean_hr features.mean_rr features.rmssd features.sdnn features.dfa_alpha1 features.dfa_alpha2 features.motion_intensity');
    const activityQuery = CaparActivityTimeSeries.find({
      account_id: accountId,
      ...sourceFilter,
      episode_start: { $gte: selection.range.startMs, $lt: selection.range.endMs },
    });
    if (!includeDetail) {
      activityQuery.select('episode_key device_id window_type day_key activity_label episode_start episode_end source_segment_ids summary.window_count summary.valid_window_count summary.mean_hr summary.mean_rr summary.mean_sdnn summary.mean_rmssd summary.mean_dfa_alpha1 summary.mean_dfa_alpha2 summary.mean_motion_intensity');
    }
    const [rowDocs, windowDocs, activityDocs, wearableSamples, episodeDocs, streamLogs, baselines] = await Promise.all([
      includeDetail ? PolarData.find({
        user_id: accountId,
        ...sourceFilter,
        ...timestampRangeFilter('timestamp', selection.range),
      })
        .select('_id timestamp hr rr rrms signal_quality acc_x acc_y acc_z step_count activity device_id')
        .sort({ timestamp: 1, _id: 1 })
        .limit(TIMELINE_SOURCE_LIMIT + 1)
        .lean() : [],
      windowQuery
        .sort({ window_start: 1, _id: 1 })
        .limit(TIMELINE_SOURCE_LIMIT + 1)
        .lean(),
      activityQuery
        .sort({ episode_start: 1, _id: 1 })
        .limit(TIMELINE_SOURCE_LIMIT + 1)
        .lean(),
      includeDetail ? PatientAppWearableSample.find({
        account_id: accountId,
        account_type: 'user',
        ...(deviceId ? { device_id: deviceId } : {}),
        recorded_at: {
          $gte: new Date(selection.range.startMs),
          $lt: new Date(selection.range.endMs),
        },
      })
        .select('_id device_id recorded_at sensor_contact signal_confidence heart_rate_bpm rr_intervals_ms acceleration_g activity activity_intensity rmssd_ms sdnn_ms dfa_alpha1 spo2_pct steps data_quality')
        .sort({ recorded_at: 1, _id: 1 })
        .limit(TIMELINE_SOURCE_LIMIT + 1)
        .lean() : [],
      includeDetail ? AnomalyEvent.find({
        user_id: accountId,
        ...(deviceId ? { device_id: deviceId } : {}),
        onset_time: { $gte: selection.range.startMs, $lt: selection.range.endMs },
      })
        .select('_id device_id activity onset_time started_at candidate_at persistent_at peak_time recovery_started_at recovered_at resolved_time unresolved_at actual_onset_time duration_ms onset_score peak_score peak_hr baseline_hr classification z_scores_at_peak trajectory status physiological_outcome current_state confidence segment_ids parent_episode_id ttr_min')
        .sort({ onset_time: 1, _id: 1 })
        .limit(TIMELINE_SOURCE_LIMIT + 1)
        .lean() : AnomalyEvent.find({
          user_id: accountId,
          ...(deviceId ? { device_id: deviceId } : {}),
          onset_time: { $gte: selection.range.startMs, $lt: selection.range.endMs },
        })
          .select('_id device_id activity onset_time started_at peak_time recovered_at resolved_time duration_ms classification status physiological_outcome current_state confidence segment_ids parent_episode_id ttr_min')
          .sort({ onset_time: 1, _id: 1 })
          .limit(TIMELINE_SOURCE_LIMIT + 1)
          .lean(),
      includeDetail ? MobileStreamLog.find({
        user_id: String(accountId),
        ...(deviceId ? { device_id: deviceId } : {}),
        created_at: {
          $gte: new Date(selection.range.startMs),
          $lt: new Date(selection.range.endMs),
        },
      })
        .select('_id device_id event created_at mqtt_connected')
        .sort({ created_at: 1, _id: 1 })
        .limit(TIMELINE_SOURCE_LIMIT + 1)
        .lean() : [],
      Baseline.find({ user_id: accountId })
        .select('activity time_period stats.mean_hr stats.mean_rr stats.rmssd stats.dfa_alpha1 stats.motion_intensity segment_count is_mature')
        .lean(),
    ]);
    const rowsTruncated = includeDetail && rowDocs.length > TIMELINE_SOURCE_LIMIT;
    const wearableSamplesTruncated = wearableSamples.length > TIMELINE_SOURCE_LIMIT;
    const windowsTruncated = windowDocs.length > TIMELINE_SOURCE_LIMIT;
    const activitiesTruncated = activityDocs.length > TIMELINE_SOURCE_LIMIT;
    const episodesTruncated = episodeDocs.length > TIMELINE_SOURCE_LIMIT;
    const evidenceTruncated = includeDetail && streamLogs.length > TIMELINE_SOURCE_LIMIT;
    const polarRows = rowDocs.slice(0, TIMELINE_SOURCE_LIMIT).map((row) => ({
      ...row,
      timestamp_ms: normalizeEpochMs(row.timestamp),
      source_collection: 'PolarData',
      source_id: String(row._id),
    })).sort((first, second) => first.timestamp_ms - second.timestamp_ms
      || String(first._id).localeCompare(String(second._id)));
    const contactSamples = wearableSamples.slice(0, TIMELINE_SOURCE_LIMIT);
    const wearableRows = contactSamples.map((sample) => {
      const timestamp = normalizeEpochMs(sample.recorded_at);
      const rrValues = sample.rr_intervals_ms || [];
      const id = String(sample._id);
      return {
        _id: `wearable:${id}`,
        source_id: id,
        source_collection: 'PatientAppWearableSample',
        timestamp,
        timestamp_ms: timestamp,
        hr: sample.heart_rate_bpm,
        rr: meanOfFinite(rrValues),
        rr_interval_count: rrValues.length,
        rmssd_ms: sample.rmssd_ms,
        sdnn_ms: sample.sdnn_ms,
        dfa_alpha1: sample.dfa_alpha1,
        acc_x: averageAcceleration(sample.acceleration_g, 'x'),
        acc_y: averageAcceleration(sample.acceleration_g, 'y'),
        acc_z: averageAcceleration(sample.acceleration_g, 'z'),
        activity: sample.activity || sample.activity_intensity || 'Unknown',
        signal_quality: sample.signal_confidence,
        data_quality: sample.data_quality?.status,
        sensor_contact: sample.sensor_contact,
        device_id: sample.device_id,
      };
    }).filter((row) => row.timestamp_ms !== null);
    const rows = [...polarRows, ...wearableRows].sort((first, second) => (
      first.timestamp_ms - second.timestamp_ms
      || String(first._id).localeCompare(String(second._id))
    ));
    const activities = activityDocs.slice(0, TIMELINE_SOURCE_LIMIT);
    const episodes = episodeDocs.slice(0, TIMELINE_SOURCE_LIMIT);
    const activitySegments = new Map();
    for (const activity of activities) {
      for (const segmentId of activity.source_segment_ids || []) {
        activitySegments.set(String(segmentId), activity.episode_key);
      }
    }
    const windows = windowDocs.slice(0, TIMELINE_SOURCE_LIMIT).map((window) => ({
      ...window,
      parent_episode_id: activitySegments.get(String(window._id)) || null,
      parent_relation_source: activitySegments.has(String(window._id))
        ? 'CaparActivityTimeSeries.source_segment_ids'
        : null,
    })).sort((first, second) => (
      (normalizeEpochMs(first.window_start) ?? 0)
      - (normalizeEpochMs(second.window_start) ?? 0)
      || String(first._id).localeCompare(String(second._id))
    ));
    let rowsWithLineage = [];
    if (includeDetail) {
      const windowsByDevice = new Map();
      for (const window of windows) {
        const deviceKey = String(window.device_id || 'UNKNOWN');
        if (!windowsByDevice.has(deviceKey)) windowsByDevice.set(deviceKey, []);
        windowsByDevice.get(deviceKey).push(window);
      }
      rowsWithLineage = rows.map((row) => {
        const candidates = windowsByDevice.get(String(row.device_id || 'UNKNOWN')) || [];
        let low = 0;
        let high = candidates.length - 1;
        let parent = null;
        while (low <= high) {
          const middle = Math.floor((low + high) / 2);
          const startTime = normalizeEpochMs(candidates[middle].window_start) ?? Infinity;
          if (startTime <= row.timestamp_ms) {
            parent = candidates[middle];
            low = middle + 1;
          } else {
            high = middle - 1;
          }
        }
        const endTime = parent ? normalizeEpochMs(parent.window_end) : null;
        const hasOverlap = parent && endTime !== null && row.timestamp_ms <= endTime;
        return {
          ...row,
          parent_window_id: hasOverlap ? String(parent._id) : null,
          parent_relation_source: hasOverlap ? 'timestamp_overlap' : null,
        };
      });
    }
    const temporal = includeDetail
      ? buildCaparTemporalTimeline({
        accountId,
        rows: rowsWithLineage,
        windows,
        activities,
        wearableSamples: contactSamples,
        streamLogs: streamLogs.slice(0, TIMELINE_SOURCE_LIMIT),
      })
      : { anchors: [], device_sessions: [] };
    const getActivity = (node, mode) => (
      mode === 'rows' ? node.activity : mode === 'windows' ? node.activity_label : node.activity_label
    );
    const getMetric = (node, mode) => (
      mode === 'rows'
        ? node.hr
        : mode === 'windows'
          ? node.features?.mean_hr
          : mode === 'episodes'
            ? node.peak_hr
            : node.summary?.mean_hr
    );
    const edgesFor = (data, mode) => buildTemporalEdges(data, {
      getTime: (node) => mode === 'rows'
        ? normalizeEpochMs(node.timestamp_ms)
        : mode === 'windows'
          ? normalizeEpochMs(node.window_start)
          : mode === 'episodes'
            ? normalizeEpochMs(node.onset_time)
            : normalizeEpochMs(node.episode_start),
      getActivity: (node) => mode === 'episodes' ? node.activity : getActivity(node, mode),
      getMetric: (node) => getMetric(node, mode),
      getId: (node) => mode === 'activities' ? node.episode_key || node._id : node._id,
    });

    return res.json({
      success: true,
      detail_included: includeDetail,
      count: {
        rows: rowsWithLineage.length,
        windows: windows.length,
        activities: activities.length,
        episodes: episodes.length,
      },
      dates,
      patient_id: String(req.query.patient_id),
      user_id: String(accountId),
      selected_date: selection.selectedDate,
      date_mode: selection.allDates ? 'all' : 'day',
      selected_device: deviceId,
      baselines,
      rows: rowsWithLineage,
      windows,
      activities,
      anchors: temporal.anchors,
      device_sessions: temporal.device_sessions,
      temporal_edges: {
        rows: includeDetail ? edgesFor(rowsWithLineage, 'rows') : [],
        windows: includeDetail ? edgesFor(windows, 'windows') : [],
        activities: includeDetail ? edgesFor(activities, 'activities') : [],
        episodes: includeDetail ? edgesFor(episodes, 'episodes') : [],
      },
      truncated: {
        rows: rowsTruncated,
        wearable_samples: wearableSamplesTruncated,
        windows: windowsTruncated,
        activities: activitiesTruncated,
        episodes: episodesTruncated,
        evidence: evidenceTruncated,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function listDoctorCaparGraph(req, res) {
  try {
    const allowedFields = new Set([
      'patient_id', 'date', 'all_dates', 'device_id',
      'operation', 'node_id', 'start_id', 'target_id', 'weighted', 'limit', 'offset',
    ]);
    const unknownFields = Object.keys(req.query).filter((field) => !allowedFields.has(field));
    if (unknownFields.length) {
      return res.status(400).json({ success: false, message: `Query tidak dikenal: ${unknownFields.join(', ')}.` });
    }

    const operation = req.query.operation || 'page';
    if (!['page', 'neighbors', 'path'].includes(operation)) {
      return res.status(400).json({ success: false, message: 'operation harus page, neighbors, atau path.' });
    }
    const limit = parseBoundedInteger(req.query.limit, 200, 1, GRAPH_PAGE_LIMIT);
    const offset = parseBoundedInteger(req.query.offset, 0, 0, GRAPH_OFFSET_LIMIT);
    if (limit === null || offset === null) {
      return res.status(400).json({
        success: false,
        message: `limit harus 1-${GRAPH_PAGE_LIMIT} dan offset harus 0-${GRAPH_OFFSET_LIMIT}.`,
      });
    }
    if (req.query.weighted !== undefined && !['true', 'false'].includes(String(req.query.weighted))) {
      return res.status(400).json({ success: false, message: 'weighted harus bernilai true atau false.' });
    }
    if (operation === 'neighbors' && !String(req.query.node_id || '').trim()) {
      return res.status(400).json({ success: false, message: 'node_id wajib untuk operation neighbors.' });
    }
    if (operation === 'path' && (!String(req.query.start_id || '').trim()
      || !String(req.query.target_id || '').trim())) {
      return res.status(400).json({ success: false, message: 'start_id dan target_id wajib untuk operation path.' });
    }

    const timelineQuery = Object.fromEntries(
      ['patient_id', 'date', 'all_dates', 'device_id']
        .filter((key) => req.query[key] !== undefined)
        .map((key) => [key, req.query[key]]),
    );
    timelineQuery.include_detail = 'false';
    let timelineStatus = 200;
    let timelinePayload;
    const responseCapture = {
      status(statusCode) {
        timelineStatus = statusCode;
        return this;
      },
      json(payload) {
        timelinePayload = payload;
        return payload;
      },
    };
    await listDoctorCaparTemporalTimeline({ query: timelineQuery }, responseCapture);
    if (timelineStatus !== 200 || !timelinePayload?.success) {
      return res.status(timelineStatus).json(timelinePayload || {
        success: false,
        message: 'Gagal memuat sumber graph CAPAR.',
      });
    }

    const graph = projectCaparGraph({
      patient: { _id: timelinePayload.patient_id },
      rows: timelinePayload.rows,
      windows: timelinePayload.windows,
      activities: timelinePayload.activities,
      episodes: timelinePayload.episodes,
      anchors: timelinePayload.anchors,
      deviceSessions: timelinePayload.device_sessions,
    });
    const baseResponse = {
      success: true,
      operation,
      detail_included: timelinePayload.detail_included,
      summary: graph.summary,
      truncated: timelinePayload.truncated,
    };

    if (operation === 'neighbors') {
      const nodeId = String(req.query.node_id);
      const center = graph.nodeById.get(nodeId);
      if (!center) return res.status(404).json({ success: false, message: 'Node graph tidak ditemukan.' });
      const neighbors = getGraphNeighbors(graph, nodeId);
      const page = neighbors.slice(offset, offset + limit);
      const edges = [...new Map(page.flatMap(({ edges: relationships }) => (
        relationships.map((edge) => [edge.id, edge])
      ))).values()];
      return res.json({
        ...baseResponse,
        center,
        nodes: [center, ...page.map(({ node }) => node)],
        edges,
        offset,
        limit,
        total_neighbors: neighbors.length,
        has_more: offset + page.length < neighbors.length,
        next_offset: offset + page.length < neighbors.length ? offset + page.length : null,
      });
    }

    if (operation === 'path') {
      const startId = String(req.query.start_id);
      const targetId = String(req.query.target_id);
      const weighted = req.query.weighted === 'true';
      const path = findGraphPath(graph, startId, targetId, {
        weighted,
        edgeTypes: weighted ? ['NEXT'] : null,
      });
      if ((!graph.nodeById.has(startId) || !graph.nodeById.has(targetId))) {
        return res.status(404).json({ success: false, message: 'Node awal atau tujuan tidak ditemukan.' });
      }
      return res.json({
        ...baseResponse,
        weighted,
        path,
        nodes: path ? path.nodeIds.map((id) => graph.nodeById.get(id)) : [],
        edges: path ? path.edgeIds.map((id) => graph.edgeById.get(id)) : [],
      });
    }

    const orderedNodes = [...graph.nodes].sort((first, second) => (
      (first.timestamp ?? -Infinity) - (second.timestamp ?? -Infinity)
      || first.type.localeCompare(second.type)
      || first.id.localeCompare(second.id)
    ));
    const nodes = orderedNodes.slice(offset, offset + limit);
    const nodeIds = new Set(nodes.map(({ id }) => id));
    const edges = graph.edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));
    const hasMore = offset + nodes.length < orderedNodes.length;
    return res.json({
      ...baseResponse,
      nodes,
      edges,
      offset,
      limit,
      total_nodes: orderedNodes.length,
      total_edges: graph.edges.length,
      has_more: hasMore,
      next_offset: hasMore ? offset + nodes.length : null,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function saveDoctorCaparDynamicProfile(req, res) {
  try {
    const patientId = String(req.body?.patient_id || '');
    const scope = String(req.body?.scope || '');
    const analysisDate = String(req.body?.date || '');
    const activity = String(req.body?.activity || 'all').trim();
    const episodeKey = String(req.body?.episode_key || '').trim();
    const windowId = String(req.body?.window_id || '').trim();
    const profile = req.body?.profile;
    if (!mongoose.isValidObjectId(patientId)) {
      return res.status(400).json({ success: false, message: 'patient_id tidak valid.' });
    }
    if (!['person', 'day', 'activity', 'window'].includes(scope)) {
      return res.status(400).json({ success: false, message: 'Scope dynamic profile tidak valid.' });
    }
    if (analysisDate && !/^\d{4}-\d{2}-\d{2}$/.test(analysisDate)) {
      return res.status(400).json({ success: false, message: 'Tanggal harus berformat YYYY-MM-DD.' });
    }
    if (!activity || activity.length > 120 || episodeKey.length > 160 || windowId.length > 160) {
      return res.status(400).json({ success: false, message: 'Konteks dynamic profile tidak valid.' });
    }
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)
      || profile.source !== 'mongo' || profile.scope !== scope
      || !Array.isArray(profile.graph?.nodes) || !Array.isArray(profile.graph?.edges)
      || profile.graph.nodes.length > 500 || profile.graph.edges.length > 1000
      || !profile.model || typeof profile.model !== 'object'
      || !Array.isArray(profile.history) || profile.history.length > 365) {
      return res.status(400).json({ success: false, message: 'Payload dynamic profile tidak valid.' });
    }
    const serializedProfile = JSON.stringify(profile);
    if (serializedProfile.length > 2_000_000) {
      return res.status(413).json({ success: false, message: 'Payload dynamic profile terlalu besar.' });
    }

    const patientResult = await getPatientAccount(patientId);
    if (patientResult.error) {
      return res.status(patientResult.error.status).json({
        success: false,
        message: patientResult.error.message,
      });
    }
    if (!mongoose.isValidObjectId(req.user?.id)) {
      return res.status(401).json({ success: false, message: 'Identitas dokter tidak valid.' });
    }

    const data = await CaparDynamicProfile.findOneAndUpdate(
      {
        account_id: patientResult.accountId,
        scope,
        analysis_date: analysisDate,
        activity,
        episode_key: episodeKey,
        window_id: windowId,
      },
      {
        $set: {
          patient_id: patientResult.patient._id,
          payload: profile,
          generated_by: req.user.id,
          algorithm_version: 'capar-dynamic-profile-v1',
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean();

    return res.status(201).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function listDoctorCaparRows(req, res) {
  try {
    const queryError = validateDateQuery(
      req.query,
      new Set(['patient_id', 'date', 'all_dates', 'offset'])
    );
    if (queryError) return res.status(400).json({ success: false, message: queryError });
    const offset = Number(req.query.offset || 0);
    if (!Number.isSafeInteger(offset) || offset < 0) {
      return res.status(400).json({ success: false, message: 'offset harus bilangan bulat non-negatif.' });
    }

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
      { $skip: offset },
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
      next_offset: truncated ? offset + NODE_LIMIT : null,
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
      .select('_id device_id window_type window_start window_end activity_label raw_count is_valid classification rr_status signal_quality_detail.q_signal missing_data_info.confidence_score features.mean_hr features.mean_rr features.sdnn features.motion_intensity features.rmssd features.dfa_alpha1 features.dfa_alpha2')
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
