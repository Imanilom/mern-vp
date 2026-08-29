"""
===============================================================================
CAPAR 2.0 — Google Colab Pipeline Simulation Script
Event ID: 6a90023d74156d89d1dc451b | User ID: 6a7e4fc8a6e8c17678a91e8f
Activity: Duduk (Evening) | Tau_In Baseline: 1.70
===============================================================================
"""

import math
import json
from datetime import datetime, timedelta

# ── 1. Configuration & Input Document ──────────────────────────────────────────
TAU_IN = 1.70       # Baseline tau_in (Duduk Evening)
TAU_OUT = 1.70 * 0.5  # 0.85 (Recovery entry threshold)
TAU_NORMAL = 0.85 * 0.7 # 0.595 (Baseline normal threshold)
DISCONNECT_TIMEOUT_MIN = 15 # Gap > 15 min -> Data terputus / device dilepas

EVENT_ID = "6a90023d74156d89d1dc451b"
USER_ID = "6a7e4fc8a6e8c17678a91e8f"
DEVICE_ID = "E4F82A29"
ACTIVITY = "Duduk"
SEGMENT_ID_1 = "6a9001cb8269202384f61737"
ONSET_TS = 1787822539472  # 2026-08-27T09:22:19.472Z (16:22:19 WIB)

print("=" * 80)
print(f"CAPAR 2.0 SIMULATION FOR EVENT: {EVENT_ID}")
print(f"User ID: {USER_ID} | Device: {DEVICE_ID} | Activity: {ACTIVITY} (Evening)")
print(f"Baseline Tau_In: {TAU_IN:.2f} | Tau_Out: {TAU_OUT:.2f} | Tau_Normal: {TAU_NORMAL:.2f}")
print("=" * 80)

