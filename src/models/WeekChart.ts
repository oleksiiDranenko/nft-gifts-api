import mongoose from "mongoose";

const WeekChartSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    amountOnSale: { type: Number, required: false },
    salesCount: { type: Number, required: false },
    volume: { type: Number, required: false },
    priceTon: { type: Number, required: true },
    priceUsd: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now, expires: "7d" },
  },
  {
    collection: "weekChart",
    versionKey: false,
  }
);

WeekChartSchema.index({ name: 1, createdAt: -1 });

WeekChartSchema.index({ date: 1, time: 1 });

export const WeekChartModel = mongoose.model("weekChart", WeekChartSchema);
