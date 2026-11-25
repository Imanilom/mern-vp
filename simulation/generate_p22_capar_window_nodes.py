import argparse
from collections import defaultdict
from datetime import datetime, timedelta, timezone
import os
from pathlib import Path
import re

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D
from pymongo import MongoClient
from bson import ObjectId


ROOT = Path(__file__).resolve().parents[1]
USER_ID = "6a8f9fab74156d89d1dc3c47"
OUTPUT = Path(__file__).resolve().parent / "p22_capar_window_nodes_live.png"
LOCAL_TZ = timezone(timedelta(hours=7))
MAX_NODES_PER_ROW = 25

COLORS = {
    "valid": "#42c9a5",
    "invalid": "#ffbd4a",
    "connector": "#47617a",
    "text": "#d7e3ef",
    "muted": "#91a6ba",
    "background": "#101b28",
    "row": "#152333",
}


def load_mongo_uri():
    if os.environ.get("MONGO"):
        return os.environ["MONGO"]

    env_file = ROOT / "api" / ".env"
    if not env_file.is_file():
        raise FileNotFoundError("MongoDB URI is not set and api/.env was not found.")

    for line in env_file.read_text(encoding="utf-8-sig").splitlines():
        key, separator, value = line.partition("=")
        if separator and key.strip() == "MONGO":
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
                value = value[1:-1]
            if value:
                return value

    raise RuntimeError("MONGO is not configured in api/.env.")


def epoch_milliseconds(value):
    timestamp = float(value)
    if abs(timestamp) < 100_000_000_000:
        timestamp *= 1000
    return int(timestamp)


def get_windows():
    client = MongoClient(load_mongo_uri(), serverSelectionTimeoutMS=8000)
    try:
        client.admin.command("ping")
        database = client.get_default_database()
        if database is None:
            database = client["test"]
        rows = list(database["segments"].find(
            {"user_id": ObjectId(USER_ID)},
            {
                "_id": 0,
                "window_start": 1,
                "window_type": 1,
                "is_valid": 1,
                "classification": 1,
                "anomaly_score": 1,
                "activity_label": 1,
                "features.mean_hr": 1,
                "features.mean_rr": 1,
                "features.motion_intensity": 1,
            },
        ))
    finally:
        client.close()

    for row in rows:
        row["timestamp_ms"] = epoch_milliseconds(row["window_start"])
        row["datetime"] = datetime.fromtimestamp(
            row["timestamp_ms"] / 1000,
            tz=LOCAL_TZ,
        )
    return sorted(rows, key=lambda row: row["timestamp_ms"])


def metric_text(value, digits=0):
    if value is None:
        return "—"
    try:
        return f"{float(value):.{digits}f}"
    except (TypeError, ValueError):
        return "—"


def activity_for(row):
    return str(row.get("activity_label") or "Unknown")