# ── 2. CAPAR FSM Engine Simulation ────────────────────────────────────────────
class EventSimulator:
    def __init__(self):
        self.window_history = []
        self.episode_active = False
        self.current_state = "BASELINE_COMPATIBLE"
        self.event_doc = None
        self.meta_doc = None
        self.last_ts = None

    def process_window(self, ts_ms, score, seg_id):
        ts_dt = datetime.fromtimestamp(ts_ms / 1000.0)
        
        # Cek Gap / Disconnect Handler (> 15 min gap)
        if self.last_ts is not None and self.episode_active:
            gap_min = (ts_ms - self.last_ts) / 60000.0
            if gap_min > DISCONNECT_TIMEOUT_MIN:
                self.force_close_tau_out(ts_ms, reason="Data terputus / device dilepas sebelum titik tau_out (Force closed at last valid window)")
                return self.current_state

        self.last_ts = ts_ms

        # 2-of-3 window sliding persistence check
        self.window_history.append(score >= TAU_IN)
        if len(self.window_history) > 3:
            self.window_history.pop(0)

        count_in_last_3 = sum(self.window_history)

        if score >= TAU_IN:
            self.episode_active = True
            if count_in_last_3 >= 2:
                self.current_state = "PERSISTENT_DEVIATION"
            else:
                self.current_state = "DEVIATION_CANDIDATE"

            if not self.event_doc:
                self.create_event(ts_ms, score, seg_id)
            else:
                self.update_event(ts_ms, score, seg_id)

        elif self.episode_active:
            if count_in_last_3 >= 2 and score > TAU_OUT:
                self.current_state = "PERSISTENT_DEVIATION"
                self.update_event(ts_ms, score, seg_id)
            elif score <= TAU_NORMAL:
                self.current_state = "RECOVERED"
                self.close_event(ts_ms, score, status="closed")
                self.episode_active = False
            elif score <= TAU_OUT:
                self.current_state = "RECOVERING"
                self.update_event(ts_ms, score, seg_id)
            else:
                self.current_state = "RECOVERING"
                self.update_event(ts_ms, score, seg_id)
        else:
            self.current_state = "BASELINE_COMPATIBLE"

        return self.current_state

    def create_event(self, ts_ms, score, seg_id):
        dt_wib = datetime.fromtimestamp(ts_ms / 1000.0)
        self.event_doc = {
            "_id": {"$oid": EVENT_ID},
            "user_id": {"$oid": USER_ID},
            "device_id": DEVICE_ID,
            "activity": ACTIVITY,
            "onset_time": ts_ms,
            "started_at": ts_ms,
            "candidate_at": ts_ms,
            "peak_time": ts_ms,
            "resolved_time": None,
            "actual_onset_time": None,
            "duration_ms": 300000, # 5 min initial window
            "onset_score": score,
            "peak_score": score,
            "peak_hr": 102.65,
            "baseline_hr": 64.88,
            "classification": "Alert",
            "trajectory": {
                "sequence_of_scores": [score],
                "delta_hr": None,
                "persistence": 1,
                "dfa_alpha1": None,
                "dfa_alpha2": None,
                "recovery_time_ms": None
            },
            "segment_ids": [{"$oid": seg_id}],
            "status": "open",
            "auc_score": None,
            "window_count": 1,
            "unresolved_reason": None,
            "admin_status": "OPEN",
            "physiological_outcome": "UNRESOLVED",
            "current_state": self.current_state,
            "recovery_entry_at": None,
            "ttr_min": None,
            "peak_count": 1,
            "relapse_count": 0,
            "relapse": False,
            "relapse_at": None,
            "parent_episode_id": None,
            "rule_version": "1.0.0",
            "total_paused_ms": 0,
            "last_paused_at": None,
            "review_status": "New",
            "validation_label": "None",
            "reviewer_id": None,
            "reviewer_notes": "",
            "escalated": False,
            "pause_history": [],
            "annotations": []
        }

        # Create EpisodeMeta Document
        self.meta_doc = {
            "_id": {"$oid": f"meta_{EVENT_ID[-12:]}"},
            "episode_id": {"$oid": EVENT_ID},
            "analysis_id": {"$oid": f"analysis_{EVENT_ID[-12:]}"},
            "user_id": {"$oid": USER_ID},
            "participant_id": "p-E4F82A29",
            "date": dt_wib.strftime("%Y-%m-%d"),
            "time": dt_wib.strftime("%H:%M:%S"),
            "onset_timestamp": ts_ms,
            "status": "candidate",
            "current_state": self.current_state,
            "activity": ACTIVITY,
            "classification": "Alert",
            "peak_score": score,
            "duration_ms": 300000
        }

    def update_event(self, ts_ms, score, seg_id):
        if not self.event_doc: return
        self.event_doc["window_count"] += 1
        self.event_doc["trajectory"]["sequence_of_scores"].append(score)
        self.event_doc["trajectory"]["persistence"] = len(self.event_doc["trajectory"]["sequence_of_scores"])
        self.event_doc["segment_ids"].append({"$oid": seg_id})
        
        if score > self.event_doc["peak_score"]:
            self.event_doc["peak_score"] = score
            self.event_doc["peak_time"] = ts_ms

        self.event_doc["current_state"] = self.current_state
        self.event_doc["duration_ms"] = ts_ms - self.event_doc["onset_time"] + 300000

        # Update EpisodeMeta
        if self.meta_doc:
            self.meta_doc["status"] = "persistent" if "PERSISTENT" in self.current_state else "candidate"
            self.meta_doc["current_state"] = self.current_state
            self.meta_doc["peak_score"] = self.event_doc["peak_score"]
            self.meta_doc["duration_ms"] = self.event_doc["duration_ms"]

    def force_close_tau_out(self, ts_ms, reason):
        if not self.event_doc: return
        last_valid_ts = self.event_doc["onset_time"] + (self.event_doc["window_count"] * 300000)

        self.event_doc["status"] = "closed"
        self.event_doc["admin_status"] = "CLOSED"
        self.event_doc["current_state"] = "FORCE_CLOSED_TAU_OUT"
        self.event_doc["recovery_entry_at"] = last_valid_ts
        self.event_doc["recovered_at"] = last_valid_ts
        self.event_doc["resolved_time"] = last_valid_ts
        self.event_doc["unresolved_reason"] = reason
        self.event_doc["duration_ms"] = last_valid_ts - self.event_doc["onset_time"]

        if self.meta_doc:
            self.meta_doc["status"] = "recovered"
            self.meta_doc["current_state"] = "FORCE_CLOSED_TAU_OUT"
            self.meta_doc["duration_ms"] = self.event_doc["duration_ms"]

        print(f"\n[DISCONNECT HANDLER TRIGGERED]")
        print(f"    Episode ID      : {EVENT_ID}")
        print(f"    Reason          : {reason}")
        print(f"    Force Tau_Out At: {datetime.fromtimestamp(last_valid_ts/1000.0).strftime('%H:%M:%S')}")

        self.episode_active = False

    def close_event(self, ts_ms, score, status="closed"):
        if not self.event_doc: return
        self.event_doc["status"] = status
        self.event_doc["admin_status"] = "CLOSED"
        self.event_doc["current_state"] = "RECOVERED"
        self.event_doc["recovered_at"] = ts_ms
        self.event_doc["resolved_time"] = ts_ms
        self.event_doc["duration_ms"] = ts_ms - self.event_doc["onset_time"]

        if self.meta_doc:
            self.meta_doc["status"] = "recovered"
            self.meta_doc["current_state"] = "RECOVERED"
            self.meta_doc["duration_ms"] = self.event_doc["duration_ms"]

        self.episode_active = False

