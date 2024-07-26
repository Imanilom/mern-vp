import mongoose from "mongoose";
import {riwayatmedis} from '../models/riwayatmedis.model.js';

const schema = mongoose.Schema({
    riwayatmedis : {
        type : mongoose.Types.ObjectId,
        required : true,
        ref : riwayatmedis
    },
    pertanyaan : String,
    jawaban : String
}, {
    timestamps : true
})


export const anamnesa = mongoose.model('anamnesa', schema);