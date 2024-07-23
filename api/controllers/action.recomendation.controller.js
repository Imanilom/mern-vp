import mongoose from "mongoose";
// import { ActionRecomendation } from '../models/actionRecomendationUser.js';
import { Recomendation } from "../models/recomendation.js";

export const postCheck = async (req, res) => {
    const { activity_id } = req.body;

    try {
        const recommend = await Recomendation.findById(activity_id);
        if (!recommend) return res.status(413).json({ message: 'Cant do the action. when resource was missing' });

        recommend.status = true;
        await recommend.save();

        res.json({ message: 'Oke sended', result: recommend })
    } catch (error) {
        console.log(error);
    }
}

export const postUncheck = async (req, res) => {
    const { activity_id } = req.body;
    try {
        const recommend = await Recomendation.findById(activity_id);
        if (!recommend) return res.status(413).json({ message: 'Cant do the action. when resource was missing' })


        recommend.status = false;
        await recommend.save();

        res.json({ message: 'Oke sended', result: recommend })
    } catch (error) {
        console.log(error);
    }
}

export const getListPatientByActivity = async (req, res) => {
    try {
        // i have id activity
        const patient = await ActionRecomendation.find({
            activity: req.params.activity_id
        }).populate('patient').sort({ createdAt: -1 });

        res.json({ patients: patient });
    } catch (error) {
        console.log(error);
    }
}
