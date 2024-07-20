import mongoose from 'mongoose';

const Schema = mongoose.Schema;

// Define the Patient schema
const PatientSchema = new mongoose.Schema({
    profile: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    }
    
}, {
    timestamps: true
});

// Create the Patient model
const Patient = mongoose.model('Patient', PatientSchema);

export default Patient;