#!/usr/bin/env python3
"""CAPAR operating-point characterization for selected MongoDB participants.

Pipeline:
MongoDB polardatas (raw Polar) -> 1-min windows -> quality gating
-> contextual baseline -> z-scores
-> C,V,A,L proxies -> hysteresis episodes -> recovery progress R
-> operating-point episode metrics -> longitudinal phenotype -> plots.

C,V,A,L,R are model-derived proxies, not direct clinical measurements.
"""
from __future__ import annotations

import argparse
import json
import math
import os
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Optional

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


@dataclass
class Config:
    window_seconds: int = 60
    min_coverage: float = 0.60
    expected_sampling_hz: float = 1.0
    hr_min: float = 35.0
    hr_max: float = 220.0
    rr_min_ms: float = 250.0
    rr_max_ms: float = 2000.0
    baseline_method: str = "robust"
    min_baseline_windows: int = 8
    covariance_regularization: float = 1e-3
    tau_in: float = 1.80
    tau_out: float = 1.00
    enter_persistence_windows: int = 2
    exit_persistence_windows: int = 2
    plateau_derivative_tol: float = 0.08
    relapse_window_minutes: int = 15
    fast_recovery_min: float = 5.0
    slow_recovery_min: float = 10.0
    sustained_episode_min: float = 15.0
    high_displacement: float = 2.50


FEATURES = ["hr_mean", "delta_hr", "hr_slope_bpm_min", "rmssd", "sdnn", "dfa_alpha1"]


def as_float(value: Any) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return np.nan
    return result if np.isfinite(result) else np.nan


def timestamp_from_mongo(value: Any) -> pd.Timestamp:
    numeric = as_float(value)
    if np.isfinite(numeric):
        if numeric < 20_000_000_000:
            numeric *= 1000
        return pd.to_datetime(numeric, unit="ms", errors="coerce")
    return pd.to_datetime(value, errors="coerce")


def rmssd(values: np.ndarray) -> float:
    values = np.asarray(values, dtype=float)
    values = values[np.isfinite(values)]
    return float(np.sqrt(np.mean(np.diff(values) ** 2))) if len(values) >= 3 else np.nan


def dfa_alpha1(values: np.ndarray) -> float:
    values = np.asarray(values, dtype=float)
    values = values[np.isfinite(values)]
    if len(values) < 24:
        return np.nan
    profile = np.cumsum(values - np.mean(values))
    x_values, fluctuation_values = [], []
    for scale in range(4, 17):
        count = len(profile) // scale
        if count < 2:
            continue
        fluctuations = []
        for index in range(count):
            segment = profile[index * scale:(index + 1) * scale]
            x = np.arange(scale, dtype=float)
            trend = np.polyval(np.polyfit(x, segment, 1), x)
            fluctuations.append(np.sqrt(np.mean((segment - trend) ** 2)))
        value = float(np.sqrt(np.mean(np.asarray(fluctuations) ** 2)))
        if value > 0 and np.isfinite(value):
            x_values.append(np.log(float(scale)))
            fluctuation_values.append(np.log(value))
    return float(np.polyfit(x_values, fluctuation_values, 1)[0]) if len(x_values) >= 3 else np.nan


def slope_per_minute(values: np.ndarray, timestamps: pd.Series) -> float:
    numeric = np.asarray(values, dtype=float)
    time_values = pd.to_datetime(timestamps)
    seconds = (time_values - time_values.iloc[0]).dt.total_seconds().to_numpy(float)
    mask = np.isfinite(numeric) & np.isfinite(seconds)
    if mask.sum() < 2 or np.ptp(seconds[mask]) <= 0:
        return np.nan
    return float(np.polyfit(seconds[mask], numeric[mask], 1)[0] * 60.0)


