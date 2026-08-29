"""
===============================================================================
CAPAR 2.0 — Google Colab Pipeline Simulation & Metadata Verification Script
===============================================================================
Simulasi ini menguji:
 1. Detection Onset (Candidate State saat score >= tau_in)
 2. 2-of-3 Window Sliding Persistence (State -> PERSISTENT_DEVIATION jika 2 dari 3 window anomaly)
 3. Handler Data Terputus / Device Dilepas sebelum recovery (FORCE_CLOSED_TAU_OUT)
 4. Generasi Koleksi EpisodeMeta & EpisodeAnalysis yang saling terhubung (Linked)
 5. Visualisasi Trajektori & State Machine Graph
===============================================================================
"""

import math
import json
from datetime import datetime, timedelta

# Try optional visualization imports for local vs Colab
try:
    import matplotlib.pyplot as plt
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False

# ── 1. Configuration & Thresholds ──────────────────────────────────────────────
TAU_IN = 1.86       # Candidate onset threshold
TAU_OUT = 1.18      # Recovery entry threshold
TAU_NORMAL = 0.82   # Normal baseline threshold
DISCONNECT_TIMEOUT_MIN = 15 # Gap > 15 menit dianggap device dilepas/terputus

print("=" * 80)
print("CAPAR 2.0 PIPELINE SIMULATION: 2-of-3 Persistence & Disconnect Handler")
print("=" * 80)

# ── 2. Data Generator (Skenario Fisiologis Sparse/Real-time) ───────────────────
base_time = datetime(2026, 8, 27, 16, 20, 0)
timestamps = []
scores = []

# Baseline normal (5 window)
for i in range(5):
    timestamps.append(base_time + timedelta(minutes=5 * i))
    scores.append(0.5)

# Onset & Anomaly (Window 5: Score high 4.63) -> Window Candidate 1
timestamps.append(base_time + timedelta(minutes=25))
scores.append(4.63) # Window 6 (Candidate Onset)

# Window 6: Score dip ke 1.50 (< tau_in tapi > tau_out)
timestamps.append(base_time + timedelta(minutes=30))
scores.append(1.50) # Window 7

# Window 7: Score high 3.85 (>= tau_in) -> 2 dari 3 window anomaly => PERSISTENT_DEVIATION!
timestamps.append(base_time + timedelta(minutes=35))
scores.append(3.85) # Window 8 (Persistent)

# Data Terputus / Device Dilepas (Simulasi Gap 30 Menit tanpa data recovery < tau_out)
timestamps.append(base_time + timedelta(minutes=65))
scores.append(1.40) # Window 9 (Setelah Gap 30 Min)

# Recovery normal untuk perbandingan
timestamps.append(base_time + timedelta(minutes=70))
scores.append(0.90)
timestamps.append(base_time + timedelta(minutes=75))
scores.append(0.60)


