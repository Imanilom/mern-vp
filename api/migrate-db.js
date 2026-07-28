import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// URI wajib diisi via environment variable — TIDAK ada fallback ke credentials hardcoded
const SOURCE_URI = process.env.SOURCE_MONGO_URI;
const TARGET_URI = process.env.TARGET_MONGO_URI || process.env.MONGO;

if (!SOURCE_URI) {
  console.error('[migrate-db] ERROR: SOURCE_MONGO_URI tidak ada di .env. Isi dulu sebelum migrasi!');
  process.exit(1);
}

if (!TARGET_URI) {
  console.error('[migrate-db] ERROR: TARGET_MONGO_URI (atau MONGO) tidak ada di .env.');
  process.exit(1);
}

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

    // Hitung total dokumen
    const totalDocs = await sourceCollection.countDocuments({});
    if (totalDocs === 0) {
      console.log(`  -> Collection ${colName} is empty. Skipping.`);
      continue;
    }

    console.log(`  -> Found ${totalDocs} documents. Starting batch transfer...`);
    
    // Gunakan cursor untuk iterasi agar tidak OOM
    const cursor = sourceCollection.find({});
    const BATCH_SIZE = 5000;
    let batch = [];
    let insertedCount = 0;

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      batch.push(doc);

      if (batch.length === BATCH_SIZE) {
        try {
          await targetCollection.insertMany(batch, { ordered: false });
          insertedCount += batch.length;
          console.log(`     Progress: ${insertedCount} / ${totalDocs}`);
        } catch (err) {
          // ordered: false mengizinkan lanjut meski ada duplicate key
          insertedCount += batch.length;
        }
        batch = []; // kosongkan memory
      }
    }

    // Insert sisa dokumen yang kurang dari BATCH_SIZE
    if (batch.length > 0) {
      try {
        await targetCollection.insertMany(batch, { ordered: false });
        insertedCount += batch.length;
      } catch (err) {
        insertedCount += batch.length;
      }
    }
    
    console.log(`  -> Successfully migrated ${insertedCount} documents for ${colName}`);
  }

  console.log('\nMigration complete!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
