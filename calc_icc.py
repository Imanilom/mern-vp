import numpy as np
import pandas as pd
import pymongo
from bson import ObjectId
from datetime import datetime
import statsmodels.formula.api as smf
import warnings
warnings.filterwarnings('ignore')

uri = 'mongodb://capar_admin:SecurePassword123!@127.0.0.1:27017/test?authSource=admin'
client = pymongo.MongoClient(uri)
collection = client['test']['polardatas']

def get_stats(user_id):
    query_id = ObjectId(user_id) if collection.count_documents({'user_id': ObjectId(user_id)}) > 0 else user_id
    docs = list(collection.find({
        'user_id': query_id,
        'activity': {'$in': ['Duduk', 'Berjalan']},
        'hr': {'$exists': True, '$type': 'number'},
        'rr': {'$exists': True, '$type': 'number'}
    }))
    
    if not docs:
        print(f'User {user_id} - No Data')
        return
        
    df = pd.DataFrame(docs)
    
    def parse_dt(row):
        if pd.notna(row.get('date_created')):
            try: return pd.to_datetime(row['date_created'], format='%d-%m-%Y').strftime('%Y-%m-%d')
            except: pass
        if pd.notna(row.get('timestamp')):
            ts = row['timestamp']
            ts = ts / 1000.0 if ts > 1e11 else float(ts)
            return datetime.fromtimestamp(ts).strftime('%Y-%m-%d')
        return None
            
    df['date'] = df.apply(parse_dt, axis=1)
    df = df.dropna(subset=['date', 'hr', 'rr', 'activity'])
    
    print(f'--- PESERTA {user_id} ---')
    
    for act in ['Duduk', 'Berjalan']:
        d_act = df[df['activity'] == act]
        if d_act.empty:
            print(f'{act}: No Data')
            continue
            
        print(f'Centroid {act}: HR = {d_act["hr"].mean():.2f} ± {d_act["hr"].std():.2f}, RR = {d_act["rr"].mean():.2f} ± {d_act["rr"].std():.2f} (N={len(d_act)})')
        
        # Optimize ICC calculation by downsampling to max 2000 points
        if len(d_act) > 2000:
            d_act = d_act.sample(n=2000, random_state=42)
            
        if d_act['date'].nunique() > 1:
            try:
                md_hr = smf.mixedlm('hr ~ 1', d_act, groups=d_act['date']).fit(method='lbfgs')
                icc_hr = md_hr.cov_re.iloc[0,0] / (md_hr.cov_re.iloc[0,0] + md_hr.scale)
                
                md_rr = smf.mixedlm('rr ~ 1', d_act, groups=d_act['date']).fit(method='lbfgs')
                icc_rr = md_rr.cov_re.iloc[0,0] / (md_rr.cov_re.iloc[0,0] + md_rr.scale)
                
                print(f'ICC (Antar-hari) {act} -> HR: {icc_hr:.4f} | RR: {icc_rr:.4f}')
            except Exception as e:
                print(f'ICC calculation failed: {str(e)[:50]}')
        else:
            print(f'ICC {act}: Not enough days ({d_act["date"].nunique()} days found)')
            
get_stats('6a98264316b1f3634c777f82')
print()
get_stats('6a8f9fab74156d89d1dc3c47')