# ── 3. CAPAR FSM Simulator ────────────────────────────────────────────────────
class CAPARFSMSimulator:
    def __init__(self, tau_in=1.86, tau_out=1.18, tau_normal=0.82):
        self.tau_in = tau_in
        self.tau_out = tau_out
        self.tau_normal = tau_normal
        self.window_history = [] # sliding window 3
        self.episode_active = False
        self.current_state = 'BASELINE_COMPATIBLE'
        self.open_event = None
        self.last_ts = None
        self.events = []
        self.meta_collection = []

    def process_window(self, ts, score, participant_id="p-9669def075"):
        ts_ms = int(ts.timestamp() * 1000)
        
        # 1. Cek Gap / Disconnect Handler (> 15 menit gap saat episode aktif)
        if self.last_ts is not None and self.episode_active:
            gap_min = (ts - self.last_ts).total_seconds() / 60.0
            if gap_min > DISCONNECT_TIMEOUT_MIN:
                self.force_close_tau_out(ts_ms, reason="Data terputus / device dilepas sebelum titik tau_out (Force closed at last valid window)")
        
        self.last_ts = ts
        
        # Update sliding history 3-window (2-of-3 persistence check)
        self.window_history.append(score >= self.tau_in)
        if len(self.window_history) > 3:
            self.window_history.pop(0)
            
        count_in_last_3 = sum(self.window_history)

        # State transition evaluation
        if score >= self.tau_in:
            self.episode_active = True
            if count_in_last_3 >= 2:
                self.current_state = 'PERSISTENT_DEVIATION'
            else:
                self.current_state = 'DEVIATION_CANDIDATE'
            
            if not self.open_event:
                self.create_event(ts_ms, score, participant_id)
            else:
                self.update_event(ts_ms, score)
                
        elif self.episode_active:
            if count_in_last_3 >= 2 and score > self.tau_out:
                self.current_state = 'PERSISTENT_DEVIATION'
                self.update_event(ts_ms, score)
            elif score <= self.tau_normal:
                self.current_state = 'RECOVERED'
                self.close_event(ts_ms, score, status='closed')
                self.episode_active = False
                self.window_history = []
            elif score <= self.tau_out:
                self.current_state = 'RECOVERING'
                self.update_event(ts_ms, score)
            else:
                self.current_state = 'RECOVERING'
                self.update_event(ts_ms, score)
        else:
            self.current_state = 'BASELINE_COMPATIBLE'
            
        return self.current_state

    def create_event(self, ts_ms, score, participant_id):
        dt = datetime.fromtimestamp(ts_ms / 1000.0)
        event_id = f"ep_{ts_ms}"
        analysis_id = f"analysis_{ts_ms}"
        
        event_doc = {
            '_id': event_id,
            'participant_id': participant_id,
            'onset_time': ts_ms,
            'started_at': ts_ms,
            'candidate_at': ts_ms,
            'peak_time': ts_ms,
            'onset_score': score,
            'peak_score': score,
            'duration_ms': 300000, # 5 min initial window
            'status': 'open',
            'current_state': self.current_state,
            'window_count': 1,
            'resolved_time': None,
            'recovered_at': None,
            'unresolved_reason': None
        }
        self.open_event = event_doc
        self.events.append(event_doc)
        
        # Meta Collection Linked Document
        meta_doc = {
            'episode_id': event_id,
            'analysis_id': analysis_id,
            'participant_id': participant_id,
            'date': dt.strftime('%Y-%m-%d'),
            'time': dt.strftime('%H:%M:%S'),
            'onset_timestamp': ts_ms,
            'status': 'candidate' if self.current_state == 'DEVIATION_CANDIDATE' else 'persistent',
            'current_state': self.current_state,
            'peak_score': score,
            'duration_ms': 300000
        }
        self.meta_collection.append(meta_doc)

    def update_event(self, ts_ms, score):
        if not self.open_event: return
        self.open_event['window_count'] += 1
        if score > self.open_event['peak_score']:
            self.open_event['peak_score'] = score
            self.open_event['peak_time'] = ts_ms
        self.open_event['current_state'] = self.current_state
        self.open_event['duration_ms'] = ts_ms - self.open_event['onset_time'] + 300000
        
        # Update linked EpisodeMeta
        for m in self.meta_collection:
            if m['episode_id'] == self.open_event['_id']:
                m['status'] = 'persistent' if 'PERSISTENT' in self.current_state else ('candidate' if 'CANDIDATE' in self.current_state else 'recovering')
                m['current_state'] = self.current_state
                m['peak_score'] = self.open_event['peak_score']
                m['duration_ms'] = self.open_event['duration_ms']

    def force_close_tau_out(self, ts_ms, reason):
        if not self.open_event: return
        last_valid_ts = self.open_event['onset_time'] + (self.open_event['window_count'] * 300000)
        
        self.open_event['status'] = 'closed'
        self.open_event['current_state'] = 'FORCE_CLOSED_TAU_OUT'
        self.open_event['recovery_entry_at'] = last_valid_ts
        self.open_event['recovered_at'] = last_valid_ts
        self.open_event['resolved_time'] = last_valid_ts
        self.open_event['unresolved_reason'] = reason
        self.open_event['duration_ms'] = last_valid_ts - self.open_event['onset_time']
        
        for m in self.meta_collection:
            if m['episode_id'] == self.open_event['_id']:
                m['status'] = 'recovered'
                m['current_state'] = 'FORCE_CLOSED_TAU_OUT'
                m['duration_ms'] = self.open_event['duration_ms']
        
        print(f"\n[DISCONNECT HANDLER TRIGGERED]")
        print(f"    Episode ID      : {self.open_event['_id']}")
        print(f"    Reason          : {reason}")
        print(f"    Force Tau_Out At: {datetime.fromtimestamp(last_valid_ts/1000.0).strftime('%H:%M:%S')}")
        
        self.open_event = None
        self.episode_active = False

    def close_event(self, ts_ms, score, status='closed'):
        if not self.open_event: return
        self.open_event['status'] = status
        self.open_event['current_state'] = 'RECOVERED'
        self.open_event['recovered_at'] = ts_ms
        self.open_event['resolved_time'] = ts_ms
        self.open_event['duration_ms'] = ts_ms - self.open_event['onset_time']
        
        for m in self.meta_collection:
            if m['episode_id'] == self.open_event['_id']:
                m['status'] = 'recovered'
                m['current_state'] = 'RECOVERED'
                m['duration_ms'] = self.open_event['duration_ms']
                
        self.open_event = None

# Run Simulation
sim = CAPARFSMSimulator(tau_in=TAU_IN, tau_out=TAU_OUT, tau_normal=TAU_NORMAL)
fsm_states = []

print("\n--- TIMELINE DETEKSI WINDOW ---")
for ts, sc in zip(timestamps, scores):
    st = sim.process_window(ts, sc)
    fsm_states.append(st)
    print(f"[{ts.strftime('%H:%M:%S')}] Score: {sc:.2f}  ==> State: {st}")

# ── 4. Verify & Display Collections ────────────────────────────────────────────
print("\n" + "=" * 80)
print("1. EpisodeMeta COLLECTION (Dokumen Linked Meta)")
print("=" * 80)
print(json.dumps(sim.meta_collection, indent=2))

print("\n" + "=" * 80)
print("2. AnomalyEvent COLLECTION (Hasil FSM State Machine)")
print("=" * 80)
for ev in sim.events:
    print(json.dumps(ev, indent=2))

if HAS_MATPLOTLIB:
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 9), sharex=True, gridspec_kw={'height_ratios': [2.5, 1]})
    time_labels = [t.strftime('%H:%M') for t in timestamps]
    x_indices = list(range(len(timestamps)))
    ax1.plot(x_indices, scores, marker='o', color='#2b5c8f', linewidth=2.5, label='Anomaly Score S(t)')
    ax1.axhline(y=TAU_IN, color='#d9534f', linestyle='--', linewidth=1.8, label=f'tau_in ({TAU_IN})')
    ax1.axhline(y=TAU_OUT, color='#f0ad4e', linestyle='-.', linewidth=1.8, label=f'tau_out ({TAU_OUT})')
    ax1.set_title('CAPAR 2.0 Simulation Chart', fontsize=13, fontweight='bold')
    plt.tight_layout()
    plt.savefig('d:/Kerjaan/mern-vp/capar_simulation_chart.png')
    print("\n✅ Chart image saved to d:/Kerjaan/mern-vp/capar_simulation_chart.png")
