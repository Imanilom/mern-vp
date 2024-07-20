import mongoose from "mongoose";
import {Recomendation} from '../models/recomendation.js';
import Patient from "./patient.model.js";
import User from "./user.model.js";

const actionSchema  = mongoose.Schema({
    activity : {
        required : true, 
        ref : Recomendation,
        type : mongoose.Schema.Types.ObjectId
    },
    docter : {
        required : true, 
        ref : User,
        type : mongoose.Schema.Types.ObjectId
    },
    patient : {
        required : true, 
        ref : Patient,
        type : mongoose.Schema.Types.ObjectId
    },
    status : {
        required : true, 
        type : mongoose.Schema.Types.Boolean
    },
}, {
    timestamps : true
})  

export const ActionRecomendation = mongoose.model('actionrecomendations', actionSchema);