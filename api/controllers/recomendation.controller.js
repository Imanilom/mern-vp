import mongoose from "mongoose";
import { Recomendation } from "../models/recomendation.js";
import Patient from "../models/patient.model.js";
import User from "../models/user.model.js";
import { ActionRecomendation } from "../models/actionRecomendationUser.js";

// For doctor

export const createRecomendation = async (req, res) => {
    const { name, berlaku_dari, hingga_tanggal } = req.body;
    req.body.doctor_id = req.user.id;
    // console.log(name, berlaku_dari, hingga_tanggal, req.user)
    try {
        const recomendation = await Recomendation.create(req.body);
        res.json({ message: 'Create recomendation success', recomendation })
    } catch (error) {
        console.log(error);
    }
}


export const getRecomendation = async (req, res) => {
    try {

        let rekomendation = [];
        // if role is doctor fetch this >>
        if (req.user.role === 'doctor') {
            rekomendation = await Recomendation.find({
                doctor_id: req.user.id
            }).sort({ createdAt: -1 });

        }

        // if role is != doctor fetch this >>
        else {
            const patient = await Patient.findById(req.user.id);
            // user.doctor 
            console.log(patient);
            if (!patient.docter) return res.json({ recomendation: rekomendation });

            let rekomendationCollection = await Recomendation.find({
                doctor_id: patient.docter || ''
            }).sort({ createdAt: -1 }).populate('doctor_id');

            console.log('collection ', rekomendationCollection.length);
            const actionPatient = await ActionRecomendation.find({
                docter: patient.docter || '',
                patient : req.user.id
            });
        
            rekomendation = [];

            rekomendationCollection.forEach(element => {
                let found = false; 

                for (let j = 0; j < actionPatient.length; j++) {
                    if (element._doc._id.equals(actionPatient[j]['activity'])) {
                        found = true;
                        rekomendation.push({...element._doc, status : true});
                        // console.log(rekomendation, j)
                        // jika disini maka langsung lanjut forEach
                    }
                    
                }

                if(!found){
                    rekomendation.push({...element._doc, status : false});

                }
            });

            // for (let i = 0; i < rekomendation.length; i++) {
            //     let activity = rekomendation[i];
            //     for (let j = 0; j < actionPatient.length; j++) {
            //         console.log(activity._id, '==', actionPatient[j]['activity'], activity._id.equals(actionPatient[j]['activity']))
            //         if (activity._id.equals(actionPatient[j]['activity'])) {
            //             activity.status = true;

            //             console.log('----true');
            //         } else {
            //             rekomendation[i]['status'] = false;
            //             rekomendation
            //         }
            //     }
            // }

            // for (let i = 0; i < rekomendation.length; i++) {
            //     let activity = rekomendation[i];
            //     // Cek apakah activity._id ada dalam actionPatient
            //     rekomendation[i]['status'] = actionPatient.some(val => val.activity == activity._id ? console.log('oke same') : false);
            // }


            // console.log('action patient', actionPatient);
            // console.log('result filter', rekomendation);
        }

        res.json({ recomendation: rekomendation });
    } catch (error) {
        console.log(error);
    }
}

export const detailRecomendation = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(403).json({ message: 'Id doesnt valid' })
        const detail = await Recomendation.findById(req.params.id);
        if (!detail) return res.status(403).json({ message: 'You got nothing. resource missing' });
        return res.json({ recomendation: detail });
    } catch (error) {
        console.log(error);
    }
}

export const updateRecomendation = async (req, res) => {
    try {
        const { name, berlaku_dari, hingga_tanggal } = req.body;
        const recomendation = await Recomendation.findById(req.params.id);
        recomendation.name = name;
        recomendation.berlaku_dari = berlaku_dari;
        recomendation.hingga_tanggal = hingga_tanggal;

        await recomendation.save();

        res.json({ message: 'Update document success', recomendation: recomendation });

    } catch (error) {
        console.log(error);
    }
}


export const deleteRecommend = async (req, res) => {
    try {
        const recomendation = await Recomendation.findById(req.params.id);
        if (!recomendation) return res.status(502).json({ message: 'Resource missing. action denied' })

        await recomendation.deleteOne();
        const rekomendation = await Recomendation.find({
            doctor_id: req.user.id
        }).sort({ createdAt: -1 });

        res.json({ message: 'The activity succesfully delete', recomendations: rekomendation });
    } catch (error) {
        console.log(error);
    }
}

// For patient