import mongoose from "mongoose";

const LifeChartSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        date: { type: String, required: true },
        amountOnSale: {type: Number, required: false},
        priceTon: { type: Number, required: true },
        priceUsd: { type: Number, required: true },
        openTon: { type: Number, required: false },
        closeTon: { type: Number, required: false },
        highTon: { type: Number, required: false },
        lowTon: { type: Number, required: false },
        volume: { type: Number, required: false },
        salesCount: {type: Number, required: false}
    },
    { 
        collection: 'lifeChart',
        versionKey: false
     } 
);

export const LifeChartModel = mongoose.model('lifeChart', LifeChartSchema)