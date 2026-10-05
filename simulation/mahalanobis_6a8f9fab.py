"""
===============================================================================
MAHALANOBIS DISTANCE VISUALIZATION — PESERTA 6a8f9fab74156d89d1dc3c47
CAPAR System — Cardiovascular Anomaly Pattern Analysis & Reporting
===============================================================================

User ID: 6a8f9fab74156d89d1dc3c47
Target  : Activity label (Duduk / Berdiri)
Variabel: HR (Heart Rate, bpm) & RR (RR interval, ms)

Catatan: Menggunakan data simulasi fisiologis karena data asli di MongoDB kosong.
===============================================================================
"""

import numpy as np
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

RNG = np.random.default_rng(seed=47)  # Seed berbeda untuk variasi

# ─── FISIOLOGI SINTETIS ────────────────────────────────────────────
ACTIVITY_PARAMS = {
    "Duduk": {
        "hr_mean": 75.0, "hr_std": 6.0,
        "rr_mean": 800.0, "rr_std": 60.0,
        "hr_rr_corr": -0.83,
        "color": "#38BDF8",
        "marker": "o",
    },
    "Berdiri": {
        "hr_mean": 88.0, "hr_std": 8.0,
        "rr_mean": 680.0, "rr_std": 70.0,
        "hr_rr_corr": -0.80,
        "color": "#FB923C",
        "marker": "^",
    },
}

DAY_VARIATION = {"hr": 3.5, "rr": 35.0}
DAYS = ["Hari 1\n(Senin)", "Hari 2\n(Selasa)", "Hari 3\n(Rabu)", "Hari 4\n(Kamis)", "Hari 5\n(Jumat)"]
N_PER_GROUP = 40
DAY_COLORS = ["#38BDF8", "#34D399", "#F472B6", "#A78BFA", "#FCD34D"]


def generate_bivariate(hr_mean, hr_std, rr_mean, rr_std, corr, n, rng):
    cov = np.array([
        [hr_std**2, corr * hr_std * rr_std],
        [corr * hr_std * rr_std, rr_std**2]
    ])
    L = np.linalg.cholesky(cov)
    z = rng.standard_normal((2, n))
    data = L @ z + np.array([[hr_mean], [rr_mean]])
    return data.T


def mahalanobis_ellipse(mean, cov, ax, n_std=2.0, color="white",
                         alpha_fill=0.12, alpha_edge=0.85, lw=1.8, linestyle="-", label=None, zorder=2):
    vals, vecs = np.linalg.eigh(cov)
    order = vals.argsort()[::-1]
    vals, vecs = vals[order], vecs[:, order]
    angle = np.degrees(np.arctan2(*vecs[:, 0][::-1]))
    w, h = 2 * n_std * np.sqrt(vals)

    ell = Ellipse(xy=mean, width=w, height=h, angle=angle, facecolor=color, edgecolor=color, alpha=alpha_fill, zorder=zorder)
    ax.add_patch(ell)
    ell_edge = Ellipse(xy=mean, width=w, height=h, angle=angle, facecolor="none", edgecolor=color, lw=lw, linestyle=linestyle, alpha=alpha_edge, zorder=zorder + 1, label=label)
    ax.add_patch(ell_edge)
    return ell_edge


def compute_mahal_scores(data, ref_mean, ref_cov):
    VI = inv(ref_cov)
    scores = np.array([mahalanobis(x, ref_mean, VI)**2 for x in data])
    return scores


def add_chi2_text(ax, x=0.02, y=0.97):
    p2_95 = chi2.ppf(0.95, df=2)
    p2_99 = chi2.ppf(0.99, df=2)
    ax.text(x, y, f"χ²(0.95,df=2) = {p2_95:.2f}\nχ²(0.99,df=2) = {p2_99:.2f}",
            transform=ax.transAxes, fontsize=7.5, color="#94A3B8", va="top", ha="left",
            bbox=dict(boxstyle="round,pad=0.3", facecolor="#162030", edgecolor="#2D3F50", alpha=0.85))


def add_participant_label(ax):
    ax.text(0.99, 0.01, f"Peserta {UID[:8]}... | Simulasi CAPAR",
            transform=ax.transAxes, fontsize=7, color="#4B6478", va="bottom", ha="right")


