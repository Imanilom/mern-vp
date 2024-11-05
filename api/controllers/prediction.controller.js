import {Appointments} from '../models/appointment.model.js';
import Patient from '../models/patient.model.js';
import User from '../models/user.model.js';
import {PredictionFactor} from '../models/prediction_factor.model.js';

export const getAppointmentPredictionPatient = async (req, res) => {
    try {
        // getPrediction, getAppointment (kalo ada), getStatusAppointment
        let patient;
        let appointment;

        if(req.user.role == 'user'){
            patient = await User.findById(req.user.id);
            if(patient){
                appointment = await Appointments.findOne({patient : patient._id}).populate('doctor');
            }
        }else{
            // docter
            patient = await User.findById(req.query.patient);
            console.log(req.query);
            if(!patient) return res.status(403).json({message : 'patient not found'})
            appointment = await Appointments.findOne({patient : patient._id}).populate('doctor');;
        }

        if(!appointment) appointment = null;

        let prediction;
        prediction = await PredictionFactor.findOne({patient : patient._id});
        if(!prediction){
            prediction = null;
        }
        
        const status = patient.requestAppointment;
        res.json({ appointment ,prediction, status});

    } catch (error) {
        console.log({error});
    }
}

export const createFactorPrediction = async (req, res) => { // doctor only
    try {

        const {result_prediction, supporting_risks, patient} = req.body;
        const __patient = await User.findById(patient);
        if(!__patient) res.status(403).json({message : 'Pasient is invalid'});

        const factor_prediction = await PredictionFactor.create({result_prediction, supporting_risks, patient : __patient._id, doctor : req.user.id});
        res.json({message : "Ok suksess..", factor_prediction});

    } catch (error) {
        console.log({error})
    }
} 

export const deleteFactorPrediction = async (req, res) => {
    try {
        let {id} = req.params; 
        const prediction = await PredictionFactor.findOne({ _id : id });
        if(!prediction) return res.status(403).json({message : "Cant find any prediction"});

        await PredictionFactor.deleteOne({ _id: prediction._id });

        res.json({message : "Prediction Factor Deleted."});
    } catch (error) {
        console.log({error})
    }
} 