# ── 3. Run Step-by-Step Simulation ─────────────────────────────────────────────
sim = EventSimulator()

# Window 1: Current Event Document State (Onset Score 4.63 >= 1.70)
w1_ts = ONSET_TS
w1_score = 4.630937674944507
w1_seg = SEGMENT_ID_1
st1 = sim.process_window(w1_ts, w1_score, w1_seg)

print(f"\n--- WINDOW 1 (Onset Candidate) ---")
print(f"Timestamp    : {datetime.fromtimestamp(w1_ts/1000.0).strftime('%Y-%m-%d %H:%M:%S')}")
print(f"Score        : {w1_score:.4f} (>= Tau_In 1.70)")
print(f"Current State: {st1}")
print(f"Duration MS  : {sim.event_doc['duration_ms']} ms ({sim.event_doc['duration_ms']/60000:.1f} min)")

# Window 2: Data 5 menit kemudian (Score = 3.52 >= 1.70) -> 2 dari 2 window >= 1.70
w2_ts = ONSET_TS + 300000 # +5 min
w2_score = 3.5200
w2_seg = "6a9001cb8269202384f61738"
st2 = sim.process_window(w2_ts, w2_score, w2_seg)

print(f"\n--- WINDOW 2 (Persistence Check: 2 of 3) ---")
print(f"Timestamp    : {datetime.fromtimestamp(w2_ts/1000.0).strftime('%Y-%m-%d %H:%M:%S')}")
print(f"Score        : {w2_score:.4f} (>= Tau_In 1.70)")
print(f"Current State: {st2}")
print(f"Duration MS  : {sim.event_doc['duration_ms']} ms ({sim.event_doc['duration_ms']/60000:.1f} min)")

# Window 3: Data Terputus / Device Dilepas (Gap > 15 min, misal 30 min kemudian tanpa recovery < 0.85)
w3_ts = ONSET_TS + 300000 + 1800000 # +30 min gap
w3_score = 1.4000
w3_seg = "6a9001cb8269202384f61739"
st3 = sim.process_window(w3_ts, w3_score, w3_seg)

print(f"\n--- WINDOW 3 (Disconnection / Device Off Handler) ---")
print(f"Current State: {sim.event_doc['current_state']}")
print(f"Resolved Time: {datetime.fromtimestamp(sim.event_doc['resolved_time']/1000.0).strftime('%Y-%m-%d %H:%M:%S')}")
print(f"Duration MS  : {sim.event_doc['duration_ms']} ms ({sim.event_doc['duration_ms']/60000:.1f} min)")
print(f"Reason       : {sim.event_doc['unresolved_reason']}")

print("\n" + "=" * 80)
print("HASIL AKHIR ANOMALYEVENT DOCUMENT (MONGODB)")
print("=" * 80)
print(json.dumps(sim.event_doc, indent=2))

print("\n" + "=" * 80)
print("HASIL AKHIR EPISODEMETA DOCUMENT (LINKED TO EPISODEANALYSIS)")
print("=" * 80)
print(json.dumps(sim.meta_doc, indent=2))
