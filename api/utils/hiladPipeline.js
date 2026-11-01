import mongoose from 'mongoose';
import PolarData from '../models/data.model.js';
import HiladModel from '../models/hilad_model.model.js';
import HiladWindow from '../models/hilad_window.model.js';
import PatientAppProfile from '../models/patient_app_profile.model.js';
import { errorHandler } from './error.js';
import {
  buildQualityGatedMinuteSequence,
  evaluateLstmAutoencoder,
  HILAD_MIN_TRAINING_WINDOWS,
  HILAD_RETRAIN_WINDOW_INTERVAL,
  trainLstmAutoencoder,
} from './hiladLstmAutoencoder.js';

const trainingTasks = new Map();
const ACTIVITIES = new Set([
  'rest', 'sitting', 'standing', 'walking', 'running', 'exercise', 'sleep', 'other',
]);
const ACTIVITY_ALIASES = {
  rest: ['Istirahat'],
  sitting: ['Duduk'],
  standing: ['Berdiri'],
  walking: ['Berjalan', 'Berjalan Cepat', 'Naik Tangga'],
  running: ['Berlari', 'Lari Cepat'],
  exercise: ['Olahraga Berat', 'Bersepeda', 'Berenang', 'Senam', 'Yoga'],
  sleep: ['Tidur', 'Berbaring'],
  other: ['Lainnya'],
};

function activityForPolar(activity) {
  const first = ACTIVITY_ALIASES[activity]?.[0];
  return first || 'Lainnya';
}

function toSequenceReading(document) {
  return {
    timestamp: Number(document.timestamp),
    hr: Number(document.hr),
    rr: Number(document.rr),
    acc_x: Number(document.acc_x),
    acc_y: Number(document.acc_y),
    acc_z: Number(document.acc_z),
    signal_quality: Number(document.signal_quality),
  };
}

function sequencesFromPolarReadings(readings) {
  const byMinute = new Map();
  for (const reading of readings) {
    const minute = Math.floor(reading.timestamp / 60) * 60;
    const bucket = byMinute.get(minute) || [];
    bucket.push(reading);
    byMinute.set(minute, bucket);
  }
  const sequences = [];
  for (const [minute, minuteReadings] of byMinute) {
    const sequence = buildQualityGatedMinuteSequence(minuteReadings);
    if (sequence) sequences.push({ ...sequence, window_start: minute });
  }
  return sequences.sort((left, right) => left.window_start - right.window_start);
}

function trainingKey(accountId, activity) {
  return `${accountId.toString()}:${activity}`;
}

async function trainAccountModel(accountId, activity) {
  const key = trainingKey(accountId, activity);
  if (trainingTasks.has(key)) return;
  trainingTasks.set(key, true);

  try {
    const modelDocument = await HiladModel.findOne({
      account_id: accountId,
      activity,
    });
    if (!modelDocument) return;
    modelDocument.status = 'training';
    modelDocument.last_error = null;
    await modelDocument.save();

    const trainingWindows = await HiladWindow.find({
      account_id: accountId,
      activity,
      feedback_label: { $in: [null, 'normal'] },
    })
      .sort({ window_start: 1 })
      .limit(500)
      .select('sequence')
      .lean();
    if (trainingWindows.length < HILAD_MIN_TRAINING_WINDOWS) {
      modelDocument.status = 'warming_up';
      await modelDocument.save();
      return;
    }

    const trained = await trainLstmAutoencoder(trainingWindows);
    modelDocument.status = 'ready';
    modelDocument.version += 1;
    modelDocument.weights = trained.weights;
    modelDocument.anomaly_threshold = trained.threshold;
    modelDocument.training_window_count = trained.training_window_count;
    modelDocument.last_trained_at = new Date();
    modelDocument.last_error = null;
    await modelDocument.save();
  } catch (error) {
    await HiladModel.updateOne(
      { account_id: accountId, activity },
      { $set: { status: 'failed', last_error: error.message.slice(0, 500) } }
    );
    console.error(`[HILAD] Training failed for ${trainingKey(accountId, activity)}: ${error.message}`);
  } finally {
    trainingTasks.delete(key);
  }
}

function scheduleTraining(accountId, activity) {
  void trainAccountModel(accountId, activity);
}

