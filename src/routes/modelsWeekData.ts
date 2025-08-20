import { getDate } from "../bot/functions";
import { ModelsWeekChartModel } from "../models/ModelsWeekChart";

export const addModelsWeekData = async (data: any) => {
  const { date, time } = getDate("Europe/London");
  try {
    const newGiftData = new ModelsWeekChartModel({
      giftId: data.giftId,
      models: data.models?.map((model: any) => ({
        name: model.name,
        amountOnSale: model.amountOnSale,
        priceTon: model.priceTon,
        priceUsd: model.priceUsd
      })) || [],
      date,
      time,
    });

    await newGiftData.save();
  } catch (error) {
    console.log(error);
  }
};