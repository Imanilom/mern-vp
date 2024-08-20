import mongoose from "mongoose";
import User from './user.model.js';

const AktivitasSchema = new mongoose.Schema(
    {
        Date: {
            type: Date,
            default: Date.now 
        },
        awal: {
            type: String,
        },
        akhir: {
            type: String,
        },
        aktivitas: {
            type: String,
        },
        status: {
            type: String
        },
        userRef: {
            type: String,
        },
       
        create_at: { 
          type: Date, 
          default: Date.now 
        },
      },
      {
        versionKey: false,
      }
    );  

const Aktivitas = mongoose.model("aktivitas", AktivitasSchema);

export default Aktivitas;