export async function analyzePolarRecordingWithHilad({
  accountId,
  accountScopes,
  activity,
  deviceId,
}) {
  if (!ACTIVITIES.has(activity)) {
    throw errorHandler(400, 'Aktivitas tidak didukung untuk analisis HILAD.');
  }
  const profile = await PatientAppProfile.findOne({
    $or: accountScopes,
  }).select('ai_processing_consent').lean();
  if (profile?.ai_processing_consent?.granted !== true) {
    return {
      status: 'consent_required',
      message: 'Aktifkan persetujuan pemrosesan AI pada profil untuk memakai LSTM-AE.',
    };
  }

  const currentMinute = Math.floor(Date.now() / 60_000) * 60;
  const polarActivities = ACTIVITY_ALIASES[activity];
  const storedReadings = await PolarData.find({
    user_id: accountId,
    device_id: deviceId,
    activity: { $in: polarActivities },
    timestamp: { $gte: currentMinute - 60, $lt: currentMinute },
    signal_quality: { $gte: 0.5 },
  })
    .sort({ timestamp: 1 })
    .select('timestamp hr rr acc_x acc_y acc_z signal_quality')
    .lean();

  const sequences = sequencesFromPolarReadings(storedReadings.map(toSequenceReading));
  for (const sequence of sequences) {
    await HiladWindow.updateOne(
      {
        account_id: accountId,
        activity,
        window_start: sequence.window_start,
      },
      {
        $setOnInsert: {
          account_id: accountId,
          activity,
          device_id: deviceId,
          window_start: sequence.window_start,
          window_end: sequence.window_end,
          sequence: sequence.sequence,
        },
      },
      { upsert: true, runValidators: true }
    );
  }

  let model = await HiladModel.findOne({ account_id: accountId, activity });
  if (!model) {
    model = await HiladModel.create({
      account_id: accountId,
      activity,
      status: 'warming_up',
      window_size: 60,
      feature_count: 5,
    });
  }
  const eligibleCount = await HiladWindow.countDocuments({
    account_id: accountId,
    activity,
    feedback_label: { $in: [null, 'normal'] },
  });
  if (
    eligibleCount >= HILAD_MIN_TRAINING_WINDOWS
    && (model.status === 'warming_up'
      || eligibleCount >= model.training_window_count + HILAD_RETRAIN_WINDOW_INTERVAL)
    && model.status !== 'failed'
    && model.status !== 'training'
  ) {
    scheduleTraining(accountId, activity);
  }

  let latestWindow = await HiladWindow.findOne({ account_id: accountId, activity })
    .sort({ window_end: -1 })
    .lean();
  model = await HiladModel.findOne({ account_id: accountId, activity }).lean();
  if (
    model?.status === 'ready'
    && latestWindow
    && (
      latestWindow.reconstruction_score === null
      || latestWindow.model_version !== model.version
    )
  ) {
    const result = await evaluateLstmAutoencoder(model, latestWindow.sequence);
    await HiladWindow.updateOne(
      { _id: latestWindow._id, account_id: accountId },
      {
        $set: {
          reconstruction_errors: result.reconstruction_errors,
          reconstruction_score: result.reconstruction_score,
          anomaly_threshold: result.anomaly_threshold,
          model_version: result.model_version,
          is_anomaly_candidate: result.is_anomaly_candidate,
        },
      }
    );
    latestWindow = {
      ...latestWindow,
      reconstruction_errors: result.reconstruction_errors,
      reconstruction_score: result.reconstruction_score,
      anomaly_threshold: result.anomaly_threshold,
      model_version: result.model_version,
      is_anomaly_candidate: result.is_anomaly_candidate,
    };
  }
  if (
    model?.status === 'ready'
    && latestWindow
    && latestWindow.reconstruction_score !== null
  ) {
    const errors = latestWindow.reconstruction_errors || [];
    const temporalAttributions = errors.map((row) =>
      row.reduce((sum, value) => sum + value, 0) / row.length
    );
    const total = temporalAttributions.reduce((sum, value) => sum + value, 0);
    return {
      status: 'evaluated',
      window_id: latestWindow._id,
      activity,
      window_start: latestWindow.window_start,
      window_end: latestWindow.window_end,
      model_version: model.version,
      reconstruction_score: latestWindow.reconstruction_score,
      anomaly_threshold: latestWindow.anomaly_threshold,
      model_version: latestWindow.model_version,
      is_anomaly_candidate: latestWindow.is_anomaly_candidate,
      temporal_attributions: temporalAttributions.map((value) =>
        total > 0 ? value / total : 0
      ),
      method: 'lstm_autoencoder_reconstruction_error',
      explanation_note: 'Reconstruction residual menunjukkan bagian yang tidak cocok dengan pola latih; bukan CAM atau diagnosis.',
      training_window_count: model.training_window_count,
      threshold_source: '95th_percentile_of_held_out_quality_gated_reconstruction_error_x_1.25',
    };
  }

  return {
    status: model?.status === 'training'
      ? 'training'
      : model?.status === 'failed'
        ? 'failed'
        : 'warming_up',
    activity,
    model_status: model?.status || 'warming_up',
    quality_gated_minute_windows: eligibleCount,
    required_training_windows: HILAD_MIN_TRAINING_WINDOWS,
    window_length_seconds: 60,
    message: model?.status === 'training'
      ? 'Model sedang dilatih dari rekaman berkualitas yang dianggap normal.'
      : model?.status === 'failed'
        ? 'Pelatihan model gagal; periksa log API atau minta pelatihan ulang.'
        : `Menunggu minimal ${HILAD_MIN_TRAINING_WINDOWS} window berkualitas (5 menit) sebelum skor anomali tersedia.`,
  };
}

