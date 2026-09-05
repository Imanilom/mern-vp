import pymongo
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import json
import os
from bson import ObjectId

# Visual styling
plt.style.use('seaborn-v0_8-whitegrid' if 'seaborn-v0_8-whitegrid' in plt.style.available else 'default')
plt.rcParams['figure.dpi'] = 150

MONGO_URI = 'mongodb://capar_admin:SecurePassword123!@127.0.0.1:27017/test?authSource=admin'
client = pymongo.MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
db = client['test']

u = db.users.find_one({'name': 'Peserta 2'})
user_id = u['_id']
user_name = u['name']

baseline = db.baselines.find_one({'user_id': user_id, 'status': 'active'}) or db.baselines.find_one({'user_id': user_id})
tau_in = baseline.get('thresholds', {}).get('tau_in', 2.5) if baseline else 2.5
tau_out = baseline.get('thresholds', {}).get('tau_out', 1.5) if baseline else 1.5
tau_normal = baseline.get('thresholds', {}).get('tau_normal', 1.0) if baseline else 1.0

# Scores of EP_4
scores = [2.15, 1.85, 2.0, 2.15, 1.85, 3.1, 1.09, 3.35, 2.85, 3.1, 3.35, 0.95]
hrs = [61.28, 62.65, 60.58, 64.49, 66.68, 62.21, 62.07, 61.81, 60.88, 61.36, 61.61, 62.07]
times_min = list(range(len(scores)))

# Multi-Peak Identification:
# Peak 1: index 5 (3.10)
# Relapse 1: index 6 -> 7 (1.09 -> 3.35)
# Peak 2: index 7 (3.35)
# Relapse 2: index 8 -> 9 (2.85 -> 3.10)
# Peak 3: index 10 (3.35)
# Final Recovery: index 11 (0.95)

peaks_info = [
    {'peak_idx': 5, 'time_min': 5, 'score': 3.10, 'label': 'Peak 1 (Onset Peak)', 'tau_out_reached_min': 6, 'ttr_min': 1.0},
    {'peak_idx': 7, 'time_min': 7, 'score': 3.35, 'label': 'Peak 2 (Relapse Peak 1)', 'tau_out_reached_min': 11, 'ttr_min': 4.0},
    {'peak_idx': 10, 'time_min': 10, 'score': 3.35, 'label': 'Peak 3 (Relapse Peak 2)', 'tau_out_reached_min': 11, 'ttr_min': 1.0}
]

relapses_info = [
    {'from_idx': 6, 'to_idx': 7, 'from_score': 1.09, 'to_score': 3.35, 'delta': +2.26, 'label': 'Relapse 1 (+2.26/min)'},
    {'from_idx': 8, 'to_idx': 9, 'from_score': 2.85, 'to_score': 3.10, 'delta': +0.25, 'label': 'Relapse 2 (+0.25/min)'},
]

# ── PLOT 1: DUAL-PANEL PUBLICATION CHART (TRAJECTORY + PHASE SPACE ORBIT) ───
fig = plt.figure(figsize=(16, 8))
gs = fig.add_gridspec(1, 2, width_ratios=[1.2, 1])

# PANEL A: TIMELINE TRAJECTORY
ax1 = fig.add_subplot(gs[0, 0])
ax1.plot(times_min, scores, marker='o', color='#2563EB', linewidth=2.5, zorder=3, label='Deviasi $S(t)$')
ax1.fill_between(times_min, scores, alpha=0.12, color='#3B82F6', label='AUC Area = 24.23')

# Thresholds
ax1.axhline(tau_in, color='#DC2626', linestyle='--', linewidth=1.8, label=f'$\\tau_{{in}}$ Onset Deviasi ({tau_in:.2f})')
ax1.axhline(tau_out, color='#F59E0B', linestyle='-.', linewidth=1.8, label=f'$\\tau_{{out}}$ Awal Recovery ({tau_out:.2f})')
ax1.axhline(tau_normal, color='#10B981', linestyle=':', linewidth=1.8, label=f'$\\tau_{{normal}}$ Baseline Resolved ({tau_normal:.2f})')

# Mark Peaks on Timeline
for p in peaks_info:
    ax1.scatter([p['time_min']], [p['score']], color='#DC2626', s=200, zorder=6, marker='*')
    ax1.annotate(f"{p['label']}\\n$S={p['score']:.2f}$ (TTR: {p['ttr_min']}m)",
                 (p['time_min'], p['score']),
                 textcoords="offset points", xytext=(0, 15), ha='center',
                 fontweight='bold', fontsize=8.5,
                 bbox=dict(boxstyle='round,pad=0.3', fc='#FEE2E2', ec='#DC2626', lw=1.2))

# Mark Relapses on Timeline
for r in relapses_info:
    mid_t = (r['from_idx'] + r['to_idx']) / 2.0
    mid_s = (r['from_score'] + r['to_score']) / 2.0
    ax1.annotate(f"⚡ {r['label']}",
                 (r['to_idx'], r['to_score']),
                 textcoords="offset points", xytext=(15, -28), ha='left',
                 arrowprops=dict(arrowstyle='->', color='#B91C1C', lw=1.8),
                 fontweight='bold', fontsize=8.5,
                 bbox=dict(boxstyle='round,pad=0.3', fc='#FEF3C7', ec='#D97706', lw=1.2))

