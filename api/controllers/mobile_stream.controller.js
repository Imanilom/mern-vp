import MobileStreamLog from '../models/mobile_stream_log.model.js';
import PolarData from '../models/data.model.js';

/**
 * POST /api/log/mobile-ping
 *
 * Dipanggil oleh Flutter app untuk melaporkan status streaming ke VPS.
 * Tidak memerlukan auth (menggunakan userId dari body).
 *
 * Body:
 * {
 *   "user_id": "abc123",
 *   "device_id": "Polar H10",
 *   "event": "publish_success",   // streaming_started | publish_success | publish_failed | mqtt_connected | mqtt_failed | heartbeat
 *   "readings_count": 5,
 *   "mqtt_connected": true,
 *   "error_message": null,
 *   "app_version": "1.0.0",
 *   "platform": "android"
 * }
 */
export const mobilePing = async (req, res) => {
  try {
    const {
      user_id,
      device_id,
      event,
      readings_count,
      mqtt_connected,
      error_message,
      app_version,
      platform,
    } = req.body;

    if (!user_id || !event) {
      return res.status(400).json({
        success: false,
        message: 'user_id dan event wajib diisi',
      });
    }

    const validEvents = [
      'streaming_started', 'streaming_stopped',
      'publish_success', 'publish_failed',
      'mqtt_connected', 'mqtt_failed', 'heartbeat',
    ];

    if (!validEvents.includes(event)) {
      return res.status(400).json({
        success: false,
        message: `event tidak valid. Gunakan salah satu: ${validEvents.join(', ')}`,
      });
    }

    const log = await MobileStreamLog.create({
      user_id:       user_id.toString(),
      device_id:     device_id || 'UNKNOWN',
      event,
      readings_count: readings_count ?? 0,
      mqtt_connected: mqtt_connected ?? false,
      error_message:  error_message ?? null,
      app_version:    app_version ?? null,
      platform:       platform ?? null,
    });

    console.log(`[MobilePing] user=${user_id} | event=${event} | readings=${readings_count ?? 0} | mqtt=${mqtt_connected}`);

    return res.status(201).json({
      success: true,
      message: 'Ping diterima',
      log_id: log._id,
    });
  } catch (err) {
    console.error('[MobilePing] Error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/log/mobile-status
 *
 * Dashboard monitoring VPS: melihat status streaming mobile per user.
 *
 * Query params:
 *   ?user_id=abc123         (opsional, filter per user)
 *   ?limit=50               (default 50, max 200)
 *   ?event=publish_success  (opsional, filter per event)
 *   ?since=2026-08-18T00:00:00Z (opsional, filter sejak waktu tertentu)
 */
export const mobileStatus = async (req, res) => {
  try {
    const { user_id, event, since } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);

    // ── Bangun query ───────────────────────────────────────────
    const query = {};
    if (user_id) query.user_id = user_id.toString();
    if (event)   query.event   = event;
    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate)) query.created_at = { $gte: sinceDate };
    }

    // ── Fetch recent logs ──────────────────────────────────────
    const logs = await MobileStreamLog.find(query)
      .sort({ created_at: -1 })
      .limit(limit)
      .lean();

    // ── Summary per user (last 1 jam) ──────────────────────────
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const summaryPipeline = [
      { $match: { created_at: { $gte: oneHourAgo } } },
      {
        $group: {
          _id: '$user_id',
          last_event:          { $last: '$event' },
          last_seen:           { $max: '$created_at' },
          total_pings:         { $sum: 1 },
          total_readings_sent: {
            $sum: {
              $cond: [{ $eq: ['$event', 'publish_success'] }, '$readings_count', 0]
            }
          },
          mqtt_failures: {
            $sum: {
              $cond: [{ $in: ['$event', ['mqtt_failed', 'publish_failed']] }, 1, 0]
            }
          },
          device_id: { $last: '$device_id' },
          platform:  { $last: '$platform' },
        }
      },
      { $sort: { last_seen: -1 } },
    ];

    const summary = await MobileStreamLog.aggregate(summaryPipeline);

    // ── Enrich summary dengan data MongoDB terbaru ─────────────
    const enrichedSummary = await Promise.all(summary.map(async (s) => {
      // Cek data terbaru di PolarData untuk user ini (maks 15 menit)
      const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
      let lastDataInDB = null;
      try {
        const lastDoc = await PolarData.findOne({
          user_id: s._id,
          // timestamp adalah unix epoch dalam detik
          timestamp: { $gte: Math.floor(fifteenMinAgo.getTime() / 1000) },
        }).sort({ timestamp: -1 }).select('timestamp hr rr device_id').lean();

        if (lastDoc) {
          lastDataInDB = {
            timestamp: new Date(lastDoc.timestamp * 1000).toISOString(),
            hr: lastDoc.hr,
            rr: lastDoc.rr,
            device_id: lastDoc.device_id,
          };
        }
      } catch (_) { /* skip jika error */ }

      const minutesSinceLastSeen = Math.round((Date.now() - new Date(s.last_seen)) / 60000);
      const isActive = minutesSinceLastSeen <= 2 && s.last_event !== 'streaming_stopped';

      return {
        user_id:             s._id,
        device_id:           s.device_id,
        platform:            s.platform,
        status:              isActive ? '🟢 AKTIF' : minutesSinceLastSeen <= 10 ? '🟡 IDLE' : '🔴 TIDAK AKTIF',
        last_event:          s.last_event,
        last_seen:           s.last_seen,
        minutes_since_seen:  minutesSinceLastSeen,
        total_pings_1h:      s.total_pings,
        total_readings_sent_1h: s.total_readings_sent,
        mqtt_failures_1h:    s.mqtt_failures,
        last_data_in_db:     lastDataInDB,
        data_in_db_ok:       lastDataInDB !== null,
      };
    }));

    return res.json({
      success: true,
      generated_at: new Date().toISOString(),
      summary: enrichedSummary,
      recent_logs: logs,
    });
  } catch (err) {
    console.error('[MobileStatus] Error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};
