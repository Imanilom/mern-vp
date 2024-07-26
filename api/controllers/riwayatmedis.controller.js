import {anamnesa} from '../models/anamnesa.model.js';
import Patient from '../models/patient.model.js';
import {riwayatmedis} from '../models/riwayatmedis.model.js';

import mongoose from 'mongoose';

export const createRiwayatMedis = async (req,res) => {
    try {
        console.log(req.body);
        console.log(req.user.id);
        const patient = await Patient.findOne({
            _id : req.user.id
        });

        // check riwayatamedis apakah sudah ada?
        // if true kita update,
        // if false kita create
        let isHaveRiwayat = await riwayatmedis.findOne({
            Doctor : patient.docter,
            Patient : req.user.id
        });

        if(isHaveRiwayat){
            console.log('update medis', req.body)
        }else{
            const riwayatmedisCreate = await riwayatmedis.create({
                Doctor : patient.docter,
                Patient : req.user.id,
                Date : new Date()   
            });
            console.log(patient, patient.docter, riwayatmedisCreate)
        }


        // forearch 


    } catch (error) {
        console.log(error);
    }
}

