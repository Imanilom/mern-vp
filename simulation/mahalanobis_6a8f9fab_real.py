"""
===============================================================================
MAHALANOBIS DISTANCE VISUALIZATION (REAL DATA)
CAPAR System — Cardiovascular Anomaly Pattern Analysis & Reporting
===============================================================================

User ID : 6a8f9fab74156d89d1dc3c47
Target  : Activity label (Duduk / Berdiri)
Variabel: HR (hr) & RR (rr) dari collection `polardatas`

Grafik 1 : Aktivitas DUDUK — distribusi antar hari
Grafik 2 : DUDUK vs BERDIRI — pada hari yang SAMA (intra-day comparison)
Grafik 3 : DUDUK vs BERDIRI — antar hari (cross-day comparison)

Output: simulation/mahalanobis_6a8f9fab_grafik1.png
        simulation/mahalanobis_6a8f9fab_grafik2.png
        simulation/mahalanobis_6a8f9fab_grafik3.png
        simulation/mahalanobis_6a8f9fab_all.png  (panel 3-in-1)
===============================================================================
"""

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import Ellipse
from matplotlib.gridspec import GridSpec
from scipy.spatial.distance import mahalanobis
from scipy.stats import chi2
from scipy.linalg import inv
import warnings, os
from datetime import datetime
import pymongo
from bson import ObjectId

warnings.filterwarnings("ignore")

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
UID = "6a8f9fab74156d89d1dc3c47"
PREFIX = "mahalanobis_6a8f9fab"

# ─── Setup global style ────────────────────────────────────────────────────────
plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "font.size": 10,
    "axes.titlesize": 13,
    "axes.labelsize": 11,
    "legend.fontsize": 9,
    "figure.facecolor": "#0F1923",
    "axes.facecolor": "#131F2B",
    "axes.edgecolor": "#2D3F50",
    "axes.labelcolor": "#C9D8E8",
    "xtick.color": "#8BA3B8",
    "ytick.color": "#8BA3B8",
    "text.color": "#E2EAF0",
    "grid.color": "#1E2E3C",
    "grid.linestyle": "--",
    "grid.alpha": 0.5,
    "legend.facecolor": "#162030",
    "legend.edgecolor": "#2D3F50",
    "legend.framealpha": 0.85,
})

# ─── MONGODB CONNECTION & DATA FETCHING ────────────────────────────────────────

def fetch_real_data(user_id):
    uri = "mongodb://capar_admin:SecurePassword123!@127.0.0.1:27017/test?authSource=admin"
    client = pymongo.MongoClient(uri)
    db = client["test"]
    
    # KOREKSI: Gunakan polardatas, bukan segments
    collection = db["polardatas"]
    
    try:
        query_id = ObjectId(user_id)
    except:
        query_id = user_id

    # Menggunakan hr dan rr, dan parse dari date_created
    docs = list(collection.find({
        "user_id": query_id,
        "activity": {"$in": ["Duduk", "Berdiri"]},
        "hr": {"$exists": True, "$type": "number"},
        "rr": {"$exists": True, "$type": "number"}
    }))

    if not docs:
        print(f"Error: No data found for user_id {user_id} with 'Duduk' or 'Berdiri' activities in polardatas.")
        return pd.DataFrame()

    df = pd.DataFrame(docs)
    
    # Mengambil format date (misal dari date_created "16-09-2026" atau timestamp)
    def parse_dt(row):
        if pd.notna(row.get('date_created')):
            try:
                # date_created string format "16-09-2026"
                return pd.to_datetime(row['date_created'], format='%d-%m-%Y').strftime('%Y-%m-%d')
            except:
                pass
        
        if pd.notna(row.get('timestamp')):
            ts = row['timestamp']
            ts = ts / 1000.0 if ts > 1e11 else float(ts)
            return datetime.fromtimestamp(ts).strftime('%Y-%m-%d')
            
        return None
            
    df['date'] = df.apply(parse_dt, axis=1)
    
    # Rename hr ke mean_hr dan rr ke mean_rr agar sesuai dengan script plot
    df = df.rename(columns={'hr': 'mean_hr', 'rr': 'mean_rr'})
    
    # Filter
    df = df.dropna(subset=['date', 'mean_hr', 'mean_rr', 'activity'])
    
    # Sort
    if 'timestamp' in df.columns:
        df = df.sort_values(by='timestamp')
        
    # Ambil sample saja jika terlalu besar agar plot ellipse mahalanobis tidak hang
    if len(df) > 5000:
        df = df.sample(5000, random_state=42)
    
    return df


