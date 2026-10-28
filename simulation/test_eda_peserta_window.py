import unittest
from datetime import datetime, time, timedelta, timezone
from pathlib import Path
from tempfile import TemporaryDirectory

from bson import ObjectId

from eda_peserta_window import (
    build_report,
    create_plots,
    documents_to_frame,
    local_datetime,
    make_query,
    parse_timestamp,
)


class ParticipantWindowEdaTests(unittest.TestCase):
    def setUp(self):
        self.day = datetime(2026, 10, 28).date()
        self.start = local_datetime(self.day, time(8, 0))
        self.end = local_datetime(self.day, time(9, 30))

    def test_epoch_seconds_and_milliseconds_are_normalized(self):
        expected = datetime(2026, 10, 28, 1, 15, tzinfo=timezone.utc)
        seconds = expected.timestamp()
        self.assertEqual(parse_timestamp(seconds), expected)
        self.assertEqual(parse_timestamp(seconds * 1000), expected)

    def test_string_timestamps_without_timezone_are_interpreted_as_wib(self):
        parsed = parse_timestamp("2026-10-28T08:15:00")
        self.assertEqual(parsed, datetime(2026, 10, 28, 1, 15, tzinfo=timezone.utc))

    def test_frame_filters_window_and_maps_sensor_fields(self):
        start = datetime(2026, 10, 28, 1, 0, tzinfo=timezone.utc)
        docs = [
            {
                "_id": ObjectId(),
                "timestamp": start.timestamp(),
                "hr": 72,
                "rr": 830,
                "rrms": 34,
                "activity": "Duduk",
            },
            {
                "_id": ObjectId(),
                "timestamp": (start + timedelta(minutes=45)).timestamp(),
                "hr": 82,
                "rr": 720,
                "activity": "Berjalan",
            },
            {
                "_id": ObjectId(),
                "timestamp": self.end.timestamp(),
                "hr": 99,
                "rr": 600,
                "activity": "Lainnya",
            },
        ]
        frame = documents_to_frame(docs, self.start, self.end)
        self.assertEqual(len(frame), 2)
        self.assertEqual(frame.iloc[0]["hr"], 72)
        self.assertEqual(frame.iloc[1]["activity"], "Berjalan")
        self.assertEqual(
            frame.iloc[0]["recorded_at_wib"].isoformat(),
            "2026-10-28T08:00:00+07:00",
        )

    def test_query_scopes_user_and_epoch_units(self):
        user_id = ObjectId("6a8f9fab74156d89d1dc3c47")
        query = make_query(user_id, self.start, self.end)
        self.assertEqual(query["user_id"], user_id)
        seconds_range, milliseconds_range, _created_range = query["$or"]
        self.assertLess(seconds_range["timestamp"]["$gte"], milliseconds_range["timestamp"]["$gte"])
        self.assertEqual(seconds_range["timestamp"]["$lt"], self.end.timestamp())

    def test_summary_excludes_full_participant_identifier(self):
        timestamp = datetime(2026, 10, 28, 1, 0, tzinfo=timezone.utc)
        frame = documents_to_frame(
            [{"timestamp": timestamp.timestamp(), "hr": 72, "rr": 830}],
            self.start,
            self.end,
        )
        report = build_report(
            frame,
            "6a8f9fab74156d89d1dc3c47",
            self.start,
            self.end,
            fetched_count=1,
        )
        self.assertEqual(report["participant_id"], "6a8f9fab…")
        self.assertEqual(report["metrics"]["hr"]["mean"], 72.0)
        self.assertEqual(report["timezone"], "Asia/Jakarta (UTC+07:00)")
        self.assertIsInstance(report["quality_flags"], dict)
        self.assertEqual(report["quality_flags"]["rr_iqr_outliers_descriptive_only"], 0)

    def test_plots_are_created_for_real_and_empty_windows(self):
        timestamp = datetime(2026, 10, 28, 1, 0, tzinfo=timezone.utc)
        frame = documents_to_frame(
            [
                {"timestamp": timestamp.timestamp(), "hr": 72, "rr": 830, "rrms": 34, "activity": "Duduk"},
                {
                    "timestamp": (timestamp + timedelta(seconds=30)).timestamp(),
                    "hr": 74,
                    "rr": 810,
                    "rrms": 38,
                    "activity": "Duduk",
                },
            ],
            self.start,
            self.end,
        )
        with TemporaryDirectory() as temp_dir:
            output_dir = Path(temp_dir)
            filenames = create_plots(frame, output_dir, "6a8f9fab")
            self.assertEqual(len(filenames), 3)
            self.assertTrue(all((output_dir / name).is_file() for name in filenames))

            empty_names = create_plots(frame.iloc[0:0], output_dir, "6a8f9fab")
            self.assertEqual(len(empty_names), 3)
        report = build_report(
            frame,
            "6a8f9fab74156d89d1dc3c47",
            self.start,
            self.end,
            fetched_count=2,
        )
        self.assertEqual(report["derived_rmssd_from_rr"]["valid_minutes"], 1)


if __name__ == "__main__":
    unittest.main()
