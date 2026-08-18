import mongoose from "mongoose";


const Schema = mongoose.Schema({
    doctor : {
        required : true,
        type : mongoose.Schema.Types.ObjectId,
        ref : 'users'
    },
    patient : {
        required : true,
        type : mongoose.Schema.Types.ObjectId,
        ref : 'patients'
    },
    result_prediction : String,
    supporting_risks : [String]
})

export const PredictionFactor = mongoose.model('prediction_factors', Schema); 