# ─── HELPER FUNCTIONS ──────────────────────────────────────────────────────────

def mahalanobis_ellipse(mean, cov, ax, n_std=2.0, color="white",
                         alpha_fill=0.12, alpha_edge=0.85,
                         lw=1.8, linestyle="-", label=None, zorder=2):
    try:
        vals, vecs = np.linalg.eigh(cov)
        order = vals.argsort()[::-1]
        vals, vecs = vals[order], vecs[:, order]
        angle = np.degrees(np.arctan2(*vecs[:, 0][::-1]))
        w, h = 2 * n_std * np.sqrt(np.maximum(vals, 1e-6))
    except:
        return None

    ell = Ellipse(xy=mean, width=w, height=h, angle=angle,
                  facecolor=color, edgecolor=color,
                  alpha=alpha_fill, zorder=zorder)
    ax.add_patch(ell)
    ell_edge = Ellipse(xy=mean, width=w, height=h, angle=angle,
                       facecolor="none", edgecolor=color,
                       lw=lw, linestyle=linestyle, alpha=alpha_edge,
                       zorder=zorder + 1, label=label)
    ax.add_patch(ell_edge)
    return ell_edge


def compute_mahal_scores(data, ref_mean, ref_cov):
    try:
        VI = inv(ref_cov)
    except:
        VI = np.linalg.pinv(ref_cov)
    scores = np.array([mahalanobis(x, ref_mean, VI)**2 for x in data])
    return scores


def style_axis(ax, title, xlabel="HR (bpm)", ylabel="RR Interval (ms)"):
    ax.set_title(title, fontsize=11, fontweight="bold", color="#E2EAF0", pad=10)
    ax.set_xlabel(xlabel, fontsize=10)
    ax.set_ylabel(ylabel, fontsize=10)
    ax.grid(True, alpha=0.4)
    ax.tick_params(axis="both", labelsize=8)


def add_chi2_text(ax, x=0.02, y=0.97):
    p2_95 = chi2.ppf(0.95, df=2)
    p2_99 = chi2.ppf(0.99, df=2)
    ax.text(x, y,
            f"chi2(95%,df=2) = {p2_95:.2f}\nchi2(99%,df=2) = {p2_99:.2f}",
            transform=ax.transAxes,
            fontsize=7.5, color="#94A3B8",
            va="top", ha="left",
            bbox=dict(boxstyle="round,pad=0.3", facecolor="#162030",
                      edgecolor="#2D3F50", alpha=0.85))


def add_participant_label(ax):
    ax.text(0.99, 0.01, f"Peserta {UID} | Real Data | CAPAR",
            transform=ax.transAxes, fontsize=7, color="#4B6478",
            va="bottom", ha="right")


DAY_COLORS = ["#38BDF8", "#34D399", "#F472B6", "#A78BFA", "#FCD34D", "#FB923C", "#94A3B8", "#EF4444", "#84CC16", "#14B8A6"]
ACT_STYLE = {
    "Duduk": {"color": "#38BDF8", "marker": "o"},
    "Berdiri": {"color": "#FB923C", "marker": "^"}
}

# ══════════════════════════════════════════════════════════════════════════════
# GRAFIK 1 — DUDUK, ANTAR HARI
# ══════════════════════════════════════════════════════════════════════════════