def resolve_targets(db, requested: list[str]) -> list[dict[str, Any]]:
    users = list(db.users.find({}, {"_id": 1, "name": 1, "email": 1, "guid": 1}).sort("_id", 1))
    targets = []
    requested_lower = {item.strip().lower() for item in requested}
    for user in users:
        values = {
            str(user.get("_id", "")).lower(),
            str(user.get("name", "")).lower(),
            str(user.get("email", "")).lower(),
            str(user.get("guid", "")).lower(),
        }
        if values & requested_lower:
            targets.append(user)
    missing = requested_lower - {
        value
        for user in targets
        for value in [
            str(user.get("_id", "")).lower(),
            str(user.get("name", "")).lower(),
            str(user.get("email", "")).lower(),
            str(user.get("guid", "")).lower(),
        ]
    }
    if missing:
        raise ValueError(f"Peserta tidak ditemukan: {sorted(missing)}")
    return targets


def segments_to_windows(docs: list[dict[str, Any]], cfg: Config) -> pd.DataFrame:
    rows = []
    expected = max(1, int(cfg.window_seconds * cfg.expected_sampling_hz))
    for doc in docs:
        feature = doc.get("features") or {}
        quality = doc.get("signal_quality")
        quality_ok = not isinstance(quality, dict) or not quality.get("is_artifact", False)
        raw_count = as_float(doc.get("raw_count"))
        # Mongo stores pre-aggregated windows; raw_count is not a 1 Hz sample count.
        # Use the persisted segment validity as the quality gate and retain raw_count
        # as an audit field instead of incorrectly rejecting sparse valid windows.
        coverage = 1.0 if np.isfinite(raw_count) and raw_count > 0 else 0.0
        hr = as_float(feature.get("mean_hr"))
        rr = as_float(feature.get("mean_rr"))
        valid = bool(doc.get("is_valid", True)) and quality_ok
        valid = valid and np.isfinite(hr) and cfg.hr_min <= hr <= cfg.hr_max
        valid = valid and (not np.isfinite(rr) or cfg.rr_min_ms <= rr <= cfg.rr_max_ms)
        rows.append({
            "window_start": timestamp_from_mongo(doc.get("window_start")),
            "activity": str(doc.get("activity_label") or "unknown"),
            "n_samples": int(raw_count) if np.isfinite(raw_count) else expected,
            "coverage": coverage,
            "quality_fraction": 1.0 if valid else 0.0,
            "valid_window": int(valid and coverage >= cfg.min_coverage),
            "hr_mean": hr,
            "delta_hr": as_float(feature.get("delta_hr")),
            "hr_slope_bpm_min": as_float(feature.get("slope_hr")),
            "rr_mean_ms": rr,
            "sdnn": as_float(feature.get("sdnn")),
            "rmssd": as_float(feature.get("rmssd")),
            "dfa_alpha1": as_float(feature.get("dfa_alpha1")),
            "acc_mean": as_float(feature.get("motion_intensity")),
        })
    if not rows:
        return pd.DataFrame(columns=["window_start", "activity", "valid_window"])
    return pd.DataFrame(rows).dropna(subset=["window_start"]).sort_values("window_start").reset_index(drop=True)


