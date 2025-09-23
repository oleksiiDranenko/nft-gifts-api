import mongoose from "mongoose";

const IndexMonthDataSchema = new mongoose.Schema(
  {
    indexId: { type: String, required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    priceTon: { type: Number, required: true },
    priceUsd: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now, expires: "30d" },
  },
  {
    collection: "indexMonthData",
    versionKey: false,
  }
);

export const IndexMonthDataModel = mongoose.model(
  "indexMonthData",
  IndexMonthDataSchema
);
