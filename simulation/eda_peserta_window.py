#!/usr/bin/env python3
"""EDA lokal untuk window PolarData satu peserta; tidak mengunggah data."""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any

try:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.dates as mdates
    import matplotlib.pyplot as plt
    import numpy as np
    import pandas as pd
    from bson import ObjectId
    from pymongo import MongoClient
except ImportError as exc:
    missing = getattr(exc, "name", None) or str(exc)
    raise SystemExit(
        f"Dependensi belum tersedia ({missing}). "
        "Install dengan: pip install -r simulation/requirements_eda.txt"
    ) from exc


JAKARTA = timezone(timedelta(hours=7), name="WIB")
DEFAULT_USER_ID = "6a8f9fab74156d89d1dc3c47"
DEFAULT_START = "08:00"
DEFAULT_END = "09:30"
DEFAULT_DATABASE = "test"
DEFAULT_COLLECTION = "polardatas"
NUMERIC_FIELDS = (
    "hr",
    "rr",
    "rrms",
    "acc_x",
    "acc_y",
    "acc_z",
    "step_count",
)


def parse_clock(value: str) -> time:
    try:
        return datetime.strptime(value, "%H:%M").time()
    except ValueError as exc:
        raise argparse.ArgumentTypeError(
            f"Waktu '{value}' harus menggunakan format HH:MM."
        ) from exc


def parse_timestamp(value: Any) -> datetime | None:
    """Normalize supported Mongo timestamp shapes to timezone-aware UTC."""
    if isinstance(value, datetime):
        parsed = value
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)

    if isinstance(value, (int, float)) and np.isfinite(value):
        epoch = float(value)
        if abs(epoch) >= 1e11:
            epoch /= 1000
        try:
            return datetime.fromtimestamp(epoch, tz=timezone.utc)
        except (OverflowError, OSError, ValueError):
            return None

    if isinstance(value, str) and value.strip():
        try:
            parsed = pd.Timestamp(value).to_pydatetime()
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=JAKARTA)
            return parsed.astimezone(timezone.utc)
        except (ValueError, TypeError, OverflowError):
            return None
    return None


def local_datetime(day: date, clock: time) -> datetime:
    return datetime.combine(day, clock, tzinfo=JAKARTA)


def make_query(user_id: ObjectId, start: datetime, end: datetime) -> dict:
    start_seconds = start.timestamp()
    end_seconds = end.timestamp()
    start_milliseconds = start_seconds * 1000
    end_milliseconds = end_seconds * 1000
    return {
        "user_id": user_id,
        "$or": [
            {
                "timestamp": {
                    "$gte": start_seconds,
                    "$lt": end_seconds,
                }
            },
            {
                "timestamp": {
                    "$gte": start_milliseconds,
                    "$lt": end_milliseconds,
                }
            },
            {
                "createdAt": {
                    "$gte": start.astimezone(timezone.utc),
                    "$lt": end.astimezone(timezone.utc),
                }
            },
        ],
    }


def document_timestamp(document: dict) -> datetime | None:
    value = parse_timestamp(document.get("timestamp"))
    if value is not None:
        return value

    value = parse_timestamp(document.get("createdAt"))
    if value is not None:
        return value

    date_text = document.get("date_created")
    time_text = document.get("time_created")
    if not isinstance(date_text, str) or not date_text.strip():
        return None
    candidates = []
    if isinstance(time_text, str) and time_text.strip():
        candidates.extend(
            [
                f"{date_text} {time_text}",
                f"{time_text} {date_text}",
            ]
        )
    candidates.append(date_text)
    for candidate in candidates:
        for day_first in (True, False):
            try:
                parsed = pd.to_datetime(
                    candidate,
                    dayfirst=day_first,
                    errors="raise",
                ).to_pydatetime()
                if parsed.tzinfo is None:
                    parsed = parsed.replace(tzinfo=JAKARTA)
                return parsed.astimezone(timezone.utc)
            except (ValueError, TypeError, OverflowError):
                continue
    return None