def polar_data_to_windows(docs: list[dict[str, Any]], cfg: Config) -> pd.DataFrame:
    """Aggregate raw PolarData into quality-gated one-minute windows."""
    raw_rows = []
    for doc in docs:
        timestamp = timestamp_from_mongo(doc.get("timestamp"))
        if pd.isna(timestamp):
            date_value = str(doc.get("date_created") or "")
            time_value = str(doc.get("time_created") or "00:00:00")
            timestamp = pd.to_datetime(f"{date_value} {time_value}", dayfirst=True, errors="coerce")
        hr = as_float(doc.get("hr"))
        rr = as_float(doc.get("rr"))
        if not np.isfinite(rr):
            rr = as_float(doc.get("rrms"))
        raw_rows.append({
            "timestamp": timestamp,
            "hr": hr,
            "rr_ms": rr,
            "acc_x": as_float(doc.get("acc_x")),
            "acc_y": as_float(doc.get("acc_y")),
            "acc_z": as_float(doc.get("acc_z")),
            "ecg": as_float(doc.get("ecg")),
            "activity": str(doc.get("activity") or "unknown"),
        })
    raw = pd.DataFrame(raw_rows).dropna(subset=["timestamp"])
    if raw.empty:
        return pd.DataFrame(columns=["window_start", "activity", "valid_window"])
    raw = raw.sort_values("timestamp").reset_index(drop=True)
    raw["window_start"] = raw["timestamp"].dt.floor(f"{cfg.window_seconds}s")
    intervals = raw["timestamp"].diff().dt.total_seconds()
    typical_interval = intervals[(intervals > 0) & (intervals <= 300)].median()
    inferred_hz = 1.0 / typical_interval if np.isfinite(typical_interval) and typical_interval > 0 else cfg.expected_sampling_hz
    expected = max(1, int(round(cfg.window_seconds * inferred_hz)))
    rows = []
    for window_start, group in raw.groupby("window_start", sort=True):
        hr_valid = group.hr.between(cfg.hr_min, cfg.hr_max)
        rr_valid = group.rr_ms.isna() | group.rr_ms.between(cfg.rr_min_ms, cfg.rr_max_ms)
        quality_valid = hr_valid & rr_valid
        valid_group = group[quality_valid]
        hr_values = valid_group.hr.to_numpy(float)
        rr_values = valid_group.rr_ms.dropna().to_numpy(float)
        coverage = min(1.0, len(group) / expected)
        quality_fraction = float(quality_valid.mean()) if len(group) else 0.0
        acceleration = np.sqrt(group.acc_x ** 2 + group.acc_y ** 2 + group.acc_z ** 2)
        rows.append({
            "window_start": window_start,
            "activity": str(group.activity.mode().iloc[0]) if not group.activity.mode().empty else "unknown",
            "n_samples": len(group),
            "coverage": coverage,
            "quality_fraction": quality_fraction,
            "valid_window": int(coverage >= cfg.min_coverage and quality_fraction >= cfg.min_coverage and len(hr_values) >= 2),
            "hr_mean": float(np.mean(hr_values)) if len(hr_values) else np.nan,
            "delta_hr": float(hr_values[-1] - hr_values[0]) if len(hr_values) >= 2 else np.nan,
            "hr_slope_bpm_min": slope_per_minute(hr_values, valid_group.timestamp) if len(hr_values) >= 2 else np.nan,
            "rr_mean_ms": float(np.mean(rr_values)) if len(rr_values) else np.nan,
            "sdnn": float(np.std(rr_values, ddof=1)) if len(rr_values) >= 2 else np.nan,
            "rmssd": rmssd(rr_values),
            "dfa_alpha1": dfa_alpha1(rr_values),
            "acc_mean": float(np.nanmean(acceleration)) if acceleration.notna().any() else np.nan,
            "ecg_mean": float(np.nanmean(valid_group.ecg)) if valid_group.ecg.notna().any() else np.nan,
        })
    return pd.DataFrame(rows).sort_values("window_start").reset_index(drop=True)


def center_scale(values: pd.Series, method: str) -> tuple[float, float]:
    values = pd.to_numeric(values, errors="coerce").dropna()
    if values.empty:
        return np.nan, np.nan
    if method == "meanstd":
        center = float(values.mean())
        scale = float(values.std(ddof=1)) if len(values) > 1 else 1.0
    else:
        center = float(values.median())
        mad = float(np.median(np.abs(values.to_numpy() - center)))
        scale = 1.4826 * mad
        if not np.isfinite(scale) or scale < 1e-9:
            scale = float(values.std(ddof=1)) if len(values) > 1 else 1.0
    if not np.isfinite(scale) or scale < 1e-9:
        scale = 1.0
    return center, scale


