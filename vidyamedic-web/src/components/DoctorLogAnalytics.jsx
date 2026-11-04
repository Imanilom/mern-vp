import { Activity, AlertTriangle, GitBranch, HeartPulse, Lightbulb, MessageSquareText, Radio } from 'lucide-react';

function sortedByTime(logs) {
  return [...logs].sort((first, second) => (
    new Date(first.log_at || 0).getTime() - new Date(second.log_at || 0).getTime()
  ));
}

function numberValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Waktu tidak tersedia';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function buildSeries(rows, label, color, valueForRow, timeForRow = (row) => row.log_at) {
  return [{
    label,
    color,
    points: rows.map((row) => ({
      time: timeForRow(row),
      value: numberValue(valueForRow(row)),
    })).filter((point) => point.value !== null),
  }];
}

function LineChart({ title, description, series, unit = '' }) {
  const populated = series.filter((item) => item.points.length);
  const values = populated.flatMap((item) => item.points.map((point) => point.value));
  if (!values.length) {
    return (
      <div className="doctor-analysis-card">
        <div className="doctor-analysis-heading"><h3>{title}</h3></div>
        <div className="doctor-analysis-empty">Belum ada data untuk ditampilkan.</div>
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, Math.abs(max) * 0.08, 1);
  const chartMin = min - range * 0.12;
  const chartMax = max + range * 0.12;
  const width = 620;
  const height = 190;
  const left = 44;
  const right = 610;
  const top = 14;
  const bottom = 164;
  const position = (point, index, length) => ({
    x: length < 2 ? (left + right) / 2 : left + (index / (length - 1)) * (right - left),
    y: bottom - ((point.value - chartMin) / (chartMax - chartMin)) * (bottom - top),
  });
  const firstTime = populated.flatMap((item) => item.points).map((point) => point.time).filter(Boolean).sort()[0];
  const lastTime = populated.flatMap((item) => item.points).map((point) => point.time).filter(Boolean).sort().at(-1);

  return (
    <div className="doctor-analysis-card">
      <div className="doctor-analysis-heading">
        <div><h3>{title}</h3>{description && <p>{description}</p>}</div>
        <span>{unit}</span>
      </div>
      <div className="doctor-analysis-chart">
        <div className="doctor-chart-scale">
          <span>{chartMax.toFixed(1)}{unit ? ` ${unit}` : ''}</span>
          <span>{chartMin.toFixed(1)}{unit ? ` ${unit}` : ''}</span>
        </div>
        <svg
          aria-label={title}
          preserveAspectRatio="none"
          role="img"
          viewBox={`0 0 ${width} ${height}`}
        >
          {[top, (top + bottom) / 2, bottom].map((y) => (
            <line className="doctor-chart-grid" key={y} x1={left} x2={right} y1={y} y2={y} />
          ))}
          {populated.map((item) => {
            const coords = item.points.map((point, index) => position(point, index, item.points.length));
            return (
              <g key={item.label}>
                {coords.length > 1 && (
                  <polyline
                    fill="none"
                    points={coords.map((point) => `${point.x},${point.y}`).join(' ')}
                    stroke={item.color}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="3"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {coords.map((point, index) => (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    fill={item.color}
                    key={`${item.label}-${index}`}
                    r="3.5"
                  />
                ))}
              </g>
            );
          })}
        </svg>
        <div className="doctor-chart-times">
          <span>{firstTime ? formatTime(firstTime) : ''}</span>
          <span>{lastTime ? formatTime(lastTime) : ''}</span>
        </div>
      </div>
      <div className="doctor-chart-legend">
        {populated.map((item) => (
          <span key={item.label}><i style={{ background: item.color }} />{item.label} · {item.points.length}</span>
        ))}
      </div>
    </div>
  );
}

function EmptyAnalysis({ icon: Icon = Activity, title, detail }) {
  return (
    <div className="doctor-analysis-empty-state panel">
      <Icon size={24} />
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

function BaselineAnalysis({ logs }) {
  const rows = sortedByTime(logs.filter((log) => log.log_type === 'hil_baseline'));
  if (!rows.length) {
    return <EmptyAnalysis icon={HeartPulse} title="Baseline belum tersedia" detail="Data baseline HIL pasien akan muncul setelah rekaman baseline tersimpan." />;
  }
  const activities = [...new Set(rows.map((row) => row.activity).filter(Boolean))];
  const activityColors = ['#168c87', '#667bc4', '#b78945', '#b4668a', '#4380a7'];
  return (
    <div className="doctor-analysis-grid">
      {[
        ['mean_hr', 'Rerata denyut jantung', 'bpm', '#168c87'],
        ['rmssd', 'RMSSD', 'ms', '#667bc4'],
        ['sdnn', 'SDNN', 'ms', '#b78945'],
        ['dfa_alpha1', 'DFA alpha-1', '', '#b4668a'],
        ['motion_intensity', 'Intensitas gerakan', '', '#4380a7'],
      ].map(([field, title, unit, color]) => (
        <LineChart
          description={`Tren baseline per aktivitas: ${activities.join(', ') || 'tidak diketahui'}`}
          key={field}
          series={activities.length
            ? activities.map((activity, index) => ({
              label: activity,
              color: activityColors[index % activityColors.length],
              points: rows.filter((row) => row.activity === activity).map((row) => ({
                time: row.recorded_at || row.log_at,
                value: numberValue(row.features?.[field]),
              })).filter((point) => point.value !== null),
            }))
            : buildSeries(rows, title, color, (row) => row.features?.[field])}
          title={title}
          unit={unit}
        />
      ))}
      <div className="doctor-analysis-card doctor-baseline-summary">
        <div className="doctor-analysis-heading"><h3>Ringkasan baseline</h3></div>
        {activities.map((activity) => {
          const activityRows = rows.filter((row) => row.activity === activity);
          const meanHr = activityRows.map((row) => numberValue(row.features?.mean_hr)).filter((value) => value !== null);
          const average = meanHr.length
            ? meanHr.reduce((total, value) => total + value, 0) / meanHr.length
            : null;
          return (
            <div className="doctor-baseline-row" key={activity}>
              <span>{activity}</span>
              <strong>{average === null ? '—' : `${average.toFixed(1)} bpm`}</strong>
              <small>{activityRows.length} rekaman</small>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getDeviationPoints(logs) {
  const points = [];
  for (const log of logs) {
    if (log.log_type === 'hil_scenario') {
      const history = Array.isArray(log.history) ? log.history : [];
      const baseline = numberValue(log.baseline_mean_hr);
      const threshold = baseline === null
        ? null
        : baseline + (numberValue(log.threshold_bpm) ?? 0);
      for (const item of history) {
        points.push({
      time: item.recorded_at,
      heartRate: numberValue(item.heart_rate_bpm),
      baseline,
      threshold,
        });
      }
      const heartRate = numberValue(log.heart_rate_bpm ?? log.raw_hr);
      if (heartRate !== null) {
        points.push({
          time: log.observed_at || log.log_at,
          heartRate,
          baseline,
          threshold,
        });
      }
    }
    if (log.log_type === 'hil_realtime') {
      const analysis = log.analysis || {};
      const baseline = numberValue(analysis.baseline?.mean_hr);
      const baselineStd = numberValue(analysis.baseline?.mean_hr_std);
      const threshold = baseline === null
        ? null
        : baseline + (baselineStd === null ? 10 : Math.max(10, baselineStd * 2));
      for (const reading of analysis.readings || log.readings || []) {
        points.push({
          time: reading.recorded_at || log.evaluated_at || log.log_at,
          heartRate: numberValue(reading.heart_rate_bpm),
          baseline,
          threshold,
          label: log.patient_name,
        });
      }
    }
  }
  return points.filter((point) => point.heartRate !== null).sort(
    (first, second) => new Date(first.time || 0) - new Date(second.time || 0)
  );
}

function DeviationAnalysis({ logs }) {
  const points = getDeviationPoints(logs);
  const detected = logs.filter((log) => (
    (log.log_type === 'hil_scenario' && log.event_type === 'deviation_detected')
    || (log.log_type === 'hil_realtime' && log.analysis?.interpretation?.is_candidate === true)
  ));
  if (!points.length) {
    return <EmptyAnalysis icon={AlertTriangle} title="Data deviasi belum tersedia" detail="Grafik akan tersedia setelah evaluasi memiliki denyut jantung dan nilai pembanding." />;
  }
  return (
    <div className="doctor-analysis-content">
      <div className="doctor-analysis-stat">
        <strong>{detected.length}</strong><span>kandidat deviasi tercatat</span>
      </div>
      <LineChart
        description="Perbandingan denyut jantung hasil observasi terhadap baseline yang tersimpan."
        series={[
          { label: 'Denyut teramati', color: '#cf717e', points: points.map((point) => ({ time: point.time, value: point.heartRate })) },
          { label: 'Baseline', color: '#168c87', points: points.filter((point) => point.baseline !== null).map((point) => ({ time: point.time, value: point.baseline })) },
          { label: 'Ambang tersimpan', color: '#b78945', points: points.filter((point) => point.threshold !== null).map((point) => ({ time: point.time, value: point.threshold })) },
        ]}
        title="Denyut jantung dan pembanding"
        unit="bpm"
      />
      <div className="doctor-analysis-card doctor-analysis-table">
        <div className="doctor-analysis-heading"><h3>Catatan deviasi dan status evaluasi</h3></div>
        {logs.filter((log) => log.log_type === 'hil_scenario' && (
          log.algorithm_status || log.event_type === 'deviation_detected'
        )).slice(0, 20).map((log) => (
          <div className="doctor-analysis-row" key={log._id}>
            <span>{log.patient_name} · {formatTime(log.observed_at || log.log_at)}</span>
            <strong>{log.algorithm_status || log.event_type}</strong>
            <small>
              HR {log.heart_rate_bpm ?? log.raw_hr ?? '—'} bpm · baseline {log.baseline_mean_hr ?? '—'} bpm
              {log.z_score != null ? ` · z-score ${Number(log.z_score).toFixed(2)}` : ''}
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecordingAnalysis({ logs }) {
  const points = [];
  for (const log of logs) {
    if (log.log_type === 'hil_scenario') {
      for (const reading of log.history || []) {
        points.push({ time: reading.recorded_at, hr: numberValue(reading.heart_rate_bpm), quality: numberValue(reading.q_signal) });
      }
    }
    if (log.log_type === 'hil_realtime') {
      for (const reading of log.readings || []) {
        points.push({ time: reading.recorded_at, hr: numberValue(reading.heart_rate_bpm), quality: numberValue(reading.signal_confidence) });
      }
    }
    if (log.log_type === 'wearable' && log.heart_rate_bpm != null) {
      points.push({ time: log.recorded_at, hr: numberValue(log.heart_rate_bpm), quality: numberValue(log.signal_confidence) });
    }
  }
  points.sort((first, second) => new Date(first.time || 0) - new Date(second.time || 0));
  const recordingLogs = logs.filter((log) => (
    ['hil_session', 'hil_scenario', 'hil_realtime', 'wearable'].includes(log.log_type)
  ));
  if (!points.length) {
    return <EmptyAnalysis icon={Radio} title="Rekaman belum tersedia" detail="Rekaman wearable dan sampel HIL pasien akan divisualisasikan di sini." />;
  }
  return (
    <div className="doctor-analysis-content">
      <div className="doctor-analysis-stat">
        <strong>{points.length}</strong><span>titik rekaman · {recordingLogs.length} catatan terkait</span>
      </div>
      <LineChart
        description="HR dari sampel HIL, evaluasi realtime, serta rekaman wearable yang tersedia."
        series={buildSeries(points, 'Denyut jantung', '#168c87', (point) => point.hr, (point) => point.time)}
        title="Grafik rekaman denyut jantung"
        unit="bpm"
      />
      <LineChart
        description="Nilai kualitas sinyal yang tersimpan pada sampel rekaman."
        series={buildSeries(points, 'Kualitas sinyal', '#667bc4', (point) => point.quality, (point) => point.time)}
        title="Kualitas rekaman"
      />
    </div>
  );
}

function ObservationAnalysis({ logs }) {
  const rows = logs.filter((log) => (
    log.log_type === 'hil_explanation'
    || log.log_type === 'hil_scenario'
    || log.log_type === 'scenario_session'
  )).sort((first, second) => new Date(second.log_at || 0) - new Date(first.log_at || 0));
  if (!rows.length) {
    return <EmptyAnalysis icon={Lightbulb} title="Hasil observasi belum tersedia" detail="Observasi HIL dan interpretasi skenario akan tampil saat rekamannya tersedia." />;
  }
  return (
    <div className="doctor-observation-list">
      {rows.slice(0, 50).map((log) => {
        const interpretation = log.log_type === 'scenario_session'
          ? log.interpretations?.at(-1)
          : null;
        const title = log.log_type === 'hil_explanation'
          ? log.status
          : interpretation?.status || log.algorithm_status || log.event_type || 'Observasi';
        const explanation = log.explanation
          || interpretation?.reason
          || log.recommendation
          || log.clarification
          || interpretation?.uncertainty;
        const observation = interpretation?.observation;
        return (
          <article className="doctor-observation-card panel" key={`${log.log_type}:${log._id}`}>
            <div className="doctor-observation-top">
              <span>{log.patient_name}</span>
              <time>{formatTime(log.log_at)}</time>
            </div>
            <h3>{String(title).replaceAll('_', ' ')}</h3>
            <p>{explanation || 'Tidak ada catatan penjelasan pada log ini.'}</p>
            <div className="doctor-observation-meta">
              {log.scenario && <span>Skenario {log.scenario}</span>}
              {log.activity && <span>{log.activity}</span>}
              {log.quality_status && <span>Kualitas: {log.quality_status}</span>}
              {log.baseline_ready != null && <span>Baseline {log.baseline_ready ? 'siap' : 'belum siap'}</span>}
              {observation?.features?.mean_hr != null && <span>HR: {observation.features.mean_hr} bpm</span>}
            </div>
            {log.factors?.length > 0 && (
              <div className="doctor-answer-tags">
                {log.factors.map((factor) => <span key={factor}>{factor.replaceAll('_', ' ')}</span>)}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function flattenAnswer(value) {
  if (value === null || value === undefined || value === '') return [];
  if (Array.isArray(value)) return value.flatMap(flattenAnswer);
  if (typeof value !== 'object') return [String(value)];
  return Object.entries(value).flatMap(([key, child]) => (
    flattenAnswer(child).map((answer) => `${key.replaceAll('_', ' ')}: ${answer}`)
  ));
}

function PatientAnswers({ logs }) {
  const rows = [];
  for (const log of logs) {
    if (log.log_type === 'check_in') {
      const answers = [
        ['Perasaan', log.feeling],
        ['Aktivitas', log.activity],
        ['Postur', log.posture],
        ['Gejala', log.symptoms],
        ['Faktor yang dipilih', log.deviation_follow_up?.perceived_factors],
        ['Urutan faktor', log.deviation_follow_up?.ranked_context_factors],
        ['Aktivitas sebelumnya', log.deviation_follow_up?.activity_before_event],
        ['Onset gejala', log.deviation_follow_up?.symptom_onset],
        ['Aktivitas berat', log.deviation_follow_up?.strenuous_activity],
        ['Intensitas aktivitas', log.deviation_follow_up?.activity_intensity],
        ['Aktivitas mental', log.deviation_follow_up?.mental_activity],
        ['Kondisi pengukuran', log.deviation_follow_up?.measurement_condition],
        ['Catatan pasien', log.deviation_follow_up?.note || log.note],
      ];
      rows.push({
        id: log._id,
        patient: log.patient_name,
        time: log.recorded_at || log.log_at,
        source: 'Check-in pasien',
        answers: answers.flatMap(([label, value]) => flattenAnswer(value).map((answer) => `${label}: ${answer}`)),
      });
    }
    if (log.log_type === 'scenario_questionnaire') {
      rows.push({
        id: log._id,
        patient: log.patient_name,
        time: log.submitted_at || log.log_at,
        source: `Kuesioner ${log.instrument || ''}`,
        answers: flattenAnswer(log.responses),
      });
    }
    if (log.log_type === 'scenario_event') {
      rows.push({
        id: log._id,
        patient: log.patient_name,
        time: log.event_time || log.log_at,
        source: 'Jawaban koreksi aktivitas skenario',
        answers: flattenAnswer({
          pilihan: log.value,
          keyakinan: log.confidence,
          konteks_sebelumnya: log.previous_context,
          konteks_sekarang: log.current_context,
          status_proses: log.processing_state,
        }),
      });
    }
    if (log.log_type === 'hil_scenario' && (
      log.event_type === 'clarification_submitted' || log.clarification
    )) {
      rows.push({
        id: log._id,
        patient: log.patient_name,
        time: log.log_at,
        source: 'Klarifikasi HIL',
        answers: flattenAnswer({ jawaban: log.clarification, aktivitas: log.activity }),
      });
    }
  }
  rows.sort((first, second) => new Date(second.time || 0) - new Date(first.time || 0));
  if (!rows.length) {
    return <EmptyAnalysis icon={MessageSquareText} title="Belum ada jawaban pasien" detail="Jawaban check-in, kuesioner, klarifikasi, dan pilihan aktivitas pasien tampil di sini." />;
  }
  return (
    <div className="doctor-answer-list">
      {rows.slice(0, 100).map((row) => (
        <article className="doctor-answer-card panel" key={row.id}>
          <div className="doctor-observation-top">
            <span>{row.patient} · {row.source}</span>
            <time>{formatTime(row.time)}</time>
          </div>
          {row.answers.length ? (
            <ul>{row.answers.map((answer, index) => <li key={`${row.id}:${index}`}>{answer}</li>)}</ul>
          ) : <p>Tidak ada jawaban yang tersimpan pada catatan ini.</p>}
        </article>
      ))}
    </div>
  );
}

function NodeAnalysis({ logs }) {
  const scenarioLogs = sortedByTime(logs.filter((log) => log.log_type === 'hil_scenario'));
  const runs = new Map();
  for (const log of scenarioLogs) {
    const key = `${log.patient_id}:${log.run_id}`;
    if (!runs.has(key)) runs.set(key, []);
    runs.get(key).push(log);
  }
  const latestRun = [...runs.values()].sort((first, second) => (
    new Date(second.at(-1)?.log_at || 0) - new Date(first.at(-1)?.log_at || 0)
  ))[0] || [];
  const uniqueNodes = latestRun.filter((log, index) => (
    index === 0 || log.event_type !== latestRun[index - 1].event_type
  )).slice(-12);

  if (!uniqueNodes.length) {
    const interpretations = logs
      .filter((log) => log.log_type === 'scenario_session')
      .flatMap((log) => (log.interpretations || []).map((item) => ({
        ...item,
        patient_name: log.patient_name,
        log_at: item.created_at,
      })))
      .sort((first, second) => new Date(first.log_at || 0) - new Date(second.log_at || 0));
    if (!interpretations.length) {
      return <EmptyAnalysis icon={GitBranch} title="Node proses belum tersedia" detail="Node alur akan disusun dari event sesi HIL atau interpretasi skenario yang tersimpan." />;
    }
    return (
      <div className="doctor-node-panel panel">
        <h3>Urutan hasil interpretasi</h3>
        <div className="doctor-node-track">
          {interpretations.slice(-12).map((node, index) => (
            <div className="doctor-node" key={`${node.version}:${index}`}>
              <span>{index + 1}</span>
              <strong>{String(node.status || 'observasi').replaceAll('_', ' ')}</strong>
              <small>{node.patient_name} · {node.processing_state}</small>
              {node.reason && <p>{node.reason}</p>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="doctor-node-panel panel">
      <div className="doctor-analysis-heading">
        <div>
          <h3>Node alur sesi HIL terbaru</h3>
          <p>{latestRun[0]?.patient_name} · Skenario {latestRun[0]?.scenario} · {latestRun[0]?.run_id}</p>
        </div>
      </div>
      <div className="doctor-node-track">
        {uniqueNodes.map((node, index) => (
          <div className="doctor-node" key={node._id}>
            <span>{index + 1}</span>
            <strong>{String(node.event_type).replaceAll('_', ' ')}</strong>
            <small>{node.activity} · {formatTime(node.log_at)}</small>
            {node.algorithm_status && <small>Status: {node.algorithm_status.replaceAll('_', ' ')}</small>}
            {node.explanation && <p>{node.explanation}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DoctorLogAnalytics({ activeView, logs }) {
  if (activeView === 'baseline') return <BaselineAnalysis logs={logs} />;
  if (activeView === 'deviation') return <DeviationAnalysis logs={logs} />;
  if (activeView === 'recordings') return <RecordingAnalysis logs={logs} />;
  if (activeView === 'observations') return <ObservationAnalysis logs={logs} />;
  if (activeView === 'answers') return <PatientAnswers logs={logs} />;
  if (activeView === 'nodes') return <NodeAnalysis logs={logs} />;
  return null;
}
