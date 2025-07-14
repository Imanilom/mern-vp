import mongoose from 'mongoose';

// Define the Patient schema
const PatientSchema = mongoose.Schema({
    guid: {
        type: String,
      },
      docter : {
        required : true,
        type : mongoose.Schema.Types.ObjectId,
        ref : 'users'
      },
      name: {
        required: true,
        type: String,
      },
      email: {
        required: true,
        unique: true,
        lowercase: true,
        type: String,
      },
      password: {
        required: true,
        type: String,
      },
      current_device: {
        required: true,
        type: String,
        default: "E4F82A29"
      },
      phone_number: {
        type: String,
      },
      address: {
        default: "",
        type: String,
      },
      role: {
        type: String,
        default: "patient",
      },
      otp: {
        default: 0,
        type: Number,
      },
      is_active: {
        type: Boolean,
        default: true,
      },
      create_at: {
        type: Date,
        default: Date.now
      },
      profilePicture: {
        type: String,
        default:
          'https://img.freepik.com/premium-vector/man-avatar-profile-picture-vector-illustration_268834-538.jpg',
      },
      requestAppointment : String // pending || accept
}, {
    timestamps: true
});

// Create the Patient model
const Patient = mongoose.model('Patient', PatientSchema);

export default Patient;