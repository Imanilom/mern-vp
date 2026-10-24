import amqp from 'amqplib';
import mongoose from 'mongoose';
import { analyzeAndCorrectRR, checkQualityGate } from './dataQualityGate.js';
import { sendMobileNotification } from './notificationService.js';
import { io } from '../index.js';

function normalizeTransportReading(reading) {
  const timestamp = reading.timestamp ?? reading.ts ?? reading.time ?? null;
  const heartRate = reading.heart_rate ?? reading.hr ?? reading.heartRate ?? null;
  const rrInterval = reading.rr_interval ?? reading.rr ?? reading.rrInterval ?? null;
  const motionState = reading.motion_state ?? reading.activity ?? reading.motionState ?? 'Duduk';

  return {
    timestamp,
    heart_rate: heartRate,
    rr_interval: rrInterval,
    activity: motionState,
    battery: reading.battery ?? null,
    signal_quality: reading.signal_quality ?? null,
    rmssd: reading.rmssd ?? null,
    dfa_alpha1: reading.dfa_alpha1 ?? null,
    acc_x: reading.acc_x ?? reading.accX ?? 0,
    acc_y: reading.acc_y ?? reading.accY ?? 0,
    acc_z: reading.acc_z ?? reading.accZ ?? 0,
    ecg: reading.ecg ?? 0,
    step_count: reading.step_count ?? reading.stepCount ?? 0,
    is_simulated: reading.is_simulated === true,
  };
}

export function buildTransportEnvelope(payload) {
  const readings = Array.isArray(payload?.readings) ? payload.readings : [];

  return {
    user_id: payload?.user_id ?? payload?.userId ?? null,
    account_type: payload?.account_type ?? payload?.accountType ?? null,
    provider: payload?.provider ?? null,
    source: payload?.source ?? 'polar_ble',
    is_simulated: payload?.is_simulated === true,
    device_id: payload?.device_id ?? payload?.deviceId ?? 'UNKNOWN',
    received_at: payload?.received_at ?? new Date().toISOString(),
    readings: readings.map(normalizeTransportReading),
  };
}

export function buildPolarDataDocuments(envelope, userId = envelope?.user_id) {
  if (!mongoose.isValidObjectId(userId) || envelope?.is_simulated === true) {
    return [];
  }

  const validActivities = new Set([
    'Tidur', 'Berbaring', 'Duduk', 'Berdiri', 'Berjalan', 'Berjalan Cepat',
    'Naik Tangga', 'Bersepeda', 'Berenang', 'Senam', 'Yoga', 'Berlari',
    'Lari Cepat', 'Olahraga Berat', 'Makan', 'Memasak', 'Berkendara',
    'Bekerja', 'Lainnya',
  ]);

  return (Array.isArray(envelope.readings) ? envelope.readings : [])
    .flatMap((reading) => {
      const rawTimestamp = reading.timestamp == null
        ? Number.NaN
        : Number(reading.timestamp);
      const timestamp = Number.isFinite(rawTimestamp)
        ? Math.floor(rawTimestamp > 10000000000 ? rawTimestamp / 1000 : rawTimestamp)
        : Math.floor(Date.now() / 1000);
      const heartRate = Number(reading.heart_rate);
      const rrInterval = Number(reading.rr_interval);
      if (
        !Number.isFinite(heartRate)
        || heartRate < 30
        || heartRate > 220
        || !Number.isFinite(rrInterval)
        || rrInterval < 300
        || rrInterval > 2000
      ) {
        return [];
      }

      const recordedAt = new Date(timestamp * 1000);
      const wibTime = new Date(recordedAt.getTime() + 7 * 60 * 60 * 1000);
      const activity = validActivities.has(reading.activity)
        ? reading.activity
        : 'Lainnya';

      return [{
        user_id: userId,
        timestamp,
        date_created: `${String(wibTime.getUTCDate()).padStart(2, '0')}-${String(wibTime.getUTCMonth() + 1).padStart(2, '0')}-${wibTime.getUTCFullYear()}`,
        time_created: `${String(wibTime.getUTCHours()).padStart(2, '0')}:${String(wibTime.getUTCMinutes()).padStart(2, '0')}:${String(wibTime.getUTCSeconds()).padStart(2, '0')}`,
        hr: heartRate,
        rr: rrInterval,
        rrms: reading.rmssd ?? null,
        activity,
        device_id: envelope.device_id || 'UNKNOWN',
        isChecked: false,
        processStatus: 'PENDING',
        acc_x: reading.acc_x ?? 0,
        acc_y: reading.acc_y ?? 0,
        acc_z: reading.acc_z ?? 0,
        step_count: reading.step_count ?? 0,
        ecg: reading.ecg ?? 0,
      }];
    });
}

