import mongoose from 'mongoose';
import User from './models/user.model.js';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGO || 'mongodb://127.0.0.1:27017/healthdevice').then(async () => {
  const id = '675ba1e92b8428e4dd641cd0'; // memerlin90@gmail.com
  const doctorObjId = new mongoose.Types.ObjectId(id);
  
  const patients1 = await User.find({
      $or: [
          { docter: doctorObjId },
          { docter: id.toString() }
      ]
  }).lean();
  
  console.log('Found patients via docter field:', patients1.length);
  if (patients1.length > 0) {
     console.log('Sample found patient docter field type:', typeof patients1[0].docter, patients1[0].docter);
  } else {
     const fallback = await User.find({ role: 'user' }).lean();
     console.log('Total users with role=user:', fallback.length);
  }
  process.exit(0);
});
