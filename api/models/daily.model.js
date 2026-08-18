import mongoose from 'mongoose';

const DailyMetricSchema = new mongoose.Schema({
    date: {
        type: String,
        required: true
    },
    metrics: {
        median3dp: {
            type: Number,
            required: true
        },
        mean: {
            type: Number,
            required: true
        },
        max: {
            type: Number,
            required: true
        },
        min: {
            type: Number,
            required: true
        },
        rmssd: {
            type: Number,
            required: true
        },
        sdnn: {
            type: Number,
            required: true
        },
        hf: {
            type: Number,
            required: true
        },
        lf: {
            type: Number,
            required: true
        },
        lfHfRatio: {
            type: Number,
            required: true
        }
    }
}, { timestamps: true });

const DailyMetric = mongoose.model('DailyMetric', DailyMetricSchema);

export default DailyMetric;