export function buildPatientAppDemoSampleOperations(envelope) {
  if (
    !mongoose.isValidObjectId(envelope?.user_id)
    || !['user', 'patient'].includes(envelope.account_type)
  ) {
    throw new Error('Patient app demo stream is missing a valid account scope.');
  }

  return (Array.isArray(envelope.readings) ? envelope.readings : [])
    .flatMap((reading) => {
      const recordedAt = new Date(Number(reading.timestamp) * 1000);
      const heartRate = Number(reading.heart_rate);
      const rrInterval = Number(reading.rr_interval);
      if (
        !Number.isFinite(recordedAt.getTime())
        || !Number.isFinite(heartRate)
        || heartRate < 20
        || heartRate > 250
      ) {
        return [];
      }

      const rawConfidence = Number(reading.signal_quality);
      const signalConfidence = Number.isFinite(rawConfidence)
        ? Math.max(0, Math.min(1, rawConfidence > 1 ? rawConfidence / 100 : rawConfidence))
        : 0;
      const rrIntervals = Number.isFinite(rrInterval)
        && rrInterval >= 250
        && rrInterval <= 3000
        ? [rrInterval]
        : [];
      const acceleration = ['acc_x', 'acc_y', 'acc_z'].map((axis) => {
        const value = Number(reading[axis]);
        return Number.isFinite(value) ? Math.max(-16, Math.min(16, value)) : 0;
      });
      const activity = String(reading.activity || '').toLowerCase();
      const posture = ['lying', 'berbaring', 'sleep', 'tidur'].includes(activity)
        ? 'lying'
        : ['standing', 'berdiri'].includes(activity)
          ? 'standing'
          : ['sitting', 'duduk', 'rest', 'istirahat'].includes(activity)
            ? 'sitting'
            : 'unknown';
      const recordedActivity = ['lying', 'berbaring', 'sleep', 'tidur'].includes(activity)
        ? 'sleep'
        : ['standing', 'berdiri'].includes(activity)
          ? 'standing'
          : ['walking', 'berjalan'].includes(activity)
            ? 'walking'
            : ['running', 'berlari'].includes(activity)
              ? 'running'
              : ['sitting', 'duduk'].includes(activity)
                ? 'sitting'
                : ['rest', 'istirahat'].includes(activity)
                  ? 'rest'
                  : 'other';
      const sample = {
        account_id: envelope.user_id,
        account_type: envelope.account_type,
        provider: envelope.provider === 'other' ? 'other' : 'polar_h10',
        is_simulated: true,
        recorded_at: recordedAt,
        heart_rate_bpm: heartRate,
        rr_intervals_ms: rrIntervals,
        acceleration_g: [{ x: acceleration[0], y: acceleration[1], z: acceleration[2] }],
        activity_intensity: 'unknown',
        posture,
        activity: recordedActivity,
        sensor_contact: true,
        signal_confidence: signalConfidence,
        expected_rr_count: rrIntervals.length || null,
        data_quality: {
          status: 'warning',
          q_signal: signalConfidence,
          q_complete: rrIntervals.length ? 1 : 0,
          reasons: ['simulated_sensor_data'],
          feature_source: rrIntervals.length ? 'derived_from_rr' : 'unavailable',
        },
        device_id: envelope.device_id || 'UNKNOWN',
        ingestion_source: 'rabbitmq_stream',
      };
      return [{
        updateOne: {
          filter: {
            account_id: sample.account_id,
            account_type: sample.account_type,
            device_id: sample.device_id,
            recorded_at: sample.recorded_at,
            is_simulated: true,
            ingestion_source: 'rabbitmq_stream',
          },
          update: { $setOnInsert: sample },
          upsert: true,
        },
      }];
    });
}

let connection = null;
let channel = null;