# ══════════════════════════════════════════════════════════════════════════════
# GRAFIK 1 — DUDUK, ANTAR HARI
# ══════════════════════════════════════════════════════════════════════════════

def plot_grafik1():
    n_days = 5
    p = ACTIVITY_PARAMS["Duduk"]

    fig, ax = plt.subplots(figsize=(10, 7))
    fig.patch.set_facecolor("#0F1923")

    all_data, day_datasets = [], []
    for d_idx in range(n_days):
        hr_shift = RNG.uniform(-DAY_VARIATION["hr"], DAY_VARIATION["hr"])
        rr_shift = RNG.uniform(-DAY_VARIATION["rr"], DAY_VARIATION["rr"])
        data_d = generate_bivariate(
            p["hr_mean"] + hr_shift, p["hr_std"], p["rr_mean"] + rr_shift, p["rr_std"], p["hr_rr_corr"], N_PER_GROUP, RNG
        )
        day_datasets.append(data_d)
        all_data.append(data_d)

    all_arr = np.vstack(all_data)
    pool_mean = all_arr.mean(axis=0)
    pool_cov  = np.cov(all_arr.T)

    d2_all = compute_mahal_scores(all_arr, pool_mean, pool_cov)

    sc = ax.scatter(all_arr[:, 0], all_arr[:, 1], c=d2_all, cmap="plasma",
                    vmin=0, vmax=chi2.ppf(0.99, df=2) * 1.5, s=30, alpha=0.65, zorder=3, linewidths=0)
    
    cbar = fig.colorbar(sc, ax=ax, pad=0.01, shrink=0.85)
    cbar.set_label("Mahalanobis D²", color="#8BA3B8", fontsize=8)
    cbar.ax.yaxis.set_tick_params(color="#8BA3B8")
    plt.setp(plt.getp(cbar.ax.axes, 'yticklabels'), color="#8BA3B8", fontsize=7)

    legend_handles = []
    for d_idx, data_d in enumerate(day_datasets):
        d_mean = data_d.mean(axis=0)
        d_cov  = np.cov(data_d.T)
        color  = DAY_COLORS[d_idx]
        label  = DAYS[d_idx].replace('\n', ' ')
        mahalanobis_ellipse(d_mean, d_cov, ax, n_std=1.0, color=color, alpha_fill=0.06, alpha_edge=0.4, lw=1.2, linestyle="--")
        h = mahalanobis_ellipse(d_mean, d_cov, ax, n_std=2.0, color=color, alpha_fill=0.0, alpha_edge=0.9, lw=2.0, label=label)
        ax.plot(d_mean[0], d_mean[1], marker="D", ms=8, color=color, zorder=6, markeredgecolor="#0F1923", mew=0.8)
        legend_handles.append(h)

    mahalanobis_ellipse(pool_mean, pool_cov, ax, n_std=2.0, color="#FFFFFF", alpha_fill=0.0, alpha_edge=0.5, lw=2.2, linestyle=":", label="Baseline Pooled (2σ)")
    legend_handles.append(mpatches.Patch(facecolor="none", edgecolor="#FFFFFF", linestyle=":", lw=2.2, label="Baseline Pooled (2σ)"))

    thresh_99 = chi2.ppf(0.99, df=2)
    mahalanobis_ellipse(pool_mean, pool_cov, ax, n_std=np.sqrt(thresh_99), color="#EF4444", alpha_fill=0.04, alpha_edge=0.6, lw=1.5, linestyle="-.")
    legend_handles.append(mpatches.Patch(facecolor="#EF444422", edgecolor="#EF4444", linestyle="-.", lw=1.5, label="Zona Anomali (χ²>99%)"))

    ax.legend(handles=legend_handles, loc="upper right", title="Kelompok Hari", title_fontsize=9)
    ax.set_title(f"Grafik 1 — Mahalanobis Area: Aktivitas DUDUK Antar Hari\n[ HR vs RR | Peserta {UID[:8]}... ]", fontsize=11, fontweight="bold", color="#E2EAF0", pad=10)
    ax.set_xlabel("HR (bpm)", fontsize=10); ax.set_ylabel("RR Interval (ms)", fontsize=10)
    ax.grid(True, alpha=0.4); ax.tick_params(axis="both", labelsize=8)
    add_chi2_text(ax)
    add_participant_label(ax)
    plt.tight_layout()

    out = os.path.join(OUT_DIR, f"{PREFIX}_grafik1.png")
    plt.savefig(out, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
    print(f"  + Saved: {out}")
    return fig


# ══════════════════════════════════════════════════════════════════════════════
# GRAFIK 2 — DUDUK vs BERDIRI, SATU HARI YANG SAMA
# ══════════════════════════════════════════════════════════════════════════════

def plot_grafik2():
    p_d = ACTIVITY_PARAMS["Duduk"]
    p_b = ACTIVITY_PARAMS["Berdiri"]

    data_duduk = generate_bivariate(p_d["hr_mean"], p_d["hr_std"], p_d["rr_mean"], p_d["rr_std"], p_d["hr_rr_corr"], N_PER_GROUP, RNG)
    data_berdiri = generate_bivariate(p_b["hr_mean"], p_b["hr_std"], p_b["rr_mean"], p_b["rr_std"], p_b["hr_rr_corr"], N_PER_GROUP, RNG)

    mean_d = data_duduk.mean(axis=0)
    cov_d  = np.cov(data_duduk.T)
    mean_b = data_berdiri.mean(axis=0)
    cov_b  = np.cov(data_berdiri.T)

    d2_berdiri_vs_duduk = compute_mahal_scores(data_berdiri, mean_d, cov_d)
    d2_duduk_self       = compute_mahal_scores(data_duduk,   mean_d, cov_d)

    fig, axes = plt.subplots(1, 2, figsize=(14, 7), sharex=False)
    fig.patch.set_facecolor("#0F1923")
    fig.suptitle(f"Grafik 2 — Mahalanobis Area: DUDUK vs BERDIRI (Satu Hari Sama)\n[ HR vs RR | Peserta {UID[:8]}... | Ortostatik Response ]", fontsize=13, fontweight="bold", color="#E2EAF0", y=1.01)

    thresh_95 = chi2.ppf(0.95, df=2)
    thresh_99 = chi2.ppf(0.99, df=2)

    ax = axes[0]
    ax.scatter(data_duduk[:, 0], data_duduk[:, 1], c=d2_duduk_self, cmap="Blues", vmin=0, vmax=thresh_99, s=32, alpha=0.75, label="Duduk", marker="o", zorder=4, linewidths=0)
    ax.scatter(data_berdiri[:, 0], data_berdiri[:, 1], c=d2_berdiri_vs_duduk, cmap="Oranges", vmin=0, vmax=thresh_99 * 1.5, s=32, alpha=0.75, label="Berdiri", marker="^", zorder=4, linewidths=0)

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
    ax.set_title("Ruang Fitur HR-RR\n(Scatter + Mahalanobis Ellipse)", fontsize=11, fontweight="bold", color="#E2EAF0", pad=10)
    ax.set_xlabel("HR (bpm)", fontsize=10); ax.set_ylabel("RR Interval (ms)", fontsize=10)
    ax.grid(True, alpha=0.4); ax.tick_params(axis="both", labelsize=8)
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

    ax2.set_title("Distribusi D²\n(Duduk vs Berdiri — Referensi: Duduk)", fontsize=11, fontweight="bold", color="#E2EAF0", pad=10)
    ax2.set_xlabel("Mahalanobis D²", fontsize=10); ax2.set_ylabel("Frekuensi", fontsize=10)
    ax2.grid(True, alpha=0.4); ax2.tick_params(axis="both", labelsize=8)
    ax2.legend(loc="upper center", fontsize=8)
    add_participant_label(ax2)

    plt.tight_layout()
    out = os.path.join(OUT_DIR, f"{PREFIX}_grafik2.png")
    plt.savefig(out, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
    print(f"  + Saved: {out}")
    return fig


# ══════════════════════════════════════════════════════════════════════════════
# GRAFIK 3 — DUDUK vs BERDIRI, ANTAR HARI
# ══════════════════════════════════════════════════════════════════════════════

def plot_grafik3():
    p_d = ACTIVITY_PARAMS["Duduk"]
    p_b = ACTIVITY_PARAMS["Berdiri"]
    n_days = 5

    datasets = {}
    for act, p in [("Duduk", p_d), ("Berdiri", p_b)]:
        datasets[act] = []
        for d_idx in range(n_days):
            hr_shift = RNG.uniform(-DAY_VARIATION["hr"], DAY_VARIATION["hr"])
            rr_shift = RNG.uniform(-DAY_VARIATION["rr"], DAY_VARIATION["rr"])
            data = generate_bivariate(
                p["hr_mean"] + hr_shift, p["hr_std"], p["rr_mean"] + rr_shift, p["rr_std"], p["hr_rr_corr"], N_PER_GROUP, RNG
            )
            datasets[act].append(data)

    all_duduk  = np.vstack(datasets["Duduk"])
    all_berdiri = np.vstack(datasets["Berdiri"])
    grand_mean = np.vstack([all_duduk, all_berdiri]).mean(axis=0)
    grand_cov  = np.cov(np.vstack([all_duduk, all_berdiri]).T)

    ref_d = {"mean": all_duduk.mean(axis=0),   "cov": np.cov(all_duduk.T)}
    ref_b = {"mean": all_berdiri.mean(axis=0), "cov": np.cov(all_berdiri.T)}

    thresh_95 = chi2.ppf(0.95, df=2)
    thresh_99 = chi2.ppf(0.99, df=2)

    fig = plt.figure(figsize=(17, 12))
    fig.patch.set_facecolor("#0F1923")
    gs = GridSpec(2, 3, figure=fig, hspace=0.40, wspace=0.32, top=0.92, bottom=0.06, left=0.06, right=0.97)

    fig.suptitle(f"Grafik 3 — Mahalanobis Area: DUDUK vs BERDIRI Antar Hari\n[ HR vs RR | Peserta {UID[:8]}... | Cross-Day Comparison ]", fontsize=13, fontweight="bold", color="#E2EAF0")

    ax_sc = fig.add_subplot(gs[:, 0])
    legend_handles = []
    for act, p in [("Duduk", p_d), ("Berdiri", p_b)]:
        ref = ref_d if act == "Duduk" else ref_b
        act_color = p["color"]
        for d_idx, data in enumerate(datasets[act]):
            ax_sc.scatter(data[:, 0], data[:, 1], color=DAY_COLORS[d_idx], s=18 if act == "Duduk" else 22, alpha=0.5, marker=p["marker"], zorder=3, linewidths=0)

        h = mahalanobis_ellipse(ref["mean"], ref["cov"], ax_sc, n_std=np.sqrt(thresh_95), color=act_color, alpha_fill=0.07, alpha_edge=0.9, lw=2.2, label=f"{act} 95%-ellipse")
        mahalanobis_ellipse(ref["mean"], ref["cov"], ax_sc, n_std=1.0, color=act_color, alpha_fill=0.12, alpha_edge=0.3, lw=1.0)
        ax_sc.plot(*ref["mean"], marker=p["marker"], ms=12, color=act_color, zorder=8, markeredgecolor="#0F1923", mew=1.2)
        legend_handles.append(h)

    mahalanobis_ellipse(grand_mean, grand_cov, ax_sc, n_std=np.sqrt(thresh_99), color="#FFFFFF", alpha_fill=0.0, alpha_edge=0.3, lw=1.5, linestyle=":")
    legend_handles.append(mpatches.Patch(facecolor="none", edgecolor="#FFFFFF", linestyle=":", lw=1.5, label="Grand 99%-ellipse"))

    for d_idx, day in enumerate(DAYS):
        legend_handles.append(mpatches.Patch(facecolor=DAY_COLORS[d_idx], label=day.replace("\n", " "), alpha=0.7))

    ax_sc.legend(handles=legend_handles, loc="upper right", fontsize=7.5, title="Aktivitas & Hari", title_fontsize=8)
    ax_sc.set_title("Ruang Fitur HR-RR\n(Semua Aktivitas & Hari)", fontsize=11, fontweight="bold", color="#E2EAF0", pad=10)
    ax_sc.set_xlabel("HR (bpm)", fontsize=10); ax_sc.set_ylabel("RR Interval (ms)", fontsize=10)
    ax_sc.grid(True, alpha=0.4); ax_sc.tick_params(axis="both", labelsize=8)
    add_chi2_text(ax_sc)
    add_participant_label(ax_sc)

    ax_hm = fig.add_subplot(gs[0, 1])
    hmap = np.zeros((2, n_days))
    for a_idx, (act, ref) in enumerate([("Duduk", ref_d), ("Berdiri", ref_b)]):
        for d_idx, data in enumerate(datasets[act]):
            hmap[a_idx, d_idx] = compute_mahal_scores(data, ref["mean"], ref["cov"]).mean()

    im = ax_hm.imshow(hmap, cmap="plasma", aspect="auto", vmin=0, vmax=thresh_99)
    cbar_hm = fig.colorbar(im, ax=ax_hm, shrink=0.85, pad=0.02)
    cbar_hm.set_label("Rata-rata D²", color="#8BA3B8", fontsize=8)
    cbar_hm.ax.yaxis.set_tick_params(color="#8BA3B8")
    plt.setp(cbar_hm.ax.yaxis.get_ticklabels(), color="#8BA3B8", fontsize=7)

    ax_hm.set_xticks(range(n_days)); ax_hm.set_xticklabels([d.replace("\n", " ") for d in DAYS], fontsize=7.5)
    ax_hm.set_yticks([0, 1]); ax_hm.set_yticklabels(["Duduk", "Berdiri"], fontsize=9, fontweight="bold")
    ax_hm.set_title("Heatmap Rata-rata D²\n(per Aktivitas × Hari)", fontsize=10, fontweight="bold", color="#E2EAF0")
    for a_idx in range(2):
        for d_idx in range(n_days):
            val = hmap[a_idx, d_idx]
            txt_color = "white" if val < thresh_95 * 0.7 else "#FF6B6B"
            ax_hm.text(d_idx, a_idx, f"{val:.2f}", ha="center", va="center", fontsize=8.5, color=txt_color, fontweight="bold")
    ax_hm.axhline(0.5, color="#2D3F50", lw=1.5)
    ax_hm.text(n_days - 0.5, -0.4, f"χ²(95%)={thresh_95:.1f}", fontsize=7, color="#F59E0B", ha="right")

    ax_ln = fig.add_subplot(gs[0, 2])
    x = np.arange(n_days)
    for a_idx, (act, ref, lc) in enumerate([("Duduk", ref_d, "#38BDF8"), ("Berdiri", ref_b, "#FB923C")]):
        means = [compute_mahal_scores(datasets[act][d], ref["mean"], ref["cov"]).mean() for d in range(n_days)]
        stds  = [compute_mahal_scores(datasets[act][d], ref["mean"], ref["cov"]).std() for d in range(n_days)]
        means, stds = np.array(means), np.array(stds)
        ax_ln.plot(x, means, "o-", color=lc, lw=2.0, ms=7, markeredgecolor="#0F1923", mew=0.8, label=act)
        ax_ln.fill_between(x, means - stds, means + stds, color=lc, alpha=0.15)

    ax_ln.axhline(thresh_95, color="#F59E0B", lw=1.5, linestyle="--", label=f"χ²(95%)={thresh_95:.2f}")
    ax_ln.axhline(thresh_99, color="#EF4444", lw=1.5, linestyle="-.", label=f"χ²(99%)={thresh_99:.2f}")
    ax_ln.set_xticks(x); ax_ln.set_xticklabels([d.replace("\n", " ") for d in DAYS], fontsize=7.5, rotation=15, ha="right")
    ax_ln.set_title("Tren D² Harian\n(Mean ± SD per Aktivitas)", fontsize=11, fontweight="bold", color="#E2EAF0", pad=10)
    ax_ln.set_xlabel("Hari Pengamatan", fontsize=10); ax_ln.set_ylabel("Rata-rata D²", fontsize=10)
    ax_ln.grid(True, alpha=0.4); ax_ln.tick_params(axis="both", labelsize=8)
    ax_ln.legend(fontsize=8)
    add_participant_label(ax_ln)

    ax_bx1 = fig.add_subplot(gs[1, 1])
    data_boxes_d = [compute_mahal_scores(datasets["Duduk"][d], ref_d["mean"], ref_d["cov"]) for d in range(n_days)]
    bp1 = ax_bx1.boxplot(data_boxes_d, patch_artist=True, medianprops=dict(color="#38BDF8", lw=2), flierprops=dict(marker="o", color="#EF4444", ms=4, alpha=0.6))
    for patch, color in zip(bp1["boxes"], DAY_COLORS):
        patch.set_facecolor(color); patch.set_alpha(0.5); patch.set_edgecolor(color)
    ax_bx1.axhline(thresh_95, color="#F59E0B", lw=1.5, linestyle="--")
    ax_bx1.axhline(thresh_99, color="#EF4444", lw=1.5, linestyle="-.")
    ax_bx1.set_xticks(range(1, n_days + 1)); ax_bx1.set_xticklabels([d.replace("\n", " ") for d in DAYS], fontsize=7.5, rotation=15, ha="right")
    ax_bx1.set_title("Boxplot D² — Aktivitas DUDUK\n(Referensi: pool Duduk)", fontsize=11, fontweight="bold", color="#E2EAF0", pad=10)
    ax_bx1.set_xlabel("Hari", fontsize=10); ax_bx1.set_ylabel("D²", fontsize=10)
    ax_bx1.grid(True, alpha=0.4); ax_bx1.tick_params(axis="both", labelsize=8)
    ax_bx1.legend(fontsize=7.5)
    add_participant_label(ax_bx1)

    ax_bx2 = fig.add_subplot(gs[1, 2])
    data_boxes_b = [compute_mahal_scores(datasets["Berdiri"][d], ref_b["mean"], ref_b["cov"]) for d in range(n_days)]
    bp2 = ax_bx2.boxplot(data_boxes_b, patch_artist=True, medianprops=dict(color="#FB923C", lw=2), flierprops=dict(marker="^", color="#EF4444", ms=4, alpha=0.6))
    for patch, color in zip(bp2["boxes"], DAY_COLORS):
        patch.set_facecolor(color); patch.set_alpha(0.5); patch.set_edgecolor(color)
    ax_bx2.axhline(thresh_95, color="#F59E0B", lw=1.5, linestyle="--")
    ax_bx2.axhline(thresh_99, color="#EF4444", lw=1.5, linestyle="-.")
    ax_bx2.set_xticks(range(1, n_days + 1)); ax_bx2.set_xticklabels([d.replace("\n", " ") for d in DAYS], fontsize=7.5, rotation=15, ha="right")
    ax_bx2.set_title("Boxplot D² — Aktivitas BERDIRI\n(Referensi: pool Berdiri)", fontsize=11, fontweight="bold", color="#E2EAF0", pad=10)
    ax_bx2.set_xlabel("Hari", fontsize=10); ax_bx2.set_ylabel("D²", fontsize=10)
    ax_bx2.grid(True, alpha=0.4); ax_bx2.tick_params(axis="both", labelsize=8)
    ax_bx2.legend(fontsize=7.5)
    add_participant_label(ax_bx2)

    plt.tight_layout()
    out = os.path.join(OUT_DIR, f"{PREFIX}_grafik3.png")
    plt.savefig(out, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
    print(f"  + Saved: {out}")
    return fig


# ══════════════════════════════════════════════════════════════════════════════
# PANEL GABUNGAN (all 3 in one figure)
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
        "Grafik 2: Duduk vs Berdiri (1 Hari)",
        "Grafik 3: Duduk vs Berdiri Antar Hari",
    ]

    fig, axes = plt.subplots(1, 3, figsize=(20, 7))
    fig.patch.set_facecolor("#0A1218")
    fig.suptitle(f"Mahalanobis Distance Area — Peserta {UID} (Simulation)  |  HR & RR", fontsize=14, fontweight="bold", color="#E2EAF0", y=1.01)
    
    for ax, fname, title in zip(axes, files, titles):
        try:
            img = mpimg.imread(fname)
            ax.imshow(img, aspect="auto")
        except FileNotFoundError:
            ax.text(0.5, 0.5, "File tidak ditemukan", ha="center", va="center", color="red", transform=ax.transAxes)
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
    
    print("\n*NOTE: Menggunakan Simulasi karena data MongoDB kosong.*")

    print("\n[1/4] Generating Grafik 1: Duduk Antar Hari...")
    fig1 = plot_grafik1()
    if fig1: plt.close(fig1)

    print("\n[2/4] Generating Grafik 2: Duduk vs Berdiri (Intra-Day)...")
    fig2 = plot_grafik2()
    if fig2: plt.close(fig2)

    print("\n[3/4] Generating Grafik 3: Duduk vs Berdiri (Cross-Day)...")
    fig3 = plot_grafik3()
    if fig3: plt.close(fig3)

    print("\n[4/4] Generating Summary Panel...")
    plot_summary_panel()

    print("\n" + "=" * 65)
    print("  SELESAI. Output disimpan di folder simulation/")
    print("=" * 65)
