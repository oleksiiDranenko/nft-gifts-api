import { GiftInterface } from "../../models/Gift";
import { IndexDataModel } from "../../models/IndexData";

export const calculateTMCAndSave = async (
  date: string,
  indexId: any,
  giftsList: any,
  lifeData: any
) => {
  try {
    if (!lifeData.length || !giftsList.length) return;

    let totalPriceTon = 0;
    let totalPriceUsd = 0;

    for (const record of lifeData) {
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

    const newData = new IndexDataModel({
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
  lifeData: any
) => {
  try {
    if (!lifeData.length || !giftsList.length) return null;

    const supplyMap: any = {};
    giftsList.forEach((gift: any) => {
      supplyMap[gift.name] = gift.supply;
    });

    let totalPriceTon = 0;
    let totalPriceUsd = 0;

    for (const record of lifeData) {
      const supply = supplyMap[record.name] || 0;
      if (supply === 0) continue;

      totalPriceTon += (record.priceTon || 0) * supply;
      totalPriceUsd += (record.priceUsd || 0) * supply;
    }

    totalPriceTon = parseFloat(totalPriceTon.toFixed(4));
    totalPriceUsd = parseFloat(totalPriceUsd.toFixed(4));

    if (!isFinite(totalPriceTon) || !isFinite(totalPriceUsd)) return null;

    const newData = new IndexDataModel({
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
  lifeData: any
) => {
  try {
    if (!lifeData.length || !giftsList.length) return null;

    let totalSupply = 0;

    for (const record of lifeData) {
      const gift = giftsList.find(
        (item: GiftInterface) => item.name === record.name
      );
      if (!gift || !isFinite(gift.upgradedSupply)) continue;

      totalSupply += gift.upgradedSupply;
    }

    if (!isFinite(totalSupply)) return null;

    const newData = new IndexDataModel({
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