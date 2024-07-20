import mongoose from 'mongoose';
import Patient from './patient.model.js';

const recomendationSchema = mongoose.Schema({
    doctor_id : {
        type : mongoose.Types.ObjectId,
        required : true,
        ref : Patient
    },
    name : {
        type : String,
        required : true
    },
    berlaku_dari : Date,
    hingga_tanggal : Date,
}, {
    timestamps : true
});

export const Recomendation = mongoose.model('recomendations', recomendationSchema);