def draw_graph(rows, selected_activity=None, output_path=OUTPUT):
    if not rows:
        raise RuntimeError(f"No CAPAR windows found for P22 ({USER_ID}).")

    windows_by_day = defaultdict(list)
    for row in rows:
        windows_by_day[row["datetime"].date()].append(row)

    days = sorted(windows_by_day)
    valid_count = sum(row.get("is_valid") is True for row in rows)
    invalid_count = len(rows) - valid_count
    graph_rows = []
    for day in days:
        day_windows = windows_by_day[day]
        chunk_count = (len(day_windows) + MAX_NODES_PER_ROW - 1) // MAX_NODES_PER_ROW
        for start in range(0, len(day_windows), MAX_NODES_PER_ROW):
            graph_rows.append((
                day,
                day_windows,
                start,
                day_windows[start:start + MAX_NODES_PER_ROW],
                chunk_count,
            ))
    figure_height = max(6.5, 1.45 * len(graph_rows) + 2.4)

    plt.rcParams.update({
        "font.family": "DejaVu Sans",
        "font.size": 8,
        "text.color": COLORS["text"],
        "axes.labelcolor": COLORS["text"],
        "xtick.color": COLORS["muted"],
        "ytick.color": COLORS["muted"],
        "figure.facecolor": COLORS["background"],
        "axes.facecolor": COLORS["row"],
    })
    fig, axes = plt.subplots(
        len(graph_rows),
        1,
        figsize=(24, figure_height),
        squeeze=False,
    )
    fig.suptitle(
        "CAPAR WINDOW NODE GRAPH — P22"
        + (f" — AKTIVITAS: {selected_activity.upper()}" if selected_activity else ""),
        x=0.12,
        y=0.99,
        ha="left",
        color="#f0f6fc",
        fontsize=19,
        fontweight="bold",
    )
    first_day = days[0].isoformat()
    last_day = days[-1].isoformat()
    fig.text(
        0.12,
        0.94,
        f"ID {USER_ID}  |  {len(rows)} window  |  "
        f"{valid_count} valid  |  {invalid_count} invalid  |  "
        f"{first_day} s.d. {last_day}  |  "
        f"{'filter: ' + selected_activity + '  |  ' if selected_activity else 'semua aktivitas  |  '}"
        "data MongoDB lokal",
        color=COLORS["muted"],
        fontsize=9,
    )

    for axis, graph_row in zip(axes[:, 0], graph_rows):
        day, day_windows, start, windows, chunk_count = graph_row
        count = len(windows)
        x_offset = (MAX_NODES_PER_ROW - count) / 2
        x_positions = [x_offset + index for index in range(count)]

        for index in range(count - 1):
            axis.annotate(
                "",
                xy=(x_positions[index + 1] - 0.21, 0.12),
                xytext=(x_positions[index] + 0.21, 0.12),
                arrowprops={
                    "arrowstyle": "->",
                    "color": COLORS["connector"],
                    "linewidth": 0.75,
                    "shrinkA": 0,
                    "shrinkB": 0,
                },
                zorder=1,
            )

        for index, row in enumerate(windows):
            is_valid = row.get("is_valid") is True
            color = COLORS["valid"] if is_valid else COLORS["invalid"]
            x = x_positions[index]
            node_index = start + index + 1
            axis.scatter(
                [x],
                [0.12],
                s=185,
                facecolor=color,
                edgecolor="#e8f1f8",
                linewidth=0.65,
                zorder=2,
            )
            axis.text(
                x,
                0.12,
                f"W{node_index:02d}",
                ha="center",
                va="center",
                color="#10202b",
                fontsize=5.2,
                fontweight="bold",
                zorder=3,
            )
            axis.text(
                x,
                -0.12,
                row["datetime"].strftime("%H:%M"),
                ha="center",
                va="top",
                color=COLORS["text"],
                fontsize=5.0,
            )
            features = row.get("features", {})
            hr = metric_text(features.get("mean_hr"))
            rr = metric_text(features.get("mean_rr"))
            acc = metric_text(features.get("motion_intensity"), digits=2)
            activity = activity_for(row)
            axis.text(
                x,
                -0.27,
                f"HR {hr} · RR {rr}",
                ha="center",
                va="top",
                color=COLORS["muted"],
                fontsize=4.8,
            )
            axis.text(
                x,
                -0.42,
                f"ACC {acc} · Akt {activity}",
                ha="center",
                va="top",
                color=COLORS["muted"],
                fontsize=4.6,
            )

        axis.set_xlim(-0.65, MAX_NODES_PER_ROW - 0.35)
        axis.set_ylim(-0.58, 0.47)
        axis.axis("off")
        day_valid_count = sum(row.get("is_valid") is True for row in day_windows)
        day_label = (
            f"{day.isoformat()}\n"
            f"{len(day_windows)} window · {day_valid_count} valid"
        )
        if chunk_count > 1:
            day_label += f"\nW{start + 1:02d}–W{start + count:02d}"
        axis.text(
            -0.025,
            0.5,
            day_label,
            transform=axis.transAxes,
            ha="right",
            va="center",
            color=COLORS["text"],
            fontsize=7,
            fontweight="bold",
            clip_on=False,
        )

    legend = [
        Line2D(
            [0], [0],
            marker="o",
            linestyle="",
            markerfacecolor=COLORS["valid"],
            markeredgecolor="#e8f1f8",
            markersize=8,
            label="Window valid",
        ),
        Line2D(
            [0], [0],
            marker="o",
            linestyle="",
            markerfacecolor=COLORS["invalid"],
            markeredgecolor="#e8f1f8",
            markersize=8,
            label="Window tidak valid",
        ),
        Line2D(
            [0], [0],
            color=COLORS["connector"],
            marker=">",
            markersize=5,
            label="Urutan waktu",
        ),
    ]
    fig.legend(
        handles=legend,
        loc="lower center",
        ncol=3,
        frameon=False,
        bbox_to_anchor=(0.56, 0.015),
        fontsize=8,
    )
    fig.text(
        0.12,
        0.018,
        "HR=mean_hr (bpm) · RR=mean_rr (ms) · ACC=motion_intensity · "
        "Akt=activity_label · warna menunjukkan is_valid, bukan status diagnosis.",
        color=COLORS["muted"],
        fontsize=7,
    )
    fig.subplots_adjust(
        left=0.12,
        right=0.99,
        top=0.89,
        bottom=0.065,
        hspace=0.55,
    )
    fig.savefig(output_path, dpi=180, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)


def main():
    parser = argparse.ArgumentParser(
        description="Generate a chronological CAPAR window-node graph for P22."
    )
    parser.add_argument(
        "--activity",
        help="Keep only windows whose activity_label matches this value.",
    )
    parser.add_argument(
        "--list-activities",
        action="store_true",
        help="List activity labels and window counts available in MongoDB.",
    )
    args = parser.parse_args()

    rows = get_windows()
    if args.list_activities:
        counts = defaultdict(list)
        for row in rows:
            counts[activity_for(row)].append(row)
        for activity, activity_rows in sorted(counts.items()):
            valid = sum(row.get("is_valid") is True for row in activity_rows)
            print(f"{activity}: {len(activity_rows)} windows, {valid} valid")
        return

    selected_activity = None
    if args.activity:
        available = {activity_for(row) for row in rows}
        selected_activity = next(
            (
                activity
                for activity in available
                if activity.casefold() == args.activity.strip().casefold()
            ),
            None,
        )
        if selected_activity is None:
            choices = ", ".join(sorted(available)) or "(none)"
            raise SystemExit(
                f"Activity '{args.activity}' not found. Available activities: {choices}"
            )
        rows = [row for row in rows if activity_for(row) == selected_activity]
        slug = re.sub(r"[^a-z0-9]+", "_", selected_activity.casefold()).strip("_")
        output_path = OUTPUT.with_name(f"p22_capar_window_nodes_{slug}.png")
    else:
        output_path = OUTPUT

    draw_graph(rows, selected_activity, output_path)
    valid_count = sum(row.get("is_valid") is True for row in rows)
    label = f"activity={selected_activity}, " if selected_activity else "all activities, "
    print(f"Saved {output_path.name}: {label}{len(rows)} windows, {valid_count} valid.")


if __name__ == "__main__":
    main()