async function getChannel() {
  let rabbitmqUri = process.env.RABBITMQ_URI;
  if (!rabbitmqUri) return null;

  // Ensure URI starts with protocol scheme
  if (!rabbitmqUri.startsWith('amqp://') && !rabbitmqUri.startsWith('amqps://')) {
    const isSsl = rabbitmqUri.includes(':5672') || rabbitmqUri.includes(':8883') || rabbitmqUri.includes(':15671');
    rabbitmqUri = (isSsl ? 'amqps://' : 'amqp://') + rabbitmqUri;
  }

  // Correct typical config typo where HTTP port 15672 is placed in amqp URI
  if (rabbitmqUri.includes(':15672')) {
    console.warn('[RabbitMQ] Port 15672 detected in RABBITMQ_URI. Mapping to standard AMQP port 5672.');
    rabbitmqUri = rabbitmqUri.replace(':15672', ':5672');
  }

  if (connection && channel) {
    return channel;
  }

  try {
    console.log('[RabbitMQ] Connecting to:', rabbitmqUri);
    connection = await amqp.connect(rabbitmqUri);

    connection.on('error', (err) => {
      console.error('[RabbitMQ] Connection error:', err.message);
      connection = null;
      channel = null;
    });

    connection.on('close', () => {
      console.log('[RabbitMQ] Connection closed');
      connection = null;
      channel = null;
    });

    channel = await connection.createChannel();
    channel.on('error', (err) => {
      console.error('[RabbitMQ] Channel error:', err.message);
      channel = null;
    });

    channel.on('close', () => {
      console.log('[RabbitMQ] Channel closed');
      channel = null;
    });

    const queueName = process.env.QUEUE_NAME || 'Sensor';
    const dlqName = `${queueName}_DLQ`;

    // Assert DLQ terlebih dahulu agar bisa menjadi target dead letter
    await channel.assertQueue(dlqName, { durable: true });

    // Assert queue utama dengan dead letter routing ke DLQ
    try {
      await channel.assertQueue(queueName, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': '',          // default exchange
          'x-dead-letter-routing-key': dlqName, // rute ke DLQ
        },
      });
    } catch (err) {
      console.warn(`[RabbitMQ] assertQueue failed for ${queueName} (${err.message}). It might be a stream queue. Recreating channel...`);
      channel = await connection.createChannel();
      // We assume the queue already exists (e.g. created as stream externally)
    }
    
    // Pastikan antrean selalu di-bind ke amq.topic (default exchange plugin MQTT RabbitMQ)
    try {
      await channel.bindQueue(queueName, 'amq.topic', queueName);
    } catch (bindErr) {
      console.warn(`[RabbitMQ] bindQueue warning: ${bindErr.message}`);
    }
    return channel;
  } catch (error) {
    console.error(`[RabbitMQ] Failed to connect/create channel: ${error.message}`);
    connection = null;
    channel = null;
    return null;
  }
}

export async function publishLogTransport(payload, publishFn) {
  const envelope = buildTransportEnvelope(payload);

  // If custom publisher function is provided, try it first
  if (typeof publishFn === 'function') {
    const published = await publishFn(envelope);
    if (published) {
      return {
        success: true,
        envelope,
        published: true,
      };
    }
  }

  // Fallback to internal RabbitMQ publisher
  const channel = await getChannel();
  if (channel) {
    const queueName = process.env.QUEUE_NAME || 'Sensor';
    try {
      const buffer = Buffer.from(JSON.stringify(envelope));
      const sent = channel.sendToQueue(queueName, buffer, { persistent: true });
      if (sent) {
        return {
          success: true,
          envelope,
          published: true,
        };
      }
    } catch (error) {
      return {
        success: false,
        envelope,
        published: false,
        reason: error.message,
      };
    }
  }

  return {
    success: true,
    envelope,
    published: false,
    reason: 'No broker configured or connection failed',
  };
}

