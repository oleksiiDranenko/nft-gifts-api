import { ModelsLifeChartModel } from "../models/ModelsLifeChart";
import { ModelsWeekChartModel } from "../models/ModelsWeekChart";

export const addModelsLifeData = async (giftId: any, date: string) => {
  try {
    const list = await ModelsWeekChartModel.find({ giftId, date });

    if (!list || list.length === 0) return;

    const allModelNames = new Set<string>();
    list.forEach(entry => {
      entry.models.forEach((m: any) => allModelNames.add(m.name));
    });

    const aggregatedModels = Array.from(allModelNames).map((modelName) => {
      let sumTon = 0;
      let sumUsd = 0;
      let sumAmountOnSale = 0;
      let amountOnSaleCount = 0;
      let count = 0;

      list.forEach((entry) => {
        const model = entry.models.find((m: any) => m.name === modelName);
        if (model) {
          sumTon += model.priceTon;
          sumUsd += model.priceUsd;
          count++;

          if (model.amountOnSale !== undefined && model.amountOnSale !== null) {
            sumAmountOnSale += model.amountOnSale;
            amountOnSaleCount++;
          }
        }
      });

      const avgPriceTon = count > 0 ? parseFloat((sumTon / count).toFixed(3)) : 0;
      const avgPriceUsd = count > 0 ? parseFloat((sumUsd / count).toFixed(3)) : 0;
      const avgAmountOnSale =
        amountOnSaleCount > 0
          ? Math.round(sumAmountOnSale / amountOnSaleCount)
          : null;

      return {
        name: modelName,
        priceTon: avgPriceTon,
        priceUsd: avgPriceUsd,
        amountOnSale: avgAmountOnSale,
      };
    });

    const newObject = new ModelsLifeChartModel({
      giftId,
      models: aggregatedModels,
      date,
    });

    await newObject.save();
  } catch (error) {
    console.log(error);
  }
};