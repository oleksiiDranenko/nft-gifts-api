import mongoose from 'mongoose';

const ModelsLifeChartSchema = new mongoose.Schema(
  {
    giftId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "gift",
          required: true,
        },
    models: [
      {
        _id: false,
        name: { type: String, required: true },
        amountOnSale: {type: Number, required: false},
        priceTon: { type: Number, required: true },
        priceUsd: { type: Number, required: true }
      }
    ],
    date: { type: String, required: true }, 
  },
  { 
    collection: 'modelsLifeChart',
    versionKey: false
  }
);

export const ModelsLifeChartModel = mongoose.model('modelsLifeChart', ModelsLifeChartSchema);