export async function startLogTransportConsumer() {
  let ch = await getChannel();
  while (!ch) {
    console.warn('[RabbitMQ Consumer] Broker connection not available. Retrying in 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    ch = await getChannel();
  }

  const queueName = process.env.QUEUE_NAME || 'Sensor';
  const MAX_RETRIES = 3;
  console.log(`[RabbitMQ Consumer] Listening for messages on queue: ${queueName}...`);
  await ch.prefetch(100);

  // Use x-stream-offset: first so that if it's a stream queue, it will consume the backlog.
  // MongoDB unique index will handle any duplicates.
  ch.consume(queueName, async (msg) => {
    if (!msg) return;

    // Lacak jumlah retry dari header message
    const retryCount = (msg.properties?.headers?.['x-retry-count'] ?? 0);

    try {
      const contentStr = msg.content.toString();
      const envelope = JSON.parse(contentStr);
      console.log(`[RabbitMQ Consumer] Received transport envelope for user: ${envelope.user_id}`);

      if (
        envelope.is_simulated === true
        || envelope.source === 'patient_app_polar_ble_demo'
      ) {
        if (envelope.source === 'patient_app_polar_ble_demo') {
          const PatientAppWearableSample = (
            await import('../models/patient_app_wearable_sample.model.js')
          ).default;
          const operations = buildPatientAppDemoSampleOperations(envelope);
          if (operations.length) {
            await PatientAppWearableSample.bulkWrite(operations, {
              ordered: false,
            });
          }
          console.info(
            `[RabbitMQ Consumer] Persisted ${operations.length} simulated wearable samples for account ${envelope.user_id}; excluded from clinical PolarData and baseline learning.`
          );
          ch.ack(msg);
          return;
        }
        console.info(
          `[RabbitMQ Consumer] Received ${envelope.readings?.length ?? 0} simulated readings for device ${envelope.device_id}; acknowledged without writing clinical PolarData.`
        );
        ch.ack(msg);
        return;
      }

      let targetUserId = envelope.user_id;

      // Import User dynamically or check fallback
      const User = (await import('../models/user.model.js')).default;
      const PolarData = (await import('../models/data.model.js')).default;

      if (!targetUserId || targetUserId === 'DEMO_USER_001' || targetUserId === 'UNKNOWN_USER' || targetUserId === 'UNKNOWN') {
        const defaultUser = await User.findOne({});
        if (defaultUser) {
          targetUserId = defaultUser._id;
        }
      }

      if (targetUserId && Array.isArray(envelope.readings) && envelope.readings.length > 0) {
        const docs = buildPolarDataDocuments(envelope, targetUserId);
        if (docs.length === 0) {
          console.warn(`[RabbitMQ -> MongoDB] All ${envelope.readings.length} readings for user ${targetUserId} were filtered out (invalid HR/RR)`);
          ch.ack(msg);
          return;
        }

        const result = await PolarData.bulkWrite(docs.map((doc) => ({
          updateOne: {
            filter: { user_id: doc.user_id, timestamp: doc.timestamp },
            update: { $setOnInsert: doc },
            upsert: true,
          },
        })), { ordered: false });
        console.log(`[RabbitMQ -> MongoDB] Stored ${result.upsertedCount} new readings for user ${targetUserId}; ${result.matchedCount} already existed`);

        if (io) {
          io.emit('new_sensor_data', {
            user_id: targetUserId,
            device_id: envelope.device_id,
            readings: docs
          });
        }

        // --- ASYNC QUALITY & ANNOTATION GATE ---
        setImmediate(async () => {
          try {
            // Check for missing annotations using the most common activity
            const activities = envelope.readings.map(r => r.activity || r.motion_state || 'Unknown');
            const validActivities = activities.filter(a => a && a !== 'Unknown' && a.trim() !== '');
            const activityLabel = validActivities.length > 0 ? validActivities[0] : 'Unknown';
            const activityConfidence = activities.length > 0
              ? Number((validActivities.length / activities.length).toFixed(2))
              : 0.0;
            
            // Notification logic
            if (activityLabel === 'Unknown') {
              await sendMobileNotification(
                targetUserId,
                envelope.device_id || 'UNKNOWN',
                'ANNOTATION_REQUIRED',
                'Anotasi aktivitas tidak tersedia. Harap isi keterangan aktivitas.',
                envelope.timestamp || Date.now()
              );
            }

            // Quality audit logic
            const rrArray = envelope.readings.map(r => r.rr_interval || r.rr).filter(val => val !== undefined && val !== null);
            const expectedCount = envelope.readings.length;
            const audit = analyzeAndCorrectRR(rrArray, expectedCount);
            const gate = checkQualityGate(audit, activityLabel, activityConfidence);

            if (!gate.gate_passed) {
              await sendMobileNotification(
                targetUserId,
                envelope.device_id || 'UNKNOWN',
                'QUALITY_WARNING',
                `Kualitas sinyal menurun: ${gate.gate_reasons.join(', ')}`,
                envelope.timestamp || Date.now()
              );
            }
            
            // Optionally we could save this early audit somewhere or attach to the raw data, 
            // but the Layer 3 pipeline will compute the final audit during windowing.
          } catch (auditErr) {
            console.error('[RabbitMQ -> Async Audit] Error:', auditErr.message);
          }
        });
        // ---------------------------------------
      }

      ch.ack(msg);
    } catch (err) {
      console.error('[RabbitMQ Consumer] Error processing queue message:', err.message);

      if (retryCount < MAX_RETRIES) {
        // Nack tanpa requeue — biarkan DLQ atau retry manual yang menangani
        console.warn(`[RabbitMQ Consumer] Retry ${retryCount + 1}/${MAX_RETRIES} untuk pesan ini...`);
        ch.nack(msg, false, false); // false = jangan requeue ke queue asli (biar ke DLQ)
      } else {
        // Sudah max retry — acknowledge saja agar tidak memblok queue
        console.error(`[RabbitMQ Consumer] Pesan gagal setelah ${MAX_RETRIES}x retry. Discarding.`);
        ch.ack(msg);
      }
    }
  }, { noAck: false }); // REMOVED x-stream-offset: first to prevent PRECONDITION_FAILED on classic queues

  // Handle jika channel ditutup oleh server (misal karena error atau restart)
  ch.on('close', () => {
    console.error('[RabbitMQ Consumer] Channel unexpectedly closed! Backend stopped listening to queue.');
    console.warn('[RabbitMQ Consumer] Attempting to restart consumer in 5 seconds...');
    setTimeout(startLogTransportConsumer, 5000);
  });
  
  ch.on('error', (err) => {
    console.error('[RabbitMQ Consumer] Channel error during consume:', err.message);
  });
}
