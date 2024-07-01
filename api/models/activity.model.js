import mongoose from "mongoose";

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