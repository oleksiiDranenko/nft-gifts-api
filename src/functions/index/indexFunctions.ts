import { IndexDataModel } from "../../models/IndexData";
import { IndexMonthDataModel } from "../../models/IndexMonthData";

export async function calculateAvgAndSave(indexId: any, date: string) {
  try {
    const result = await IndexMonthDataModel.aggregate([
      { $match: { indexId, date } },
      {
        $group: {
          _id: null,
          avgPriceTon: { $avg: "$priceTon" },
          avgPriceUsd: { $avg: "$priceUsd" },
        },
      },
    ]);

    if (!result.length) {
      return null;
    }

    const { avgPriceTon, avgPriceUsd } = result[0];

    const newDailyDoc = new IndexDataModel({
      indexId,
      date,
      priceTon: avgPriceTon,
      priceUsd: avgPriceUsd,
    });

    await newDailyDoc.save();

    return newDailyDoc;
  } catch (error) {
    console.error("❌ Error creating daily index data:", error);
    throw error;
  }
}

export async function calculateSumAndSave(indexId: any, date: string) {
  try {
    const result = await IndexMonthDataModel.aggregate([
      { $match: { indexId, date } },
      {
        $group: {
          _id: null,
          totalPriceTon: { $sum: "$priceTon" },
          totalPriceUsd: { $sum: "$priceUsd" },
        },
      },
    ]);

    if (!result.length) {
      return null;
    }

    const { totalPriceTon, totalPriceUsd } = result[0];

    const newDailyDoc = new IndexDataModel({
      indexId,
      date,
      priceTon: totalPriceTon,
      priceUsd: totalPriceUsd,
    });

    await newDailyDoc.save();

    return newDailyDoc;
  } catch (error) {
    console.error("❌ Error creating daily index data:", error);
    throw error;
  }
}
