import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDynamicProfileGraph,
  buildRecoveryTrajectory,
  fitDynamicModel,
  parseDynamicAnalysisCsv,
  prepareDynamicWindow,
} from './caparDynamicAnalysis.js';

const transition = [
  [0.7, 0.1, 0],
  [0, 0.6, 0.05],
  [0.02, 0, 0.5],
];

test('dynamic estimation recovers stable coefficients from eligible paired windows', () => {
  const episodes = Array.from({ length: 24 }, (_, episodeIndex) => {
    const before = [
      Math.sin(episodeIndex * 0.81) + 0.2,
      Math.cos(episodeIndex * 1.17) - 0.1,
      Math.sin(episodeIndex * 1.43) + 0.4,
    ];
    const after = transition.map((row) => row.reduce(
      (sum, coefficient, index) => sum + (coefficient * before[index]),
      0,
    ));
    return {
      windowType: '5min',
      rows: [
        { timestamp: 0, state: before, baselineKey: 'baseline-1', eligible: true },
        { timestamp: 300_000, state: after, baselineKey: 'baseline-1', eligible: true },
      ],
    };
  });

  const result = fitDynamicModel(episodes);
  assert.equal(result.status, 'ESTIMASI');
  assert.equal(result.audit.pair_count, 24);
  assert.equal(result.audit.rank, 3);
  assert.equal(result.audit.dt_minutes, 5);
  assert.ok(result.stable);
  assert.ok(result.audit.rmse < 1e-10);
  result.matrix.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
    assert.ok(Math.abs(value - transition[rowIndex][columnIndex]) < 1e-9);
  }));
  assert.ok(result.dominantTauMinutes > 0);
});

test('dynamic estimation abstains when eligible sampling intervals are not uniform', () => {
  const episodes = Array.from({ length: 24 }, (_, episodeIndex) => {
    const before = [
      Math.sin(episodeIndex * 0.81) + 0.2,
      Math.cos(episodeIndex * 1.17) - 0.1,
      Math.sin(episodeIndex * 1.43) + 0.4,
    ];
    const after = transition.map((row) => row.reduce(
      (sum, coefficient, index) => sum + (coefficient * before[index]),
      0,
    ));
    return {
      windowType: '5min',
      rows: [
        { timestamp: 0, state: before, baselineKey: 'baseline-1', eligible: true },
        { timestamp: episodeIndex % 2 ? 300_000 : 374_400, state: after, baselineKey: 'baseline-1', eligible: true },
      ],
    };
  });
  const result = fitDynamicModel(episodes);
  assert.equal(result.status, 'ABSTAIN');
  assert.match(result.reason, /Interval sampling tidak cukup seragam/);
});

test('dynamic windows fail the quality gate when a quality component is missing or low', () => {
  const baseline = {
    _id: 'baseline-1',
    activity: 'Rest',
    time_period: 'morning',
    is_mature: true,
    stats: {
      mean_hr: { mean: 70, std: 5 },
      rmssd: { mean: 40, std: 8 },
      dfa_alpha1: { mean: 1, std: 0.1 },
    },
  };
  const baseWindow = {
    _id: 'window-1',
    window_start: Date.parse('2026-11-26T02:00:00Z'),
    activity_label: 'Rest',
    features: { mean_hr: 75, rmssd: 35, dfa_alpha1: 0.9 },
    signal_quality_detail: { q_signal: 0.96, q_complete: 0.96 },
    is_valid: true,
  };
  assert.equal(prepareDynamicWindow(baseWindow, [baseline]).eligible, true);
  assert.equal(prepareDynamicWindow({
    ...baseWindow,
    signal_quality_detail: { q_signal: 0.94, q_complete: 0.99 },
  }, [baseline]).eligible, false);
  assert.equal(prepareDynamicWindow({
    ...baseWindow,
    signal_quality_detail: { q_signal: 0.99 },
  }, [baseline]).eligible, false);
  assert.equal(prepareDynamicWindow({
    ...baseWindow,
    signal_quality_detail: { q_signal: 0.99 },
    missing_data_info: { confidence_score: 99.9 },
  }, [baseline]).eligible, false);
  assert.equal(prepareDynamicWindow({
    ...baseWindow,
    signal_quality_detail: { q_signal: 1.01, q_complete: 0.99 },
  }, [baseline]).eligible, false);
  assert.equal(prepareDynamicWindow(baseWindow, []).state, null);
  assert.equal(prepareDynamicWindow({
    ...baseWindow,
    window_start: '2026-11-26T02:00:00.000Z',
  }, [baseline]).timestamp, Date.parse('2026-11-26T02:00:00.000Z'));
  assert.equal(prepareDynamicWindow(baseWindow, [{
    ...baseline,
    stats: { ...baseline.stats, rmssd: { mean: 40, std: 0 } },
  }]).state, null);
});

