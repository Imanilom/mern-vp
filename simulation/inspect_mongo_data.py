import pymongo
import json
from bson import ObjectId

URI = "mongodb://capar_admin:SecurePassword123!@127.0.0.1:27017/test?authSource=admin"
client = pymongo.MongoClient(URI, serverSelectionTimeoutMS=5000)
db = client['test']

users = list(db.users.find({}, {'_id': 1, 'name': 1, 'email': 1, 'guid': 1}))
print(f"Total users in test db: {len(users)}")

user_stats = []
for u in users:
    uid = u['_id']
    seg_cnt = db.segments.count_documents({'user_id': uid})
    ev_cnt = db.anomalyevents.count_documents({'user_id': uid})
    relapse_cnt = db.anomalyevents.count_documents({
        'user_id': uid,
        '$or': [{'relapse': True}, {'relapse_count': {'$gt': 0}}]
    })
    
    # Check trajectory with multi-peak or long sequences
    events = list(db.anomalyevents.find({'user_id': uid}).sort('duration_ms', -1).limit(5))
    max_duration = events[0].get('duration_ms', 0) if events else 0
    max_seq_len = max([len(e.get('trajectory', {}).get('sequence_of_scores', [])) for e in events]) if events else 0

    if seg_cnt > 0 or ev_cnt > 0:
        user_stats.append({
            'id': str(uid),
            'name': u.get('name') or u.get('email') or 'Unnamed',
            'email': u.get('email', '-'),
            'segments': seg_cnt,
            'events': ev_cnt,
            'relapses': relapse_cnt,
            'max_duration_ms': max_duration,
            'max_seq_len': max_seq_len
        })

user_stats.sort(key=lambda x: (x['events'], x['segments']), reverse=True)
for s in user_stats:
    print(f"User: {s['id']} | {s['name']} | Segs: {s['segments']} | Events: {s['events']} | Relapses: {s['relapses']} | Max Dur: {s['max_duration_ms']/60000:.1f}m | Max Seq: {s['max_seq_len']}")
