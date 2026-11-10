import importlib.util
import csv
import json
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "audit_missing_fields.py"
SPEC = importlib.util.spec_from_file_location("audit_missing_fields", SCRIPT)
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)


class MissingFieldAuditTests(unittest.TestCase):
    def test_lists_blank_csv_cells_nested_json_and_missing_interpretation_keys(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            input_dir = Path(temp_dir)
            (input_dir / "interpretations.jsonl").write_text(
                json.dumps({
                    "interpretation_id": "int-1",
                    "source_type": "hil_zero_shot_result",
                    "participant_id": "P0001",
                    "versions": {"prompt_version": None, "model_version": None},
                    "output": {"explanation": "text"},
                }) + "\n",
                encoding="utf-8",
            )
            with (input_dir / "events.csv").open("w", encoding="utf-8", newline="") as file:
                writer = csv.writer(file)
                writer.writerow([
                    "episode_id", "participant_id", "session_id", "run_id",
                    "node_index", "node_type", "evidence_json",
                ])
                writer.writerow([
                    "", "P0001", "s-1", "r-1", 1, "interaction",
                    json.dumps({"clarification": ""}),
                ])
            (input_dir / "episodes.csv").write_text(
                "episode_id,participant_id,baseline_hr\n"
                "e-1,P0001,\n",
                encoding="utf-8",
            )

            rows = AUDIT.audit_missing_fields(input_dir)
            findings = {
                (row["source_file"], row["line_number"], row["field_path"], row["missing_kind"])
                for row in rows
            }

        self.assertIn(("interpretations.jsonl", 1, "versions.prompt_version", "null"), findings)
        self.assertIn(("interpretations.jsonl", 1, "episode_id", "missing_key"), findings)
        self.assertIn(("interpretations.jsonl", 1, "output.status", "missing_key"), findings)
        self.assertIn(("interpretations.jsonl", 1, "output.xai.decision", "missing_key"), findings)
        self.assertIn(("events.csv", 2, "episode_id", "empty_cell"), findings)
        self.assertIn(("events.csv", 2, "evidence_json.clarification", "empty_string"), findings)
        self.assertIn(("episodes.csv", 2, "baseline_hr", "empty_cell"), findings)

    def test_reports_missing_input_files(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            with self.assertRaises(FileNotFoundError):
                AUDIT.audit_missing_fields(Path(temp_dir))


if __name__ == "__main__":
    unittest.main()