def build_baseline(windows: pd.DataFrame, cfg: Config):
    valid = windows[windows.valid_window == 1].copy()
    pool = valid.copy()
    features = [feature for feature in FEATURES if feature in windows.columns and pool[feature].notna().any()]
    global_stats = {feature: center_scale(pool[feature], cfg.baseline_method) for feature in features}
    stats = []
    covariances = {}
    for activity in sorted(valid.activity.dropna().unique()):
        activity_rows = pool[pool.activity == activity]
        use = activity_rows if len(activity_rows) >= cfg.min_baseline_windows else pool
        row = {
            "activity": activity,
            "baseline_source": "context" if len(activity_rows) >= cfg.min_baseline_windows else "global_fallback",
            "n_baseline_windows": len(activity_rows),
        }
        z_columns = []
        for feature in features:
            center, scale = center_scale(use[feature], cfg.baseline_method)
            if not np.isfinite(center):
                center, scale = global_stats[feature]
            row[f"{feature}_center"] = center
            row[f"{feature}_scale"] = scale
            z_columns.append((use[feature].to_numpy(float) - center) / scale)
        stats.append(row)
        if z_columns:
            matrix = np.column_stack(z_columns)
            matrix = matrix[np.all(np.isfinite(matrix), axis=1)]
            covariance = np.cov(matrix, rowvar=False) if len(matrix) >= max(3, len(features) + 1) else np.eye(len(features))
            covariances[activity] = np.atleast_2d(covariance) + np.eye(len(features)) * cfg.covariance_regularization
    stats_frame = pd.DataFrame(stats)
    stat_map = {row.activity: row for _, row in stats_frame.iterrows()}
    result = windows.copy()
    for feature in features:
        result[f"z_{feature}"] = np.nan
    for index, row in result.iterrows():
        baseline = stat_map.get(row.activity)
        if baseline is None:
            continue
        for feature in features:
            value = row[feature]
            center = baseline[f"{feature}_center"]
            scale = baseline[f"{feature}_scale"]
            if np.isfinite(value) and np.isfinite(center) and scale > 0:
                result.at[index, f"z_{feature}"] = (value - center) / scale
    return result, stats_frame, covariances, features


def add_states(windows: pd.DataFrame, covariances: dict, features: list[str]) -> pd.DataFrame:
    result = windows.copy()
    distances = []
    mahalanobis = []
    for _, row in result.iterrows():
        z = np.array([row.get(f"z_{feature}", np.nan) for feature in features], dtype=float)
        finite = z[np.isfinite(z)]
        distances.append(float(np.sqrt(np.mean(finite * finite))) if len(finite) else np.nan)
        covariance = covariances.get(row.activity, np.eye(len(features)))
        mask = np.isfinite(z)
        if not mask.any():
            mahalanobis.append(np.nan)
        else:
            reduced = covariance[np.ix_(mask, mask)]
            vector = z[mask]
            mahalanobis.append(math.sqrt(max(0.0, float(vector.T @ np.linalg.pinv(reduced) @ vector))))
    result["D_feature"] = distances
    result["D_mahalanobis"] = mahalanobis

    def z(row, feature):
        value = row.get(f"z_{feature}", np.nan)
        return float(value) if np.isfinite(value) else 0.0

    c_values, v_values, a_values, l_values = [], [], [], []
    for _, row in result.iterrows():
        zh, zd, zs = z(row, "hr_mean"), z(row, "delta_hr"), z(row, "hr_slope_bpm_min")
        zr, zn, za = z(row, "rmssd"), z(row, "sdnn"), z(row, "dfa_alpha1")
        c_value = float(np.tanh(0.55 * zh + 0.30 * zd + 0.15 * zs))
        v_value = float(np.tanh(0.55 * zr + 0.25 * zn - 0.20 * zh))
        a_value = float(np.tanh(0.55 * c_value - 0.55 * v_value + 0.20 * za))
        magnitude = float(np.sqrt(np.mean(np.array([zh, zd, zr, zn, za]) ** 2)))
        c_values.append(c_value)
        v_values.append(v_value)
        a_values.append(a_value)
        l_values.append(float(1 - np.exp(-magnitude / 2.0)))
    result["C"], result["V"], result["A"], result["L"] = c_values, v_values, a_values, l_values
    result["D_reg"] = np.sqrt(result.C**2 + result.V**2 + result.A**2 + result.L**2)
    return result