def documents_to_frame(documents: list[dict], start: datetime, end: datetime) -> pd.DataFrame:
    rows = []
    start_utc = start.astimezone(timezone.utc)
    end_utc = end.astimezone(timezone.utc)
    for document in documents:
        recorded_at = document_timestamp(document)
        if recorded_at is None or not start_utc <= recorded_at < end_utc:
            continue
        row = {
            "recorded_at_utc": recorded_at,
            "recorded_at_wib": recorded_at.astimezone(JAKARTA),
            "activity": document.get("activity") or "Tidak diketahui",
            "process_status": document.get("processStatus"),
            "device_id": document.get("device_id"),
            "mongo_id": str(document.get("_id", "")),
        }
        for field in NUMERIC_FIELDS:
            value = document.get(field)
            row[field] = (
                float(value)
                if isinstance(value, (int, float)) and np.isfinite(value)
                else np.nan
            )
        rows.append(row)
    frame = pd.DataFrame(rows)
    if frame.empty:
        return frame
    return frame.sort_values("recorded_at_wib").reset_index(drop=True)


def _metric_summary(frame: pd.DataFrame) -> dict:
    summary = {}
    for field in NUMERIC_FIELDS:
        values = frame[field].dropna()
        if values.empty:
            summary[field] = {
                "n": 0,
                "mean": None,
                "std": None,
                "median": None,
                "min": None,
                "max": None,
            }
            continue
        summary[field] = {
            "n": int(values.size),
            "mean": float(values.mean()),
            "std": float(values.std()) if values.size > 1 else None,
            "median": float(values.median()),
            "min": float(values.min()),
            "max": float(values.max()),
        }
    return summary


def _sampling_summary(frame: pd.DataFrame) -> dict:
    if len(frame) < 2:
        return {
            "interval_count": 0,
            "median_interval_seconds": None,
            "p95_interval_seconds": None,
            "gaps_over_30_seconds": 0,
            "duplicate_timestamps": 0,
        }
    intervals = (
        frame["recorded_at_wib"]
        .sort_values()
        .diff()
        .dt.total_seconds()
        .dropna()
    )
    return {
        "interval_count": int(intervals.size),
        "median_interval_seconds": float(intervals.median()),
        "p95_interval_seconds": float(intervals.quantile(0.95)),
        "gaps_over_30_seconds": int((intervals > 30).sum()),
        "duplicate_timestamps": int(
            frame["recorded_at_wib"].duplicated(keep=False).sum()
        ),
    }


def _derived_rmssd_by_minute(frame: pd.DataFrame) -> pd.DataFrame:
    if frame.empty:
        return pd.DataFrame(columns=["minute", "rmssd"])
    work = frame[["recorded_at_wib", "rr"]].dropna().copy()
    work["minute"] = work["recorded_at_wib"].dt.floor("1min")
    rows = []
    for minute, group in work.groupby("minute", sort=True):
        differences = group.sort_values("recorded_at_wib")["rr"].diff().dropna()
        if differences.empty:
            continue
        rows.append({
            "minute": minute,
            "rmssd": float(np.sqrt(np.square(differences).mean())),
        })
    return pd.DataFrame(rows, columns=["minute", "rmssd"])


