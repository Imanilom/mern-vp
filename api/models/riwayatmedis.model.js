import mongoose from "mongoose";
import User from "./user.model.js"; // Pastikan ini diimpor dengan benar
import Patient from "./patient.model.js"; // Pastikan ini diimpor dengan benar

const schema = mongoose.Schema({
    Doctor: {
        type: mongoose.Types.ObjectId, // Pastikan ini adalah ObjectId
        required: true,
        ref: User // Pastikan nama model yang dirujuk benar (case-sensitive)
    },
    Patient: {
        type: mongoose.Types.ObjectId,
        required: true,
        ref: Patient // Pastikan nama model yang dirujuk benar (case-sensitive)
    },
    Date: {
        type: Date,
        default : Date.now // Lebih eksplisit dalam mendefinisikan tipe data
    }
}, {
    timestamps: true
});

export const riwayatmedis = mongoose.model('riwayatmedis', schema);