def segment(windows: pd.DataFrame, cfg: Config) -> pd.DataFrame:
    result = windows.copy()
    scores = result.D_feature.to_numpy(float)
    episode_ids = np.zeros(len(result), dtype=int)
    active = False
    episode_id = enter_count = exit_count = 0
    for index, value in enumerate(scores):
        if not np.isfinite(value) or result.iloc[index].valid_window != 1:
            if active:
                episode_ids[index] = episode_id
            continue
        if not active:
            enter_count = enter_count + 1 if value >= cfg.tau_in else 0
            if enter_count >= cfg.enter_persistence_windows:
                active = True
                episode_id += 1
                start = index - cfg.enter_persistence_windows + 1
                episode_ids[start:index + 1] = episode_id
                exit_count = 0
        else:
            episode_ids[index] = episode_id
            exit_count = exit_count + 1 if value <= cfg.tau_out else 0
            if exit_count >= cfg.exit_persistence_windows:
                active = False
                enter_count = exit_count = 0
    result["episode_id"] = episode_ids
    result["phase"] = "baseline"
    result["R"] = 1.0
    result["dD_dt"] = result.D_feature.diff()
    for current_id in [value for value in sorted(result.episode_id.unique()) if value > 0]:
        indices = list(result.index[result.episode_id == current_id])
        values = result.loc[indices, "D_feature"].to_numpy(float)
        peak_index = indices[int(np.nanargmax(values))]
        peak = float(result.loc[peak_index, "D_feature"])
        for position, row_index in enumerate(indices):
            derivative = result.at[row_index, "dD_dt"]
            distance = result.at[row_index, "D_feature"]
            phase = "tau_in" if position == 0 else "peak" if row_index == peak_index else "rising" if row_index < peak_index else "plateau_persistent" if np.isfinite(derivative) and abs(derivative) <= cfg.plateau_derivative_tol and distance > cfg.tau_out else "falling"
            result.at[row_index, "phase"] = phase
        result.at[indices[-1], "phase"] = "tau_out"
        denominator = max(peak - cfg.tau_out, 1e-6)
        for row_index in indices:
            result.at[row_index, "R"] = 0.0 if row_index <= peak_index else float(np.clip((peak - result.at[row_index, "D_feature"]) / denominator, 0, 1))
    result["D_OP"] = np.sqrt(result.C**2 + result.V**2 + result.A**2 + result.L**2 + (result.R - 1.0) ** 2)
    result["dDOP_dt"] = result.D_OP.diff()
    result["d2DOP_dt2"] = result.dDOP_dt.diff()
    return result