function cosineDistance(left, right) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] ** 2;
    rightNorm += right[index] ** 2;
  }
  if (leftNorm === 0 || rightNorm === 0) return 1;
  return 1 - dot / Math.sqrt(leftNorm * rightNorm);
}

function dtwDistance(left, right) {
  let previous = new Float64Array(right.length + 1).fill(Number.POSITIVE_INFINITY);
  previous[0] = 0;
  for (let i = 1; i <= left.length; i += 1) {
    const current = new Float64Array(right.length + 1).fill(Number.POSITIVE_INFINITY);
    for (let j = 1; j <= right.length; j += 1) {
      const stepDistance = Math.sqrt(left[i - 1].reduce(
        (sum, value, feature) => sum + (value - right[j - 1][feature]) ** 2,
        0
      ));
      current[j] = stepDistance + Math.min(
        previous[j],
        current[j - 1],
        previous[j - 1]
      );
    }
    previous = current;
  }
  return previous[right.length] / Math.max(left.length, right.length);
}

function normalizeDistanceMatrix(matrix) {
  const maximum = Math.max(...matrix.flat());
  return maximum > 0
    ? matrix.map((row) => row.map((value) => value / maximum))
    : matrix.map((row) => row.map(() => 0));
}

function kMeans(points, k) {
  let centroids = Array.from({ length: k }, (_, index) =>
    [...points[Math.floor(index * points.length / k)]]
  );
  let assignments = Array(points.length).fill(-1);
  for (let iteration = 0; iteration < 50; iteration += 1) {
    const nextAssignments = points.map((point) => {
      let best = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      centroids.forEach((centroid, index) => {
        const distance = Math.hypot(point[0] - centroid[0], point[1] - centroid[1]);
        if (distance < bestDistance) {
          best = index;
          bestDistance = distance;
        }
      });
      return best;
    });
    if (nextAssignments.every((value, index) => value === assignments[index])) break;
    assignments = nextAssignments;
    centroids = centroids.map((centroid, cluster) => {
      const members = points.filter((_, index) => assignments[index] === cluster);
      return members.length
        ? [
          members.reduce((sum, point) => sum + point[0], 0) / members.length,
          members.reduce((sum, point) => sum + point[1], 0) / members.length,
        ]
        : centroid;
    });
  }
  const inertia = points.reduce((sum, point, index) => {
    const centroid = centroids[assignments[index]];
    return sum + (point[0] - centroid[0]) ** 2 + (point[1] - centroid[1]) ** 2;
  }, 0);
  return { assignments, centroids, inertia };
}

function selectElbowK(points) {
  const maxK = Math.min(8, Math.floor(Math.sqrt(points.length)), points.length - 1);
  if (maxK < 2) return 1;
  const candidates = Array.from({ length: maxK }, (_, index) =>
    kMeans(points, index + 1)
  );
  const first = candidates[0].inertia;
  const last = candidates.at(-1).inertia;
  let bestIndex = 0;
  let maxDeviation = -1;
  candidates.forEach((candidate, index) => {
    const x = index / (candidates.length - 1);
    const y = first === last ? 0 : (first - candidate.inertia) / (first - last);
    const deviation = Math.abs(y - x) / Math.sqrt(2);
    if (deviation > maxDeviation) {
      maxDeviation = deviation;
      bestIndex = index;
    }
  });
  return bestIndex + 1;
}