def build_report(
    frame: pd.DataFrame,
    user_id: str,
    start: datetime,
    end: datetime,
    fetched_count: int,
) -> dict:
    wib_times = frame["recorded_at_wib"] if not frame.empty else pd.Series(dtype=object)
    derived_rmssd = _derived_rmssd_by_minute(frame)
    derived_values = derived_rmssd["rmssd"] if not derived_rmssd.empty else pd.Series(dtype=float)
    return {
        "participant_id": f"{user_id[:8]}…",
        "timezone": "Asia/Jakarta (UTC+07:00)",
        "window_start": start.isoformat(),
        "window_end_exclusive": end.isoformat(),
        "source": f"{DEFAULT_DATABASE}.{DEFAULT_COLLECTION}",
        "documents_fetched_by_query": fetched_count,
        "documents_in_window": int(len(frame)),
        "window_first_record": wib_times.min().isoformat() if len(wib_times) else None,
        "window_last_record": wib_times.max().isoformat() if len(wib_times) else None,
        "missing_values": (
            {field: int(frame[field].isna().sum()) for field in NUMERIC_FIELDS}
            if not frame.empty
            else {field: 0 for field in NUMERIC_FIELDS}
        ),
        "activity_counts": (
            {str(key): int(value) for key, value in frame["activity"].value_counts().items()}
            if not frame.empty
            else {}
        ),
        "process_status_counts": (
            {
                str(key): int(value)
                for key, value in frame["process_status"]
                .fillna("Tidak diketahui")
                .value_counts()
                .items()
            }
            if not frame.empty
            else {}
        ),
        "metrics": _metric_summary(frame) if not frame.empty else {},
        "derived_rmssd_from_rr": {
            "method": "RMSSD of adjacent RR intervals within each minute",
            "valid_minutes": int(derived_values.size),
            "mean": float(derived_values.mean()) if not derived_values.empty else None,
            "median": float(derived_values.median()) if not derived_values.empty else None,
            "min": float(derived_values.min()) if not derived_values.empty else None,
            "max": float(derived_values.max()) if not derived_values.empty else None,
            "note": "Nilai turunan untuk EDA; tidak menggantikan rrms yang tersimpan.",
        },
        "sampling": _sampling_summary(frame),
        "quality_flags": (
            {
                "hr_outside_model_range_30_220": int(
                    ((frame["hr"] < 30) | (frame["hr"] > 220)).sum()
                ),
                "rr_outside_model_range_300_2000": int(
                    ((frame["rr"] < 300) | (frame["rr"] > 2000)).sum()
                ),
                "hr_iqr_outliers_descriptive_only": _iqr_outlier_count(frame["hr"]),
                "rr_iqr_outliers_descriptive_only": _iqr_outlier_count(frame["rr"]),
            }
            if not frame.empty
            else {}
        ),
        "interpretation_note": (
            "EDA deskriptif untuk pemeriksaan data; penanda rentang/IQR bukan "
            "diagnosis atau kesimpulan klinis."
        ),
    }


def _iqr_outlier_count(values: pd.Series) -> int:
    clean = values.dropna()
    if len(clean) < 4:
        return 0
    q1 = clean.quantile(0.25)
    q3 = clean.quantile(0.75)
    iqr = q3 - q1
    return int(((clean < q1 - 1.5 * iqr) | (clean > q3 + 1.5 * iqr)).sum())


def _save_empty_plot(path: Path, title: str, message: str) -> None:
    fig, ax = plt.subplots(figsize=(11, 4))
    ax.text(0.5, 0.5, message, ha="center", va="center", transform=ax.transAxes)
    ax.set_title(title)
    ax.set_axis_off()
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)


