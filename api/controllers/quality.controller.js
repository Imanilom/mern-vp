import Segment from '../models/segment.model.js';

export const getSignalQuality = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Default fallback values if no segments
    let missingness = 0;
    let artifact = 0;
    let evaluableTime = 0;

    const segments = await Segment.find({ user_id: userId })
      .sort({ window_start: -1 })
      .limit(100)
      .lean();

    if (segments && segments.length > 0) {
      let totalWindows = segments.length;
      let missingWindows = 0;
      let artifactWindows = 0;
      let evaluableWindows = 0;

      segments.forEach(seg => {
        if (seg.signal_quality_detail) {
          if (seg.signal_quality_detail.missing_ratio > 0.1) missingWindows++;
          if (seg.signal_quality_detail.artifact_ratio > 0.1) artifactWindows++;
        }
        if (seg.is_valid) evaluableWindows++;
      });

      missingness = (missingWindows / totalWindows) * 100;
      artifact = (artifactWindows / totalWindows) * 100;
      evaluableTime = (evaluableWindows / totalWindows) * 100;
    }

    res.json({
      success: true,
      data: {
        missingness: missingness.toFixed(1),
        artifact: artifact.toFixed(1),
        evaluableTime: evaluableTime.toFixed(0),
        reconnects: 0,
        device: 'Polar H10 BLE Sensor',
        perDeviceQuality: [
          {
            stream: 'RR Interval & HR Stream',
            device: 'Polar H10',
            missingness: missingness.toFixed(1) + '%',
            artifact: artifact.toFixed(1) + '%',
            status: missingness > 10 ? 'Degraded' : 'Nominal',
            lastInstruction: missingness > 10 ? 'Kencangkan strap / Reconnect' : '-'
          }
        ]
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
