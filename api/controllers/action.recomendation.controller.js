import mongoose from "mongoose";
import {ActionRecomendation} from '../models/actionRecomendationUser.js';


export const postCheck = async (req, res) => {
    const {status, activity_id, patient_id, doctor_id} = req.body;
    console.log(req.body);
    try {
       const actionCheck = await ActionRecomendation.create({
        activity : activity_id,
        patient : patient_id,
        docter : doctor_id,
        status
       });

       res.json({message : 'Oke sended', result : actionCheck})
    } catch (error) {
        console.log(error);
    }
}

export const getListPatientByActivity = async (req, res) => {
    try {
        // i have id activity
        const patient = await ActionRecomendation.find({
            activity : req.params.activity_id
        }).populate('patient').sort({createdAt : -1});

        res.json({patients : patient});
    } catch (error) {
        console.log(error);
    }
}