function propagateClusterLabels(clusters, adjacency) {
  const original = clusters.map((cluster) =>
    cluster.labels.length
      ? cluster.labels.reduce((sum, value) => sum + value, 0) / cluster.labels.length
      : -1
  );
  let scores = [...original];
  for (let iteration = 0; iteration < 50; iteration += 1) {
    const next = scores.map((score, index) => {
      if (original[index] >= 0) return original[index];
      let weighted = 0;
      let weightTotal = 0;
      adjacency[index].forEach((weight, neighbor) => {
        if (neighbor !== index && scores[neighbor] >= 0) {
          weighted += weight * scores[neighbor];
          weightTotal += weight;
        }
      });
      return weightTotal > 0 ? weighted / weightTotal : -1;
    });
    const stable = next.every((value, index) =>
      (value < 0 && scores[index] < 0) || Math.abs(value - scores[index]) < 1e-5
    );
    scores = next;
    if (stable) break;
  }
  return scores;
}

export async function getHiladClusters({ accountId, activity }) {
  if (!ACTIVITIES.has(activity)) {
    throw errorHandler(400, 'activity tidak valid.');
  }
  const model = await HiladModel.findOne({ account_id: accountId, activity })
    .select('version')
    .lean();
  const windows = await HiladWindow.find({
    account_id: accountId,
    activity,
    reconstruction_score: { $ne: null },
    model_version: model?.version ?? null,
  })
    .sort({ window_end: -1 })
    .limit(60)
    .lean();
  if (windows.length === 0) return { activity, count: 0, clusters: [] };
  windows.reverse();
  if (windows.length < 3) {
    return {
      activity,
      count: windows.length,
      distance_method: '0.5_normalized_multivariate_dtw_plus_0.5_cosine_reconstruction_attribution',
      embedding_method: 'umap_on_combined_distance_profiles',
      cluster_method: 'kmeans_with_elbow_selection',
      clusters: [{
        cluster_id: 'cluster-1',
        count: windows.length,
        propagated_spuriousness_score: null,
        reviewer_label: null,
        windows: windows.map((window) => ({
          id: window._id,
          window_start: window.window_start,
          window_end: window.window_end,
          reconstruction_score: window.reconstruction_score,
          anomaly_threshold: window.anomaly_threshold,
          model_version: window.model_version,
          is_anomaly_candidate: window.is_anomaly_candidate,
          feedback_label: window.feedback_label,
        })),
      }],
    };
  }
  const dtw = windows.map((left) =>
    windows.map((right) => dtwDistance(left.sequence, right.sequence))
  );
  const attention = windows.map((window) =>
    window.reconstruction_errors.map((row) =>
      row.reduce((sum, value) => sum + value, 0) / row.length
    )
  );
  const attributionDistances = windows.map((_, index) =>
    windows.map((__, otherIndex) => cosineDistance(attention[index], attention[otherIndex]))
  );
  const normalizedDtw = normalizeDistanceMatrix(dtw);
  const normalizedAttribution = normalizeDistanceMatrix(attributionDistances);
  const combined = normalizedDtw.map((row, index) =>
    row.map((value, column) => 0.5 * value + 0.5 * normalizedAttribution[index][column])
  );

  const { UMAP } = await import('umap-js');
  const umap = new UMAP({
    nComponents: 2,
    nNeighbors: Math.min(10, Math.max(2, windows.length - 1)),
    minDist: 0.1,
  });
  const embedding = umap.fit(combined);
  const clusterCount = selectElbowK(embedding);
  const grouped = kMeans(embedding, clusterCount);
  const clusters = Array.from({ length: clusterCount }, (_, index) => ({
    index,
    members: [],
    labels: [],
  }));
  windows.forEach((window, index) => {
    const cluster = clusters[grouped.assignments[index]];
    cluster.members.push(window);
    if (window.feedback_label === 'spurious_attention') cluster.labels.push(1);
    if (window.feedback_label === 'correct_attention') cluster.labels.push(0);
  });
  const adjacency = clusters.map((cluster, index) =>
    clusters.map((other, otherIndex) => {
      if (index === otherIndex) return 0;
      const distance = Math.hypot(
        grouped.centroids[index][0] - grouped.centroids[otherIndex][0],
        grouped.centroids[index][1] - grouped.centroids[otherIndex][1]
      );
      return Math.exp(-(distance ** 2) / 0.5);
    })
  );
  const propagated = propagateClusterLabels(clusters, adjacency);

  return {
    activity,
    count: windows.length,
    distance_method: '0.5_normalized_multivariate_dtw_plus_0.5_cosine_reconstruction_attribution',
    embedding_method: 'umap_on_combined_distance_profiles',
    cluster_method: 'kmeans_with_elbow_selection',
    clusters: clusters.map((cluster, index) => ({
      cluster_id: `cluster-${index + 1}`,
      count: cluster.members.length,
      propagated_spuriousness_score: propagated[index] < 0
        ? null
        : Number(propagated[index].toFixed(4)),
      reviewer_label: cluster.labels.length
        ? cluster.labels.reduce((sum, value) => sum + value, 0) / cluster.labels.length >= 0.5
          ? 'spurious_attention'
          : 'correct_attention'
        : null,
      windows: cluster.members.map((window) => ({
        id: window._id,
        window_start: window.window_start,
        window_end: window.window_end,
        reconstruction_score: window.reconstruction_score,
        anomaly_threshold: window.anomaly_threshold,
        model_version: window.model_version,
        is_anomaly_candidate: window.is_anomaly_candidate,
        feedback_label: window.feedback_label,
      })),
    })),
  };
}

