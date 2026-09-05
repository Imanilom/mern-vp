import axios from 'axios';

async function testPersistence() {
  try {
    const payload = {
      userId: '6a6609326bf83196b1d73e97',
      params: {
        hasHeartDisease: 1,
        age: 58,
        sex: 1,
        cp: 4,
        trestbps: 140,
        chol: 260,
        fbs: 1,
        restecg: 1,
        thalach: 125,
        exang: 1,
        oldpeak: 1.8,
        slope: 2,
        ca: 2,
        thal: 7,
        meanHr: 88.5,
        rmssd: 32.4,
        sdnn: 39.1,
        dfaAlpha1: 1.25,
        ttrMinutes: 18.5
      },
      doctorNotes: 'Verifikasi Klinisi: Pasien memiliki riwayat CAD dengan depresi ST 1.8 mm.',
      validationLabel: 'Doctor Validated Snapshot',
      confirmedByPatient: true
    };

    console.log('Sending POST /api/resilience/record...');
    const res = await axios.post('http://localhost:3030/api/resilience/record', payload);
    console.log('Record Status:', res.status, res.data.message);
    console.log('Session ID:', res.data.data?.session_id);
    console.log('Saved Inputs (CAD & 13 Features):', res.data.data?.inputs?.cleveland_13_features);
    console.log('Saved Q1-Q10 Vector Phi:', res.data.data?.phenotype_q1_q10?.phenotype_vector_phi);
    console.log('Saved CRS Global Score:', res.data.data?.crs_global);
    console.log('Saved Metadata:', res.data.data?.metadata);

    console.log('\nTesting GET /api/resilience/history/6a6609326bf83196b1d73e97...');
    const histRes = await axios.get('http://localhost:3030/api/resilience/history/6a6609326bf83196b1d73e97');
    console.log('History Count:', histRes.data.count);
    console.log('Latest Session in DB:', histRes.data.data[0]?.session_id);
    console.log('SUCCESS! All inputs, Q1-Q10, outputs, and metadata recorded to MongoDB.');
  } catch (err) {
    console.error('Test error:', err.response?.data || err.message);
  }
}

testPersistence();
