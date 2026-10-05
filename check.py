import pymongo
from bson import ObjectId
uri = 'mongodb://capar_admin:SecurePassword123!@127.0.0.1:27017/test?authSource=admin'
client = pymongo.MongoClient(uri)
db = client['test']
coll = db['polardatas']

for uid in ['6a98264316b1f3634c777f82', '6a8f9fab74156d89d1dc3c47']:
    print(f'\n--- User {uid} ---')
    pipeline = [
        {'$match': {'user_id': ObjectId(uid)}},
        {'$group': {'_id': '$activity', 'count': {'$sum': 1}}}
    ]
    res = list(coll.aggregate(pipeline))
    if not res:
        print('No data found for ObjectId')
    else:
        for r in res:
            print(f'Activity: "{r["_id"]}", Count: {r["count"]}')
