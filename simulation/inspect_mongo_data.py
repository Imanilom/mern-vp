import pymongo
import json
from bson import json_util

URI = "mongodb://healthdevice:UAVqoi07o5EP4IT@nosql.smartsystem.id:27017/healthdevice"
client = pymongo.MongoClient(URI, serverSelectionTimeoutMS=5000)
db = client['healthdevice']

print("=== SAMPLE USERS ===")
for u in db.users.find().limit(2):
    print("User:", u.get('username') or u.get('name'), "Email:", u.get('email'), "Role:", u.get('role'), "Age/Gender:", u.get('age'), u.get('gender'))

print("\n=== SAMPLE PATIENTS ===")
for p in db.patients.find().limit(2):
    print("Patient:", p.get('name'), "Device:", p.get('current_device'))

print("\n=== SAMPLE BASELINES ===")
for b in db.baselines.find().limit(2):
    print("Baseline keys:", list(b.keys()))
    print("Baseline sample:", json.dumps(json.loads(json_util.dumps(b)), indent=2)[:400])

print("\n=== SAMPLE ANOMAL_EVENTS ===")
for e in db.anomal_events.find().limit(2):
    print("Event keys:", list(e.keys()))
    print("Event sample:", json.dumps(json.loads(json_util.dumps(e)), indent=2)[:500])

print("\n=== SAMPLE SEGMENTS ===")
for s in db.segments.find().limit(2):
    print("Segment keys:", list(s.keys()))
    print("Segment sample:", json.dumps(json.loads(json_util.dumps(s)), indent=2)[:600])
