from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health():
    r=client.get('/api/health');assert r.status_code==200; assert r.json()['mode']=='SYNTHETIC_DEMO'

def test_web_home():
    r=client.get('/'); assert r.status_code==200; assert 'VIDYAMEDIC' in r.text

def test_all_main_sections():
    for route in ('/api/dashboard','/api/profile','/api/monitoring','/api/bi?days=7','/api/ai/insights','/api/recommendations','/api/admin/status'):
        r=client.get(route);assert r.status_code==200, (route,r.text)
    assert len(client.get('/api/dashboard').json()['series'])==145
    assert client.get('/api/bi?days=1').status_code==422

def test_human_feedback_and_followup():
    r=client.post('/api/checkins',json={'context':'Baru selesai berjalan / naik tangga','symptoms':'Tidak ada','note':'Baru naik tangga'})
    assert r.status_code==201
    d=client.get('/api/dashboard').json()
    assert d['last_event']['context']=='Baru selesai berjalan / naik tangga'
    assert d['last_event']['status']=='context_reviewed'
    r=client.post('/api/recommendations/review-recovery/complete',json={'status':'done'})
    assert r.status_code==200
    assert next(x for x in client.get('/api/recommendations').json()['items'] if x['id']=='review-recovery')['status']=='done'

def test_chat_and_safety():
    r=client.post('/api/ai/chat',json={'message':'Mengapa HR naik?'})
    assert r.status_code==200 and r.json()['engine']=='rule_based_demo_not_llm'
    r=client.post('/api/ai/chat',json={'message':'Saya nyeri dada'})
    assert 'darurat' in r.json()['answer']

def test_export_csv():
    r=client.get('/api/reports/export.csv');assert r.status_code==200 and 'SYNTHETIC_DEMO' in r.text
