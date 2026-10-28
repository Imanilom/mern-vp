import math
import unittest

from simulation.backfill_polar_rrms import calculate_missing_rmssd


class BackfillPolarRmssdTests(unittest.TestCase):
    def test_calculates_only_missing_values_within_continuous_activity(self):
        documents = [
            {"_id": "prior", "timestamp": 990, "rr": 790, "activity": "Duduk"},
            {"_id": "first", "timestamp": 1000, "rr": 800, "activity": "Duduk"},
            {
                "_id": "existing",
                "timestamp": 1001,
                "rr": 820,
                "rrms": 77,
                "activity": "Duduk",
            },
            {"_id": "changed", "timestamp": 1002, "rr": 830, "activity": "Berjalan"},
            {"_id": "gap", "timestamp": 1040, "rr": 840, "activity": "Berjalan"},
            {"_id": "recovered", "timestamp": 1041, "rr": 850, "activity": "Berjalan"},
            {"_id": "invalid", "timestamp": 1042, "rr": math.nan, "activity": "Berjalan"},
            {
                "_id": "other-device",
                "timestamp": 1043,
                "rr": 900,
                "activity": "Berjalan",
                "device_id": "polar-2",
            },
        ]
        for document in documents:
            document.setdefault("device_id", "polar-1")

        result = calculate_missing_rmssd(documents, 1000, 1100)

        self.assertEqual(result, {"first": 10.0, "recovered": 10.0})


if __name__ == "__main__":
    unittest.main()