def characterize(windows: pd.DataFrame, cfg: Config) -> pd.DataFrame:
    rows = []
    for episode_id in [value for value in sorted(windows.episode_id.unique()) if value > 0]:
        group = windows[windows.episode_id == episode_id].copy()
        peak_index = group.D_feature.idxmax()
        peak = windows.loc[peak_index]
        start = pd.to_datetime(group.window_start.iloc[0])
        peak_time = pd.to_datetime(peak.window_start)
        end = pd.to_datetime(group.window_start.iloc[-1])
        ttr = (end - peak_time).total_seconds() / 60
        duration = (end - start).total_seconds() / 60 + cfg.window_seconds / 60
        state = group[["C", "V", "A", "L", "R"]].to_numpy(float)
        path_length = float(np.nansum(np.linalg.norm(np.diff(state, axis=0), axis=1))) if len(state) > 1 else 0.0
        rows.append({
            "episode_id": int(episode_id),
            "activity_start": str(group.activity.iloc[0]),
            "start_tau_in": start.isoformat(),
            "peak_time": peak_time.isoformat(),
            "end_tau_out": end.isoformat(),
            "duration_min": duration,
            "TTP_min": (peak_time - start).total_seconds() / 60,
            "TTR_min": ttr,
            "Dmax_feature": float(group.D_feature.max()),
            "Dmax_OP": float(group.D_OP.max()),
            "D_residual": float(group.D_feature.iloc[-1]),
            "recovery_rate_per_min": max(0, (float(group.D_feature.max()) - float(group.D_feature.iloc[-1])) / ttr) if ttr > 0 else np.nan,
            "AUC_D": float(np.trapezoid(group.D_feature.to_numpy(float), (pd.to_datetime(group.window_start) - start).dt.total_seconds() / 60)),
            "L_OP_path_length": path_length,
            "trajectory_efficiency": float(np.linalg.norm(state[-1] - state[0]) / path_length) if path_length > 1e-9 else np.nan,
            "C_peak": float(peak.C), "V_peak": float(peak.V), "A_peak": float(peak.A), "L_peak": float(peak.L),
            "R_end": float(group.R.iloc[-1]), "relapse": 0,
        })
    episodes = pd.DataFrame(rows)
    if episodes.empty:
        return episodes
    for index in range(len(episodes) - 1):
        gap = (pd.to_datetime(episodes.loc[index + 1, "start_tau_in"]) - pd.to_datetime(episodes.loc[index, "end_tau_out"])).total_seconds() / 60
        if 0 <= gap <= cfg.relapse_window_minutes and episodes.loc[index, "activity_start"] == episodes.loc[index + 1, "activity_start"]:
            episodes.loc[index, "relapse"] = 1
    return episodes


def phenotype(episodes: pd.DataFrame, cfg: Config) -> dict[str, Any]:
    if episodes.empty:
        return {"phenotype": ["stable_or_no_detected_episode"], "n_episodes": 0}
    ttr = float(episodes.TTR_min.median())
    displacement = float(episodes.Dmax_feature.median())
    duration = float(episodes.duration_min.median())
    relapse = float(episodes.relapse.mean())
    labels = ["adaptive_fast_recovery" if ttr <= cfg.fast_recovery_min else "slow_recovery" if ttr >= cfg.slow_recovery_min else "intermediate_recovery"]
    if displacement >= cfg.high_displacement and ttr <= cfg.fast_recovery_min:
        labels.append("high_displacement_efficient_recovery")
    if duration >= cfg.sustained_episode_min:
        labels.append("sustained_operating_shift")
    if relapse > 0:
        labels.append("unstable_relapsing")
    return {"phenotype": labels, "n_episodes": int(len(episodes)), "median_TTR_min": ttr, "median_Dmax_feature": displacement, "median_duration_min": duration, "relapse_rate": relapse, "stability": 1 - relapse, "note": "Exploratory phenotype; calibrate thresholds on study data."}


def episode_bar_color(count: int, phenotype: Any = None) -> str:
    """Map episode burden to a consistent chart color.

    Semantics:
    - 0 episodes: stable / no detected episode
    - 1 episode: mild / moderate operating shift
    - >=2 episodes: sustained or unstable episode burden
    """
    if count <= 0:
        return "#16A34A"
    if count == 1:
        return "#F59E0B"
    label_text = " ".join(str(item) for item in (phenotype if isinstance(phenotype, (list, tuple, set)) else [phenotype])) if phenotype is not None else ""
    lowered = label_text.lower()
    if "sustained" in lowered or "unstable" in lowered or "relaps" in lowered:
        return "#DC2626"
    return "#7C3AED"


