import mongoose from 'mongoose';

const SegmentSchema = new mongoose.Schema({
    interval: {
        type: String,
        required: true
    },
    metrics: {
        sdnn: {
            type: Number,
            required: true
        },
        rmssd: {
            type: Number,
            required: true
        },
        pnn50: {
            type: Number,
            required: true
        }
    },
    logs: [{
        HR: {
            type: Number,
            required: true
        },
        RR: {
            type: Number,
            required: true
        },
        rrRMS: {
            type: Number
        },
        create_at: {
            type: Date,
            required: true
        }
    }]
}, { timestamps: true });

const Segment = mongoose.model('Segment', SegmentSchema);

export default Segment;
