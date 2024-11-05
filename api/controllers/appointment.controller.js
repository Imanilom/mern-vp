import {Appointments} from '../models/appointment.model.js';
import Patient from '../models/patient.model.js';
import User from '../models/user.model.js';


export const requestAppointmentUser = async (req, res) => {
    try {
        const patient = await User.findById(req.user.id);
        patient.requestAppointment = 'pending';
        await patient.save();
        
        // console.log('oke..', req.user, {patient});
        res.json({message : "Request Appointment succesfully sended.."});
    } catch (error) {
        console.log({error})
    }
}

export const acceptAndCreateAppointment = async (req, res) => { // docter only
    try {
        const {date, time, note, patient} = req.body;

        // Tell to patient the Appointment is Accepted;
        const __patient = await User.findById(patient);
        __patient.requestAppointment = 'accepted';
        await __patient.save();

        const appointment = await Appointments.create({doctor : req.user.id, patient : __patient._id, date, time, note});
        const resultAppointment = await Appointments.findById(appointment._id).populate('doctor');
        res.json({message : 'Appointment succesfully created.', appointment : resultAppointment});

    } catch (error) {
        console.log({error});
    }
}


export const EndedAppointment = async (req, res) => { // docter only
    try {
        const {patient} = req.body;

        // Dengan ini user bisa minta temu janji lain waktu
        const __patient = await User.findById(patient);
        __patient.requestAppointment = '';
        await __patient.save();

        await Appointments.deleteMany({
            patient : __patient._id
        });

        res.json({message : 'Apointment success and ended.'})
    } catch (error) {
        console.log({error})
    }
}