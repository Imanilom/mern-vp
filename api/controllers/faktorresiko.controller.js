import Labotariums from "../models/labotariums.model.js";
import User from "../models/user.model.js";
import faktorresiko from '../models/factorresiko.model.js';
export const getAllLab = async (req, res) => {
    try {

        const max = 5;
        const page = req.query.p || 0;
        const { patientid } = req.params;
        const user = await User.findById(patientid);
        const labs = await Labotariums.find({ user: user._id }).skip(page * max).limit(max).sort({ Date: -1 });

        const countDoc = await Labotariums.countDocuments({ user: user._id });
        let count = Math.floor(countDoc / max);
        if (count == 0) {
            count++;
        }
        res.json({ labs, count });
    } catch (err) {
        console.log({ err })
    }
}

export const createLab = async (req, res) => {
    try {
        const { name, location, patientId } = req.body;
        const user = await User.findById(patientId);

        if (!user) return res.status(403).json({ message: "Cant find any user" });

        const lab = await Labotariums.create({
            name_lab: name,
            location,
            user: user._id
        });

        res.json({ lab, message: "Add new Labotariums succesfully" });

    } catch (error) {
        console.log({ error })
    }
}

export const delLab = async (req, res) => {
    try {
        const { id } = req.params;

        const lab = await Labotariums.findById(id);
        if (!lab) return res.status(403).json({ message: "Cant find any." });
        await lab.deleteOne();

        res.json({ lab, message: "Delete Labotarium succesfully" });

    } catch (error) {
        console.log({ error })
    }
}

export const fillDoc = async (req, res) => {
    const { tanggal,
        file,
        detail, docter, patientid, lab } = req.body;

    console.log(req.body)
    const user = await User.findById(patientid);
    const dokter = await User.findById(docter);
    const labotarium = await Labotariums.findById(lab);
    try {
        const doc = await faktorresiko.create({
            Date: new Date(tanggal),
            penilaian: detail,
            file_url: file,
            labotarium: labotarium._id,
            docter: dokter._id,
            user: user._id
        });

        console.log('okee')
        res.json({ message: "Docment succesfully write!", doc })
    } catch (err) {
        // console.log({err})
    }
}
export const delDoc = async (req, res) => {
    try {
        const { id } = req.params;

        const doc = await faktorresiko.findById(id);
        if (!doc) return res.status(403).json({ message: "Cant find any document." });
        await doc.deleteOne();

        res.json({ message: "Delete Labotarium succesfully" });
    } catch (error) {
        console.log({ error })
    }
}
export const showDoc = async (req, res) => {
    const { lab } = req.params;
    try {
        const lab__ = await Labotariums.findById(lab);
        console.log({ lab__ })
        const docs = await faktorresiko.find({ labotarium: lab__._id }).sort({Date : -1}).populate('docter');

        res.json({ docs, lab__ });
    } catch (err) {
        console.log({ err })
    }
}