test('episode recovery requires two consecutive quality-qualified windows in range', () => {
  const start = Date.parse('2026-11-26T02:00:00Z');
  const baseline = {
    _id: 'baseline-1',
    activity: 'Rest',
    time_period: 'morning',
    is_mature: true,
    stats: {
      mean_hr: { mean: 100, std: 10 },
      rmssd: { mean: 50, std: 10 },
      dfa_alpha1: { mean: 1, std: 0.1 },
    },
  };
  const windows = [
    { _id: 'peak', window_start: start, window_type: '5min', activity_label: 'Rest', features: { mean_hr: 130, rmssd: 50, dfa_alpha1: 1 }, signal_quality_detail: { q_signal: 1, q_complete: 1 } },
    { _id: 'entry', window_start: start + 300_000, window_type: '5min', activity_label: 'Rest', features: { mean_hr: 110, rmssd: 50, dfa_alpha1: 1 }, signal_quality_detail: { q_signal: 1, q_complete: 1 } },
    { _id: 'confirm', window_start: start + 600_000, window_type: '5min', activity_label: 'Rest', features: { mean_hr: 107, rmssd: 50, dfa_alpha1: 1 }, signal_quality_detail: { q_signal: 1, q_complete: 1 } },
  ];
  const recovery = buildRecoveryTrajectory({
    peak_time: start,
    segment_ids: windows.map(({ _id }) => _id),
  }, windows, [baseline]);

  assert.equal(recovery.status, 'Terkonfirmasi oleh aturan observasional');
  assert.equal(recovery.ttrMinutes, 10);
  assert.equal(recovery.points.filter(({ isConfirmation }) => isConfirmation).length, 1);
});

test('episode recovery cannot bridge a quality failure to satisfy the two-window dwell rule', () => {
  const start = Date.parse('2026-11-26T02:00:00Z');
  const baseline = {
    _id: 'baseline-1',
    activity: 'Rest',
    time_period: 'morning',
    is_mature: true,
    stats: {
      mean_hr: { mean: 100, std: 10 },
      rmssd: { mean: 50, std: 10 },
      dfa_alpha1: { mean: 1, std: 0.1 },
    },
  };
  const windows = [0, 5, 10, 15].map((minute, index) => ({
    _id: `w${index}`,
    window_start: start + (minute * 60_000),
    window_type: '5min',
    activity_label: 'Rest',
    features: { mean_hr: index === 0 ? 130 : 110, rmssd: 50, dfa_alpha1: 1 },
    signal_quality_detail: index === 2
      ? { q_signal: 0.94, q_complete: 1 }
      : { q_signal: 1, q_complete: 1 },
  }));
  const recovery = buildRecoveryTrajectory({
    peak_time: start,
    segment_ids: windows.map(({ _id }) => _id),
  }, windows, [baseline]);
  assert.equal(recovery.status, 'Belum terkonfirmasi');
  assert.equal(recovery.ttrMinutes, null);
});

