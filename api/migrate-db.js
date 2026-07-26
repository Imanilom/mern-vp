import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Default values, can be overridden by environment variables
const SOURCE_URI = process.env.SOURCE_MONGO_URI || "mongodb+srv://memerlin90:LYyX217FP02iuCqV@pak.21cks.mongodb.net/?retryWrites=true&w=majority&appName=pak";
const TARGET_URI = process.env.TARGET_MONGO_URI || "mongodb://localhost:27017/healthdevice";

async function migrate() {
  console.log('Connecting to Source DB (Atlas)...');
  const sourceConn = await mongoose.createConnection(SOURCE_URI).asPromise();
  
  console.log('Connecting to Target DB (Local)...');
  const targetConn = await mongoose.createConnection(TARGET_URI).asPromise();

  console.log('Connected to both databases successfully.');

  const dbSource = sourceConn.db;
  const dbTarget = targetConn.db;

  const collections = await dbSource.listCollections().toArray();
  
  for (let colInfo of collections) {
    const colName = colInfo.name;
    if (colName.startsWith('system.')) continue;
    
    console.log(`\nMigrating collection: ${colName}...`);
    const sourceCollection = dbSource.collection(colName);
    const targetCollection = dbTarget.collection(colName);

    const docs = await sourceCollection.find({}).toArray();
    
    if (docs.length > 0) {
      try {
        // Uncomment the line below to clear the target collection before importing
        // await targetCollection.deleteMany({});
        
        await targetCollection.insertMany(docs, { ordered: false });
        console.log(`  -> Successfully inserted ${docs.length} documents into ${colName}`);
      } catch (err) {
        // If ordered: false, it will continue even if some docs have duplicate keys
        console.error(`  -> Error inserting into ${colName} (some documents might already exist):`, err.message);
      }
    } else {
      console.log(`  -> Collection ${colName} is empty. Skipping.`);
    }
  }

  console.log('\nMigration complete!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
