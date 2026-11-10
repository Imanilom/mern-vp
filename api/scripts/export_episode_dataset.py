#!/usr/bin/env python3
"""Export scenario B and C data for participants P0001 through P0016."""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


PARTICIPANT_NAMES = tuple(f"P{number:04d}" for number in range(1, 17))
SCENARIOS = ("B", "C")
SCENARIO_NAMES = {"B": "One-way Feedback", "C": "Human in the loop"}

EPISODE_FIELDS = [
    "episode_id",
    "user_id",
    "participant_id",
    "start_time",
    "end_time",
    "onset_time",
    "candidate_at",
    "persistent_at",
    "peak_time",
    "recovery_started_at",
    "recovered_at",
    "resolved_time",
    "unresolved_at",
    "status",
    "current_state",
    "physiological_outcome",
    "classification",
    "activity",
    "context",
    "anomaly_score",
    "peak_score",
    "peak_hr",
    "baseline_hr",
    "duration_ms",
    "ttr_min",
    "auc_score",
    "window_count",
    "relapse_count",
    "review_status",
    "validation_label",
    "episode_json",
    "analysis_json",
    "meta_json",
]

EVENT_FIELDS = [
    "episode_id",
    "user_id",
    "participant_id",
    "scenario",
    "session_id",
    "run_id",
    "node_index",
    "node_type",
    "timestamp",
    "source",
    "status",
    "activity",
    "anomaly_score",
    "heart_rate_bpm",
    "evidence_json",
]


def json_default(value: Any) -> str:
    if isinstance(value, datetime):
        return timestamp(value) or ""
    return str(value)


def json_text(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=json_default, separators=(",", ":"))


def identifier(value: Any) -> str:
    return "" if value is None else str(value)


def first_nonempty(*values: Any) -> Any:
    return next((value for value in values if value is not None and value != ""), None)


def timestamp(value: Any) -> str | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, (int, float)):
        epoch = value / 1000 if abs(value) >= 100_000_000_000 else value
        try:
            parsed = datetime.fromtimestamp(epoch, tz=timezone.utc)
        except (OverflowError, OSError, ValueError):
            return None
    elif isinstance(value, str):
        try:
            numeric = float(value)
        except ValueError:
            try:
                parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                return None
        else:
            return timestamp(numeric)
    else:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def timestamp_order(value: Any) -> float:
    iso = timestamp(value)
    if not iso:
        return float("-inf")
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp()


def _episode_key(episode_id: Any, fallback_id: Any = None) -> str:
    value = episode_id if episode_id is not None else fallback_id
    return identifier(value) if value is not None else ""