def save_plots(windows: pd.DataFrame, episodes: pd.DataFrame, outdir: Path, label: str, cfg: Config) -> None:
    figures = outdir / "figures"
    figures.mkdir(parents=True, exist_ok=True)
    safe_label = label.lower().replace(" ", "_")
    # Give dense daily windows enough horizontal space to remain readable.
    figure_width = max(16.0, min(42.0, 12.0 + len(windows) * 0.10))
    fig, axes = plt.subplots(2, 1, figsize=(figure_width, 9), sharex=True)
    axes[0].plot(windows.window_start, windows.hr_mean, color="#B91C1C", label="HR mean")
    axes[0].set_ylabel("HR (bpm)")
    axes[0].legend()
    axes[1].plot(windows.window_start, windows.D_feature, color="#7C3AED", label="D_feature")
    axes[1].plot(windows.window_start, windows.D_OP, color="#0D9488", label="D_OP")
    axes[1].axhline(cfg.tau_in, color="#DC2626", linestyle="--", label="tau_in")
    axes[1].axhline(cfg.tau_out, color="#F59E0B", linestyle="--", label="tau_out")
    axes[1].set_ylabel("Distance")
    axes[1].legend(ncol=4)
    fig.suptitle(f"CAPAR Operating Point - {label}")
    fig.tight_layout()
    fig.savefig(figures / f"{safe_label}_trajectory.png", dpi=160)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(figure_width, 7))
    for component, color in [("C", "#DC2626"), ("V", "#0D9488"), ("A", "#2563EB"), ("L", "#7C3AED"), ("R", "#16A34A")]:
        ax.plot(windows.window_start, windows[component], label=component, color=color)
    ax.set_title(f"CVALR State Trajectory - {label}")
    ax.set_ylabel("Proxy state")
    ax.legend(ncol=5)
    fig.tight_layout()
    fig.savefig(figures / f"{safe_label}_cvalr.png", dpi=160)
    plt.close(fig)