test('episode recovery resolves windows through the physiological parent event when segment ids are absent', () => {
  const timestamp = Date.parse('2026-11-26T02:00:00Z');
  const window = {
    _id: 'window-1',
    window_start: timestamp,
    window_type: '5min',
    activity_label: 'Rest',
    features: { mean_hr: 100, rmssd: 50, dfa_alpha1: 1 },
    signal_quality_detail: { q_signal: 1, q_complete: 1 },
  };
  const recovery = buildRecoveryTrajectory(
    { _id: 'child-event', parent_episode_id: 'parent-event' },
    [window],
    [{
      _id: 'baseline-1',
      activity: 'Rest',
      time_period: 'morning',
      is_mature: true,
      stats: {
        mean_hr: { mean: 100, std: 10 },
        rmssd: { mean: 50, std: 10 },
        dfa_alpha1: { mean: 1, std: 0.1 },
      },
    }],
    [{ _id: 'parent-event', segment_ids: ['window-1'] }],
  );
  assert.equal(recovery.points.length, 1);
});

test('CSV import validates the CAPAR export schema and restores baselines and activity relations', () => {
  const csv = [
    'granularity,node_id,timestamp,end_timestamp,hr_bpm,rmssd_ms,dfa_alpha1,activity,device_id,signal_quality,q_complete,window_type,baseline_activity,baseline_time_period,baseline_hr_mean,baseline_hr_std,baseline_rmssd_mean,baseline_rmssd_std,baseline_dfa_alpha1_mean,baseline_dfa_alpha1_std,baseline_mature,source_reference',
    'window,w1,2026-11-26T02:00:00.000Z,2026-11-26T02:05:00.000Z,75,35,0.9,Rest,device-1,0.98,0.99,5min,Rest,morning,70,5,40,8,1,0.1,true,w1',
    'activity,a1,2026-11-26T02:00:00.000Z,2026-11-26T02:05:00.000Z,75,35,0.9,Rest,device-1,,,,,,,,,,,,,w1',
  ].join('\r\n');
  const imported = parseDynamicAnalysisCsv(csv);
  assert.equal(imported.windows.length, 1);
  assert.equal(imported.baselines[0].is_mature, true);
  assert.equal(imported.activities[0].source_segment_ids[0], 'w1');
  assert.throws(() => parseDynamicAnalysisCsv('granularity,node_id\nwindow,w1'), /Kolom CSV tidak lengkap/);
});

test('dynamic profile graph keeps relationship nodes visible when the selected day has no windows', () => {
  const graph = buildDynamicProfileGraph({
    participant: 'P01',
    scope: 'day',
    day: '2026-11-18',
    activity: 'all',
    windows: [],
    model: {
      status: 'ABSTAIN',
      reason: 'Belum ada data.',
      audit: { pair_count: 0 },
      matrix: null,
    },
  });

  assert.deepEqual(
    graph.nodes.map(({ id }) => id),
    ['person', 'day:2026-11-18', 'activity:0:0', 'model', 'mode', 'profile'],
  );
  assert.ok(graph.edges.some(({ from, to }) => from === 'person' && to === 'day:2026-11-18'));
  assert.ok(graph.edges.some(({ from, to }) => from === 'model' && to === 'profile'));
});

test('dynamic profile graph keeps window metrics as attributes without scaling its node', () => {
  const selectedWindow = {
    _id: 'window-1',
    window_start: Date.parse('2026-11-18T06:22:30.000Z'),
    activity_label: 'Naik tangga',
    features: { mean_hr: 75.6 },
    signal_quality_detail: { q_signal: 0.98 },
  };
  const graph = buildDynamicProfileGraph({
    participant: 'P01',
    scope: 'day',
    day: '2026-11-18',
    activity: 'all',
    windows: [selectedWindow],
    selectedWindow,
    model: { status: 'ESTIMASI', audit: { pair_count: 18 }, matrix: [[1]] },
  });
  const selectedNode = graph.nodes.find(({ id }) => id === 'window:window-1');

  assert.equal(selectedNode.sub, 'Window observasi');
  assert.deepEqual(selectedNode.attributes, {
    timestamp: new Date(selectedWindow.window_start).toISOString(),
    hr_bpm: 75.6,
    rmssd_ms: null,
    dfa_alpha1: null,
    motion_intensity: null,
    signal_quality: 0.98,
  });
  assert.ok(graph.edges.some(({ from, to, rel }) => (
    from === 'window:window-1' && to === 'model' && rel === 'contributesTo'
  )));
  assert.equal(selectedNode.w, 155);
});
