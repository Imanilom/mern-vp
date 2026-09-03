import pymongo
import json
from bson import json_util
import pandas as pd
import os

URI = 'mongodb+srv://memerlin90:LYyX217FP02iuCqV@pak.21cks.mongodb.net/?retryWrites=true&w=majority&appName=pak'
print("Connecting to MongoDB Atlas...")
client = pymongo.MongoClient(URI, serverSelectionTimeoutMS=8000)
db = client['test']

print("Fetching segments (up to 3000)...")
seg_cursor = db.segments.find().limit(3000)
segments = []
for s in seg_cursor:
    f = s.get('features', {})
    z = s.get('z_scores', {})
    segments.append({
        'segment_id': str(s['_id']),
        'user_id': str(s.get('user_id', '')),
        'device_id': s.get('device_id', ''),
        'activity': s.get('activity_label', 'Rest'),
        'window_start': s.get('window_start'),
        'window_end': s.get('window_end'),
        'mean_hr': f.get('mean_hr'),
        'std_hr': f.get('std_hr'),
        'delta_hr': f.get('delta_hr'),
        'slope_hr': f.get('slope_hr'),
        'mean_rr': f.get('mean_rr'),
        'sdnn': f.get('sdnn'),
        'rmssd': f.get('rmssd'),
        'motion_intensity': f.get('motion_intensity', 0),
        'dfa_alpha1': f.get('dfa_alpha1', 1.0),
        'anomaly_score': s.get('anomaly_score', 0),
        'classification': s.get('classification', 'Normal'),
        'z_hr': z.get('z_hr', 0),
        'z_rr': z.get('z_rr', 0),
        'z_sdnn': z.get('z_sdnn', 0)
    })

print(f"Fetched {len(segments)} segments.")

print("Fetching anomaly events...")
ev_cursor = db.anomalyevents.find()
events = []
for e in ev_cursor:
    events.append({
        'event_id': str(e['_id']),
        'user_id': str(e.get('user_id', '')),
        'device_id': e.get('device_id', ''),
        'activity': e.get('activity', 'Rest'),
        'onset_time': e.get('onset_time'),
        'peak_time': e.get('peak_time'),
        'resolved_time': e.get('resolved_time'),
        'duration_ms': e.get('duration_ms', 0),
        'duration_sec': (e.get('duration_ms', 0) or 0) / 1000.0,
        'onset_score': e.get('onset_score', 0),
        'peak_score': e.get('peak_score', 0),
        'classification': e.get('classification', 'Alert'),
        'status': e.get('status', 'resolved'),
        'review_status': e.get('review_status', '')
    })

print(f"Fetched {len(events)} anomaly events.")

print("Fetching baselines...")
base_cursor = db.baselines.find()
baselines = []
for b in base_cursor:
    st = b.get('stats', {})
    lt = b.get('learned_tau', {})
    baselines.append({
        'baseline_id': str(b['_id']),
        'user_id': str(b.get('user_id', '')),
        'activity': b.get('activity', 'Rest'),
        'time_period': b.get('time_period', 'morning'),
        'mean_hr': st.get('mean_hr', {}).get('mean'),
        'std_hr': st.get('mean_hr', {}).get('std'),
        'tau_in': lt.get('tau_in', 1.86),
        'tau_out': lt.get('tau_out', 1.18)
    })
print(f"Fetched {len(baselines)} baselines.")

cache_data = {
    'source': 'MongoDB Atlas (pak.21cks.mongodb.net)',
    'database': 'test',
    'total_segments': len(segments),
    'total_events': len(events),
    'total_baselines': len(baselines),
    'segments': segments,
    'events': events,
    'baselines': baselines
}

out_path = 'simulation/mongodb_telemetry_cache.json'
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(cache_data, f, indent=1)

print(f"Successfully cached MongoDB data to: {out_path} ({os.path.getsize(out_path)/1024:.1f} KB)")