def build_episode_rows(
    anomaly_events: Iterable[dict[str, Any]],
    analyses: Iterable[dict[str, Any]],
    metas: Iterable[dict[str, Any]],
    participant_labels: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    participant_labels = participant_labels or {}
    event_by_id = {identifier(item.get("_id")): item for item in anomaly_events if item.get("_id") is not None}
    meta_by_episode = {
        identifier(item.get("episode_id")): item
        for item in metas
        if item.get("episode_id") is not None
    }
    analysis_by_episode: dict[str, dict[str, Any]] = {}
    for analysis in analyses:
        key = _episode_key(analysis.get("episode_id"), analysis.get("_id"))
        if not key:
            continue
        existing = analysis_by_episode.get(key)
        if existing is None or timestamp_order(
            first_nonempty(analysis.get("updatedAt"), analysis.get("createdAt"))
        ) >= timestamp_order(first_nonempty(existing.get("updatedAt"), existing.get("createdAt"))):
            analysis_by_episode[key] = analysis

    episode_keys = set(event_by_id) | set(analysis_by_episode)
    rows = []
    for key in episode_keys:
        event = event_by_id.get(key, {})
        analysis = analysis_by_episode.get(key, {})
        actual_episode_id = first_nonempty(event.get("_id"), analysis.get("episode_id"), analysis.get("_id"))
        meta = meta_by_episode.get(identifier(actual_episode_id), {})
        user_id = identifier(first_nonempty(event.get("user_id"), analysis.get("user_id"), meta.get("user_id")))
        row = {
            "episode_id": identifier(actual_episode_id),
            "user_id": user_id,
            "participant_id": participant_labels.get(
                user_id, first_nonempty(meta.get("participant_id"), event.get("participant_id"))
            ),
            "start_time": timestamp(first_nonempty(analysis.get("start_time"), event.get("onset_time"), meta.get("onset_timestamp"))),
            "end_time": timestamp(first_nonempty(analysis.get("end_time"), event.get("resolved_time"), event.get("recovered_at"), event.get("unresolved_at"))),
            "onset_time": timestamp(first_nonempty(event.get("onset_time"), event.get("started_at"), analysis.get("start_time"))),
            "candidate_at": timestamp(event.get("candidate_at")),
            "persistent_at": timestamp(event.get("persistent_at")),
            "peak_time": timestamp(event.get("peak_time")),
            "recovery_started_at": timestamp(first_nonempty(event.get("recovery_started_at"), event.get("recovery_entry_at"))),
            "recovered_at": timestamp(event.get("recovered_at")),
            "resolved_time": timestamp(event.get("resolved_time")),
            "unresolved_at": timestamp(event.get("unresolved_at")),
            "status": first_nonempty(event.get("status"), meta.get("status")),
            "current_state": first_nonempty(event.get("current_state"), analysis.get("physiological_state"), analysis.get("evidence_state"), meta.get("current_state")),
            "physiological_outcome": event.get("physiological_outcome"),
            "classification": first_nonempty(event.get("classification"), analysis.get("y_true"), meta.get("classification")),
            "activity": first_nonempty(event.get("activity"), analysis.get("activity"), meta.get("activity")),
            "context": first_nonempty(event.get("context_tag"), analysis.get("dominant_context"), analysis.get("context")),
            "anomaly_score": first_nonempty(event.get("peak_score"), analysis.get("anomaly_score"), meta.get("peak_score")),
            "peak_score": first_nonempty(event.get("peak_score"), analysis.get("anomaly_score")),
            "peak_hr": event.get("peak_hr"),
            "baseline_hr": event.get("baseline_hr"),
            "duration_ms": first_nonempty(event.get("duration_ms"), analysis.get("total_duration"), meta.get("duration_ms")),
            "ttr_min": first_nonempty(event.get("ttr_min"), analysis.get("ttr"), analysis.get("recovery_duration")),
            "auc_score": first_nonempty(event.get("auc_score"), analysis.get("deviation_auc")),
            "window_count": first_nonempty(event.get("window_count"), len(event.get("segment_ids") or []) or None),
            "relapse_count": first_nonempty(event.get("relapse_count"), analysis.get("relapse_count")),
            "review_status": first_nonempty(event.get("review_status"), analysis.get("review_status")),
            "validation_label": first_nonempty(event.get("validation_label"), analysis.get("validation_label")),
            "episode_json": json_text(event) if event else "",
            "analysis_json": json_text(analysis) if analysis else "",
            "meta_json": json_text(meta) if meta else "",
        }
        rows.append(row)
    return sorted(rows, key=lambda row: (timestamp_order(row["onset_time"]), row["episode_id"]))


def _node(
    episode_id: Any,
    user_id: Any,
    node_type: str,
    at: Any,
    source: str,
    **evidence: Any,
) -> dict[str, Any] | None:
    node_time = timestamp(at)
    if not node_time:
        return None
    return {
        "episode_id": identifier(episode_id),
        "user_id": identifier(user_id),
        "node_index": 0,
        "node_type": node_type,
        "timestamp": node_time,
        "source": source,
        "status": first_nonempty(evidence.pop("status", None), ""),
        "activity": first_nonempty(evidence.pop("activity", None), ""),
        "anomaly_score": first_nonempty(evidence.pop("anomaly_score", None), ""),
        "heart_rate_bpm": first_nonempty(evidence.pop("heart_rate_bpm", None), ""),
        "evidence_json": json_text(evidence),
    }


def build_event_rows(
    anomaly_events: Iterable[dict[str, Any]],
    segments_by_episode: dict[str, list[dict[str, Any]]] | None = None,
    audits_by_episode: dict[str, list[dict[str, Any]]] | None = None,
    participant_labels: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    segments_by_episode = segments_by_episode or {}
    audits_by_episode = audits_by_episode or {}
    participant_labels = participant_labels or {}
    rows: list[dict[str, Any]] = []
    lifecycle = [
        ("onset", "onset_time"),
        ("candidate", "candidate_at"),
        ("persistent", "persistent_at"),
        ("peak", "peak_time"),
        ("recovery_started", "recovery_started_at"),
        ("recovery_entry", "recovery_entry_at"),
        ("recovered", "recovered_at"),
        ("resolved", "resolved_time"),
        ("unresolved", "unresolved_at"),
        ("relapse", "relapse_at"),
    ]

    for episode in anomaly_events:
        episode_id = episode.get("_id")
        key = identifier(episode_id)
        user_id = episode.get("user_id")
        for node_type, field in lifecycle:
            row = _node(
                episode_id,
                user_id,
                node_type,
                episode.get(field),
                "anomalyevents",
                status=episode.get("current_state") or episode.get("status"),
                activity=episode.get("activity"),
                anomaly_score=episode.get("peak_score") if node_type == "peak" else episode.get("onset_score"),
                heart_rate_bpm=episode.get("peak_hr") if node_type == "peak" else None,
                field=field,
            )
            if row:
                rows.append(row)

        for index, peak in enumerate(episode.get("peaks_history") or []):
            row = _node(
                episode_id, user_id, "peak_history", peak.get("peak_time"), "anomalyevents.peaks_history",
                anomaly_score=peak.get("peak_score"),
                heart_rate_bpm=peak.get("peak_hr"),
                sequence=index,
                related_tau_out_time=timestamp(peak.get("tau_out_time")),
                ttr_to_tau_out_ms=peak.get("ttr_to_tau_out_ms"),
            )
            if row:
                rows.append(row)

        for index, pause in enumerate(episode.get("pause_history") or []):
            for node_type, field in (("pause_started", "paused_from"), ("pause_resumed", "resumed_at")):
                row = _node(
                    episode_id, user_id, node_type, pause.get(field), "anomalyevents.pause_history",
                    sequence=index, gap_ms=pause.get("gap_ms"),
                )
                if row:
                    rows.append(row)

        for index, annotation in enumerate(episode.get("annotations") or []):
            row = _node(
                episode_id, user_id, "annotation", annotation.get("timestamp"), "anomalyevents.annotations",
                text=annotation.get("text"), sequence=index,
                created_at=timestamp(annotation.get("created_at")),
            )
            if row:
                rows.append(row)

        for audit in audits_by_episode.get(key, []):
            row = _node(
                episode_id, user_id, "audit", audit.get("createdAt") or audit.get("created_at"),
                "episodeaudits",
                status=audit.get("action"),
                algorithm_version=audit.get("algorithm_version"),
                rule_version=audit.get("rule_version"),
                actor_id=identifier(audit.get("actor_id")),
                payload=audit.get("payload") or {},
            )
            if row:
                rows.append(row)

        for segment in segments_by_episode.get(key, []):
            row = _node(
                episode_id, user_id, "physiology_window",
                segment.get("window_start") or segment.get("createdAt"),
                "segments",
                status=segment.get("classification") or segment.get("rr_status"),
                activity=segment.get("activity_label"),
                anomaly_score=segment.get("anomaly_score"),
                heart_rate_bpm=(segment.get("features") or {}).get("mean_hr"),
                segment_id=identifier(segment.get("_id")),
                window_end=timestamp(segment.get("window_end")),
                features=segment.get("features") or {},
                quality=segment.get("signal_quality_detail") or segment.get("missing_data_info") or {},
                z_scores=segment.get("z_scores") or {},
            )
            if row:
                rows.append(row)

    for row in rows:
        row["participant_id"] = participant_labels.get(row["user_id"], "")
    rows.sort(key=lambda row: (
        row["participant_id"],
        row["episode_id"],
        timestamp_order(row["timestamp"]),
        row["node_type"],
    ))
    node_indexes: dict[str, int] = defaultdict(int)
    for row in rows:
        key = row["episode_id"] or f'{row.get("session_id", "")}:{row.get("run_id", "")}'
        node_indexes[key] += 1
        row["node_index"] = node_indexes[key]
    return rows


def build_hil_event_rows(
    hil_logs: Iterable[dict[str, Any]],
    participant_labels: dict[str, str],
) -> list[dict[str, Any]]:
    rows = []
    for log in hil_logs:
        scenario = str(log.get("scenario", "")).upper()
        if scenario not in SCENARIOS:
            continue
        account_id = identifier(log.get("account_id"))
        participant_id = participant_labels.get(account_id)
        if not participant_id:
            continue
        created_at = first_nonempty(log.get("createdAt"), log.get("created_at"))
        event_time = timestamp(created_at)
        if not event_time:
            continue
        rows.append({
            "episode_id": "",
            "user_id": account_id,
            "participant_id": participant_id,
            "scenario": scenario,
            "session_id": identifier(log.get("session_id")),
            "run_id": identifier(log.get("run_id")),
            "node_index": 0,
            "node_type": log.get("event_type") or "hil_event",
            "timestamp": event_time,
            "source": "patient_hil_scenario_logs",
            "status": first_nonempty(log.get("algorithm_status"), log.get("quality_status"), ""),
            "activity": log.get("activity") or "",
            "anomaly_score": "",
            "heart_rate_bpm": first_nonempty(log.get("heart_rate_bpm"), log.get("raw_hr"), ""),
            "evidence_json": json_text({
                field: log.get(field)
                for field in (
                    "sample_id", "observed_at", "raw_recorded_at", "raw_hr",
                    "baseline_mean_hr", "baseline_std_hr", "threshold_bpm",
                    "z_score", "q_signal", "q_complete", "recommendation",
                    "clarification", "explanation", "history",
                )
                if log.get(field) is not None
            }),
        })
    rows.sort(key=lambda row: (
        row["participant_id"],
        row["session_id"],
        row["run_id"],
        timestamp_order(row["timestamp"]),
    ))
    node_indexes: dict[tuple[str, str], int] = defaultdict(int)
    for row in rows:
        key = (row["session_id"], row["run_id"])
        node_indexes[key] += 1
        row["node_index"] = node_indexes[key]
    return rows


def _version_metadata(*records: dict[str, Any]) -> dict[str, Any]:
    prompt_version = None
    model_version = None
    algorithm_version = None
    rule_version = None
    for record in records:
        if not record:
            continue
        prompt_version = first_nonempty(
            prompt_version, record.get("prompt_version"), record.get("promptVersion")
        )
        model_version = first_nonempty(
            model_version, record.get("model_version"), record.get("modelVersion"),
            record.get("model_name"), record.get("model"),
        )
        algorithm_version = first_nonempty(
            algorithm_version, record.get("algorithm_version"), record.get("algorithmVersion")
        )
        rule_version = first_nonempty(
            rule_version, record.get("rule_version"), record.get("ruleVersion")
        )
    return {
        "prompt_version": prompt_version,
        "model_version": model_version,
        "algorithm_version": algorithm_version,
        "rule_version": rule_version,
        "prompt_model_version_recorded": prompt_version is not None or model_version is not None,
    }


def build_interpretation_rows(
    scenario_sessions: Iterable[dict[str, Any]],
    hil_explanations: Iterable[dict[str, Any]],
    hil_logs: Iterable[dict[str, Any]],
    participant_labels: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    participant_labels = participant_labels or {}
    rows: list[dict[str, Any]] = []
    logs_by_id = {identifier(log.get("_id")): log for log in hil_logs if log.get("_id") is not None}

    for session in scenario_sessions:
        session_scenario = str(session.get("scenario_id", "")).upper()
        if session_scenario not in SCENARIOS:
            continue
        participant_id = participant_labels.get(identifier(session.get("account_id")))
        if not participant_id:
            continue
        for interpretation in session.get("interpretations") or []:
            scenario = str(interpretation.get("scenario_id", session.get("scenario_id", ""))).upper()
            if scenario not in SCENARIOS:
                continue
            evidence = {
                "observation": interpretation.get("observation"),
                "baseline": interpretation.get("baseline"),
                "statistical_evidence": interpretation.get("statistical_evidence"),
                "quality": (interpretation.get("observation") or {}).get("quality"),
                "trigger_event_id": identifier(interpretation.get("trigger_event_id")),
            }
            rows.append({
                "interpretation_id": f"{identifier(session.get('_id'))}:{interpretation.get('version', '')}",
                "source_type": "scenario_interpretation",
                "participant_id": participant_id,
                "session_id": identifier(session.get("_id")),
                "run_id": "",
                "scenario": interpretation.get("scenario_id") or session.get("scenario_id"),
                "created_at": timestamp(interpretation.get("created_at")),
                "input": {
                    "scenario_id": interpretation.get("scenario_id") or session.get("scenario_id"),
                    "context": interpretation.get("context"),
                    "observed_at": timestamp(interpretation.get("observed_at")),
                    "previous_version": interpretation.get("previous_version"),
                    "trigger_event_id": identifier(interpretation.get("trigger_event_id")),
                },
                "output": interpretation,
                "versions": _version_metadata(interpretation, session),
                "evidence": evidence,
            })

    for explanation in hil_explanations:
        scenario = str(explanation.get("scenario", "")).upper()
        if scenario not in SCENARIOS:
            continue
        participant_id = participant_labels.get(identifier(explanation.get("account_id")))
        if not participant_id:
            continue
        source_log = logs_by_id.get(identifier(explanation.get("source_log_id")), {})
        evidence = {
            "source_log_id": identifier(explanation.get("source_log_id")),
            "sample_id": identifier(explanation.get("sample_id")),
            "segment_id": identifier(explanation.get("segment_id")),
            "activity": explanation.get("activity"),
            "quality_status": explanation.get("quality_status"),
            "baseline_ready": explanation.get("baseline_ready"),
            "factors": explanation.get("factors") or [],
            "source_log": {
                field: source_log.get(field)
                for field in (
                    "event_type", "heart_rate_bpm", "raw_hr", "baseline_mean_hr",
                    "baseline_std_hr", "threshold_bpm", "z_score", "q_signal",
                    "q_complete", "quality_status", "algorithm_status",
                )
                if source_log.get(field) is not None
            },
        }
        rows.append({
            "interpretation_id": identifier(explanation.get("_id")),
            "source_type": "hil_explanation",
            "participant_id": participant_id,
            "session_id": identifier(explanation.get("session_id")),
            "run_id": explanation.get("run_id"),
            "scenario": scenario,
            "created_at": timestamp(explanation.get("createdAt") or explanation.get("created_at")),
            "input": {
                "activity": explanation.get("activity"),
                "status": explanation.get("status"),
                "quality_status": explanation.get("quality_status"),
                "snapshot_version": explanation.get("snapshot_version"),
                "xai_trigger_context": (explanation.get("xai") or {}).get("trigger_context"),
            },
            "output": {
                "explanation": explanation.get("explanation"),
                "status": explanation.get("status"),
                "factors": explanation.get("factors") or [],
                "xai": explanation.get("xai"),
            },
            "versions": _version_metadata(explanation, source_log),
            "evidence": evidence,
        })

    for log in hil_logs:
        scenario = str(log.get("scenario", "")).upper()
        if scenario not in SCENARIOS:
            continue
        if log.get("event_type") not in ("zero_shot_generated", "zero_shot_failed"):
            continue
        participant_id = participant_labels.get(identifier(log.get("account_id")))
        if not participant_id:
            continue
        rows.append({
            "interpretation_id": identifier(log.get("_id")),
            "source_type": "hil_zero_shot_result",
            "participant_id": participant_id,
            "session_id": identifier(log.get("session_id")),
            "run_id": log.get("run_id"),
            "scenario": scenario,
            "created_at": timestamp(log.get("createdAt") or log.get("created_at")),
            "input": {
                "event_type": log.get("event_type"),
                "activity": log.get("activity"),
                "clarification": log.get("clarification"),
                "sample_id": identifier(log.get("sample_id")),
            },
            "output": {
                "event_type": log.get("event_type"),
                "explanation": log.get("explanation"),
                "recommendation": log.get("recommendation"),
                "error_or_status": log.get("clarification"),
            },
            "versions": _version_metadata(log),
            "evidence": {
                "observed_at": timestamp(log.get("observed_at")),
                "heart_rate_bpm": log.get("heart_rate_bpm"),
                "raw_hr": log.get("raw_hr"),
                "baseline_mean_hr": log.get("baseline_mean_hr"),
                "baseline_std_hr": log.get("baseline_std_hr"),
                "threshold_bpm": log.get("threshold_bpm"),
                "z_score": log.get("z_score"),
                "quality_status": log.get("quality_status"),
                "q_signal": log.get("q_signal"),
                "q_complete": log.get("q_complete"),
                "history": log.get("history") or [],
            },
        })

    return sorted(rows, key=lambda row: (
        timestamp_order(row.get("created_at")),
        row["source_type"],
        row["interpretation_id"],
    ))


def write_csv(path: Path, fields: list[str], rows: Iterable[dict[str, Any]]) -> int:
    count = 0
    with path.open("w", newline="", encoding="utf-8-sig") as output:
        writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({
                field: value if isinstance(value, str) else json_text(value)
                if isinstance(value, (dict, list, tuple)) else value
                for field, value in row.items()
            })
            count += 1
    return count


def write_jsonl(path: Path, rows: Iterable[dict[str, Any]]) -> int:
    count = 0
    with path.open("w", encoding="utf-8") as output:
        for row in rows:
            output.write(json_text(row) + "\n")
            count += 1
    return count


def write_scenario_workbook(
    path: Path,
    participants: Iterable[str],
    sessions: Iterable[dict[str, Any]],
    event_rows: Iterable[dict[str, Any]],
    interpretation_rows: Iterable[dict[str, Any]],
    participant_labels: dict[str, str],
) -> dict[str, dict[str, int]]:
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font
    except ImportError as error:
        raise RuntimeError(
            "Dependensi openpyxl belum tersedia. Install dengan: python -m pip install openpyxl"
        ) from error

    sessions = list(sessions)
    event_rows = list(event_rows)
    interpretation_rows = list(interpretation_rows)
    fields = [
        "record_type", "participant_id", "scenario", "scenario_name", "timestamp",
        "session_id", "run_id", "node_index", "event_type", "source_type",
        "interpretation_id", "activity", "status", "heart_rate_bpm",
        "input_json", "output_json", "evidence_json", "versions_json",
        "session_count", "event_count", "interpretation_count",
    ]
    workbook = Workbook()
    workbook.remove(workbook.active)
    counts: dict[str, dict[str, int]] = {}

    for scenario in SCENARIOS:
        sheet = workbook.create_sheet(scenario)
        sheet.append(fields)
        sheet.freeze_panes = "A2"
        sheet.auto_filter.ref = f"A1:{chr(64 + len(fields))}1"
        for cell in sheet[1]:
            cell.font = Font(bold=True)

        scenario_sessions = [
            row for row in sessions
            if str(row.get("scenario", "")).upper() == scenario
        ]
        scenario_events = [
            row for row in event_rows
            if str(row.get("scenario", "")).upper() == scenario
            and row.get("source") == "patient_hil_scenario_logs"
        ]
        scenario_interpretations = [
            row for row in interpretation_rows
            if str(row.get("scenario", "")).upper() == scenario
        ]
        for participant_id in participants:
            participant_sessions = [
                row for row in scenario_sessions
                if participant_labels.get(identifier(row.get("account_id"))) == participant_id
            ]
            participant_events = [
                row for row in scenario_events
                if row.get("participant_id") == participant_id
            ]
            participant_interpretations = [
                row for row in scenario_interpretations
                if row.get("participant_id") == participant_id
            ]
            sheet.append([
                "participant_summary", participant_id, scenario, SCENARIO_NAMES[scenario],
                None, None, None, None, None, None, None, None, None, None,
                None, None, None, None, len(participant_sessions), len(participant_events),
                len(participant_interpretations),
            ])

        for row in scenario_events:
            sheet.append([
                "event", row.get("participant_id"), scenario, SCENARIO_NAMES[scenario],
                row.get("timestamp"), row.get("session_id"), row.get("run_id"),
                row.get("node_index"), row.get("node_type"), None, None,
                row.get("activity"), row.get("status"), row.get("heart_rate_bpm"),
                None, None, row.get("evidence_json"), None, None, None, None,
            ])
        for row in scenario_interpretations:
            sheet.append([
                "interpretation", row.get("participant_id"), scenario, SCENARIO_NAMES[scenario],
                row.get("created_at"), row.get("session_id"), row.get("run_id"),
                None, None, row.get("source_type"), row.get("interpretation_id"),
                row.get("input", {}).get("activity"), row.get("output", {}).get("status"),
                row.get("evidence", {}).get("heart_rate_bpm"),
                json_text(row.get("input")), json_text(row.get("output")),
                json_text(row.get("evidence")), json_text(row.get("versions")),
                None, None, None,
            ])
        counts[scenario] = {
            "sessions": len(scenario_sessions),
            "events": len(scenario_events),
            "interpretations": len(scenario_interpretations),
        }
        sheet.auto_filter.ref = f"A1:{chr(64 + len(fields))}{sheet.max_row}"

    path.parent.mkdir(parents=True, exist_ok=True)
    workbook.save(path)
    return counts


def _load_api_env() -> None:
    env_file = Path(__file__).resolve().parents[1] / ".env"
    if not env_file.is_file():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        match = re.match(r"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$", line)
        if not match or match.group(1) in os.environ:
            continue
        value = match.group(2)
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
            value = value[1:-1]
        os.environ[match.group(1)] = value


def _fetch_episode_documents(
    db: Any,
    account_ids: list[Any],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    owner_filter = {"user_id": {"$in": account_ids}}
    anomalies = list(db["anomalyevents"].find(owner_filter))
    analyses = list(db["episodeanalyses"].find(owner_filter))
    metas = list(db["episodemetas"].find(owner_filter))
    return anomalies, analyses, metas


def export_from_mongo(database: Any, output_dir: Path) -> dict[str, int]:
    participant_names = list(PARTICIPANT_NAMES)
    participants = list(database["users"].find(
        {"name": {"$in": participant_names}},
        {"_id": 1, "name": 1},
    ))
    participants.extend(database["patients"].find(
        {"name": {"$in": participant_names}},
        {"_id": 1, "name": 1},
    ))
    participant_labels = {
        identifier(participant["_id"]): participant["name"]
        for participant in participants
    }
    participant_account_ids = [participant["_id"] for participant in participants]
    hil_sessions = list(database["patient_hil_sessions"].find({
        "account_id": {"$in": participant_account_ids},
        "scenario": {"$in": list(SCENARIOS)},
    }))

    anomalies, analyses, metas = _fetch_episode_documents(database, participant_account_ids)
    episode_rows = build_episode_rows(anomalies, analyses, metas, participant_labels)
    episode_ids = [item.get("_id") for item in anomalies if item.get("_id") is not None]
    audit_by_episode: dict[str, list[dict[str, Any]]] = defaultdict(list)
    if episode_ids:
        for audit in database["episodeaudits"].find({"episode_id": {"$in": episode_ids}}):
            audit_by_episode[identifier(audit.get("episode_id"))].append(audit)

    segment_by_episode: dict[str, list[dict[str, Any]]] = defaultdict(list)
    segment_ids = list({
        segment_id
        for episode in anomalies
        for segment_id in (episode.get("segment_ids") or [])
        if segment_id is not None
    })
    if segment_ids:
        segment_by_id = {
            identifier(segment.get("_id")): segment
            for segment in database["segments"].find({"_id": {"$in": segment_ids}})
        }
        for episode in anomalies:
            key = identifier(episode.get("_id"))
            for segment_id in episode.get("segment_ids") or []:
                segment = segment_by_id.get(identifier(segment_id))
                if segment:
                    segment_by_episode[key].append(segment)

    # Older anomaly records may lack segment_ids; recover their windows by user and lifecycle range.
    by_user: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for episode in anomalies:
        by_user[identifier(episode.get("user_id"))].append(episode)
    for user_episodes in by_user.values():
        user_episodes.sort(key=lambda item: timestamp_order(item.get("onset_time")))
        for index, episode in enumerate(user_episodes):
            if episode.get("segment_ids") or not episode.get("user_id") or not episode.get("onset_time"):
                continue
            onset_ms = episode.get("onset_time")
            end_candidates = [
                episode.get(field)
                for field in ("resolved_time", "recovered_at", "unresolved_at")
                if episode.get(field) is not None
            ]
            if not end_candidates and index + 1 < len(user_episodes):
                end_candidates.append(user_episodes[index + 1].get("onset_time"))
            end_ms = min(end_candidates) if end_candidates else onset_ms + 48 * 60 * 60 * 1000
            recovered = list(database["segments"].find({
                "user_id": episode["user_id"],
                "window_start": {"$gte": onset_ms, "$lte": end_ms},
            }).sort("window_start", 1).limit(2880))
            segment_by_episode[identifier(episode.get("_id"))].extend(recovered)

    event_rows = build_event_rows(
        anomalies, segment_by_episode, audit_by_episode, participant_labels
    )
    hil_logs = list(database["patient_hil_scenario_logs"].find({
        "account_id": {"$in": participant_account_ids},
        "scenario": {"$in": list(SCENARIOS)},
    }))
    event_rows.extend(build_hil_event_rows(hil_logs, participant_labels))
    scenario_sessions = list(database["patientscenariosessions"].find({
        "account_id": {"$in": participant_account_ids},
        "scenario_id": {"$in": [scenario.lower() for scenario in SCENARIOS]},
    }))
    hil_explanations = list(database["patient_hil_explanations"].find({
        "account_id": {"$in": participant_account_ids},
        "scenario": {"$in": list(SCENARIOS)},
    }))
    interpretations = build_interpretation_rows(
        scenario_sessions, hil_explanations, hil_logs, participant_labels
    )

    output_dir.mkdir(parents=True, exist_ok=True)
    scenario_counts = write_scenario_workbook(
        output_dir / "scenario_comparison.xlsx",
        participant_names,
        hil_sessions,
        event_rows,
        interpretations,
        participant_labels,
    )
    counts = {
        "episodes": write_csv(output_dir / "episodes.csv", EPISODE_FIELDS, episode_rows),
        "events": write_csv(output_dir / "events.csv", EVENT_FIELDS, event_rows),
        "interpretations": write_jsonl(output_dir / "interpretations.jsonl", interpretations),
        "participants": len(participants),
        "hil_sessions": len(hil_sessions),
        "b_sessions": scenario_counts["B"]["sessions"],
        "b_events": scenario_counts["B"]["events"],
        "b_interpretations": scenario_counts["B"]["interpretations"],
        "c_sessions": scenario_counts["C"]["sessions"],
        "c_events": scenario_counts["C"]["events"],
        "c_interpretations": scenario_counts["C"]["interpretations"],
    }
    return counts


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--database",
        help="MongoDB database name (defaults to the database in MONGO URI).",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "exports" / "episode_dataset",
        help="Directory for CSV, JSONL, and scenario_comparison.xlsx exports.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    _load_api_env()
    args = parse_args(argv)
    mongo_uri = os.environ.get("MONGO") or "mongodb://127.0.0.1:27017/healthdevice"
    try:
        from pymongo import MongoClient
    except ImportError:
        print("Dependensi pymongo belum tersedia. Install dengan: python -m pip install pymongo", file=sys.stderr)
        return 2

    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=10_000)
    try:
        client.admin.command("ping")
        database = client[args.database] if args.database else client.get_default_database()
        if database is None:
            print("Database tidak diketahui; set nama database di MONGO URI atau gunakan --database.", file=sys.stderr)
            return 2
        counts = export_from_mongo(database, args.output_dir)
    except Exception as error:  # Report database and export failures to the caller.
        print(f"Ekspor episode gagal: {error}", file=sys.stderr)
        return 1
    finally:
        client.close()

    print(f"Ekspor selesai ke {args.output_dir.resolve()}")
    print(f"episodes.csv: {counts['episodes']} baris episode")
    print(f"events.csv: {counts['events']} node bertimestamp")
    print(f"interpretations.jsonl: {counts['interpretations']} interpretasi")
    print(f"scenario_comparison.xlsx: {args.output_dir / 'scenario_comparison.xlsx'}")
    print(f"Peserta ditemukan: {counts['participants']} dari P0001-P0016")
    print(f"Skenario B - One-way Feedback: {counts['b_sessions']} sesi, {counts['b_events']} event, {counts['b_interpretations']} interpretasi")
    print(f"Skenario C - Human in the loop: {counts['c_sessions']} sesi, {counts['c_events']} event, {counts['c_interpretations']} interpretasi")
    print("Prompt/model version tidak tersedia pada record lama akan diekspor sebagai null.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
