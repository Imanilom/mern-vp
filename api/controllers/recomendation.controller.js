import mongoose from "mongoose";
import { Recomendation } from "../models/recomendation.js";

export const createRecomendation = async(req, res) => {
    const {name, berlaku_dari, hingga_tanggal} = req.body;
    req.body.doctor_id = req.user.id; 
    // console.log(name, berlaku_dari, hingga_tanggal, req.user)
    try {
        const recomendation = await Recomendation.create(req.body);
        res.json({message : 'Create recomendation success', recomendation})
    } catch (error) {
        console.log(error);
    }
}

