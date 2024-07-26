const mongoose = require('mongoose');

const polarDataSchema = new mongoose.Schema({
  guid: { type: String, required: true, unique: true },
  timeEpoch: { type: Number, required: true }, // Assuming 64-bit epoch
  hr: { type: Number },
  rr: { type: Number },
  acc: { type: [Number] }, // Array for accelerometer data
  username: { type: String, required: true },
  encryptedPassword: { type: String, required: true },
  activity: { type: String } 
});

const PolarData = mongoose.model('PolarData', polarDataSchema);
  
  module.exports = PolarData;