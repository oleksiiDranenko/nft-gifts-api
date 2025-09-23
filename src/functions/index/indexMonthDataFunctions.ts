import { calculatePercentOnSale } from "../../bot/operations/percentOfSupplyOnSale";
import { GiftInterface } from "../../models/Gift";
import { IndexMonthDataModel } from "../../models/IndexMonthData";

export const calculateTMCAndSave = async (
  date: string,
  indexId: any,
  giftsList: any,
  weekData: any
) => {
  try {
    if (!weekData.length || !giftsList.length) return;

    let totalPriceTon = 0;
    let totalPriceUsd = 0;

    for (const record of weekData) {
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
  indexId: any,
  giftsList: any,
  weekData: any
) => {
  try {
    if (!weekData.length || !giftsList.length) return null;

    const supplyMap: any = {};
    giftsList.forEach((gift: any) => {
      supplyMap[gift.name] = gift.supply;
    });

    let totalPriceTon = 0;
    let totalPriceUsd = 0;

    for (const record of weekData) {
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
  indexId: any,
  giftsList: any,
  weekData: any
) => {
  try {
    if (!weekData.length || !giftsList.length) return null;

    let totalSupply = 0;

    for (const record of weekData) {
      const gift = giftsList.find(
        (item: GiftInterface) => item.name === record.name
      );
      if (!gift || !isFinite(gift.upgradedSupply)) continue;

      totalSupply += gift.upgradedSupply;
    }

    if (!isFinite(totalSupply)) return null;

    const newData = new IndexMonthDataModel({
      indexId: indexId.toString(),
      date,
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
  indexId: any,
  giftsList: any,
  weekData: any
) => {
  try {
    if (!weekData.length || !giftsList.length) return null;

    let totalVolume = 0;

    // Group records by gift name
    const groupedRecords: Record<string, any[]> = {};
    for (const record of weekData) {
      if (!groupedRecords[record.name]) {
        groupedRecords[record.name] = [];
      }
      groupedRecords[record.name].push(record);
    }

    // For each gift: take last 48 records and sum volume
    for (const giftName in groupedRecords) {
      const records = groupedRecords[giftName];
      const last48 = records.slice(-48);

      let giftVolume = 0;
      for (const rec of last48) {
        const vol = parseFloat(rec.volume);
        if (!isFinite(vol)) continue;
        giftVolume += vol;
      }

      totalVolume += giftVolume;
    }

    totalVolume = parseFloat(totalVolume.toFixed(4));
    if (!isFinite(totalVolume)) return null;

    const newData = new IndexMonthDataModel({
      indexId: indexId.toString(),
      date,
      priceTon: totalVolume, // reusing same fields
      priceUsd: totalVolume, // store in both Ton/Usd slots
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
  indexId: any
) => {
  const value = await calculatePercentOnSale();

  const newData = new IndexMonthDataModel({
    indexId: indexId.toString(),
    date,
    priceTon: value,
    priceUsd: value,
  });

  await newData.save();
};
