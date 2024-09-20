import mongoose from "mongoose";
import Patient from "../models/patient.model.js";
import User from "../models/user.model.js";
import { Treatments } from "../models/treatment.model.js";

// get treatment pasient

export const getTreatment = async (req, res) => {
    try {

        let history = [];
        let treat;

        //cek role dlu 
        const user = await User.findById(req.params.patient);
        history = await Treatments.find({
            patient: user._id,
            status: {
                $ne: "ongoing"
            },
        }).populate('doctor');

        treat = await Treatments.findOne({
            patient: user._id,
            status: "ongoing",
        }).populate('doctor');

        res.json({treat, history});
    } catch (error) {
        console.log({ error });
    }
}


export const getTreatmentDetail = async (req, res) => {
    try {
        let treat;

        treat = await Treatments.findById(req.params.id).populate('doctor');

        res.json({treat});
    } catch (error) {
        console.log({ error });
    }
}

// create treatment
export const createTreatment = async (req, res) => {
    try {

        const { patient_id, diagnosis, followUpDate, notes, medications } = req.body;
        const __docter = await User.findOne({ _id: req.user.id });
        const __patient = await Patient.findById(patient_id);

        if (!__docter || !__patient) return res.status(403).json({ message: "Invalid patient" });

        const create = await Treatments.create({
            doctor: __docter._id,
            patient: __patient._id,
            diagnosis,
            followUpDate,
            notes,
            medications
        });

        res.json({ message: "Succesfully.", Treatment: create })

    } catch (error) {
        console.log({ error })
    }


}

// update treatment
export const updateTreatment = async (req, res) => {
 try {

        const { _id, diagnosis, followUpDate, notes, medications } = req.body;

        const treatment = await Treatments.findById(_id);
        if(!treatment) return res.status(403).json({message : 'Cant find any treatment'});

        treatment.diagnosis = diagnosis;
        treatment.followUpDate = followUpDate;
        treatment.notes = notes;
        treatment.medications = medications;

        await treatment.save();
        res.json({ message: "Succesfully update treatment."})

    } catch (error) {
        console.log({ error })
    }

}

// delete treatment
export const deleteTreatment = async (req, res) => {
    try {
        const treat = await Treatments.findById(req.params.id);

        await treat.deleteOne();
        res.json({message : 'ok'});
        
    } catch (error) {
        console.log({error})
    }
}

// switch status ongoing -> completed
export const switchStatus = async (req, res) => {
    try {
        const treat = await Treatments.findById(req.body._id);
        // console.log({treat, __patient})
        treat.status = 'completed';
        await treat.save();

        res.json({message : 'The Treatment was succesfully complete.'});
    } catch (error) {
        console.log({error});
    }
}