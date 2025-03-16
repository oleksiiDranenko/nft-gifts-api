import mongoose from "mongoose";

const LifeChartSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        date: { type: String, required: true },
        priceTon: { type: Number, required: true },
        priceUsd: { type: Number, required: true }
    },
    { 
        collection: 'lifeChart',
        versionKey: false
     } 
);

export const LifeChartModel = mongoose.model('lifeChart', LifeChartSchema)