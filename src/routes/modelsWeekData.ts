import { ModelsWeekChartModel } from "../models/ModelsWeekChart";

export const addModelsWeekData = async (data: any) => {
  try {
    const newGiftData = new ModelsWeekChartModel({
      giftId: data.giftId,
      models: data.models?.map((model: any) => ({
        name: model.name,
        priceTon: model.priceTon,
        priceUsd: model.priceUsd
      })) || []
    });

    await newGiftData.save();
  } catch (error) {
    console.log(error);
  }
};