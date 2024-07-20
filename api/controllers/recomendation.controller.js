import mongoose from "mongoose";
import { Recomendation } from "../models/recomendation.js";

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
        const rekomendation = await Recomendation.find({
            doctor_id: req.user.id
        }).sort({ createdAt: -1 });

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

        res.json({message : 'The activity succesfully delete', recomendations : rekomendation});
    } catch (error) {
        console.log(error);
    }
}

// For patient