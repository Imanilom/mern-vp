import mongoose from "mongoose";
import User from "./user.model.js";


const Schema = mongoose.Schema({
    doctor : {
        required : true,
        type : mongoose.Schema.Types.ObjectId,
        ref : User
    },
    patient : {
        required : true,
        type : mongoose.Schema.Types.ObjectId,
        ref : 'patients'
    },
    date : String, 
    time : String,
    note : String,

    created_at : {
        type : Date,
        default : Date.now,
    }
});

export const Appointments = mongoose.model("appointments", Schema);