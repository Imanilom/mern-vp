import mongoose from "mongoose";
import User from "./user.model.js";

const doc = mongoose.Schema({
    label : String,
    jawaban : String
});

const faktorresiko_Schema = mongoose.Schema({
    user: {
        required: true,
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users'
    },
    docter: {
        required: true,
        type: mongoose.Schema.Types.ObjectId,
        ref: User
    },
    labotarium: {
        required: true,
        type: mongoose.Schema.Types.ObjectId,
        ref: 'labotariums'
    },
    penilaian: [doc],
    file_url: {
        type: String,
    },
    Date: Date
}, {
    timestamp: true
});

const faktorresiko = mongoose.model('faktorresiko', faktorresiko_Schema);
export default faktorresiko;