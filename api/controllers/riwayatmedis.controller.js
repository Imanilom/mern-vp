import { anamnesa } from '../models/anamnesa.model.js';
import Patient from '../models/patient.model.js';
import User from '../models/user.model.js';
import { riwayatmedis } from '../models/riwayatmedis.model.js';

import mongoose from 'mongoose';

export const createRiwayatMedis = async (req, res) => {
    try {
        console.log(req.body);
        console.log(req.user.id);
        const patient = await User.findOne({
            _id: req.user.id
        });

        // check riwayatamedis apakah sudah ada?
        // if true kita update,
        // if false kita create
        // let isHaveRiwayat = await riwayatmedis.findOne({
        //     Doctor: patient.docter,
        //     Patient: req.user.id
        // });

        // if (isHaveRiwayat) {

        //     // console.log('update medis', req.body)
        //     res.json({ message: 'update action' })
        // } else {
        console.log('sedang create..')
        const riwayatmedisCreate = await riwayatmedis.create({
            Doctor: patient.docter,
            Patient: req.user.id,
            Date: new Date()
        });
        console.log(patient, patient.docter, riwayatmedisCreate)

        let question = req.body.questions;

        // forearch 
        question.forEach(async (value) => {
            const anamnesaCreate = await anamnesa.create({
                riwayatmedis: riwayatmedisCreate._id,
                pertanyaan: value.pertanyaan,
                jawaban: value.jawaban
            });
        });

        return res.json({ message: 'Berhasil membuat riwayat medis' })
        // }

    } catch (error) {
        console.log(error);
    }
}

export const getRiwayatMedisPasien = async (req, res) => {
    try {
        console.log(req.params.id)
        const riwayatmedisDoc = await riwayatmedis.findOne({
            Patient: req.params.id
        }).populate('Doctor');

        if (!riwayatmedisDoc) {
            return res.json({ riwayatmedis: null })
        } else {
            let result;
            const anamnesaDoc = await anamnesa.find({
                riwayatmedis: riwayatmedisDoc._id,
                status: {
                    $exists: false
                }
            });

            const catatanTambahan = await anamnesa.find({
                riwayatmedis: riwayatmedisDoc._id,
                status: {
                    $exists: true
                }
            })

            result = { riwayatmedisDoc, details: anamnesaDoc, tambahan: catatanTambahan }
            return res.json(result);
        }
    } catch (error) {
        console.log(error);
    }
}

export const deleteRiwayat = async (req, res) => {
    const id = req.params.id;
    try {
        await anamnesa.deleteMany({
            riwayatmedis: id
        })

        await riwayatmedis.deleteOne({
            _id: id
        });

        return res.json({ message: 'ok' });
    } catch (error) {
        console.log(error);
    }
}

export const getOneAnamnesa = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(403).json({ message: 'its not valid objectId' });

        const anamnesaOne = await anamnesa.findById(req.params.id);

        if (!anamnesa) return res.status(403).json({ message: 'Cant do action when resource was missing' });
        return res.json({ anamnesa: anamnesaOne })
    } catch (error) {
        console.log(error);
    }
}

export const createAnamnesa = async (req, res) => {
    // console.log(req.body);
    try {
        const createAnamnesa = await anamnesa.create({
            ...req.body, status: 'Catatan tambahan'
        });

        res.json({ message: 'Succesfully create anamnesa' })
    } catch (error) {
        console.log(error);
    }
}

export const updateAnamnesa = async (req, res) => {
    try {
        const { pertanyaan, jawaban } = req.body;
        const anamnesaOne = await anamnesa.findById(req.params.id);

        anamnesaOne.pertanyaan = pertanyaan;
        anamnesaOne.jawaban = jawaban;
        await anamnesaOne.save()

        res.json({ message: 'Succesfully update anamnesa' })
    } catch (error) {
        console.log(error);
    }
}

export const deleteAnamnesa = async (req, res) => {
    console.log('delete')
    try {
        const anamnesaOne = await anamnesa.findById(req.params.id);
        await anamnesaOne.deleteOne();

        return res.json({ message: `Anamnesa succesfully deleted!` });
    } catch (err) {
        console.log(err)
    }
}



