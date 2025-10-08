import { calculatePercentOnSale } from "../../bot/operations/percentOfSupplyOnSale";
import { GiftInterface } from "../../models/Gift";
import { IndexMonthDataModel } from "../../models/IndexMonthData";

export const calculateTMCAndSave = async (
  date: string,
  time: string,
  indexId: any,
  giftsList: any,
  monthData: any
) => {
  try {
    if (!monthData.length || !giftsList.length) return;

    let totalPriceTon = 0;
    let totalPriceUsd = 0;

    for (const record of monthData) {
      const gift = giftsList.find(
        (item: GiftInterface) => item.name === record.name
      );
      if (!gift || !isFinite(gift.upgradedSupply)) continue;

      const supply = gift.upgradedSupply;
      const priceTon = parseFloat(record.priceTon);
      const priceUsd = parseFloat(record.priceUsd);

      if (!isFinite(priceTon) || !isFinite(priceUsd)) continue;

      totalPriceTon += priceTon * supply;
      totalPriceUsd += priceUsd * supply;
    }

    totalPriceTon = parseFloat(totalPriceTon.toFixed(4));
    totalPriceUsd = parseFloat(totalPriceUsd.toFixed(4));

    if (!isFinite(totalPriceTon) || !isFinite(totalPriceUsd)) return;

    const newData = new IndexMonthDataModel({
      indexId: indexId.toString(),
      date,
      time,
      priceTon: totalPriceTon,
      priceUsd: totalPriceUsd,
    });

    await newData.save();
  } catch (error: any) {
    console.error(
      `Error saving market cap data for ${date}, ${indexId}: ${error.stack}`
    );
  }
};

export const calculateFDVAndSave = async (
  date: string,
  time: string,
  indexId: any,
  giftsList: any,
  monthData: any
) => {
  try {
    if (!monthData.length || !giftsList.length) return null;

    const supplyMap: any = {};
    giftsList.forEach((gift: any) => {
      supplyMap[gift.name] = gift.supply;
    });

    let totalPriceTon = 0;
    let totalPriceUsd = 0;

    for (const record of monthData) {
      const supply = supplyMap[record.name] || 0;
      if (supply === 0) continue;

      totalPriceTon += (record.priceTon || 0) * supply;
      totalPriceUsd += (record.priceUsd || 0) * supply;
    }

    totalPriceTon = parseFloat(totalPriceTon.toFixed(4));
    totalPriceUsd = parseFloat(totalPriceUsd.toFixed(4));

    if (!isFinite(totalPriceTon) || !isFinite(totalPriceUsd)) return null;

    const newData = new IndexMonthDataModel({
      indexId: indexId.toString(),
      date,
      time,
      priceTon: totalPriceTon,
      priceUsd: totalPriceUsd,
    });

    await newData.save();
    return { priceTon: totalPriceTon, priceUsd: totalPriceUsd };
  } catch (error: any) {
    console.error(
      `Error saving FDV data for ${date}, ${indexId}: ${error.stack}`
    );
    return null;
  }
};

export const calculateTSAndSave = async (
  date: string,
  time: string,
  indexId: any,
  giftsList: any
) => {
  try {
    if (!giftsList?.length) return null;

    let totalSupply = 0;

    for (const gift of giftsList) {
      if (isFinite(gift.upgradedSupply)) {
        totalSupply += gift.upgradedSupply;
      }
    }

    if (!isFinite(totalSupply)) return null;

    const newData = new IndexMonthDataModel({
      indexId: indexId.toString(),
      date,
      time,
      priceTon: totalSupply,
      priceUsd: totalSupply,
    });

    await newData.save();

    return { totalSupply };
  } catch (error: any) {
    console.error(
      `Error saving TS data for ${date}, ${indexId}: ${error.stack}`
    );
    return null;
  }
};

export const calculateVolumeAndSave = async (
  date: string,
  time: string,
  indexId: any,
  giftsList: any,
  monthData: any
) => {
  try {
    if (!Array.isArray(monthData) || !monthData.length) return null;
    if (!Array.isArray(giftsList) || !giftsList.length) return null;

    let totalVolume = 0;

    // Get all unique gift names from giftsList
    const giftNames = giftsList.map((g: any) => g.name);

    for (const giftName of giftNames) {
      // Filter monthData for this gift
      const giftRecords = monthData.filter((rec: any) => rec.name === giftName);
      if (!giftRecords.length) continue;

      // Take the last record (most recent)
      const lastRecord = giftRecords[giftRecords.length - 1];
      const vol = parseFloat(lastRecord.volume);

      if (isFinite(vol)) {
        totalVolume += vol;
      }
    }

    totalVolume = parseFloat(totalVolume.toFixed(4));
    if (!isFinite(totalVolume)) return null;

    const newData = new IndexMonthDataModel({
      indexId: indexId.toString(),
      date,
      time,
      priceTon: totalVolume,
      priceUsd: totalVolume,
    });

    await newData.save();

    return { totalVolume };
  } catch (error: any) {
    console.error(
      `Error saving Volume data for ${date}, ${indexId}: ${error.stack}`
    );
    return null;
  }
};

export const calculatePercentOnSaleAndSave = async (
  date: string,
  time: string,
  indexId: any
) => {
  const value = await calculatePercentOnSale();

  const newData = new IndexMonthDataModel({
    indexId: indexId.toString(),
    date,
    time,
    priceTon: value,
    priceUsd: value,
  });

  await newData.save();
};
