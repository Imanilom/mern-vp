import mongoose from 'mongoose';
import Patient from './patient.model.js';
import User from './user.model.js';

const recomendationSchema = mongoose.Schema({
    doctor: {
        type: mongoose.Types.ObjectId,
        required: true,
        ref: User
    },
    patient : {
        required : true, 
        ref : Patient,
        type : mongoose.Schema.Types.ObjectId
    },
    name: {
        type: String,
        required: true
    },
    status: {
        type: Boolean,
        default: false
    },
    berlaku_dari: Date,
    hingga_tanggal: Date,
}, {
    timestamps: true
});

export const Recomendation = mongoose.model('recomendations', recomendationSchema);