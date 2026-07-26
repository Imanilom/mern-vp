import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    guid: {
      // required: true,
      type: String,
      unique: false// Added unique constraint for guid
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
      type: String,
      default: "E4F82A29",
    },
    phone_number: {
      required: true,
      type: String,
    },
    address: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      default: "user",
    },
    otp: {
      type: Number,
      default: 0,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    profilePicture: {
      type: String,
      default:
        'https://img.freepik.com/premium-vector/man-avatar-profile-picture-vector-illustration_268834-538.jpg',
    },
    // ---- Profil Biometrik untuk ML ----
    age: {
      type: Number,
      default: null,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      default: 'male',
    },
    weight: {
      type: Number, // kg
      default: null,
    },
    height: {
      type: Number, // cm
      default: null,
    },
    // ------------------------------------
    docter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Corrected reference to the model name
    },
    requestAppointment: {
      type: String, // Added type specification
      enum: ['pending', 'accepted', ''], // Limited the values for this field
    },
  },
  {
    versionKey: false,
  }
);

const User = mongoose.model("User", UserSchema); // Capitalized the model name

export default User;
