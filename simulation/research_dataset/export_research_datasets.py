#!/usr/bin/env python3
"""Export available local records into research-ready CSV datasets.

Missing measurements and unverified labels are kept empty; this exporter does
not synthesize RR intervals, activity transitions, baselines, or ground truth.
"""

from __future__ import annotations

import argparse
import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = Path(__file__).resolve().parent / "output"


def read_csv(path: Path, delimiter: str = ",") -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as source:
        return list(csv.DictReader(source, delimiter=delimiter))


def parse_json(value: str | None) -> dict[str, Any]:
    if not value:
        return {}
    try:
        parsed = json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def write_csv(path: Path, columns: list[str], rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as target:
        writer = csv.DictWriter(target, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def anonymized_ids(values: set[str], prefix: str) -> dict[str, str]:
    return {
        value: f"{prefix}{index:05d}"
        for index, value in enumerate(sorted(value for value in values if value), 1)
    }


def normalize_raw_timestamp(date: str, time: str) -> str:
    if not date or not time:
        return ""
    try:
        parsed_date = datetime.strptime(date, "%d/%m/%Y").date()
    except ValueError:
        return f"{date}T{time}"
    return f"{parsed_date.isoformat()}T{time}"


def event_rows(rows: list[dict[str, str]], source: str) -> list[dict[str, str]]:
    return [row for row in rows if row.get("source") == source]


def export(output: Path) -> dict[str, int]:
    events = read_csv(ROOT / "simulation" / "events.csv")
    episodes = read_csv(ROOT / "simulation" / "episodes.csv")
    raw_samples = read_csv(ROOT / "data" / "data.csv", delimiter=";")

    episode_ids = anonymized_ids(
        {row.get("episode_id", "") for row in episodes}, "E"
    )
    run_ids = anonymized_ids(
        {
            row.get("run_id", "")
            for row in events
            if row.get("source") == "patient_hil_scenario_logs"
        },
        "R",
    )
    raw_participant_ids = anonymized_ids(
        {row.get("guid_device", "") for row in raw_samples}, "RAW"
    )

    physiology = []
    for row in event_rows(events, "segments"):
        evidence = parse_json(row.get("evidence_json"))
        features = evidence.get("features") or {}
        quality = evidence.get("quality") or {}
        physiology.append(
            {
                "participant_id": row.get("participant_id", ""),
                "episode_id": episode_ids.get(row.get("episode_id", ""), ""),
                "timestamp": row.get("timestamp", ""),
                "window_end": evidence.get("window_end", ""),
                "HR_bpm": features.get("mean_hr", row.get("heart_rate_bpm", "")),
                "mean_RR_ms": features.get("mean_rr", ""),
                "RR_interval_ms": "",
                "ACC_intensity": features.get("motion_intensity", ""),
                "ACC_raw": "",
                "quality_status": "",
                "capar_classification": row.get("status", ""),
                "q_signal": quality.get("q_signal", ""),
                "q_complete": quality.get("q_complete", ""),
                "artifact_fraction": quality.get("artifact_fraction", ""),
                "missing_fraction": quality.get("missing_fraction", ""),
                "RMSSD_ms": features.get("rmssd", ""),
                "SDNN_ms": features.get("sdnn", ""),
                "source": "simulation/events.csv:segments",
            }
        )
    write_csv(
        output / "dataset_01_physiology_windows.csv",
        [
            "participant_id", "episode_id", "timestamp", "window_end", "HR_bpm",
            "mean_RR_ms", "RR_interval_ms", "ACC_intensity", "ACC_raw",
            "quality_status", "capar_classification", "q_signal", "q_complete", "artifact_fraction",
            "missing_fraction", "RMSSD_ms", "SDNN_ms", "source",
        ],
        physiology,
    )

    raw_physiology = []
    for row in raw_samples:
        date = row.get("date_created", "").strip()
        time = row.get("time_created", "").strip()
        raw_physiology.append(
            {
                "participant_id": raw_participant_ids.get(row.get("guid_device", ""), ""),
                "episode_id": "",
                "timestamp": normalize_raw_timestamp(date, time),
                "timestamp_basis": "source row timestamp; beat-level timestamp not verified",
                "HR_bpm": row.get("HR", ""),
                "RR_interval_ms": row.get("RR", ""),
                "rrRMS_ms": row.get("rrRMS", ""),
                "ACC_raw": "",
                "quality_status": "",
                "source_timezone": "not_recorded",
                "source": "data/data.csv",
            }
        )
    write_csv(
        output / "dataset_01_raw_physiology.csv",
        [
            "participant_id", "episode_id", "timestamp", "HR_bpm",
            "timestamp_basis", "RR_interval_ms", "rrRMS_ms", "ACC_raw", "quality_status",
            "source_timezone", "source",
        ],
        raw_physiology,
    )

    hil_events = event_rows(events, "patient_hil_scenario_logs")
    activities = []
    clarifications = []
    baselines_by_key: dict[tuple[str, str, str, str, str], dict[str, Any]] = {}
    for row in hil_events:
        evidence = parse_json(row.get("evidence_json"))
        participant = row.get("participant_id", "")
        run_id = run_ids.get(row.get("run_id", ""), "")
        event_type = row.get("node_type", "")
        timestamp = row.get("timestamp", "")
        activity = row.get("activity", "")

        activities.append(
            {
                "participant_id": participant,
                "episode_id": "",
                "scenario_run_id": run_id,
                "timestamp": timestamp,
                "activity": activity,
                "event_type": event_type,
                "start_time": "",
                "end_time": "",
                "previous_activity": "",
                "transition_basis": "app event; not independently verified",
            }
        )

        if event_type in {
            "clarification_requested",
            "clarification_submitted",
            "zero_shot_generated",
            "feedback_presented",
        }:
            clarifications.append(
                {
                    "participant_id": participant,
                    "episode_id": "",
                    "scenario_run_id": run_id,
                    "timestamp": timestamp,
                    "event_type": event_type,
                    "question": "",
                    "response": (
                        evidence.get("clarification", "")
                        if event_type == "clarification_submitted"
                        else ""
                    ),
                    "context_before": "",
                    "context_after": "",
                    "decision_before": "",
                    "decision_after": "",
                    "revision_reason": "",
                    "recorded_status": row.get("status", ""),
                    "interpretation_text": evidence.get("explanation", ""),
                    "source": "simulation/events.csv",
                }
            )

        if evidence.get("baseline_mean_hr") is not None:
            baseline_key = (
                participant,
                activity,
                str(evidence.get("baseline_mean_hr", "")),
                str(evidence.get("baseline_std_hr", "")),
                run_id,
            )
            baselines_by_key[baseline_key] = {
                "participant_id": participant,
                "episode_id": "",
                "context": activity,
                "HR_mean_bpm": evidence.get("baseline_mean_hr", ""),
                "HR_SD_bpm": evidence.get("baseline_std_hr", ""),
                "RMSSD_mean_ms": "",
                "RMSSD_SD_ms": "",
                "baseline_observation_count": "",
                "source_record_count": (
                    int(baselines_by_key.get(baseline_key, {}).get("source_record_count") or 0) + 1
                ),
                "source_run_id": run_id,
                "source_timestamp": timestamp,
                "baseline_source": "patient_hil_scenario_logs evidence",
            }
    write_csv(
        output / "dataset_02_activity_transitions.csv",
        [
            "participant_id", "episode_id", "scenario_run_id", "timestamp",
            "activity", "event_type", "start_time", "end_time",
            "previous_activity", "transition_basis",
        ],
        activities,
    )
    write_csv(
        output / "dataset_03_personal_baselines.csv",
        [
            "participant_id", "episode_id", "context", "HR_mean_bpm",
            "HR_SD_bpm", "RMSSD_mean_ms", "RMSSD_SD_ms",
            "baseline_observation_count", "source_record_count",
            "source_run_id", "source_timestamp", "baseline_source",
        ],
        list(baselines_by_key.values()),
    )
    write_csv(
        output / "dataset_04_hitl_clarifications.csv",
        [
            "participant_id", "episode_id", "scenario_run_id", "timestamp",
            "event_type", "question", "response", "context_before",
            "context_after", "decision_before", "decision_after", "recorded_status",
            "revision_reason", "interpretation_text", "source",
        ],
        clarifications,
    )

    reference_labels = []
    computational_logs = []
    participants = set()
    protocol_by_run: dict[str, dict[str, Any]] = {}
    for row in episodes:
        participant = row.get("participant_id", "")
        participants.add(participant)
        episode_id = episode_ids.get(row.get("episode_id", ""), "")
        episode_json = parse_json(row.get("episode_json"))
        analysis_json = parse_json(row.get("analysis_json"))
        meta_json = parse_json(row.get("meta_json"))
        threshold_policy = analysis_json.get("threshold_policy") or {}
        thresholds = threshold_policy.get("applied_values") or {}

        reference_labels.append(
            {
                "participant_id": participant,
                "episode_id": episode_id,
                "activity_label": "",
                "recovery_reference_status": "",
                "reference_onset_time": episode_json.get("actual_onset_time", ""),
                "reference_recovery_time": "",
                "review_status": row.get("review_status", ""),
                "source_review_label": row.get("validation_label", ""),
                "reviewer_present": bool(episode_json.get("reviewer_id")),
                "review_notes": episode_json.get("reviewer_notes", ""),
                "reference_independent": "not established by source export",
                "adjudication_basis": "",
                "source": "simulation/episodes.csv",
            }
        )
        computational_logs.append(
            {
                "participant_id": participant,
                "episode_id": episode_id,
                "timestamp": row.get("start_time", ""),
                "onset_time": row.get("onset_time", ""),
                "candidate_at": row.get("candidate_at", ""),
                "persistent_at": row.get("persistent_at", ""),
                "peak_time": row.get("peak_time", ""),
                "recovery_started_at": row.get("recovery_started_at", ""),
                "recovered_at": row.get("recovered_at", ""),
                "deviation_score": row.get("anomaly_score", ""),
                "peak_score": row.get("peak_score", ""),
                "state": row.get("current_state", ""),
                "status": row.get("status", ""),
                "classification": row.get("classification", ""),
                "persistence_windows": episode_json.get("trajectory", {}).get("persistence", ""),
                "recovery_slope": analysis_json.get("recovery_slope", ""),
                "TTR_ms": episode_json.get("trajectory", {}).get("recovery_time_ms", ""),
                "relapse": episode_json.get("relapse", ""),
                "relapse_count": row.get("relapse_count", ""),
                "tau_in": thresholds.get("tau_in", analysis_json.get("tau_in", "")),
                "tau_out": thresholds.get("tau_out", analysis_json.get("tau_out", "")),
                "algorithm_version": row.get("rule_version", ""),
                "model_version": "",
                "audit_payload": "",
                "source": "simulation/episodes.csv",
            }
        )

    for row in hil_events:
        participant = row.get("participant_id", "")
        if participant:
            participants.add(participant)
        source_run = row.get("run_id", "")
        if source_run:
            run_id = run_ids[source_run]
            summary = protocol_by_run.setdefault(
                run_id,
                {
                    "participant_id": participant,
                    "episode_id": "",
                    "scenario_run_id": run_id,
                    "scenario": row.get("scenario", ""),
                    "start_time": "",
                    "end_time": "",
                    "device": "",
                    "rest_duration": "",
                    "stair_intensity": "",
                    "recovery_position": "",
                    "recording_method": "",
                    "protocol_source": "not supplied in event export",
                },
            )
            event_type = row.get("node_type", "")
            if event_type == "scenario_started":
                summary["start_time"] = row.get("timestamp", "")
            if event_type in {"live_recording_stopped", "observation_frozen"}:
                summary["end_time"] = row.get("timestamp", "")

    write_csv(
        output / "dataset_05_reference_labels.csv",
        [
            "participant_id", "episode_id", "activity_label",
            "recovery_reference_status", "reference_onset_time",
            "reference_recovery_time", "review_status", "source_review_label",
            "reviewer_present", "review_notes", "reference_independent",
            "adjudication_basis", "source",
        ],
        reference_labels,
    )

    for row in raw_samples:
        raw_id = raw_participant_ids.get(row.get("guid_device", ""))
        if raw_id:
            participants.add(raw_id)
    write_csv(
        output / "dataset_06_participant_characteristics.csv",
        [
            "participant_id", "age_years", "sex_category", "BMI",
            "activity_characteristics", "relevant_conditions", "availability",
        ],
        [
            {
                "participant_id": participant,
                "age_years": "",
                "sex_category": "",
                "BMI": "",
                "activity_characteristics": "",
                "relevant_conditions": "",
                "availability": "not present in source exports",
            }
            for participant in sorted(participants)
        ],
    )
    write_csv(
        output / "dataset_07_experiment_protocol.csv",
        [
            "participant_id", "episode_id", "scenario_run_id", "scenario",
            "start_time", "end_time", "device", "rest_duration",
            "stair_intensity", "recovery_position", "recording_method",
            "protocol_source",
        ],
        list(protocol_by_run.values()),
    )
    write_csv(
        output / "dataset_08_capar_computational_log.csv",
        [
            "participant_id", "episode_id", "timestamp", "onset_time",
            "candidate_at", "persistent_at", "peak_time", "recovery_started_at",
            "recovered_at", "deviation_score", "peak_score", "state", "status",
            "classification", "persistence_windows", "recovery_slope", "TTR_ms",
            "relapse", "relapse_count", "tau_in", "tau_out",
            "algorithm_version", "model_version", "audit_payload", "source",
        ],
        computational_logs,
    )

    availability = [
        ("01", "Fisiologis mentah", "parsial", "Ada RR/HR pada data.csv dan fitur window di events.csv; tidak ada ACC mentah atau pemetaan episode untuk data.csv."),
        ("02", "Aktivitas dan transisi", "parsial", "Ada log aktivitas aplikasi; waktu naik tangga, berhenti, dan mulai duduk terverifikasi tidak tersedia."),
        ("03", "Baseline personal", "parsial", "Log memuat mean/SD HR baseline untuk sebagian observasi; jumlah observasi dan RMSSD baseline tidak tersedia."),
        ("04", "Klarifikasi HITL", "parsial", "Log event, jawaban klarifikasi, dan teks interpretasi tersedia bila tersimpan; pertanyaan dan alasan revisi tidak terstruktur."),
        ("05", "Label referensi independen", "belum tersedia", "Label review sistem diekspor terpisah; independensi dan kriteria referensi tidak dapat dipastikan dari sumber."),
        ("06", "Karakteristik peserta", "belum tersedia", "Kolom template disediakan tanpa mengarang karakteristik."),
        ("07", "Protokol eksperimen", "parsial", "Run dan waktu event tersedia; rincian prosedur dan intensitas tidak tersedia."),
        ("08", "Log komputasi dan SER", "parsial", "Status/score/timing episode diekspor; audit trail, parameter lengkap, dan versi model dapat tidak tersedia."),
    ]
    write_csv(
        output / "dataset_availability.csv",
        ["dataset_number", "dataset", "availability", "notes"],
        [
            {
                "dataset_number": number,
                "dataset": name,
                "availability": status,
                "notes": notes,
            }
            for number, name, status, notes in availability
        ],
    )

    return {
        "physiology_windows": len(physiology),
        "raw_physiology": len(raw_physiology),
        "activity_events": len(activities),
        "baselines": len(baselines_by_key),
        "hitl_events": len(clarifications),
        "reference_records": len(reference_labels),
        "participants": len(participants),
        "protocol_runs": len(protocol_by_run),
        "capar_records": len(computational_logs),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Directory for generated CSV files (default: simulation/research_dataset/output)",
    )
    args = parser.parse_args()
    counts = export(args.output_dir)
    for name, count in counts.items():
        print(f"{name}: {count}")
    print(f"output: {args.output_dir.resolve()}")


if __name__ == "__main__":
    main()