def create_plots(frame: pd.DataFrame, output_dir: Path, participant_label: str) -> list[str]:
    plt.style.use("seaborn-v0_8-whitegrid")
    created = []
    if frame.empty:
        for filename, title in (
            ("01_timeseries.png", "Tren metrik wearable"),
            ("02_distributions.png", "Distribusi metrik"),
            ("03_activity_quality.png", "Aktivitas dan kelengkapan data"),
        ):
            path = output_dir / filename
            _save_empty_plot(
                path,
                title,
                "Tidak ada data pada rentang waktu yang dipilih.",
            )
            created.append(filename)
        return created

    work = frame.copy()
    work["minute"] = work["recorded_at_wib"].dt.floor("1min")
    minute = (
        work.groupby("minute", as_index=False)
        .agg(
            hr=("hr", "mean"),
            rr=("rr", "mean"),
            rrms=("rrms", "mean"),
            step_count=("step_count", "max"),
        )
        .sort_values("minute")
    )
    derived_rmssd = _derived_rmssd_by_minute(work)
    minute = minute.merge(derived_rmssd, on="minute", how="left")

    fig, axes = plt.subplots(3, 1, figsize=(13, 10), sharex=True)
    for axis, field, color, label in (
        (axes[0], "hr", "#C0392B", "HR rerata / menit (bpm)"),
        (axes[1], "rr", "#2471A3", "RR interval rerata / menit (ms)"),
        (axes[2], "rmssd", "#148F77", "RMSSD turunan / menit (ms)"),
    ):
        values = minute[field].dropna()
        if values.empty:
            axis.text(
                0.5,
                0.5,
                "Tidak ada data tersedia",
                ha="center",
                va="center",
                transform=axis.transAxes,
            )
        else:
            axis.plot(minute["minute"], minute[field], color=color, linewidth=1.5)
            axis.scatter(minute["minute"], minute[field], color=color, s=12, alpha=0.55)
        axis.set_ylabel(label)
        axis.grid(True, alpha=0.3)
    axes[-1].xaxis.set_major_formatter(mdates.DateFormatter("%H:%M", tz=JAKARTA))
    axes[-1].set_xlabel("Waktu (WIB)")
    fig.suptitle(f"Tren metrik wearable · Peserta {participant_label}")
    fig.tight_layout()
    fig.savefig(output_dir / "01_timeseries.png", dpi=160)
    plt.close(fig)
    created.append("01_timeseries.png")

    fig, axes = plt.subplots(1, 3, figsize=(13, 4.5))
    metric_values = [
        (frame["hr"].dropna(), "HR (bpm)"),
        (frame["rr"].dropna(), "RR (ms)"),
        (derived_rmssd["rmssd"], "RMSSD turunan (ms)"),
    ]
    for axis, (values, label) in zip(axes, metric_values):
        values = values.dropna()
        if values.empty:
            axis.text(0.5, 0.5, "Tidak ada nilai", ha="center", va="center")
        else:
            axis.hist(values, bins="auto", color="#3B82A0", alpha=0.82, edgecolor="white")
            axis.axvline(values.median(), color="#C0392B", linestyle="--", label="Median")
            axis.legend()
        axis.set_title(label)
        axis.set_ylabel("Jumlah")
    fig.suptitle("Distribusi metrik · bukan penilaian klinis")
    fig.tight_layout()
    fig.savefig(output_dir / "02_distributions.png", dpi=160)
    plt.close(fig)
    created.append("02_distributions.png")

    activity_counts = frame["activity"].value_counts()
    missing_counts = frame[list(NUMERIC_FIELDS)].isna().sum().sort_values(ascending=False)
    fig, axes = plt.subplots(1, 2, figsize=(13, 4.5))
    if activity_counts.empty:
        axes[0].text(0.5, 0.5, "Tidak ada label aktivitas", ha="center", va="center")
    else:
        activity_counts.sort_values().plot.barh(ax=axes[0], color="#5DADE2")
        axes[0].set_xlabel("Jumlah bacaan")
        axes[0].set_ylabel("")
    axes[0].set_title("Distribusi label aktivitas")
    axes[1].bar(missing_counts.index, missing_counts.values, color="#F5B041")
    axes[1].set_title("Nilai kosong per kolom")
    axes[1].set_ylabel("Jumlah kosong")
    axes[1].tick_params(axis="x", labelrotation=35)
    fig.suptitle("Konteks dan kelengkapan data")
    fig.tight_layout()
    fig.savefig(output_dir / "03_activity_quality.png", dpi=160)
    plt.close(fig)
    created.append("03_activity_quality.png")
    return created


