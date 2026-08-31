import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

const URIS = [
  'mongodb://capar_admin:SecurePassword123!@127.0.0.1:27017/test?authSource=admin',
  'mongodb://capar_admin:SecurePassword123!@127.0.0.1:27017/healthdevice?authSource=admin',
  'mongodb://capar_admin:SecurePassword123!@127.0.0.1:27017/capar-vp?authSource=admin',
  'mongodb://capar_admin:SecurePassword123!@127.0.0.1:27017/capar-db?authSource=admin',
  'mongodb+srv://memerlin90:LYyX217FP02iuCqV@pak.21cks.mongodb.net/test?retryWrites=true&w=majority&appName=pak'
];

async function testConnections() {
  for (const uri of URIS) {
    try {
      console.log('\n---------------------------------------------------------');
      console.log('Trying URI:', uri.replace(/:[^:@]+@/, ':***@'));
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
      console.log('✅ SUCCESS CONNECTED!');
      
      const adminDb = mongoose.connection.db.admin();
      const dbList = await adminDb.listDatabases();
      console.log('Databases on server:', dbList.databases.map(d => d.name));

      const collections = await mongoose.connection.db.listCollections().toArray();
      console.log('Collections in current db:', collections.map(c => c.name));

      // Quick count of AnomalyEvent or Segment in current DB
      for (const collName of collections.map(c => c.name)) {
        const count = await mongoose.connection.db.collection(collName).countDocuments();
        console.log(`  - Collection '${collName}': ${count} docs`);
      }
      
      await mongoose.disconnect();
    } catch (err) {
      console.log('❌ Failed:', err.message);
      try { await mongoose.disconnect(); } catch (e) {}
    }
  }
}

testConnections();
