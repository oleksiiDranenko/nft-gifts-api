import { FearAndGreedModel } from "../../models/FearAndGreed";
import { WeekChartModel } from "../../models/WeekChart";
import { getDate } from "../functions";
import { getNonPreSaleGifts } from "../shared/getNonPreSaleGifts";

const avg3dPriceChange = async () => {
  const gifts = await getNonPreSaleGifts();

  let totalChange = 0;
  let count = 0;

  for (let gift of gifts) {
    const giftPriceDoc = await WeekChartModel.findOne({ name: gift.name })
      .sort({ _id: -1 })
      .exec();

    const giftPrice3dAgoDoc = await WeekChartModel.findOne({ name: gift.name })
      .sort({ _id: -1 })
      .skip(144)
      .exec();

    if (giftPriceDoc && giftPrice3dAgoDoc) {
      const recentPrice = giftPriceDoc.priceTon;
      const oldPrice = giftPrice3dAgoDoc.priceTon;

      if (oldPrice > 0) {
        const percentChange = ((recentPrice - oldPrice) / oldPrice) * 100;
        totalChange += percentChange;
        count++;
      }
    }
  }

  const avgChange = count > 0 ? totalChange / count : 0;
  return avgChange;
};

const dailyVolume = async () => {
  const gifts = await getNonPreSaleGifts();

  let totalVolume = 0;

  for (let gift of gifts) {
    const docs = await WeekChartModel.find({ name: gift.name })
      .sort({ _id: -1 })
      .limit(48)
      .exec();

    const giftVolume = docs.reduce((sum, doc) => sum + (doc.volume || 0), 0);
    totalVolume += giftVolume;
  }

  return totalVolume;
};

const dailyVolume3dAgo = async () => {
  const gifts = await getNonPreSaleGifts();

  let totalVolume = 0;

  for (let gift of gifts) {
    const docs = await WeekChartModel.find({ name: gift.name })
      .sort({ _id: -1 })
      .skip(144)
      .limit(48)
      .exec();

    const giftVolume = docs.reduce((sum, doc) => sum + (doc.volume || 0), 0);
    totalVolume += giftVolume;
  }

  return totalVolume;
};

const dailyVolumePercentChange = async () => {
  const current = await dailyVolume();
  const threeDaysAgo = await dailyVolume3dAgo();

  if (threeDaysAgo === 0) return 0;

  const percentChange = ((current - threeDaysAgo) / threeDaysAgo) * 100;
  return percentChange;
};

const normalizeAsymmetric = (
  value: number,
  negMin: number,
  posMax: number
): number => {
  if (value <= 0) {
    const clamped = Math.max(negMin, Math.min(0, value));
    return ((clamped - negMin) / (0 - negMin)) * 50;
  } else {
    const clamped = Math.max(0, Math.min(posMax, value));
    return 50 + (clamped / posMax) * 50;
  }
};

const getFearGreedIndex = async () => {
  const priceChange = await avg3dPriceChange();
  const volumeChange = await dailyVolumePercentChange();

  const priceScore = normalizeAsymmetric(priceChange, -70, 100);
  const volumeScore = normalizeAsymmetric(volumeChange, -80, 300);

  const index = 0.5 * priceScore + 0.5 * volumeScore;

  return Math.round(index);
};

export const addFearGreedIndex = async () => {
  const fearAndGreedValue = await getFearGreedIndex();
  const { date, time } = getDate("Europe/London");
  const fearAndGreed = new FearAndGreedModel({
    date,
    time,
    value: fearAndGreedValue,
  });

  fearAndGreed.save();
};
