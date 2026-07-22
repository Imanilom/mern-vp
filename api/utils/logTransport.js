import amqp from 'amqplib';

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
  };
}

export function buildTransportEnvelope(payload) {
  const readings = Array.isArray(payload?.readings) ? payload.readings : [];

  return {
    user_id: payload?.user_id ?? payload?.userId ?? null,
    source: payload?.source ?? 'polar_ble',
    device_id: payload?.device_id ?? payload?.deviceId ?? 'UNKNOWN',
    received_at: payload?.received_at ?? new Date().toISOString(),
    readings: readings.map(normalizeTransportReading),
  };
}

export async function publishLogTransport(payload, publishFn) {
  const envelope = buildTransportEnvelope(payload);

  if (typeof publishFn !== 'function') {
    return {
      success: true,
      envelope,
      published: false,
      reason: 'No publisher provided',
    };
  }

  const published = await publishFn(envelope);
  if (published) {
    return {
      success: true,
      envelope,
      published: true,
    };
  }

  if (process.env.RABBITMQ_URI && process.env.QUEUE_NAME) {
    try {
      const connection = await amqp.connect(process.env.RABBITMQ_URI);
      const channel = await connection.createChannel();
      const queueName = process.env.QUEUE_NAME || 'Sensor';
      await channel.assertQueue(queueName, { durable: true });
      channel.sendToQueue(queueName, Buffer.from(JSON.stringify(envelope)), { persistent: true });
      await channel.close();
      await connection.close();
      return {
        success: true,
        envelope,
        published: true,
      };
    } catch (error) {
      console.warn('[publishLogTransport] RabbitMQ publish failed:', error.message);
      return {
        success: true,
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
    reason: 'No broker configured',
  };
}
