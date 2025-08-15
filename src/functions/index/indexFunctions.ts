import { IndexDataModel } from "../../models/IndexData";

export const calculateTMCAndSave = async (date: string, indexId: any, giftsList: any, lifeData: any) => {
  try {
    if (!lifeData.length) {
      console.log(`No LifeChart data found for date: ${date}`);
      return;
    }

    if (!giftsList.length) {
      console.log(`No Gift data found`);
      return;
    }

    // Build a name → supply map directly from GiftModel
    const supplyMap: any = {};
    giftsList.forEach((gift: any) => {
      if (gift?.name && isFinite(gift?.supply)) {
        supplyMap[gift.name] = gift.supply;
      } else {
        console.warn(`❌ Gift has invalid supply or missing name: ${gift.name}`);
      }
    });

    let totalPriceTon = 0;
    let totalPriceUsd = 0;

    for (const record of lifeData) {
      const supply = supplyMap[record.name];
      const priceTon = parseFloat(record.priceTon);
      const priceUsd = parseFloat(record.priceUsd);

      if (!isFinite(priceTon) || !isFinite(priceUsd)) {
        console.warn(`❌ Invalid price for gift "${record.name}": TON=${record.priceTon}, USD=${record.priceUsd}`);
        continue;
      }

      if (!supply || !isFinite(supply)) {
        console.warn(`❌ Invalid or missing supply for gift "${record.name}": ${supply}`);
        continue;
      }

      totalPriceTon += priceTon * supply;
      totalPriceUsd += priceUsd * supply;
    }

    totalPriceTon = parseFloat(totalPriceTon.toFixed(4));
    totalPriceUsd = parseFloat(totalPriceUsd.toFixed(4));

    // Only save if values are valid
    if (!isFinite(totalPriceTon) || !isFinite(totalPriceUsd)) {
      console.warn(`❌ Skipping TMC index save: invalid prices (TON=${totalPriceTon}, USD=${totalPriceUsd})`);
      return;
    }

    const newData = new IndexDataModel({
      indexId: indexId.toString(),
      date,
      priceTon: totalPriceTon,
      priceUsd: totalPriceUsd,
    });

    await newData.save();
    console.log(`✅ Saved index data for ${date}, ${indexId}: TON=${totalPriceTon}, USD=${totalPriceUsd}`);
  } catch (error: any) {
    console.error(`❌ Error saving market cap data for ${date}, ${indexId}: ${error.stack}`);
  }
};


export const calculateFDVAndSave = async (date: string, indexId: any, giftsList: any, lifeData: any) => {
  try {
    if (!lifeData.length) {
      console.log(`⚠️ No LifeChart data found for date: ${date}`);
      return null;
    }
    if (!giftsList.length) {
      console.log(`⚠️ No Gift data found`);
      return null;
    }

    const supplyMap: any = {};
    giftsList.forEach((gift: any) => {
      supplyMap[gift.name] = gift.supply;
    });

    let totalPriceTon = 0;
    let totalPriceUsd = 0;

    for (const record of lifeData) {
      const supply = supplyMap[record.name] || 0;
      if (supply === 0) {
        console.log(`⚠️ No supply found for gift: ${record.name}`);
        continue;
      }
      totalPriceTon += (record.priceTon || 0) * supply;
      totalPriceUsd += (record.priceUsd || 0) * supply;
    }

    totalPriceTon = parseFloat(totalPriceTon.toFixed(4));
    totalPriceUsd = parseFloat(totalPriceUsd.toFixed(4));

    // 🛡️ Validate before saving
    if (!isFinite(totalPriceTon) || !isFinite(totalPriceUsd)) {
      console.warn(`❌ Skipping FDV index save: invalid prices (TON=${totalPriceTon}, USD=${totalPriceUsd})`);
      return null;
    }

    const newData = new IndexDataModel({
      indexId: indexId.toString(),
      date,
      priceTon: totalPriceTon,
      priceUsd: totalPriceUsd,
    });

    await newData.save();
    console.log(`✅ Saved index data for ${date}, ${indexId}: TON=${totalPriceTon}, USD=${totalPriceUsd}`);
    return { priceTon: totalPriceTon, priceUsd: totalPriceUsd };
  } catch (error: any) {
    console.error(`❌ Error saving FDV data for ${date}, ${indexId}: ${error.stack}`);
    return null;
  }
};
