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

let connection = null;
let channel = null;

async function getChannel() {
  let rabbitmqUri = process.env.RABBITMQ_URI;
  if (!rabbitmqUri) return null;

  // Correct typical config typo where HTTP port is placed in amqp URI
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
    await channel.assertQueue(queueName, { durable: true });
    return channel;
  } catch (error) {
    console.error('[RabbitMQ] Failed to connect/create channel:', error.message);
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
  const ch = await getChannel();
  if (ch) {
    try {
      const queueName = process.env.QUEUE_NAME || 'Sensor';
      ch.sendToQueue(queueName, Buffer.from(JSON.stringify(envelope)), { persistent: true });
      console.log(`[RabbitMQ] Published transport payload to queue: ${queueName}`);
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
    reason: 'No broker configured or connection failed',
  };
}