def plot_grafik1(df, save=True):
    df_duduk = df[df['activity'] == 'Duduk']
    if df_duduk.empty:
        print("Skipping Grafik 1: No 'Duduk' data found.")
        return None, None
        
    days = sorted(df_duduk['date'].unique())
    
    fig, ax = plt.subplots(figsize=(10, 7))
    fig.patch.set_facecolor("#0F1923")

    all_arr = df_duduk[['mean_hr', 'mean_rr']].values
    if len(all_arr) < 2:
        print("Skipping Grafik 1: Not enough 'Duduk' data.")
        return None, None
        
    pool_mean = all_arr.mean(axis=0)
    pool_cov  = np.cov(all_arr.T)

    d2_all = compute_mahal_scores(all_arr, pool_mean, pool_cov)

    sc = ax.scatter(all_arr[:, 0], all_arr[:, 1], c=d2_all, cmap="plasma",
                    vmin=0, vmax=chi2.ppf(0.99, df=2) * 1.5,
                    s=35, alpha=0.75, zorder=3, linewidths=0)
    
    cbar = fig.colorbar(sc, ax=ax, pad=0.01, shrink=0.85)
    cbar.set_label("Mahalanobis D²", color="#8BA3B8", fontsize=8)
    cbar.ax.yaxis.set_tick_params(color="#8BA3B8")
    plt.setp(plt.getp(cbar.ax.axes, 'yticklabels'), color="#8BA3B8", fontsize=7)

    legend_handles = []
    for d_idx, day in enumerate(days):
        day_data = df_duduk[df_duduk['date'] == day][['mean_hr', 'mean_rr']].values
        if len(day_data) < 2: continue
            
        d_mean = day_data.mean(axis=0)
        d_cov  = np.cov(day_data.T)
        color  = DAY_COLORS[d_idx % len(DAY_COLORS)]
        
        mahalanobis_ellipse(d_mean, d_cov, ax, n_std=1.0, color=color, alpha_fill=0.06, alpha_edge=0.4, lw=1.2, linestyle="--")
        h = mahalanobis_ellipse(d_mean, d_cov, ax, n_std=2.0, color=color, alpha_fill=0.0, alpha_edge=0.9, lw=2.0, label=day)
        ax.plot(d_mean[0], d_mean[1], marker="D", ms=8, color=color, zorder=6, markeredgecolor="#0F1923", mew=0.8)
        if h: legend_handles.append(h)

    mahalanobis_ellipse(pool_mean, pool_cov, ax, n_std=2.0, color="#FFFFFF", alpha_fill=0.0, alpha_edge=0.5, lw=2.2, linestyle=":", label="Baseline Pooled (2σ)")
    legend_handles.append(mpatches.Patch(facecolor="none", edgecolor="#FFFFFF", linestyle=":", lw=2.2, label="Baseline Pooled (2σ)"))

    thresh_99 = chi2.ppf(0.99, df=2)
    mahalanobis_ellipse(pool_mean, pool_cov, ax, n_std=np.sqrt(thresh_99), color="#EF4444", alpha_fill=0.04, alpha_edge=0.6, lw=1.5, linestyle="-.")
    legend_handles.append(mpatches.Patch(facecolor="#EF444422", edgecolor="#EF4444", linestyle="-.", lw=1.5, label="Zona Anomali (χ²>99%)"))

    ax.legend(handles=legend_handles, loc="upper right", title="Kelompok Hari", title_fontsize=9)
    style_axis(ax, f"Grafik 1 — Mahalanobis Area: Aktivitas DUDUK Antar Hari\n[ HR vs RR | Peserta {UID} ]")
    add_chi2_text(ax)
    add_participant_label(ax)
    plt.tight_layout()

    if save:
        out = os.path.join(OUT_DIR, f"{PREFIX}_grafik1.png")
        plt.savefig(out, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
        print(f"  + Saved: {out}")
    return fig, ax


# ══════════════════════════════════════════════════════════════════════════════
# GRAFIK 2 — DUDUK vs BERDIRI, SATU HARI YANG SAMA
# ══════════════════════════════════════════════════════════════════════════════

def plot_grafik2(df, save=True):
    day_counts = df.groupby(['date', 'activity']).size().unstack(fill_value=0)
    
    if 'Duduk' not in day_counts.columns or 'Berdiri' not in day_counts.columns:
        print("Skipping Grafik 2: Missing either Duduk or Berdiri completely.")
        return None, None
        
    valid_days = day_counts[(day_counts['Duduk'] >= 3) & (day_counts['Berdiri'] >= 3)].index.tolist()
    
    if not valid_days:
        print("Skipping Grafik 2: No single day found with >=3 'Duduk' and >=3 'Berdiri' data.")
        return None, None
        
    target_day = valid_days[-1] 
    df_day = df[df['date'] == target_day]
    
    data_duduk = df_day[df_day['activity'] == 'Duduk'][['mean_hr', 'mean_rr']].values
    data_berdiri = df_day[df_day['activity'] == 'Berdiri'][['mean_hr', 'mean_rr']].values

    mean_d, cov_d = data_duduk.mean(axis=0), np.cov(data_duduk.T)
    mean_b, cov_b = data_berdiri.mean(axis=0), np.cov(data_berdiri.T)

    d2_berdiri_vs_duduk = compute_mahal_scores(data_berdiri, mean_d, cov_d)
    d2_duduk_self       = compute_mahal_scores(data_duduk,   mean_d, cov_d)

    fig, axes = plt.subplots(1, 2, figsize=(14, 7), sharex=False)
    fig.patch.set_facecolor("#0F1923")
    fig.suptitle(
        f"Grafik 2 — Mahalanobis Area: DUDUK vs BERDIRI (Intra-Day: {target_day})\n"
        f"[ HR vs RR | Peserta {UID} | Ortostatik Response ]",
        fontsize=13, fontweight="bold", color="#E2EAF0", y=1.01
    )

    thresh_95 = chi2.ppf(0.95, df=2)
    thresh_99 = chi2.ppf(0.99, df=2)

    ax = axes[0]
    ax.scatter(data_duduk[:, 0], data_duduk[:, 1], c=d2_duduk_self, cmap="Blues",
                     vmin=0, vmax=thresh_99, s=35, alpha=0.8, label="Duduk", marker="o", zorder=4, linewidths=0)
    ax.scatter(data_berdiri[:, 0], data_berdiri[:, 1], c=d2_berdiri_vs_duduk, cmap="Oranges",
                     vmin=0, vmax=thresh_99 * 1.5, s=35, alpha=0.8, label="Berdiri", marker="^", zorder=4, linewidths=0)

    mahalanobis_ellipse(mean_d, cov_d, ax, n_std=1.0, color="#38BDF8", alpha_fill=0.10, alpha_edge=0.3, lw=1)
    mahalanobis_ellipse(mean_d, cov_d, ax, n_std=2.0, color="#38BDF8", alpha_fill=0.0, alpha_edge=0.9, lw=2.0, label="Duduk 2σ")
    mahalanobis_ellipse(mean_d, cov_d, ax, n_std=np.sqrt(thresh_99), color="#38BDF8", alpha_fill=0.0, alpha_edge=0.45, lw=1.4, linestyle="-.", label="Duduk 99%")

    mahalanobis_ellipse(mean_b, cov_b, ax, n_std=1.0, color="#FB923C", alpha_fill=0.10, alpha_edge=0.3, lw=1)
    mahalanobis_ellipse(mean_b, cov_b, ax, n_std=2.0, color="#FB923C", alpha_fill=0.0, alpha_edge=0.9, lw=2.0, label="Berdiri 2σ")
    mahalanobis_ellipse(mean_b, cov_b, ax, n_std=np.sqrt(thresh_99), color="#FB923C", alpha_fill=0.0, alpha_edge=0.45, lw=1.4, linestyle="-.", label="Berdiri 99%")

    ax.annotate("", xy=(mean_b[0], mean_b[1]), xytext=(mean_d[0], mean_d[1]), arrowprops=dict(arrowstyle="->", color="#F59E0B", lw=2.0, connectionstyle="arc3,rad=0.15"))
    shift_hr = mean_b[0] - mean_d[0]
    shift_rr = mean_b[1] - mean_d[1]
    mid_hr = (mean_d[0] + mean_b[0]) / 2
    mid_rr = (mean_d[1] + mean_b[1]) / 2
    ax.text(mid_hr + 0.5, mid_rr + 10, f"ΔHR={shift_hr:+.1f}bpm\nΔRR={shift_rr:+.0f}ms", fontsize=8, color="#F59E0B", bbox=dict(boxstyle="round,pad=0.25", facecolor="#162030", edgecolor="#F59E0B50", alpha=0.85))

    ax.plot(*mean_d, "D", ms=9, color="#38BDF8", zorder=7, markeredgecolor="#0F1923", mew=0.8)
    ax.plot(*mean_b, "^", ms=9, color="#FB923C", zorder=7, markeredgecolor="#0F1923", mew=0.8)

    ax.legend(loc="upper right", fontsize=8, title="Distribusi & Ellipse", title_fontsize=8)
    style_axis(ax, "Ruang Fitur HR-RR\n(Scatter + Mahalanobis Ellipse)")
    add_chi2_text(ax)
    add_participant_label(ax)

    ax2 = axes[1]
    bins = np.linspace(0, max(d2_berdiri_vs_duduk.max(), d2_duduk_self.max()) * 1.05, 25)
    ax2.hist(d2_duduk_self, bins=bins, color="#38BDF8", alpha=0.55, label="Duduk (self-reference)", edgecolor="#0F1923")
    ax2.hist(d2_berdiri_vs_duduk, bins=bins, color="#FB923C", alpha=0.55, label="Berdiri vs Referensi Duduk", edgecolor="#0F1923")

    ax2.axvline(thresh_95, color="#F59E0B", lw=2, linestyle="--", label=f"χ²(95%) = {thresh_95:.2f}")
    ax2.axvline(thresh_99, color="#EF4444", lw=2, linestyle="-.", label=f"χ²(99%) = {thresh_99:.2f}")

    n_anom_b = (d2_berdiri_vs_duduk > thresh_95).sum()
    n_anom_d = (d2_duduk_self > thresh_95).sum()
    ax2.text(0.98, 0.98, f"Berdiri anomali vs Duduk-ref:\n  {n_anom_b}/{len(d2_berdiri_vs_duduk)} titik > χ²(95%)\n"
             f"Duduk self-anomali:\n  {n_anom_d}/{len(d2_duduk_self)} titik > χ²(95%)",
             transform=ax2.transAxes, va="top", ha="right", fontsize=8.5, color="#CBD5E1", bbox=dict(boxstyle="round,pad=0.35", facecolor="#162030", edgecolor="#2D3F50", alpha=0.9))

    style_axis(ax2, "Distribusi D²\n(Duduk vs Berdiri — Referensi: Duduk)", xlabel="Mahalanobis D²", ylabel="Frekuensi")
    ax2.legend(loc="upper center", fontsize=8)
    add_participant_label(ax2)

    plt.tight_layout()
    if save:
        out = os.path.join(OUT_DIR, f"{PREFIX}_grafik2.png")
        plt.savefig(out, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
        print(f"  + Saved: {out}")
    return fig, axes


# ══════════════════════════════════════════════════════════════════════════════
# GRAFIK 3 — DUDUK vs BERDIRI, ANTAR HARI
# ══════════════════════════════════════════════════════════════════════════════

def plot_grafik3(df, save=True):
    days = sorted(df['date'].unique())
    df_duduk = df[df['activity'] == 'Duduk']
    df_berdiri = df[df['activity'] == 'Berdiri']
    
    if len(df_duduk) < 2 or len(df_berdiri) < 2:
        print("Skipping Grafik 3: Need enough data for both activities.")
        return None
        
    all_duduk = df_duduk[['mean_hr', 'mean_rr']].values
    all_berdiri = df_berdiri[['mean_hr', 'mean_rr']].values
    grand_mean = df[['mean_hr', 'mean_rr']].values.mean(axis=0)
    grand_cov  = np.cov(df[['mean_hr', 'mean_rr']].values.T)

    ref_d = {"mean": all_duduk.mean(axis=0),   "cov": np.cov(all_duduk.T)}
    ref_b = {"mean": all_berdiri.mean(axis=0), "cov": np.cov(all_berdiri.T)}

    thresh_95 = chi2.ppf(0.95, df=2)
    thresh_99 = chi2.ppf(0.99, df=2)

    fig = plt.figure(figsize=(17, 12))
    fig.patch.set_facecolor("#0F1923")
    gs = GridSpec(2, 3, figure=fig, hspace=0.40, wspace=0.32, top=0.92, bottom=0.06, left=0.06, right=0.97)

    fig.suptitle(f"Grafik 3 — Mahalanobis Area: DUDUK vs BERDIRI Antar Hari\n[ HR vs RR | Peserta {UID} | Cross-Day Comparison ]", fontsize=13, fontweight="bold", color="#E2EAF0")

    ax_sc = fig.add_subplot(gs[:, 0])
    legend_handles = []
    
    for act, ref in [("Duduk", ref_d), ("Berdiri", ref_b)]:
        act_color = ACT_STYLE[act]["color"]
        marker = ACT_STYLE[act]["marker"]
        for d_idx, day in enumerate(days):
            day_data = df[(df['date'] == day) & (df['activity'] == act)][['mean_hr', 'mean_rr']].values
            if len(day_data) == 0: continue
            d_color = DAY_COLORS[d_idx % len(DAY_COLORS)]
            ax_sc.scatter(day_data[:, 0], day_data[:, 1], color=d_color, s=25, alpha=0.6, marker=marker, zorder=3, linewidths=0)

        h = mahalanobis_ellipse(ref["mean"], ref["cov"], ax_sc, n_std=np.sqrt(thresh_95), color=act_color, alpha_fill=0.07, alpha_edge=0.9, lw=2.2, label=f"{act} 95%-ellipse")
        mahalanobis_ellipse(ref["mean"], ref["cov"], ax_sc, n_std=1.0, color=act_color, alpha_fill=0.12, alpha_edge=0.3, lw=1.0)
        ax_sc.plot(*ref["mean"], marker=marker, ms=12, color=act_color, zorder=8, markeredgecolor="#0F1923", mew=1.2)
        if h: legend_handles.append(h)

    mahalanobis_ellipse(grand_mean, grand_cov, ax_sc, n_std=np.sqrt(thresh_99), color="#FFFFFF", alpha_fill=0.0, alpha_edge=0.3, lw=1.5, linestyle=":")
    legend_handles.append(mpatches.Patch(facecolor="none", edgecolor="#FFFFFF", linestyle=":", lw=1.5, label="Grand 99%-ellipse"))

    for d_idx, day in enumerate(days):
        legend_handles.append(mpatches.Patch(facecolor=DAY_COLORS[d_idx % len(DAY_COLORS)], label=day, alpha=0.7))

    ax_sc.legend(handles=legend_handles, loc="upper right", fontsize=7.5, title="Aktivitas & Hari", title_fontsize=8)
    style_axis(ax_sc, "Ruang Fitur HR-RR\n(Semua Aktivitas & Hari)")
    add_chi2_text(ax_sc)
    add_participant_label(ax_sc)

    ax_hm = fig.add_subplot(gs[0, 1])
    hmap = np.zeros((2, len(days)))
    for a_idx, (act, ref) in enumerate([("Duduk", ref_d), ("Berdiri", ref_b)]):
        for d_idx, day in enumerate(days):
            day_data = df[(df['date'] == day) & (df['activity'] == act)][['mean_hr', 'mean_rr']].values
            if len(day_data) > 0:
                hmap[a_idx, d_idx] = compute_mahal_scores(day_data, ref["mean"], ref["cov"]).mean()
            else:
                hmap[a_idx, d_idx] = np.nan

    im = ax_hm.imshow(hmap, cmap="plasma", aspect="auto", vmin=0, vmax=thresh_99)
    cbar_hm = fig.colorbar(im, ax=ax_hm, shrink=0.85, pad=0.02)
    cbar_hm.set_label("Rata-rata D²", color="#8BA3B8", fontsize=8)
    cbar_hm.ax.yaxis.set_tick_params(color="#8BA3B8")
    plt.setp(cbar_hm.ax.yaxis.get_ticklabels(), color="#8BA3B8", fontsize=7)

    ax_hm.set_xticks(range(len(days)))
    ax_hm.set_xticklabels(days, fontsize=7.5, rotation=15)
    ax_hm.set_yticks([0, 1])
    ax_hm.set_yticklabels(["Duduk", "Berdiri"], fontsize=9, fontweight="bold")
    ax_hm.set_title("Heatmap Rata-rata D²\n(per Aktivitas × Hari)", fontsize=10, fontweight="bold", color="#E2EAF0")
    for a_idx in range(2):
        for d_idx in range(len(days)):
            val = hmap[a_idx, d_idx]
            if not np.isnan(val):
                txt_color = "white" if val < thresh_95 * 0.7 else "#FF6B6B"
                ax_hm.text(d_idx, a_idx, f"{val:.2f}", ha="center", va="center", fontsize=8.5, color=txt_color, fontweight="bold")
    ax_hm.axhline(0.5, color="#2D3F50", lw=1.5)
    ax_hm.text(len(days) - 0.5, -0.4, f"χ²(95%)={thresh_95:.1f}", fontsize=7, color="#F59E0B", ha="right")

    ax_ln = fig.add_subplot(gs[0, 2])
    x = np.arange(len(days))
    for a_idx, (act, ref, lc) in enumerate([("Duduk", ref_d, "#38BDF8"), ("Berdiri", ref_b, "#FB923C")]):
        means, stds = [], []
        for day in days:
            day_data = df[(df['date'] == day) & (df['activity'] == act)][['mean_hr', 'mean_rr']].values
            if len(day_data) > 0:
                d2 = compute_mahal_scores(day_data, ref["mean"], ref["cov"])
                means.append(d2.mean()); stds.append(d2.std())
            else:
                means.append(np.nan); stds.append(np.nan)
        means, stds = np.array(means), np.array(stds)
        ax_ln.plot(x, means, "o-", color=lc, lw=2.0, ms=7, markeredgecolor="#0F1923", mew=0.8, label=act)
        valid_idx = ~np.isnan(means)
        if valid_idx.sum() > 0:
            ax_ln.fill_between(x[valid_idx], (means - stds)[valid_idx], (means + stds)[valid_idx], color=lc, alpha=0.15)
    ax_ln.axhline(thresh_95, color="#F59E0B", lw=1.5, linestyle="--", label=f"χ²(95%)={thresh_95:.2f}")
    ax_ln.axhline(thresh_99, color="#EF4444", lw=1.5, linestyle="-.", label=f"χ²(99%)={thresh_99:.2f}")
    ax_ln.set_xticks(x)
    ax_ln.set_xticklabels(days, fontsize=7.5, rotation=15, ha="right")
    style_axis(ax_ln, "Tren D² Harian\n(Mean ± SD per Aktivitas)", xlabel="Hari Pengamatan", ylabel="Rata-rata D²")
    ax_ln.legend(fontsize=8)
    add_participant_label(ax_ln)

    ax_bx1 = fig.add_subplot(gs[1, 1])
    data_boxes_d = [compute_mahal_scores(df[(df['date'] == day) & (df['activity'] == 'Duduk')][['mean_hr', 'mean_rr']].values, ref_d["mean"], ref_d["cov"]) if len(df[(df['date'] == day) & (df['activity'] == 'Duduk')]) > 0 else [] for day in days]
    if any(len(b) > 0 for b in data_boxes_d):
        bp1 = ax_bx1.boxplot([b for b in data_boxes_d if len(b)>0], positions=[i+1 for i,b in enumerate(data_boxes_d) if len(b)>0], patch_artist=True, medianprops=dict(color="#38BDF8", lw=2), flierprops=dict(marker="o", color="#EF4444", ms=4, alpha=0.6))
        for i, patch in enumerate(bp1["boxes"]):
            patch.set_facecolor(DAY_COLORS[[i for i,b in enumerate(data_boxes_d) if len(b)>0][i] % len(DAY_COLORS)]); patch.set_alpha(0.5)
    ax_bx1.axhline(thresh_95, color="#F59E0B", lw=1.5, linestyle="--")
    ax_bx1.axhline(thresh_99, color="#EF4444", lw=1.5, linestyle="-.")
    ax_bx1.set_xticks(range(1, len(days) + 1))
    ax_bx1.set_xticklabels(days, fontsize=7.5, rotation=15, ha="right")
    style_axis(ax_bx1, "Boxplot D² — DUDUK", xlabel="Hari", ylabel="D²")

    ax_bx2 = fig.add_subplot(gs[1, 2])
    data_boxes_b = [compute_mahal_scores(df[(df['date'] == day) & (df['activity'] == 'Berdiri')][['mean_hr', 'mean_rr']].values, ref_b["mean"], ref_b["cov"]) if len(df[(df['date'] == day) & (df['activity'] == 'Berdiri')]) > 0 else [] for day in days]
    if any(len(b) > 0 for b in data_boxes_b):
        bp2 = ax_bx2.boxplot([b for b in data_boxes_b if len(b)>0], positions=[i+1 for i,b in enumerate(data_boxes_b) if len(b)>0], patch_artist=True, medianprops=dict(color="#FB923C", lw=2), flierprops=dict(marker="^", color="#EF4444", ms=4, alpha=0.6))
        for i, patch in enumerate(bp2["boxes"]):
            patch.set_facecolor(DAY_COLORS[[i for i,b in enumerate(data_boxes_b) if len(b)>0][i] % len(DAY_COLORS)]); patch.set_alpha(0.5)
    ax_bx2.axhline(thresh_95, color="#F59E0B", lw=1.5, linestyle="--")
    ax_bx2.axhline(thresh_99, color="#EF4444", lw=1.5, linestyle="-.")
    ax_bx2.set_xticks(range(1, len(days) + 1))
    ax_bx2.set_xticklabels(days, fontsize=7.5, rotation=15, ha="right")
    style_axis(ax_bx2, "Boxplot D² — BERDIRI", xlabel="Hari", ylabel="D²")

    plt.tight_layout()
    if save:
        out = os.path.join(OUT_DIR, f"{PREFIX}_grafik3.png")
        plt.savefig(out, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
        print(f"  + Saved: {out}")
    return fig


# ══════════════════════════════════════════════════════════════════════════════
# PANEL GABUNGAN
# ══════════════════════════════════════════════════════════════════════════════

def plot_summary_panel():
    import matplotlib.image as mpimg

    files = [
        os.path.join(OUT_DIR, f"{PREFIX}_grafik1.png"),
        os.path.join(OUT_DIR, f"{PREFIX}_grafik2.png"),
        os.path.join(OUT_DIR, f"{PREFIX}_grafik3.png"),
    ]
    titles = [
        "Grafik 1: Duduk Antar Hari",
        "Grafik 2: Duduk vs Berdiri (Satu Hari)",
        "Grafik 3: Duduk vs Berdiri Antar Hari",
    ]

    fig, axes = plt.subplots(1, 3, figsize=(20, 7))
    fig.patch.set_facecolor("#0A1218")
    fig.suptitle(
        f"Mahalanobis Distance Area — Peserta {UID} (Real Data)  |  HR & RR",
        fontsize=14, fontweight="bold", color="#E2EAF0", y=1.01
    )
    for ax, fname, title in zip(axes, files, titles):
        try:
            img = mpimg.imread(fname)
            ax.imshow(img, aspect="auto")
        except FileNotFoundError:
            ax.text(0.5, 0.5, "Data Tidak Cukup / Grafik Tidak Di-generate",
                    ha="center", va="center", color="red",
                    transform=ax.transAxes)
        ax.set_title(title, fontsize=10, color="#CBD5E1", pad=5)
        ax.axis("off")

    plt.tight_layout()
    out = os.path.join(OUT_DIR, f"{PREFIX}_all.png")
    plt.savefig(out, dpi=120, bbox_inches="tight", facecolor=fig.get_facecolor())
    print(f"  + Saved: {out}")
    plt.close()


if __name__ == "__main__":
    print("=" * 65)
    print(f"  MAHALANOBIS DISTANCE VISUALIZATION — PESERTA {UID}")
    print("  CAPAR System | HR × RR | Activity Separation")
    print("=" * 65)

    print(f"Fetching data from MongoDB (polardatas) for user {UID}...")
    df = fetch_real_data(UID)
    
    if df.empty:
        print("EXITING: No valid data found for Duduk/Berdiri.")
    else:
        print(f"Data fetched: {len(df)} records across {df['date'].nunique()} days.")
        
        print("\n[1/4] Generating Grafik 1: Duduk Antar Hari...")
        fig1, ax1 = plot_grafik1(df, save=True)
        if fig1: plt.close(fig1)

        print("\n[2/4] Generating Grafik 2: Duduk vs Berdiri (Intra-Day)...")
        fig2, ax2 = plot_grafik2(df, save=True)
        if fig2: plt.close(fig2)

        print("\n[3/4] Generating Grafik 3: Duduk vs Berdiri (Cross-Day)...")
        fig3 = plot_grafik3(df, save=True)
        if fig3: plt.close(fig3)

        print("\n[4/4] Generating Summary Panel...")
        plot_summary_panel()
        
        # Hitung Sentroid empiris:
        print("\n=== HASIL CENTROID AKTUAL ===")
        df_duduk = df[df['activity'] == 'Duduk']
        df_berdiri = df[df['activity'] == 'Berdiri']
        if not df_duduk.empty:
            print(f"Centroid Duduk: HR={df_duduk['mean_hr'].mean():.2f}±{df_duduk['mean_hr'].std():.2f}, RR={df_duduk['mean_rr'].mean():.2f}±{df_duduk['mean_rr'].std():.2f} (N={len(df_duduk)})")
        if not df_berdiri.empty:
            print(f"Centroid Berdiri: HR={df_berdiri['mean_hr'].mean():.2f}±{df_berdiri['mean_hr'].std():.2f}, RR={df_berdiri['mean_rr'].mean():.2f}±{df_berdiri['mean_rr'].std():.2f} (N={len(df_berdiri)})")

        print("\n" + "=" * 65)
        print("  SELESAI. Output disimpan di folder simulation/")
        print("=" * 65)
