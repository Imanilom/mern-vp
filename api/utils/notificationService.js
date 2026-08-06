import amqp from 'amqplib';

let connection = null;
let channel = null;

async function getChannel() {
  let rabbitmqUri = process.env.RABBITMQ_URI;
  if (!rabbitmqUri) return null;

  if (!rabbitmqUri.startsWith('amqp://') && !rabbitmqUri.startsWith('amqps://')) {
    const isSsl = rabbitmqUri.includes(':5672') || rabbitmqUri.includes(':8883') || rabbitmqUri.includes(':15671');
    rabbitmqUri = (isSsl ? 'amqps://' : 'amqp://') + rabbitmqUri;
  }

  if (rabbitmqUri.includes(':15672')) {
    rabbitmqUri = rabbitmqUri.replace(':15672', ':5672');
  }

  if (connection && channel) {
    return channel;
  }

  try {
    connection = await amqp.connect(rabbitmqUri);
    connection.on('error', () => { connection = null; channel = null; });
    connection.on('close', () => { connection = null; channel = null; });

    channel = await connection.createChannel();
    channel.on('error', () => { channel = null; });
    channel.on('close', () => { channel = null; });

    const queueName = process.env.NOTIFICATION_QUEUE || 'MobileNotifications';
    await channel.assertQueue(queueName, { durable: true });
    
    return channel;
  } catch (error) {
    console.error('[NotificationService] Failed to connect:', error.message);
    connection = null;
    channel = null;
    return null;
  }
}

/**
 * Sends a notification to the mobile app via RabbitMQ.
 * 
 * @param {string} userId - Target user ID
 * @param {string} deviceId - Target device ID
 * @param {string} type - Notification type (e.g., 'ANNOTATION_REQUIRED', 'QUALITY_WARNING')
 * @param {string} message - Notification text
 * @param {number} timestampMs - Event epoch timestamp in ms
 */
export async function sendMobileNotification(userId, deviceId, type, message, timestampMs) {
  const ch = await getChannel();
  if (!ch) return false;

  const queueName = process.env.NOTIFICATION_QUEUE || 'MobileNotifications';
  const timestampIso = new Date(timestampMs || Date.now()).toISOString();

  const payload = {
    type,
    user_id: userId,
    device_id: deviceId,
    timestamp: timestampMs || Date.now(),
    timestamp_iso: timestampIso,
    message,
    sent_at: new Date().toISOString(),
  };

  try {
    ch.sendToQueue(queueName, Buffer.from(JSON.stringify(payload)), { persistent: true });
    // console.log(`[NotificationService] Sent ${type} for user ${userId} to ${queueName}`);
    return true;
  } catch (err) {
    console.error('[NotificationService] Failed to send notification:', err.message);
    return false;
  }
}
