const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGO).then(async () => {
  try {
    const db = mongoose.connection.db;
    const docsToDelete = await db.collection('polardatas').find({ isChecked: true }).limit(200000).project({_id: 1}).toArray();
    const ids = docsToDelete.map(d => d._id);
    const result = await db.collection('polardatas').deleteMany({ _id: { $in: ids } });
    console.log('Deleted documents:', result.deletedCount);
  } catch(err) {
    console.error(err);
  }
  process.exit(0);
});
