import amqp from 'amqplib';

export const checkRabbitMqStatus = async (req, res) => {
  try {
    let rabbitmqUri = process.env.RABBITMQ_URI;
    if (!rabbitmqUri) return res.status(500).json({ error: 'RABBITMQ_URI not set' });

    if (!rabbitmqUri.startsWith('amqp://') && !rabbitmqUri.startsWith('amqps://')) {
      const isSsl = rabbitmqUri.includes(':5672') || rabbitmqUri.includes(':8883') || rabbitmqUri.includes(':15671');
      rabbitmqUri = (isSsl ? 'amqps://' : 'amqp://') + rabbitmqUri;
    }
    if (rabbitmqUri.includes(':15672')) {
      rabbitmqUri = rabbitmqUri.replace(':15672', ':5672');
    }

    const connection = await amqp.connect(rabbitmqUri);
    const channel = await connection.createChannel();

    const queueName = process.env.QUEUE_NAME || 'Sensor';
    
    // Get queue info
    const qInfo = await channel.checkQueue(queueName);
    
    await channel.close();
    await connection.close();

    return res.json({
      success: true,
      queue_info: qInfo,
      uri_used: rabbitmqUri.replace(/:[^:@]+@/, ':***@'), // hide password
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
