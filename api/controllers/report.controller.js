import mongoose from 'mongoose';
import Segment from '../models/segment.model.js';
import AnomalyEvent from '../models/anomalyevent.model.js';
import Baseline from '../models/baseline.model.js';
import User from '../models/user.model.js';

export async function generateReportData(req, res) {
  try {
    const { 
      type, 
      userId, 
      startDate, 
      endDate, 
      activity, 
      status, 
      group 
    } = req.query;

    if (!type) {
      return res.status(400).json({ success: false, message: 'Report type is required' });
    }

    // Common date filters
    let timeFilter = {};
    if (startDate || endDate) {
      const tsFilter = {};
      if (startDate) tsFilter.$gte = parseInt(startDate);
      if (endDate) tsFilter.$lte = parseInt(endDate);
      timeFilter = { ...tsFilter };
    }

    let data = [];
    let summary = {};

    switch (type) {
      case 'daily':
        // Individual daily report (Segments)
        if (!userId) throw new Error('userId required for daily report');
        const qDaily = { user_id: userId };
        if (Object.keys(timeFilter).length > 0) qDaily.window_start = timeFilter;
        if (activity && activity !== 'All') qDaily.activity_label = activity;

        data = await Segment.find(qDaily)
          .sort({ window_start: 1 })
          .select('window_start activity_label anomaly_score classification is_valid features.mean_hr features.rmssd')
          .lean();
        
        summary = {
          total_segments: data.length,
          valid_segments: data.filter(d => d.is_valid).length,
          avg_score: data.length ? data.reduce((a, b) => a + (b.anomaly_score || 0), 0) / data.length : 0,
        };
        break;

      case 'trajectory':
      case 'anomaly':
        // Weekly trajectory report & Anomaly report
        const qEvent = {};
        if (userId && userId !== 'All') qEvent.user_id = userId;
        if (Object.keys(timeFilter).length > 0) qEvent.onset_time = timeFilter;
        if (activity && activity !== 'All') qEvent.activity = activity;
        if (status && status !== 'All') qEvent.review_status = status;

        data = await AnomalyEvent.find(qEvent)
          .sort({ onset_time: -1 })
          .populate('user_id', 'email')
          .select('onset_time peak_score activity duration_ms review_status validation_label trajectory')
          .lean();
          
        summary = {
          total_events: data.length,
          avg_magnitude: data.length ? data.reduce((a, b) => a + (b.peak_score || 0), 0) / data.length : 0,
          validated_anomalies: data.filter(d => d.validation_label === 'Valid anomaly').length,
          false_positives: data.filter(d => d.validation_label === 'False positive').length,
        };
        break;

      case 'activity':
        // Activity-based report
        const qAct = {};
        if (userId && userId !== 'All') qAct.user_id = userId;
        if (activity && activity !== 'All') qAct.activity = activity;
        
        data = await Baseline.find(qAct).populate('user_id', 'email').lean();
        summary = { total_baselines: data.length };
        break;

      case 'quality':
        // Data quality report (is_valid ratio)
        const qQual = {};
        if (userId && userId !== 'All') qQual.user_id = userId;
        if (Object.keys(timeFilter).length > 0) qQual.window_start = timeFilter;

        const total = await Segment.countDocuments(qQual);
        const valid = await Segment.countDocuments({ ...qQual, is_valid: true });
        
        data = [{
          metric: 'Total Windows Analyzed',
          value: total
        }, {
          metric: 'Valid Windows (Signal Quality > 80%)',
          value: valid
        }, {
          metric: 'Invalid Windows (Artifacts/Motion)',
          value: total - valid
        }, {
          metric: 'Data Yield (%)',
          value: total > 0 ? ((valid / total) * 100).toFixed(2) : 0
        }];
        summary = { data_yield_percentage: data[3].value };
        break;

      case 'population':
        // Population report (mocked average of baselines)
        const allBaselines = await Baseline.find().lean();
        const acts = {};
        allBaselines.forEach(b => {
          if(!acts[b.activity]) acts[b.activity] = { count: 0, hr: 0, rmssd: 0 };
          acts[b.activity].count++;
          acts[b.activity].hr += b.stats?.mean_hr?.mean || 0;
          acts[b.activity].rmssd += b.stats?.rmssd?.mean || 0;
        });
        
        data = Object.keys(acts).map(a => ({
          activity: a,
          participants: acts[a].count,
          avg_hr: (acts[a].hr / acts[a].count).toFixed(2),
          avg_rmssd: (acts[a].rmssd / acts[a].count).toFixed(2),
        }));
        summary = { total_activities_tracked: data.length };
        break;

      case 'adherence':
      case 'performance':
        // Device adherence & System performance (mocked for demo)
        data = [
          { date: '2026-07-15', uptime: '99.9%', latency_ms: 124, active_users: 24, sync_errors: 2 },
          { date: '2026-07-16', uptime: '100%', latency_ms: 112, active_users: 26, sync_errors: 0 },
          { date: '2026-07-17', uptime: '99.5%', latency_ms: 180, active_users: 28, sync_errors: 5 },
          { date: '2026-07-18', uptime: '100%', latency_ms: 105, active_users: 28, sync_errors: 1 },
          { date: '2026-07-19', uptime: '100%', latency_ms: 110, active_users: 29, sync_errors: 0 },
        ];
        summary = { average_uptime: '99.88%' };
        break;

      default:
        return res.status(400).json({ success: false, message: 'Invalid report type' });
    }

    res.json({
      success: true,
      report_type: type,
      generated_at: Date.now(),
      filters: { userId, startDate, endDate, activity, status, group },
      summary,
      data,
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}
