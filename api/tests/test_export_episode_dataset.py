import csv
import importlib.util
import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "export_episode_dataset.py"
SPEC = importlib.util.spec_from_file_location("export_episode_dataset", SCRIPT)
EXPORTER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(EXPORTER)


class EpisodeExportTests(unittest.TestCase):
    def test_episode_export_joins_analysis_and_meta_to_one_row(self):
        events = [{
            "_id": "episode-1",
            "user_id": "user-1",
            "onset_time": 1_798_000_000_000,
            "peak_time": 1_798_000_060_000,
            "classification": "Alert",
            "status": "closed",
        }]
        analyses = [
            {"_id": "analysis-old", "episode_id": "episode-1", "createdAt": datetime(2026, 1, 1, tzinfo=timezone.utc), "anomaly_score": 1.2},
            {"_id": "analysis-new", "episode_id": "episode-1", "createdAt": datetime(2026, 1, 2, tzinfo=timezone.utc), "anomaly_score": 2.4},
        ]
        metas = [{"episode_id": "episode-1", "participant_id": "P01", "status": "persistent"}]

        rows = EXPORTER.build_episode_rows(
            events, analyses, metas, {"user-1": "P0001"}
        )

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["episode_id"], "episode-1")
        self.assertEqual(rows[0]["participant_id"], "P0001")
        self.assertEqual(rows[0]["anomaly_score"], 2.4)
        self.assertEqual(rows[0]["peak_time"], "2026-12-23T04:27:40.000Z")

    def test_event_export_contains_ordered_timestamped_lifecycle_and_segments(self):
        events = [{
            "_id": "episode-1",
            "user_id": "user-1",
            "onset_time": 1_798_000_000_000,
            "candidate_at": 1_798_000_010_000,
            "peak_time": 1_798_000_020_000,
            "status": "open",
        }]
        segments = {"episode-1": [{
            "_id": "segment-1",
            "window_start": 1_798_000_015_000,
            "features": {"mean_hr": 92},
            "anomaly_score": 2.1,
        }]}

        rows = EXPORTER.build_event_rows(events, segments)

        self.assertEqual(
            [row["node_type"] for row in rows],
            ["onset", "candidate", "physiology_window", "peak"],
        )
        self.assertEqual([row["node_index"] for row in rows], [1, 2, 3, 4])
        self.assertTrue(all(row["timestamp"].endswith("Z") for row in rows))

    def test_interpretations_jsonl_retains_io_versions_and_evidence_fields(self):
        sessions = [{
            "_id": "session-1",
            "account_id": "account-1",
            "scenario_id": "c",
            "interpretations": [{
                "version": 2,
                "scenario_id": "c",
                "created_at": datetime(2026, 2, 1, tzinfo=timezone.utc),
                "status": "DEVIATION_CANDIDATE",
                "rule_version": "scenario-v1",
                "prompt_version": "prompt-v3",
                "model_version": "model-v2",
                "observation": {"features": {"mean_hr": 95}},
                "baseline": {"activity": "walking"},
                "statistical_evidence": {"distance": 2.5},
            }],
        }]

        rows = EXPORTER.build_interpretation_rows(
            sessions, [], [], {"account-1": "P0001"}
        )

        self.assertEqual(rows[0]["participant_id"], "P0001")
        self.assertEqual(rows[0]["input"]["scenario_id"], "c")
        self.assertEqual(rows[0]["output"]["status"], "DEVIATION_CANDIDATE")
        self.assertEqual(rows[0]["versions"]["prompt_version"], "prompt-v3")
        self.assertEqual(rows[0]["versions"]["model_version"], "model-v2")
        self.assertEqual(rows[0]["evidence"]["statistical_evidence"]["distance"], 2.5)

    def test_unrecorded_prompt_and_model_versions_are_null(self):
        sessions = [{
            "_id": "session-1",
            "account_id": "account-1",
            "scenario_id": "c",
            "interpretations": [{
                "version": 1,
                "scenario_id": "c",
                "created_at": datetime(2026, 2, 1, tzinfo=timezone.utc),
                "status": "RECOVERY",
                "rule_version": "scenario-v1",
                "observation": {},
                "baseline": {},
            }],
        }]

        row = EXPORTER.build_interpretation_rows(
            sessions, [], [], {"account-1": "P0001"}
        )[0]

        self.assertIsNone(row["versions"]["prompt_version"])
        self.assertIsNone(row["versions"]["model_version"])
        self.assertFalse(row["versions"]["prompt_model_version_recorded"])

    def test_interpretations_exclude_unknown_scenarios(self):
        sessions = [{
            "_id": "scenario-b",
            "account_id": "account-1",
            "scenario_id": "d",
            "interpretations": [{
                "version": 1,
                "scenario_id": "d",
                "status": "RECOVERY",
                "observation": {},
                "baseline": {},
            }],
        }]
        logs = [{
            "_id": "log-b",
            "account_id": "account-1",
            "scenario": "D",
            "event_type": "zero_shot_generated",
        }]

        rows = EXPORTER.build_interpretation_rows(
            sessions, [], logs, {"account-1": "P0001"}
        )

        self.assertEqual(rows, [])

    def test_hil_event_export_keeps_both_scenarios_and_numbers_nodes_by_run(self):
        logs = [
            {
                "_id": "log-2",
                "account_id": "account-1",
                "session_id": "session-1",
                "run_id": "run-1",
                "scenario": "C",
                "event_type": "feedback_presented",
                "createdAt": datetime(2026, 2, 1, 0, 1, tzinfo=timezone.utc),
            },
            {
                "_id": "log-1",
                "account_id": "account-1",
                "session_id": "session-1",
                "run_id": "run-1",
                "scenario": "C",
                "event_type": "scenario_started",
                "createdAt": datetime(2026, 2, 1, 0, 0, tzinfo=timezone.utc),
            },
            {
                "_id": "log-b",
                "account_id": "account-1",
                "session_id": "session-b",
                "run_id": "run-b",
                "scenario": "B",
                "event_type": "scenario_started",
                "createdAt": datetime(2026, 2, 1, 0, 0, tzinfo=timezone.utc),
            },
        ]

        rows = EXPORTER.build_hil_event_rows(logs, {"account-1": "P0001"})

        self.assertEqual(
            [(row["scenario"], row["node_type"]) for row in rows],
            [("C", "scenario_started"), ("C", "feedback_presented"), ("B", "scenario_started")],
        )
        self.assertEqual([row["node_index"] for row in rows], [1, 2, 1])
        self.assertTrue(all(row["timestamp"].endswith("Z") for row in rows))

    def test_workbook_has_separate_b_and_c_sheets_with_all_participant_summaries(self):
        from openpyxl import load_workbook

        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "scenario_comparison.xlsx"
            counts = EXPORTER.write_scenario_workbook(
                path,
                ["P0001", "P0002"],
                [
                    {"account_id": "account-1", "scenario": "B"},
                    {"account_id": "account-2", "scenario": "C"},
                ],
                [
                    {
                        "participant_id": "P0001",
                        "scenario": "B",
                        "source": "patient_hil_scenario_logs",
                        "timestamp": "2026-02-01T00:00:00.000Z",
                        "node_type": "scenario_started",
                    },
                    {
                        "participant_id": "P0002",
                        "scenario": "C",
                        "source": "patient_hil_scenario_logs",
                        "timestamp": "2026-02-01T00:00:00.000Z",
                        "node_type": "scenario_started",
                    },
                ],
                [],
                {"account-1": "P0001", "account-2": "P0002"},
            )
            workbook = load_workbook(path, read_only=True, data_only=True)
            self.assertEqual(workbook.sheetnames, ["B", "C"])
            b_rows = list(workbook["B"].iter_rows(values_only=True))
            c_rows = list(workbook["C"].iter_rows(values_only=True))
            headers = list(b_rows[0])
            participant_index = headers.index("participant_id")
            type_index = headers.index("record_type")
            scenario_index = headers.index("scenario")

            self.assertEqual(len([r for r in b_rows[1:] if r[type_index] == "participant_summary"]), 2)
            self.assertEqual(len([r for r in c_rows[1:] if r[type_index] == "participant_summary"]), 2)
            self.assertEqual(
                [r[participant_index] for r in b_rows[1:] if r[type_index] == "event"],
                ["P0001"],
            )
            self.assertEqual(
                [r[scenario_index] for r in c_rows[1:] if r[type_index] == "event"],
                ["C"],
            )
            self.assertEqual(counts["B"]["events"], 1)
            self.assertEqual(counts["C"]["events"], 1)
            workbook.close()

    def test_files_are_written_as_csv_and_jsonl(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            output = Path(temp_dir)
            episode_count = EXPORTER.write_csv(
                output / "episodes.csv",
                EXPORTER.EPISODE_FIELDS,
                [{"episode_id": "e1", "analysis_json": {"x": 1}}],
            )
            event_count = EXPORTER.write_csv(
                output / "events.csv",
                EXPORTER.EVENT_FIELDS,
                [{"episode_id": "e1", "timestamp": "2026-01-01T00:00:00Z"}],
            )
            interpretation_count = EXPORTER.write_jsonl(
                output / "interpretations.jsonl",
                [{"input": {"value": 1}, "output": {"value": 2}}],
            )

            with (output / "episodes.csv").open(encoding="utf-8-sig", newline="") as file:
                episode_rows = list(csv.DictReader(file))
            with (output / "interpretations.jsonl").open(encoding="utf-8") as file:
                interpretation = json.loads(file.readline())

            self.assertEqual((episode_count, event_count, interpretation_count), (1, 1, 1))
            self.assertEqual(json.loads(episode_rows[0]["analysis_json"]), {"x": 1})
            self.assertEqual(interpretation["output"]["value"], 2)


if __name__ == "__main__":
    unittest.main()
