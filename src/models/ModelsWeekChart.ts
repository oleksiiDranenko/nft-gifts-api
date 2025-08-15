import mongoose from 'mongoose';

const ModelsWeekChartSchema = new mongoose.Schema(
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
        priceTon: { type: Number, required: true },
        priceUsd: { type: Number, required: true }
      }
    ],
    createdAt: { type: Date, default: Date.now, expires: '7d' }  
  },
  { 
    collection: 'modelsWeekChart',
    versionKey: false
  }
);

export const ModelsWeekChartModel = mongoose.model('modelsWeekChart', ModelsWeekChartSchema);
