import mongoose from "mongoose";

const IndexDataSchema = new mongoose.Schema(
    {
        indexId: { type: String, required: true },
        date: { type: String, required: true },
        priceTon: { type: Number, required: true },
        priceUsd: { type: Number, required: true }
    }, 
    { 
        collection: 'indexData',
        versionKey: false
     }
);

export const IndexDataModel = mongoose.model('indexData', IndexDataSchema)