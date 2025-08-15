import mongoose from 'mongoose';

const WeekChartSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    date: { type: String, required: true }, 
    time: { type: String, required: true },
    priceTon: { type: Number, required: true },
    priceUsd: { type: Number, required: true },
    models: [
      {
        name: { type: String, required: true },
        priceTon: { type: Number, required: true },
        priceUsd: { type: Number, required: true }
      }
    ],
    createdAt: { type: Date, default: Date.now, expires: '7d' }  
  },
  { 
    collection: 'weekChart',
    versionKey: false
  }
);

export const WeekChartModel = mongoose.model('weekChart', WeekChartSchema);
