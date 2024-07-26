import mongoose from "mongoose";
import User from "./user.model.js";
import Patient from "./patient.model.js";


const schema = mongoose.Schema({
    Doctor : {
        type : mongoose.Types.ObjectId,
        required : true,
        ref : User
    },
    Patient : {
        type : mongoose.Types.ObjectId,
        required : true,
        ref : Patient
    },
    Date : Date
}, {
    timestamps : true
})

export const riwayatmedis = mongoose.model('riwayatmedis', schema);