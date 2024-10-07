import mongoose from "mongoose";
import { Recomendation } from "../models/recomendation.js";
import Patient from "../models/patient.model.js";
import User from "../models/user.model.js";
// import { ActionRecomendation } from "../models/actionRecomendationUser.js";

// For doctor

export const createRecomendation = async (req, res) => {
    const { name, berlaku_dari, hingga_tanggal, patient } = req.body;
    req.body.doctor = req.user.id;
    // console.log(name, berlaku_dari, hingga_tanggal, req.user)
    try {
        const recomendation = await Recomendation.create(req.body);
        res.json({ message: 'Create recomendation success', recomendation })
    } catch (error) {
        console.log(error);
    }
}

export const getRecomendationByPatient = async (req, res) => {
    try {

        const page = req.query.p || 0;
        const maxitems = 5;
        let countDoc; 

        const startDate = req.query.startDate;
        const endDate = req.query.endDate;

        // if role is doctor fetch this >>
        if (req.user.role === 'doctor') {
            let filter = {
                doctor: req.user.id,
                patient: req.params.patient
            }

            if(startDate && endDate){
                filter.berlaku_dari = {
                    $gte : new Date(startDate),
                    $lte : new Date(endDate)
                }
                console.log({startDate, endDate, filter})
            }
            const recomendation = await Recomendation.find(filter).sort({ createdAt: -1 }).skip(page * maxitems).limit(maxitems);

            countDoc = await Recomendation.countDocuments({
                doctor: req.user.id,
                patient: req.params.patient
            });


            let lengthPagination = Math.floor(countDoc / maxitems) + 1;

            // console.log(recomendation);

            if (!recomendation) return res.json({ recomendation: recomendation,  lengthPagination});

            res.json({ recomendation: recomendation, lengthPagination });
            console.log('berhasil');
        }
        // if role is != doctor fetch this >>
        else {

            let filter = {
                patient: req.params.patient
            }

            if(startDate && endDate){
                filter.berlaku_dari = {
                    $gte : new Date(startDate),
                    $lte : new Date(endDate)
                }
                console.log({startDate, endDate, filter})
            }
           
            // console.log(req.params);
            const recomendation = await Recomendation.find(filter).sort({ createdAt: -1 }).skip(page * maxitems).limit(maxitems).populate('doctor');

            countDoc = await Recomendation.countDocuments({
                patient: req.params.patient
            });

            console.log({countDoc})

            
            let lengthPagination = Math.floor(countDoc / maxitems) + 1; 
            if (!recomendation) return res.json({ recomendation: recomendation, lengthPagination });

            res.json({ recomendation: recomendation, lengthPagination });
        }

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