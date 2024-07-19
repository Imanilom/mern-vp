import mongoose from 'mongoose';

const recomendationSchema = mongoose.Schema({
    doctor_id : {
        type : mongoose.Schema.Types.ObjectId,
        required : true
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