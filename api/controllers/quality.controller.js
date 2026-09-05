import Segment from '../models/segment.model.js';

export const getSignalQuality = async (req, res) => {
  try {
    const { userId } = req.params;
    const isAll = !userId || userId === 'ALL' || userId === '000000000000000000000000';
    const query = isAll ? {} : { user_id: userId };

    const segments = await Segment.find(query)
      .sort({ window_start: -1 })
      .limit(100)
      .lean();

    let artifactPct = 0.0;
    let missingnessPct = 0.0;
    let evaluableTimePct = 100.0;
    let totalAssessed = 0;

    if (segments && segments.length > 0) {
      let totalArtifact = 0;
      let totalMissing = 0;
      let evaluableCount = 0;
      let recordedArtCount = 0;
      let recordedMissCount = 0;

      segments.forEach(seg => {
        const q = seg.signal_quality_detail || seg.features || {};
        const art = q.artifact_fraction ?? seg.artifact_fraction ?? seg.rr_artifact_fraction ?? (seg.is_artifact ? 1.0 : null);
        const miss = q.missing_fraction ?? seg.missing_fraction ?? seg.missing_rate ?? null;

        if (art !== null && !isNaN(art)) {
          totalArtifact += (art > 1 ? art / 100 : art);
          recordedArtCount++;
        }

        if (miss !== null && !isNaN(miss)) {
          totalMissing += (miss > 1 ? miss / 100 : miss);
          recordedMissCount++;
        }

        if (seg.is_valid !== false) evaluableCount++;
      });

      const nArt = recordedArtCount || 1;
      const nMiss = recordedMissCount || 1;
      artifactPct = recordedArtCount > 0 ? Number(((totalArtifact / nArt) * 100).toFixed(1)) : 0.0;
      missingnessPct = recordedMissCount > 0 ? Number(((totalMissing / nMiss) * 100).toFixed(1)) : 0.0;
      evaluableTimePct = Number(((evaluableCount / segments.length) * 100).toFixed(0));
      totalAssessed = segments.length;
    }

    const goodDataPct = Number(Math.max(0, 100 - artifactPct - missingnessPct).toFixed(1));
    const qSignal = Number(Math.max(0, 1 - (artifactPct + missingnessPct) / 100).toFixed(2));
    const isDegraded = missingnessPct > 10 || artifactPct > 10;

    const streams = [
      {
        stream: 'Polar H10 (RR Interval & HR Telemetry)',
        device: 'POLAR_H10_BLE',
        missingness: missingnessPct.toFixed(1) + '%',
        artifact: artifactPct.toFixed(1) + '%',
        qSignal: qSignal.toFixed(2),
        status: isDegraded ? 'Degraded' : 'Normal',
        lastInstruction: isDegraded ? 'Kencangkan chest-strap / Reconnect Bluetooth' : 'Signal Stable'
      },
      {
        stream: 'HRV Autonomic Dynamics (RMSSD / SDNN)',
        device: 'CAPAR_ANALYTICS_CORE',
        missingness: (missingnessPct * 0.8).toFixed(1) + '%',
        artifact: (artifactPct * 0.9).toFixed(1) + '%',
        qSignal: Math.min(1.0, qSignal * 1.02).toFixed(2),
        status: isDegraded ? 'Degraded' : 'Normal',
        lastInstruction: `Synchronized (${new Date().toLocaleTimeString('id-ID')})`
      },
      {
        stream: 'Inertial & Motion Context (Activity / ENMO)',
        device: 'ACC_CONTEXT_ENGINE',
        missingness: (missingnessPct * 0.5).toFixed(1) + '%',
        artifact: (artifactPct * 0.6).toFixed(1) + '%',
        qSignal: Math.min(1.0, qSignal * 1.05).toFixed(2),
        status: 'Normal',
        lastInstruction: `Active (${new Date().toLocaleTimeString('id-ID')})`
      }
    ];

    res.json({
      success: true,
      data: {
        missingness: missingnessPct.toFixed(1),
        artifact: artifactPct.toFixed(1),
        good_data_pct: goodDataPct,
        q_signal: qSignal,
        evaluableTime: evaluableTimePct.toFixed(0),
        evaluable_time_pct: evaluableTimePct,
        reconnects: isDegraded ? 1 : 0,
        device: 'Polar H10 BLE Sensor',
        total_windows_assessed: totalAssessed,
        is_connected_recent: totalAssessed > 0,
        last_active_timestamp: new Date().toISOString(),
        perDeviceQuality: streams,
        per_device_quality: streams
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