ax1.set_title('A. Trajektori Temporal Episode (Multi-Peak & Relapse)', fontsize=13, fontweight='bold')
ax1.set_xlabel('Elapsed Time (menit)', fontsize=11, fontweight='bold')
ax1.set_ylabel('Anomaly Score $S(t)$', fontsize=11, fontweight='bold')
ax1.set_ylim(0.5, 4.2)
ax1.legend(loc='upper right', frameon=True, fontsize=8.5)

# PANEL B: PHASE SPACE MAP (S_t vs S_{t+1}) DENGAN HUBUNGAN PEAK & RELAPSE
ax2 = fig.add_subplot(gs[0, 1])
st = np.array(scores[:-1])
st1 = np.array(scores[1:])

# Background Zones
lim_min, lim_max = 0.5, 4.0
ax2.plot([lim_min, lim_max], [lim_min, lim_max], 'k--', linewidth=1.5, label='Isocline ($S_{t+1} = S_t$)')
ax2.fill_between([lim_min, lim_max], [lim_min, lim_max], [lim_max, lim_max], color='#FEE2E2', alpha=0.35, label='Zone A: Relapse / Escalation ($S_{t+1} > S_t$)')
ax2.fill_between([lim_min, lim_max], [lim_min, min(st1)], [lim_min, lim_max], color='#DCFCE7', alpha=0.35, label='Zone B: Recovery / Decay ($S_{t+1} < S_t$)')

# Threshold Grid Lines in Phase Space
ax2.axvline(tau_out, color='#F59E0B', linestyle=':', alpha=0.6, label='$\\tau_{out}$ Boundary')
ax2.axhline(tau_out, color='#F59E0B', linestyle=':', alpha=0.6)

# Orbit Line and Points
for i in range(len(st)):
    color = '#DC2626' if st1[i] > st[i] else '#059669'
    ax2.annotate('', xy=(st1[i], st[i]), xytext=(st[i], st1[i]),
                 arrowprops=dict(arrowstyle="->", color='#6B7280', lw=1.2, mutation_scale=10))

scatter = ax2.scatter(st, st1, c=range(len(st)), cmap='plasma', s=120, zorder=5, edgecolors='black', linewidth=1.2)

# Specific Point Callouts for Peaks & Relapse in Phase Space:
# Point 4 -> 5: Peak 1 Onset (1.85 -> 3.10)
ax2.annotate('Peak 1\n(1.85 -> 3.10)', (1.85, 3.10), textcoords="offset points", xytext=(-55, 12),
             fontweight='bold', fontsize=8, bbox=dict(boxstyle='round,pad=0.2', fc='#FEE2E2', ec='#DC2626'))

# Point 5 -> 6: Recovery 1 (3.10 -> 1.09)
ax2.annotate('Recovery 1\n(3.10 -> 1.09)', (3.10, 1.09), textcoords="offset points", xytext=(10, -20),
             fontweight='bold', fontsize=8, bbox=dict(boxstyle='round,pad=0.2', fc='#DCFCE7', ec='#10B981'))

# Point 6 -> 7: Relapse 1 -> Peak 2 (1.09 -> 3.35)
ax2.annotate('⚡ RELAPSE 1 -> Peak 2\n(1.09 -> 3.35)', (1.09, 3.35), textcoords="offset points", xytext=(-85, 15),
             arrowprops=dict(arrowstyle='->', color='#B91C1C', lw=1.5),
             fontweight='bold', fontsize=8.5, bbox=dict(boxstyle='round,pad=0.3', fc='#FEF3C7', ec='#D97706'))

# Point 8 -> 9: Relapse 2 -> Peak 3 (2.85 -> 3.10 -> 3.35)
ax2.annotate('⚡ Relapse 2 -> Peak 3\n(2.85 -> 3.10)', (2.85, 3.10), textcoords="offset points", xytext=(12, 10),
             fontweight='bold', fontsize=8, bbox=dict(boxstyle='round,pad=0.2', fc='#FEF3C7', ec='#D97706'))

# Point 10 -> 11: Final Resolved (3.35 -> 0.95)
ax2.annotate('Final Recovery\n(3.35 -> 0.95)', (3.35, 0.95), textcoords="offset points", xytext=(-60, -25),
             arrowprops=dict(arrowstyle='->', color='#059669', lw=1.5),
             fontweight='bold', fontsize=8, bbox=dict(boxstyle='round,pad=0.2', fc='#DCFCE7', ec='#10B981'))

ax2.set_title('B. Phase Space Map ($S_t \\to S_{t+1}$) & Relapse Orbit', fontsize=13, fontweight='bold')
ax2.set_xlabel('Current Score $S_t$', fontsize=11, fontweight='bold')
ax2.set_ylabel('Next Score $S_{t+1}$', fontsize=11, fontweight='bold')
ax2.set_xlim(lim_min, lim_max)
ax2.set_ylim(lim_min, lim_max)
ax2.legend(loc='lower right', frameon=True, fontsize=8)
cbar = plt.colorbar(scatter, ax=ax2, label='Time Step (t)')

plt.tight_layout()
out_img = 'simulation/phase_space_relapse_peaks_annotated.png'
plt.savefig(out_img, dpi=300)
plt.close()

print(f"Generated Annotated Dual-Panel Chart: {out_img}")
