import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const mongoUri = process.env.MONGO || 'mongodb://capar_admin:SecurePassword123!@127.0.0.1:27017/test?authSource=admin';

async function check() {
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  const db = mongoose.connection.useDb('test'); // Wait, default db?
  // Let's just use models directly
  
  const MarkovSchema = new mongoose.Schema({ user_id: mongoose.Schema.Types.ObjectId, status: String, matrix: Array }, { collection: 'markovmodels', strict: false });
  const Markov = mongoose.model('Markov', MarkovSchema);
  
  const TransitionSchema = new mongoose.Schema({ user_id: mongoose.Schema.Types.ObjectId, activity: String }, { collection: 'statetransitions', strict: false });
  const Transition = mongoose.model('Transition', TransitionSchema);

  const userId = new mongoose.Types.ObjectId('6a82ccd8483cdfd43096a96f');
  
  const markovs = await Markov.find({ user_id: userId }).lean();
  console.log('Markov Models found:', markovs.length);
  if (markovs.length) console.log(JSON.stringify(markovs, null, 2));
  
  const transitions = await Transition.find({ user_id: userId }).lean();
  console.log('State Transitions found:', transitions.length);
  if (transitions.length) console.log(JSON.stringify(transitions, null, 2));

  process.exit(0);
}

check();
