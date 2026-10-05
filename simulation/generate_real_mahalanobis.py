"""
===============================================================================
MAHALANOBIS DISTANCE VISUALIZATION (REAL DATA)
Generates graphics for multiple users based on MongoDB polardatas.
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

def fetch_real_data(user_id, act1="Duduk", act2="Berjalan"):
    uri = "mongodb://capar_admin:SecurePassword123!@127.0.0.1:27017/test?authSource=admin"
    client = pymongo.MongoClient(uri)
    collection = client["test"]["polardatas"]
    
    query_id = ObjectId(user_id) if collection.count_documents({"user_id": ObjectId(user_id)}) > 0 else user_id

    docs = list(collection.find({
        "user_id": query_id,
        "activity": {"$in": [act1, act2]},
        "hr": {"$exists": True, "$type": "number"},
        "rr": {"$exists": True, "$type": "number"}
    }))

    if not docs:
        return pd.DataFrame()

    df = pd.DataFrame(docs)
    
    def parse_dt(row):
        if pd.notna(row.get('date_created')):
            try: return pd.to_datetime(row['date_created'], format='%d-%m-%Y').strftime('%Y-%m-%d')
            except: pass
        if pd.notna(row.get('timestamp')):
            ts = row['timestamp']
            ts = ts / 1000.0 if ts > 1e11 else float(ts)
            return datetime.fromtimestamp(ts).strftime('%Y-%m-%d')
        return None
            
    df['date'] = df.apply(parse_dt, axis=1)
    df = df.rename(columns={'hr': 'mean_hr', 'rr': 'mean_rr'})
    df = df.dropna(subset=['date', 'mean_hr', 'mean_rr', 'activity'])
    
    if 'timestamp' in df.columns:
        df = df.sort_values(by='timestamp')
        
    if len(df) > 8000:
        df = df.sample(8000, random_state=42)
    
    return df


def mahalanobis_ellipse(mean, cov, ax, n_std=2.0, color="white", alpha_fill=0.12, alpha_edge=0.85, lw=1.8, linestyle="-", label=None, zorder=2):
    try:
        vals, vecs = np.linalg.eigh(cov)
        order = vals.argsort()[::-1]
        vals, vecs = vals[order], vecs[:, order]
        angle = np.degrees(np.arctan2(*vecs[:, 0][::-1]))
        w, h = 2 * n_std * np.sqrt(np.maximum(vals, 1e-6))
    except:
        return None
    ell = Ellipse(xy=mean, width=w, height=h, angle=angle, facecolor=color, edgecolor=color, alpha=alpha_fill, zorder=zorder)
    ax.add_patch(ell)
    ell_edge = Ellipse(xy=mean, width=w, height=h, angle=angle, facecolor="none", edgecolor=color, lw=lw, linestyle=linestyle, alpha=alpha_edge, zorder=zorder + 1, label=label)
    ax.add_patch(ell_edge)
    return ell_edge

def compute_mahal_scores(data, ref_mean, ref_cov):
    try: VI = inv(ref_cov)
    except: VI = np.linalg.pinv(ref_cov)
    return np.array([mahalanobis(x, ref_mean, VI)**2 for x in data])

def style_axis(ax, title, xlabel="HR (bpm)", ylabel="RR Interval (ms)"):
    ax.set_title(title, fontsize=11, fontweight="bold", color="#E2EAF0", pad=10)
    ax.set_xlabel(xlabel, fontsize=10); ax.set_ylabel(ylabel, fontsize=10)
    ax.grid(True, alpha=0.4); ax.tick_params(axis="both", labelsize=8)

def add_chi2_text(ax, x=0.02, y=0.97):
    ax.text(x, y, f"chi2(95%)={chi2.ppf(0.95, df=2):.2f}\nchi2(99%)={chi2.ppf(0.99, df=2):.2f}",
            transform=ax.transAxes, fontsize=7.5, color="#94A3B8", va="top", ha="left",
            bbox=dict(boxstyle="round,pad=0.3", facecolor="#162030", edgecolor="#2D3F50", alpha=0.85))

DAY_COLORS = ["#38BDF8", "#34D399", "#F472B6", "#A78BFA", "#FCD34D", "#FB923C", "#94A3B8", "#EF4444", "#84CC16", "#14B8A6"]
ACT_STYLE = {"Duduk": {"color": "#38BDF8", "marker": "o"}, "Berjalan": {"color": "#FB923C", "marker": "^"}}


def plot_grafik1(df, uid, prefix):
    df_duduk = df[df['activity'] == 'Duduk']
    if df_duduk.empty: return None, None
    days = sorted(df_duduk['date'].unique())
    fig, ax = plt.subplots(figsize=(10, 7))
    fig.patch.set_facecolor("#0F1923")
    all_arr = df_duduk[['mean_hr', 'mean_rr']].values
    if len(all_arr) < 2: return None, None
    pool_mean = all_arr.mean(axis=0)
    pool_cov  = np.cov(all_arr.T)
    d2_all = compute_mahal_scores(all_arr, pool_mean, pool_cov)
    sc = ax.scatter(all_arr[:, 0], all_arr[:, 1], c=d2_all, cmap="plasma", vmin=0, vmax=chi2.ppf(0.99, df=2)*1.5, s=35, alpha=0.75, zorder=3, linewidths=0)
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
    mahalanobis_ellipse(pool_mean, pool_cov, ax, n_std=2.0, color="#FFFFFF", alpha_fill=0.0, alpha_edge=0.5, lw=2.2, linestyle=":", label="Baseline (2σ)")
    legend_handles.append(mpatches.Patch(facecolor="none", edgecolor="#FFFFFF", linestyle=":", lw=2.2, label="Baseline (2σ)"))
    ax.legend(handles=legend_handles, loc="upper right", title="Kelompok Hari", title_fontsize=9)
    style_axis(ax, f"Grafik 1 — Mahalanobis Area: DUDUK Antar Hari\n[ Real Data | Peserta {uid} ]")
    add_chi2_text(ax)
    plt.tight_layout()
    out = os.path.join(OUT_DIR, f"{prefix}_grafik1.png")
    plt.savefig(out, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
    return fig, ax


def plot_grafik2(df, uid, prefix):
    day_counts = df.groupby(['date', 'activity']).size().unstack(fill_value=0)
    if 'Duduk' not in day_counts.columns or 'Berjalan' not in day_counts.columns: return None, None
    valid_days = day_counts[(day_counts['Duduk'] >= 3) & (day_counts['Berjalan'] >= 3)].index.tolist()
    if not valid_days: return None, None
    target_day = valid_days[-1] 
    df_day = df[df['date'] == target_day]
    data_duduk = df_day[df_day['activity'] == 'Duduk'][['mean_hr', 'mean_rr']].values
    data_berjalan = df_day[df_day['activity'] == 'Berjalan'][['mean_hr', 'mean_rr']].values
    if len(data_duduk) < 2 or len(data_berjalan) < 2: return None, None
    mean_d, cov_d = data_duduk.mean(axis=0), np.cov(data_duduk.T)
    mean_b, cov_b = data_berjalan.mean(axis=0), np.cov(data_berjalan.T)
    d2_berjalan_vs_duduk = compute_mahal_scores(data_berjalan, mean_d, cov_d)
    d2_duduk_self       = compute_mahal_scores(data_duduk,   mean_d, cov_d)

    fig, axes = plt.subplots(1, 2, figsize=(14, 7))
    fig.patch.set_facecolor("#0F1923")
    fig.suptitle(f"Grafik 2 — Mahalanobis Area: DUDUK vs BERJALAN (Intra-Day: {target_day})\n[ Real Data | Peserta {uid} ]", fontsize=13, fontweight="bold", color="#E2EAF0", y=1.01)
    thresh_95 = chi2.ppf(0.95, df=2)
    thresh_99 = chi2.ppf(0.99, df=2)
    ax = axes[0]
    ax.scatter(data_duduk[:,0], data_duduk[:,1], c=d2_duduk_self, cmap="Blues", vmin=0, vmax=thresh_99, s=35, alpha=0.8, label="Duduk", marker="o", linewidths=0)
    ax.scatter(data_berjalan[:,0], data_berjalan[:,1], c=d2_berjalan_vs_duduk, cmap="Oranges", vmin=0, vmax=thresh_99*1.5, s=35, alpha=0.8, label="Berjalan", marker="^", linewidths=0)
    mahalanobis_ellipse(mean_d, cov_d, ax, n_std=2.0, color="#38BDF8", alpha_fill=0.0, alpha_edge=0.9, lw=2.0, label="Duduk 2σ")
    mahalanobis_ellipse(mean_b, cov_b, ax, n_std=2.0, color="#FB923C", alpha_fill=0.0, alpha_edge=0.9, lw=2.0, label="Berjalan 2σ")
    ax.plot(*mean_d, "D", ms=9, color="#38BDF8", markeredgecolor="#0F1923")
    ax.plot(*mean_b, "^", ms=9, color="#FB923C", markeredgecolor="#0F1923")
    ax.legend(loc="upper right", fontsize=8)
    style_axis(ax, "Ruang Fitur HR-RR (Duduk vs Berjalan)")
    add_chi2_text(ax)
    
    ax2 = axes[1]
    bins = np.linspace(0, max(d2_berjalan_vs_duduk.max(), d2_duduk_self.max()) * 1.05, 25)
    ax2.hist(d2_duduk_self, bins=bins, color="#38BDF8", alpha=0.55, label="Duduk (self)", edgecolor="#0F1923")
    ax2.hist(d2_berjalan_vs_duduk, bins=bins, color="#FB923C", alpha=0.55, label="Berjalan vs Duduk", edgecolor="#0F1923")
    ax2.axvline(thresh_95, color="#F59E0B", lw=2, linestyle="--")
    ax2.axvline(thresh_99, color="#EF4444", lw=2, linestyle="-.")
    style_axis(ax2, "Distribusi D²", xlabel="Mahalanobis D²", ylabel="Frekuensi")
    ax2.legend(loc="upper center", fontsize=8)
    plt.tight_layout()
    out = os.path.join(OUT_DIR, f"{prefix}_grafik2.png")
    plt.savefig(out, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
    return fig, axes


def plot_grafik3(df, uid, prefix):
    days = sorted(df['date'].unique())
    df_duduk = df[df['activity'] == 'Duduk']
    df_berjalan = df[df['activity'] == 'Berjalan']
    if len(df_duduk) < 2 or len(df_berjalan) < 2: return None
    all_duduk = df_duduk[['mean_hr', 'mean_rr']].values
    all_berjalan = df_berjalan[['mean_hr', 'mean_rr']].values
    ref_d = {"mean": all_duduk.mean(axis=0),   "cov": np.cov(all_duduk.T)}
    ref_b = {"mean": all_berjalan.mean(axis=0), "cov": np.cov(all_berjalan.T)}
    thresh_95 = chi2.ppf(0.95, df=2)
    thresh_99 = chi2.ppf(0.99, df=2)

    fig = plt.figure(figsize=(17, 12))
    fig.patch.set_facecolor("#0F1923")
    gs = GridSpec(2, 3, figure=fig, hspace=0.40, wspace=0.32, top=0.92, bottom=0.06, left=0.06, right=0.97)
    fig.suptitle(f"Grafik 3 — Mahalanobis Area: DUDUK vs BERJALAN Antar Hari\n[ Real Data | Peserta {uid} ]", fontsize=13, fontweight="bold", color="#E2EAF0")

    ax_sc = fig.add_subplot(gs[:, 0])
    for act, ref in [("Duduk", ref_d), ("Berjalan", ref_b)]:
        act_color = ACT_STYLE[act]["color"]
        marker = ACT_STYLE[act]["marker"]
        for d_idx, day in enumerate(days):
            day_data = df[(df['date'] == day) & (df['activity'] == act)][['mean_hr', 'mean_rr']].values
            if len(day_data) == 0: continue
            ax_sc.scatter(day_data[:, 0], day_data[:, 1], color=DAY_COLORS[d_idx % len(DAY_COLORS)], s=25, alpha=0.6, marker=marker, linewidths=0)
        mahalanobis_ellipse(ref["mean"], ref["cov"], ax_sc, n_std=np.sqrt(thresh_95), color=act_color, alpha_fill=0.07, alpha_edge=0.9, lw=2.2)
        ax_sc.plot(*ref["mean"], marker=marker, ms=12, color=act_color, markeredgecolor="#0F1923")
    style_axis(ax_sc, "Ruang Fitur HR-RR")

    ax_hm = fig.add_subplot(gs[0, 1])
    hmap = np.zeros((2, len(days)))
    for a_idx, (act, ref) in enumerate([("Duduk", ref_d), ("Berjalan", ref_b)]):
        for d_idx, day in enumerate(days):
            day_data = df[(df['date'] == day) & (df['activity'] == act)][['mean_hr', 'mean_rr']].values
            if len(day_data) > 2: hmap[a_idx, d_idx] = compute_mahal_scores(day_data, ref["mean"], ref["cov"]).mean()
            else: hmap[a_idx, d_idx] = np.nan
    ax_hm.imshow(hmap, cmap="plasma", aspect="auto", vmin=0, vmax=thresh_99)
    ax_hm.set_xticks(range(len(days))); ax_hm.set_xticklabels(days, fontsize=7.5, rotation=15)
    ax_hm.set_yticks([0, 1]); ax_hm.set_yticklabels(["Duduk", "Berjalan"], fontsize=9, fontweight="bold")
    ax_hm.set_title("Heatmap Rata-rata D²")

    ax_ln = fig.add_subplot(gs[0, 2])
    x = np.arange(len(days))
    for act, ref, lc in [("Duduk", ref_d, "#38BDF8"), ("Berjalan", ref_b, "#FB923C")]:
        means = []
        for day in days:
            day_data = df[(df['date'] == day) & (df['activity'] == act)][['mean_hr', 'mean_rr']].values
            if len(day_data) > 2: means.append(compute_mahal_scores(day_data, ref["mean"], ref["cov"]).mean())
            else: means.append(np.nan)
        ax_ln.plot(x, means, "o-", color=lc, label=act)
    ax_ln.set_xticks(x); ax_ln.set_xticklabels(days, fontsize=7.5, rotation=15)
    style_axis(ax_ln, "Tren D² Harian", ylabel="Rata-rata D²")
    ax_ln.legend()

    ax_bx1 = fig.add_subplot(gs[1, 1])
    data_boxes_d = [compute_mahal_scores(df[(df['date'] == d) & (df['activity'] == 'Duduk')][['mean_hr', 'mean_rr']].values, ref_d["mean"], ref_d["cov"]) if len(df[(df['date'] == d) & (df['activity'] == 'Duduk')]) > 2 else [] for d in days]
    if any(len(b)>0 for b in data_boxes_d):
        ax_bx1.boxplot([b for b in data_boxes_d if len(b)>0], positions=[i+1 for i,b in enumerate(data_boxes_d) if len(b)>0])
    ax_bx1.set_xticks(range(1, len(days) + 1)); ax_bx1.set_xticklabels(days, fontsize=7.5, rotation=15)
    style_axis(ax_bx1, "Boxplot D² — DUDUK")

    ax_bx2 = fig.add_subplot(gs[1, 2])
    data_boxes_b = [compute_mahal_scores(df[(df['date'] == d) & (df['activity'] == 'Berjalan')][['mean_hr', 'mean_rr']].values, ref_b["mean"], ref_b["cov"]) if len(df[(df['date'] == d) & (df['activity'] == 'Berjalan')]) > 2 else [] for d in days]
    if any(len(b)>0 for b in data_boxes_b):
        ax_bx2.boxplot([b for b in data_boxes_b if len(b)>0], positions=[i+1 for i,b in enumerate(data_boxes_b) if len(b)>0])
    ax_bx2.set_xticks(range(1, len(days) + 1)); ax_bx2.set_xticklabels(days, fontsize=7.5, rotation=15)
    style_axis(ax_bx2, "Boxplot D² — BERJALAN")

    plt.tight_layout()
    out = os.path.join(OUT_DIR, f"{prefix}_grafik3.png")
    plt.savefig(out, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
    return fig


def process_user(uid, prefix):
    print(f"\n{'='*50}\nMemproses User: {uid}\n{'='*50}")
    df = fetch_real_data(uid, "Duduk", "Berjalan")
    if df.empty:
        print("Data kosong. Skip.")
        return
    print(f"Data ditemukan: {len(df)} records. (Duduk: {len(df[df['activity']=='Duduk'])}, Berjalan: {len(df[df['activity']=='Berjalan'])})")
    
    print("[1/3] Grafik 1 (Duduk)...")
    fig1, _ = plot_grafik1(df, uid, prefix)
    if fig1: plt.close(fig1)
    
    print("[2/3] Grafik 2 (Duduk vs Berjalan Intra-Day)...")
    fig2, _ = plot_grafik2(df, uid, prefix)
    if fig2: plt.close(fig2)
    
    print("[3/3] Grafik 3 (Duduk vs Berjalan Cross-Day)...")
    fig3 = plot_grafik3(df, uid, prefix)
    if fig3: plt.close(fig3)

if __name__ == "__main__":
    process_user("6a98264316b1f3634c777f82", "mahalanobis_peserta23_real_plot")
    process_user("6a8f9fab74156d89d1dc3c47", "mahalanobis_peserta22_real_plot")
    print("\nSELESAI. Cek folder simulation/.")
