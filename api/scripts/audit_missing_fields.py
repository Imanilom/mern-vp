#!/usr/bin/env python3
"""List blank fields in the exported interpretation, event, and episode files."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any, Iterable


SOURCE_FILES = ("interpretations.jsonl", "events.csv", "episodes.csv")
CSV_CONTEXT_FIELDS = ("participant_id", "session_id", "run_id", "episode_id")
CSV_JSON_FIELDS = ("input_json", "output_json", "evidence_json", "versions_json",
                   "episode_json", "analysis_json", "meta_json")
AUDIT_FIELDS = (
    "source_file",
    "line_number",
    "record_type",
    "record_id",
    "participant_id",
    "session_id",
    "run_id",
    "episode_id",
    "field_path",
    "missing_kind",
    "value",
)


def _blank_kind(value: Any) -> str | None:
    if value is None:
        return "null"
    if isinstance(value, str) and not value.strip():
        return "empty_string"
    return None


def _walk_json(value: Any, prefix: str = "") -> Iterable[tuple[str, str]]:
    kind = _blank_kind(value)
    if kind:
        yield prefix, kind
    elif isinstance(value, dict):
        for key, child in value.items():
            path = f"{prefix}.{key}" if prefix else str(key)
            yield from _walk_json(child, path)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from _walk_json(child, f"{prefix}[{index}]")


def _path_value(record: dict[str, Any], path: str) -> tuple[bool, Any]:
    value: Any = record
    for key in path.split("."):
        if not isinstance(value, dict) or key not in value:
            return False, None
        value = value[key]
    return True, value


def _audit_entry(
    source_file: str,
    line_number: int,
    record_type: str,
    record_id: str,
    context: dict[str, Any],
    field_path: str,
    missing_kind: str,
) -> dict[str, Any]:
    return {
        "source_file": source_file,
        "line_number": line_number,
        "record_type": record_type,
        "record_id": record_id,
        **{field: context.get(field, "") or "" for field in CSV_CONTEXT_FIELDS[:3]},
        "episode_id": context.get("episode_id", "") or "",
        "field_path": field_path,
        "missing_kind": missing_kind,
        "value": {
            "empty_cell": "<empty cell>",
            "empty_string": "<empty string>",
            "null": "<null>",
            "missing_key": "<missing key>",
        }[missing_kind],
    }


def _csv_record_id(row: dict[str, str]) -> str:
    if row.get("episode_id"):
        return row["episode_id"]
    if row.get("session_id") or row.get("run_id"):
        return ":".join(
            value for value in (row.get("session_id", ""), row.get("run_id", ""),
                                row.get("node_index", "")) if value
        )
    return ""


def _audit_csv(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open(encoding="utf-8-sig", newline="") as source:
        for line_number, row in enumerate(csv.DictReader(source), start=2):
            context = {field: row.get(field, "") or "" for field in CSV_CONTEXT_FIELDS}
            record_type = row.get("node_type") or "episode"
            record_id = _csv_record_id(row)
            for field, value in row.items():
                if value is None or not value.strip():
                    rows.append(_audit_entry(
                        path.name, line_number, record_type, record_id, context,
                        field, "empty_cell",
                    ))
                    continue
                if field not in CSV_JSON_FIELDS:
                    continue
                try:
                    parsed = json.loads(value)
                except json.JSONDecodeError as error:
                    raise ValueError(
                        f"{path.name}:{line_number}: invalid JSON in {field}: {error}"
                    ) from error
                for nested_path, kind in _walk_json(parsed, field):
                    rows.append(_audit_entry(
                        path.name, line_number, record_type, record_id, context,
                        nested_path, kind,
                    ))
    return rows


def _audit_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open(encoding="utf-8") as source:
        for line_number, line in enumerate(source, start=1):
            if not line.strip():
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError as error:
                raise ValueError(f"{path.name}:{line_number}: invalid JSON: {error}") from error
            context = {field: record.get(field, "") or "" for field in CSV_CONTEXT_FIELDS}
            record_type = record.get("source_type", "interpretation")
            record_id = str(record.get("interpretation_id", ""))
            for field_path, kind in _walk_json(record):
                rows.append(_audit_entry(
                    path.name, line_number, record_type, record_id, context,
                    field_path, kind,
                ))

            expected_paths = ["episode_id"]
            if record_type == "hil_zero_shot_result":
                expected_paths.extend(("output.status", "output.xai.decision"))
            for field_path in expected_paths:
                exists, value = _path_value(record, field_path)
                if not exists:
                    rows.append(_audit_entry(
                        path.name, line_number, record_type, record_id, context,
                        field_path, "missing_key",
                    ))
                elif _blank_kind(value) and not any(
                    item["field_path"] == field_path for item in rows
                    if item["source_file"] == path.name and item["line_number"] == line_number
                ):
                    rows.append(_audit_entry(
                        path.name, line_number, record_type, record_id, context,
                        field_path, _blank_kind(value) or "missing_key",
                    ))
    return rows


def audit_missing_fields(input_dir: Path) -> list[dict[str, Any]]:
    """Return one row per empty CSV cell or empty/null JSON value."""
    missing_paths = [input_dir / name for name in SOURCE_FILES]
    missing_files = [path.name for path in missing_paths if not path.is_file()]
    if missing_files:
        raise FileNotFoundError(
            f"Missing required input file(s) in {input_dir}: {', '.join(missing_files)}"
        )

    rows = _audit_jsonl(missing_paths[0])
    rows.extend(_audit_csv(missing_paths[1]))
    rows.extend(_audit_csv(missing_paths[2]))
    return rows


def write_audit(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=AUDIT_FIELDS)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    default_input = Path(__file__).resolve().parents[2] / "simulation"
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, default=default_input)
    parser.add_argument("--output", type=Path, default=default_input / "missing_fields.csv")
    args = parser.parse_args()

    rows = audit_missing_fields(args.input_dir)
    write_audit(args.output, rows)
    print(f"Wrote {len(rows)} missing-field records to {args.output}")


if __name__ == "__main__":
    main()
