import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

console.log('ENV MONGO:', process.env.MONGO);
const candidates = [
  process.env.MONGO,
  'mongodb://capar_admin:SecurePassword123!@127.0.0.1:27017/test?authSource=admin',
  'mongodb://healthdevice:UAVqoi07o5EP4IT@nosql.smartsystem.id:27017/healthdevice',
  'mongodb://127.0.0.1:27017/healthdevice',
  'mongodb://127.0.0.1:27017/capar-vp',
  'mongodb://localhost:27017/mern-vp'
];

for (const uri of candidates) {
  if (!uri) continue;
  try {
    console.log('\nTesting connection to:', uri.replace(/:[^:@]+@/, ':***@'));
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
    console.log('CONNECTED successfully!');
    const dbs = await mongoose.connection.db.admin().listDatabases();
    console.log('Databases on cluster:');
    for (const d of dbs.databases) {
      console.log(' -', d.name);
    }
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`Collections in current DB (${mongoose.connection.name}):`);
    for (const c of collections) {
      const count = await mongoose.connection.db.collection(c.name).countDocuments();
      console.log(`   * ${c.name}: ${count} docs`);
    }
    await mongoose.disconnect();
    break;
  } catch (err) {
    console.log('Failed:', err.message);
  }
}
process.exit(0);
