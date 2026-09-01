import mongoose from 'mongoose';
import PhenotypeProfile from '../models/phenotype_profile.model.js';
import User from '../models/user.model.js';

// Helper to resolve valid ObjectId for userId
async function resolveUserObjectId(userIdInput) {
  if (!userIdInput) return null;
  const uidStr = String(userIdInput);
  const uidObj = mongoose.Types.ObjectId.isValid(uidStr) ? new mongoose.Types.ObjectId(uidStr) : null;
  const user = await User.findOne(uidObj ? { $or: [{ _id: uidObj }, { guid: uidStr }] } : { guid: uidStr }).lean();
  return user?._id || (uidObj ? uidObj : null);
}

// ── POST /api/phenotype-profile/save ──────────────────────────────────────────
export async function savePhenotypeProfile(req, res) {
  try {
    const { userId, answers, phenotype_vector, candidate_phenotype, clinical_notes, status } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId wajib diisi.' });
    }

    const userObjId = await resolveUserObjectId(userId);
    if (!userObjId) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    }

    const evaluatorId = req.user?.id && mongoose.Types.ObjectId.isValid(req.user.id)
      ? new mongoose.Types.ObjectId(req.user.id)
      : null;

    // Convert answers object to map-compatible structure
    const formattedAnswers = {};
    if (answers && typeof answers === 'object') {
      for (const [k, v] of Object.entries(answers)) {
        formattedAnswers[k] = {
          q_id: v.q_id || k,
          title: v.title || '',
          answer_label: v.answer_label || '',
          narrative: v.narrative || '',
          evidence: v.evidence || '',
          metrics: v.metrics || '',
          confidence: ['tinggi', 'sedang', 'rendah'].includes(v.confidence) ? v.confidence : 'sedang',
        };
      }
    }

    const profileData = {
      user_id: userObjId,
      evaluator_id: evaluatorId,
      answers: formattedAnswers,
      phenotype_vector: phenotype_vector || {},
      candidate_phenotype: candidate_phenotype || 'Pending Evaluation',
      clinical_notes: clinical_notes || '',
      status: status || 'saved',
      updated_at: new Date(),
    };

    // Find and update latest or create new
    const updated = await PhenotypeProfile.findOneAndUpdate(
      { user_id: userObjId },
      { $set: profileData, $setOnInsert: { created_at: new Date() } },
      { new: true, upsert: true }
    );

    return res.json({
      success: true,
      message: 'Profil Fenotipe & Jawaban Q1–Q10 berhasil disimpan ke database.',
      data: updated,
    });
  } catch (err) {
    console.error('[PhenotypeProfile] save error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ── GET /api/phenotype-profile/:userId ────────────────────────────────────────
export async function getPhenotypeProfile(req, res) {
  try {
    const userId = req.params.userId || req.query.userId;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId wajib diisi.' });
    }

    const userObjId = await resolveUserObjectId(userId);
    if (!userObjId) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    }

    const profile = await PhenotypeProfile.findOne({ user_id: userObjId })
      .populate('evaluator_id', 'name email role')
      .lean();

    return res.json({
      success: true,
      data: profile || null,
    });
  } catch (err) {
    console.error('[PhenotypeProfile] get error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ── GET /api/phenotype-profile/history/:userId ────────────────────────────────
export async function listPhenotypeHistory(req, res) {
  try {
    const userId = req.params.userId || req.query.userId;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId wajib diisi.' });
    }

    const userObjId = await resolveUserObjectId(userId);
    if (!userObjId) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    }

    const history = await PhenotypeProfile.find({ user_id: userObjId })
      .sort({ updated_at: -1, created_at: -1 })
      .limit(10)
      .lean();

    return res.json({
      success: true,
      data: history,
    });
  } catch (err) {
    console.error('[PhenotypeProfile] history error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
