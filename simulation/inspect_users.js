import mongoose from 'mongoose';
import User from '../api/models/user.model.js';
import Segment from '../api/models/segment.model.js';
import AnomalyEvent from '../api/models/anomalyevent.model.js';

const MONGO = "mongodb://capar_admin:SecurePassword123!@127.0.0.1:27017/test?authSource=admin";

async function main() {
  await mongoose.connect(MONGO);
  console.log("Connected to MongoDB");

  const users = await User.find({}).lean();
  console.log(`Total users found: ${users.length}`);

  const results = [];
  for (const u of users) {
    const segCount = await Segment.countDocuments({ user_id: u._id });
    const evCount = await AnomalyEvent.countDocuments({ user_id: u._id });
    const relapseCount = await AnomalyEvent.countDocuments({
      user_id: u._id,
      $or: [{ relapse: true }, { relapse_count: { $gt: 0 } }]
    });

    const longestEvent = await AnomalyEvent.findOne({ user_id: u._id }).sort({ duration_ms: -1 }).lean();

    if (segCount > 0 || evCount > 0) {
      results.push({
        id: String(u._id),
        name: u.name || u.email || 'Unnamed',
        email: u.email || '-',
        guid: u.guid || '-',
        segments: segCount,
        events: evCount,
        relapses: relapseCount,
        maxDurationMin: longestEvent ? (longestEvent.duration_ms / 60000).toFixed(1) : 0,
        longestTrajectoryLength: longestEvent?.trajectory?.sequence_of_scores?.length || 0,
        longestEventId: longestEvent ? String(longestEvent._id) : null
      });
    }
  }

  results.sort((a, b) => (b.events - a.events) || (b.segments - a.segments));

  console.log("\n=== TOP USERS SUMMARY ===");
  results.forEach(r => {
    console.log(`User: ${r.id} | ${r.name} (${r.email}) | Segs: ${r.segments} | Events: ${r.events} | Relapses: ${r.relapses} | MaxDur: ${r.maxDurationMin}m | Trajectory: ${r.longestTrajectoryLength} pts | LongestEvent: ${r.longestEventId}`);
  });

  await mongoose.disconnect();
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