def fetch_documents(
    mongo_uri: str,
    database: str,
    collection_name: str,
    user_id: str,
    start: datetime,
    end: datetime,
    timeout_ms: int,
) -> list[dict]:
    client = MongoClient(
        mongo_uri,
        serverSelectionTimeoutMS=timeout_ms,
        connectTimeoutMS=timeout_ms,
        appname="local-participant-window-eda",
    )
    try:
        client.admin.command("ping")
        collection = client[database][collection_name]
        query = make_query(ObjectId(user_id), start, end)
        projection = {
            "_id": 1,
            "timestamp": 1,
            "createdAt": 1,
            "date_created": 1,
            "time_created": 1,
            "activity": 1,
            "processStatus": 1,
            "device_id": 1,
            **{field: 1 for field in NUMERIC_FIELDS},
        }
        return list(collection.find(query, projection).sort("timestamp", 1))
    finally:
        client.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Ambil dan visualisasikan PolarData peserta dalam rentang WIB. "
            "Mongo URI dibaca dari SIM_MONGO_URI atau MONGO_URI."
        )
    )
    parser.add_argument("--user-id", default=DEFAULT_USER_ID)
    parser.add_argument(
        "--date",
        type=date.fromisoformat,
        default=datetime.now(JAKARTA).date(),
    )
    parser.add_argument("--start", type=parse_clock, default=parse_clock(DEFAULT_START))
    parser.add_argument("--end", type=parse_clock, default=parse_clock(DEFAULT_END))
    parser.add_argument("--database", default=os.getenv("SIM_MONGO_DATABASE", DEFAULT_DATABASE))
    parser.add_argument(
        "--collection",
        default=os.getenv("SIM_MONGO_COLLECTION", DEFAULT_COLLECTION),
    )
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--timeout-ms", type=int, default=8000)
    parser.add_argument(
        "--export-csv",
        action="store_true",
        help="Simpan baris wearable per bacaan ke CSV lokal (data kesehatan sensitif).",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not ObjectId.is_valid(args.user_id):
        print("Error: --user-id harus berupa Mongo ObjectId yang valid.", file=sys.stderr)
        return 2
    if args.end <= args.start:
        print("Error: --end harus lebih akhir daripada --start pada tanggal yang sama.", file=sys.stderr)
        return 2

    mongo_uri = os.getenv("SIM_MONGO_URI") or os.getenv("MONGO_URI")
    if not mongo_uri:
        print(
            "Error: Mongo URI belum diatur. Set SIM_MONGO_URI atau MONGO_URI "
            "di environment; jangan tulis kredensial ke source code.",
            file=sys.stderr,
        )
        return 2

    start = local_datetime(args.date, args.start)
    end = local_datetime(args.date, args.end)
    output_dir = args.output_dir or (
        Path(__file__).resolve().parent
        / "outputs"
        / f"eda_{args.user_id[:8]}_{args.date:%Y%m%d}_{args.start:%H%M}_{args.end:%H%M}"
    )
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        documents = fetch_documents(
            mongo_uri,
            args.database,
            args.collection,
            args.user_id,
            start,
            end,
            args.timeout_ms,
        )
    except Exception as exc:
        print(
            f"Error MongoDB ({type(exc).__name__}). "
            "Periksa SIM_MONGO_URI, SSH tunnel, dan akses database. "
            "Detail koneksi sengaja tidak dicetak agar kredensial tidak bocor.",
            file=sys.stderr,
        )
        return 1

    frame = documents_to_frame(documents, start, end)
    report = build_report(frame, args.user_id, start, end, len(documents))
    report["plots"] = create_plots(frame, output_dir, args.user_id[:8])

    report_path = output_dir / "eda_summary.json"
    report_path.write_text(
        json.dumps(report, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    if args.export_csv and not frame.empty:
        csv_path = output_dir / "wearable_readings_sensitive.csv"
        frame.to_csv(csv_path, index=False)
        print(f"CSV bacaan individual sensitif tersimpan lokal: {csv_path}")

    print(f"Rentang: {start.isoformat()} sampai {end.isoformat()} (akhir eksklusif)")
    print(f"Data dalam window: {len(frame)} bacaan")
    print(f"Ringkasan: {report_path}")
    for plot in report["plots"]:
        print(f"Grafik: {output_dir / plot}")
    if frame.empty:
        print(
            "Tidak ada data pada window ini. Periksa timezone, tanggal, "
            "koleksi, dan format timestamp."
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