def load_from_mongo(uri: str, database: str, participant_names: list[str], cfg: Config, outdir: Path) -> dict[str, Any]:
    try:
        from pymongo import MongoClient
    except ImportError as exc:
        raise RuntimeError("Mongo mode membutuhkan pymongo. Install requirements_operating_point.txt") from exc
    client = MongoClient(uri, serverSelectionTimeoutMS=8000)
    client.admin.command("ping")
    db = client[database]
    (outdir / "figures").mkdir(parents=True, exist_ok=True)
    targets = resolve_targets(db, participant_names)
    daily_summaries = []
    comparison_rows = []
    for user in targets:
        user_id = user["_id"]
        label = str(user.get("name") or user.get("email") or user_id)
        raw_projection = {
            "timestamp": 1, "date_created": 1, "time_created": 1,
            "hr": 1, "rr": 1, "rrms": 1,
            "acc_x": 1, "acc_y": 1, "acc_z": 1, "ecg": 1,
            "activity": 1,
        }
        docs = list(db.polardatas.find({"user_id": user_id}, raw_projection).sort("timestamp", 1))
        all_windows = polar_data_to_windows(docs, cfg)
        if all_windows.empty:
            raise ValueError(f"Tidak ada segmen untuk {label}")
        participant_dir = outdir / label.lower().replace(" ", "_")
        participant_dir.mkdir(parents=True, exist_ok=True)
        all_windows["date"] = pd.to_datetime(all_windows["window_start"]).dt.strftime("%Y-%m-%d")
        for date, day_input in all_windows.groupby("date", sort=True):
            windows, baseline, covariances, features = build_baseline(day_input.drop(columns=["date"]), cfg)
            windows = add_states(windows, covariances, features)
            windows = segment(windows, cfg)
            episodes = characterize(windows, cfg)
            day_dir = participant_dir / date
            day_dir.mkdir(parents=True, exist_ok=True)
            windows.to_csv(day_dir / "windows_with_states.csv", index=False)
            baseline.to_csv(day_dir / "baseline_stats.csv", index=False)
            episodes.to_csv(day_dir / "episodes.csv", index=False)
            summary = {
                "participant": label,
                "user_id": str(user_id),
                "date": date,
                "source": "polardatas",
                "n_raw_samples": int(day_input.n_samples.sum()),
                "n_windows": len(windows),
                "n_valid_windows": int(windows.valid_window.sum()),
                "n_episodes": len(episodes),
                "phenotype": phenotype(episodes, cfg),
                "warning": "Daily CVALR are model-derived proxies; validate weights and thresholds.",
            }
            (day_dir / "summary.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
            save_plots(windows, episodes, day_dir, f"{label} {date}", cfg)
            daily_summaries.append(summary)
            comparison_row = {
                "participant": label,
                "user_id": str(user_id),
                "date": date,
                "source": "polardatas",
                "n_raw_samples": int(day_input.n_samples.sum()),
                "n_valid_windows": int(windows.valid_window.sum()),
                "n_episodes": len(episodes),
            }
            if episodes.empty:
                comparison_row.update({
                    "phenotype": summary["phenotype"]["phenotype"],
                    "median_TTR_min": None,
                    "median_Dmax_feature": None,
                    "median_duration_min": None,
                    "relapse_rate": None,
                    "stability": None,
                })
            else:
                comparison_row.update(summary["phenotype"])
            comparison_rows.append(comparison_row)
    comparison = pd.DataFrame(comparison_rows)
    comparison.to_csv(outdir / "participant_comparison.csv", index=False)
    comparison_records = json.loads(comparison.to_json(orient="records"))
    (outdir / "daily_summary.json").write_text(json.dumps({"config": asdict(cfg), "days": daily_summaries, "comparison": comparison_records}, indent=2, ensure_ascii=False), encoding="utf-8")
    if len(comparison_rows) > 0:
        fig, ax = plt.subplots(figsize=(max(10, len(comparison) * 0.85), 6))
        labels = comparison["participant"] + "\n" + comparison["date"]
        colors = [
            episode_bar_color(int(count), phenotype)
            for count, phenotype in zip(comparison["n_episodes"], comparison.get("phenotype", [None] * len(comparison)))
        ]
        bars = ax.bar(range(len(labels)), comparison["n_episodes"], color=colors)
        ax.set_xticks(range(len(labels)), labels, rotation=45, ha="right", fontsize=8)
        ax.set_title("Detected CAPAR Episodes by Participant and Day")
        ax.set_ylabel("Episode count")
        legend_handles = [
            plt.Rectangle((0, 0), 1, 1, color="#16A34A"),
            plt.Rectangle((0, 0), 1, 1, color="#F59E0B"),
            plt.Rectangle((0, 0), 1, 1, color="#7C3AED"),
            plt.Rectangle((0, 0), 1, 1, color="#DC2626"),
        ]
        legend_labels = ["Stable / no episode", "Mild episode", "Moderate burden", "Sustained / unstable"]
        ax.legend(legend_handles, legend_labels, loc="upper right", frameon=False, fontsize=8)
        fig.tight_layout()
        fig.savefig(outdir / "figures" / "participant_episode_comparison.png", dpi=160)
        plt.close(fig)
    client.close()
    return {"days": daily_summaries, "comparison": comparison_records}


def main() -> None:
    parser = argparse.ArgumentParser(description="CAPAR operating-point simulation for MongoDB participants")
    parser.add_argument("--mongo", action="store_true", help="Read segments from MongoDB")
    parser.add_argument("--mongo-uri", default=os.getenv("MONGO_URI") or os.getenv("MONGO") or "mongodb://127.0.0.1:27017/test")
    parser.add_argument("--database", default=os.getenv("MONGO_DATABASE", "test"))
    parser.add_argument("--participants", nargs="+", default=["Peserta 0", "Peserta 22", "Peserta 23"])
    parser.add_argument("--outdir", type=Path, default=Path("simulation/capar_operating_point_results"))
    parser.add_argument("--tau-in", type=float, default=1.80)
    parser.add_argument("--tau-out", type=float, default=1.00)
    args = parser.parse_args()
    if args.tau_out >= args.tau_in:
        raise ValueError("tau_out must be < tau_in")
    cfg = Config(tau_in=args.tau_in, tau_out=args.tau_out)
    if not args.mongo:
        raise ValueError("Gunakan --mongo untuk mengambil data peserta dari MongoDB")
    result = load_from_mongo(args.mongo_uri, args.database, args.participants, cfg, args.outdir)
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