export async function annotateHiladWindow({
  accountId,
  windowId,
  reviewerId,
  label,
  note = '',
}) {
  const allowedLabels = ['normal', 'anomaly', 'spurious_attention', 'correct_attention'];
  if (!allowedLabels.includes(label)) {
    throw errorHandler(400, `label harus salah satu dari: ${allowedLabels.join(', ')}.`);
  }
  if (!mongoose.isValidObjectId(windowId)) {
    throw errorHandler(400, 'window_id tidak valid.');
  }
  const updated = await HiladWindow.findOneAndUpdate(
    { _id: windowId, account_id: accountId },
    {
      $set: {
        feedback_label: label,
        feedback_by: reviewerId,
        feedback_at: new Date(),
        feedback_note: note,
      },
    },
    { new: true, runValidators: true }
  );
  if (!updated) throw errorHandler(404, 'Window HILAD tidak ditemukan.');
  const eligibleCount = await HiladWindow.countDocuments({
    account_id: accountId,
    activity: updated.activity,
    feedback_label: { $in: [null, 'normal'] },
  });
  const model = await HiladModel.findOne({
    account_id: accountId,
    activity: updated.activity,
  }).lean();
  if (
    eligibleCount >= HILAD_MIN_TRAINING_WINDOWS
    && (model?.status === 'warming_up'
      || eligibleCount >= (model?.training_window_count || 0) + HILAD_RETRAIN_WINDOW_INTERVAL)
    && model?.status !== 'failed'
    && model?.status !== 'training'
  ) {
    scheduleTraining(accountId, updated.activity);
  }
  return updated;
}

export async function retrainHiladModel({ accountId, activity }) {
  if (!ACTIVITIES.has(activity)) throw errorHandler(400, 'activity tidak valid.');
  const count = await HiladWindow.countDocuments({
    account_id: accountId,
    activity,
    feedback_label: { $in: [null, 'normal'] },
  });
  if (count < HILAD_MIN_TRAINING_WINDOWS) {
    throw errorHandler(
      422,
      `Belum cukup data. Diperlukan minimal ${HILAD_MIN_TRAINING_WINDOWS} window berkualitas; tersedia ${count}.`
    );
  }
  scheduleTraining(accountId, activity);
  return { status: 'training', activity, eligible_training_windows: count };
}

export async function hiladModelStatus({ accountId, activity }) {
  if (!ACTIVITIES.has(activity)) throw errorHandler(400, 'activity tidak valid.');
  const [model, windowCount] = await Promise.all([
    HiladModel.findOne({ account_id: accountId, activity })
      .select('-weights')
      .lean(),
    HiladWindow.countDocuments({ account_id: accountId, activity }),
  ]);
  return {
    activity,
    model: model || {
      status: 'warming_up',
      training_window_count: 0,
      anomaly_threshold: null,
    },
    collected_windows: windowCount,
    minimum_training_windows: HILAD_MIN_TRAINING_WINDOWS,
    window_length_seconds: 60,
    training_policy: 'quality_gated_recordings_assumed_normal_until_reviewed',
  };
}
