#!/usr/bin/env python3
"""Safely backfill missing PolarData rolling RMSSD values for one time window."""

from __future__ import annotations

import argparse
import math
import os
import sys
from datetime import datetime, time, timedelta, timezone

try:
    from bson import ObjectId
    from pymongo import MongoClient, UpdateOne
except ImportError as exc:
    missing = getattr(exc, "name", None) or str(exc)
    raise SystemExit(
        f"Dependency missing ({missing}). "
        "Install with: pip install -r simulation/requirements_eda.txt"
    ) from exc


JAKARTA = timezone(timedelta(hours=7), name="WIB")
DEFAULT_USER_ID = "6a8f9fab74156d89d1dc3c47"
DEFAULT_DATE = "2026-10-28"
MIN_RR_MS = 300
MAX_RR_MS = 2000
WINDOW_SECONDS = 60
MAX_GAP_SECONDS = 30


def epoch_seconds(value):
    if isinstance(value, datetime):
        parsed = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        return parsed.timestamp()
    if isinstance(value, (int, float)) and math.isfinite(value):
        return value / 1000 if abs(value) >= 10_000_000_000 else value
    return None


def calculate_missing_rmssd(documents, start_seconds, end_seconds):
    calculated = {}
    device_groups = {}
    for document in documents:
        device_groups.setdefault(document.get("device_id") or "UNKNOWN", []).append(document)

    for device_documents in device_groups.values():
        ordered = []
        for document in device_documents:
            timestamp = epoch_seconds(document.get("timestamp"))
            rr = document.get("rr")
            if timestamp is None or not isinstance(rr, (int, float)) or not math.isfinite(rr):
                continue
            ordered.append((timestamp, document, float(rr)))
        ordered.sort(key=lambda item: (item[0], str(item[1].get("_id", ""))))

        window = []
        previous = None
        for timestamp, document, rr in ordered:
            if not MIN_RR_MS <= rr <= MAX_RR_MS:
                continue

            activity = document.get("activity")
            if previous is not None and (
                activity != previous[1] or timestamp - previous[0] > MAX_GAP_SECONDS
            ):
                window = []

            cutoff = timestamp - WINDOW_SECONDS
            window = [item for item in window if item[0] >= cutoff]
            window.append((timestamp, rr))
            if len(window) >= 2 and start_seconds <= timestamp < end_seconds:
                differences = [
                    window[index][1] - window[index - 1][1]
                    for index in range(1, len(window))
                ]
                rmssd = math.sqrt(sum(value * value for value in differences) / len(differences))
                if document.get("rrms") is None:
                    calculated[document["_id"]] = round(rmssd, 2)
            previous = (timestamp, activity)
    return calculated


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--user-id", default=DEFAULT_USER_ID)
    parser.add_argument("--date", default=DEFAULT_DATE, help="Local date in YYYY-MM-DD format")
    parser.add_argument("--start", default="08:00", help="Start time in WIB (HH:MM)")
    parser.add_argument("--end", default="09:30", help="Exclusive end time in WIB (HH:MM)")
    parser.add_argument("--database", default="test")
    parser.add_argument("--collection", default="polardatas")
    parser.add_argument("--apply", action="store_true", help="Write calculated values to MongoDB")
    return parser.parse_args()


def main():
    args = parse_args()
    if not ObjectId.is_valid(args.user_id):
        print("Error: --user-id must be a valid Mongo ObjectId.", file=sys.stderr)
        return 2
    try:
        day = datetime.strptime(args.date, "%Y-%m-%d").date()
        start_time = datetime.strptime(args.start, "%H:%M").time()
        end_time = datetime.strptime(args.end, "%H:%M").time()
    except ValueError as exc:
        print(f"Error: invalid date or time: {exc}", file=sys.stderr)
        return 2
    if end_time <= start_time:
        print("Error: --end must be later than --start on the same date.", file=sys.stderr)
        return 2

    mongo_uri = os.getenv("SIM_MONGO_URI") or os.getenv("MONGO_URI")
    if not mongo_uri:
        print(
            "Error: set SIM_MONGO_URI or MONGO_URI and ensure the SSH tunnel is open.",
            file=sys.stderr,
        )
        return 2

    start = datetime.combine(day, start_time, tzinfo=JAKARTA).timestamp()
    end = datetime.combine(day, end_time, tzinfo=JAKARTA).timestamp()
    user_id = ObjectId(args.user_id)
    query = {
        "user_id": user_id,
        "$or": [
            {"timestamp": {"$gte": start - WINDOW_SECONDS, "$lt": end}},
            {
                "timestamp": {
                    "$gte": (start - WINDOW_SECONDS) * 1000,
                    "$lt": end * 1000,
                }
            },
        ],
    }

    try:
        with MongoClient(
            mongo_uri,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            appname="polar-rrms-backfill",
        ) as client:
            collection = client[args.database][args.collection]
            documents = list(collection.find(
                query,
                {
                    "timestamp": 1,
                    "rr": 1,
                    "rrms": 1,
                    "activity": 1,
                    "device_id": 1,
                },
            ))
            missing_in_window = sum(
                1
                for document in documents
                if start <= (epoch_seconds(document.get("timestamp")) or float("-inf")) < end
                and document.get("rrms") is None
            )
            calculated = calculate_missing_rmssd(documents, start, end)

            print(f"User: {args.user_id}")
            print(f"Window WIB: {args.date} {args.start}–{args.end} (end exclusive)")
            print(f"Missing/null rrms in window: {missing_in_window}")
            print(f"Eligible for backfill: {len(calculated)}")
            print(f"Mode: {'APPLY' if args.apply else 'DRY RUN'}")

            if not args.apply:
                return 0

            operations = [
                UpdateOne(
                    {
                        "_id": document_id,
                        "$or": [{"rrms": None}, {"rrms": {"$exists": False}}],
                    },
                    {"$set": {"rrms": value}},
                )
                for document_id, value in calculated.items()
            ]
            if operations:
                result = collection.bulk_write(operations, ordered=False)
                print(f"Updated rrms values: {result.modified_count}")
            else:
                print("Updated rrms values: 0")

            remaining = collection.count_documents({
                "$and": [
                    {"user_id": user_id},
                    {
                        "$or": [
                            {"timestamp": {"$gte": start, "$lt": end}},
                            {
                                "timestamp": {
                                    "$gte": start * 1000,
                                    "$lt": end * 1000,
                                }
                            },
                        ]
                    },
                    {"$or": [{"rrms": None}, {"rrms": {"$exists": False}}]},
                ]
            })
            print(f"Remaining missing/null rrms in window: {remaining}")
    except Exception as exc:
        print(
            f"MongoDB operation failed ({type(exc).__name__}); "
            "connection details are omitted.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
