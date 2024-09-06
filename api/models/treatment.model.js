import mongoose from "mongoose";
import User from "./user.model.js";
import Patient from "./patient.model.js";


const SchemaMedicine = mongoose.Schema({
    name: {
        type: String,
        required: true, // Nama obat yang diberikan
    },
    dosage: {
        type: String,
        required: true, // Dosis obat
    },
    frequency: {
        type: String,
        required: true, // Frekuensi penggunaan obat
    }
});

const Schema = mongoose.Schema({
    doctor: {
        required: true,
        type: mongoose.Schema.Types.ObjectId,
        ref: User
    },
    patient: {
        required: true,
        type: mongoose.Schema.Types.ObjectId,
        ref: Patient
    },
    treatmentDate: {
        type: Date,
        default: Date.now, // Tanggal treatment dilakukan
        required: true,
    },
    diagnosis: {
        type: String,
        required: true, // Diagnosis oleh dokter
    },
    medications: [SchemaMedicine],
    notes: {
        type: String, // Catatan tambahan dari dokter
    },
    followUpDate: {
        type: Date, // Tanggal kontrol ulang, jika ada
    },
    status: {
        type: String,
        enum: ['ongoing', 'completed'], // Status perawatan
        default: 'ongoing',
    }
}, {
    timestamps: true, // Auto-generate createdAt dan updatedAt
});

export const Treatments = mongoose.model("treatments", Schema);
