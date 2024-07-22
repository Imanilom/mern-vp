import mongoose from "mongoose";
import { Recomendation } from "../models/recomendation.js";
import Patient from "../models/patient.model.js";
import User from "../models/user.model.js";
import { ActionRecomendation } from "../models/actionRecomendationUser.js";

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

        // if role is doctor fetch this >>
        if (req.user.role === 'doctor') {
            const recomendation = await Recomendation.find({
                doctor: req.user.id,
                patient: req.params.patient
            }).sort({ createdAt: -1 });
            // console.log(recomendation);

            if (!recomendation) return res.json({ recomendation: recomendation });

            res.json({ recomendation: recomendation });
            console.log('berhasil');
        }
        // if role is != doctor fetch this >>
        else {
            console.log(req.params);
            const recomendation = await Recomendation.find({
                patient: req.params.patient
            }).sort({ createdAt: -1 }).populate('doctor');

            if (!recomendation) return res.json({ recomendation: recomendation });

            res.json({ recomendation: recomendation });
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