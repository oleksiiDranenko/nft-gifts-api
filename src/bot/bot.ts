import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import axios from "axios";
import { delay, formatDateDDMMYYYY, getDate } from "./functions";
import { addWeekData } from "../routes/weekData";
import { addLifeData } from "../routes/lifeData";
import { GiftInterface, GiftModel } from "../models/Gift";
import { addIndexData } from "../functions/index/addIndexData";
import { addModelsWeekData } from "../routes/modelsWeekData";
import { retryHandler } from "./operations/retryHandler";
import { fetchTonPrice } from "./operations/getTonPrice";
import { addModelsLifeData } from "../routes/modelsLifeData";
import { fetchVolume, MergedCollection } from "./operations/fetchVolume";
import { GiftModelsModel } from "../models/Models";

puppeteer.use(StealthPlugin());

const MICRO_TON = 1_000_000_000;

interface GiftDataInput {
  name: string;
  stats?: {
    floor?: string;
    count?: number;
  };
  volume?: number;
  salesCount?: number;
}

const fetchGiftPrices = async () => {
  try {
    const response = await retryHandler(
      async () => {
        const { data } = await axios.get(
          "https://proxy.thermos.gifts/api/v1/collections"
        );
        return data;
      },
      3,
      15000
    );
    return response;
  } catch (error: any) {
    console.error(`Failed to fetch gift prices: ${error.message}`);
    return [];
  }
};

const processData = async (gift: GiftDataInput, tonPrice: number) => {
  const { date, time } = getDate("Europe/London");

  const priceTon = gift?.stats?.floor
    ? parseFloat((parseInt(gift.stats.floor) / MICRO_TON).toFixed(2))
    : 0;

  const priceUsd = tonPrice
    ? parseFloat((priceTon * tonPrice).toFixed(4))
    : null;

  const amountOnSale = gift?.stats?.count ?? 0;

  return {
    name: gift.name,
    priceTon,
    priceUsd,
    amountOnSale,
    date,
    time,
    volume: gift.volume ?? 0,
    salesCount: gift.salesCount ?? 0,
  };
};

const fetchPreSaleGiftPrices = async (preSaleGiftNames: string[]) => {
  try {
    const res = await axios.get(
      "https://portals-market.com/partners/collections/floors",
      {
        headers: {
          Authorization: `partners ${process.env.PORTALS_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const floorPrices = res.data?.floorPrices || {};

    // Normalize input names for matching
    const results = preSaleGiftNames
      .map((originalName) => {
        const normalized = originalName.toLowerCase().replace(/\s+/g, "");
        const price = floorPrices[normalized];
        if (!price) return null;

        return {
          name: originalName, // keep original casing & spaces
          price: Number(price),
        };
      })
      .filter(Boolean); // remove nulls

    return results;
  } catch (error) {
    console.error("Error fetching pre-sale gift prices:", error);
    return [];
  }
};
const processPreSaleData = async (
  gift: { name: string; price: number },
  tonPrice: number
) => {
  const { date, time } = getDate("Europe/London");

  const priceTon = gift.price;
  const priceUsd = tonPrice
    ? parseFloat((priceTon * tonPrice).toFixed(4))
    : null;

  return {
    name: gift.name,
    priceTon,
    priceUsd,
    amountOnSale: 0,
    date,
    time,
  };
};

const fetchGiftModels = async (
  giftName: string,
  giftId: any,
  tonPrice: any
) => {
  try {
    const res = await axios.post(
      "https://proxy.thermos.gifts/api/v1/attributes",
      {
        collections: [giftName],
      }
    );

    const models = res.data[giftName]?.models || [];

    let giftModelsDoc = await GiftModelsModel.findOne({ giftId });

    if (!giftModelsDoc) {
      giftModelsDoc = await GiftModelsModel.create({
        giftId,
        models: models.map((model: any) => ({
          name: model.name,
          rarity: model.rarity_per_mille / 10,
          image: model.image_url,
        })),
      });
    }

    return models.map((model: any) => {
      const priceTon = model.stats?.floor
        ? parseFloat((parseInt(model.stats.floor) / MICRO_TON).toFixed(2))
        : 0;
      const priceUsd = tonPrice
        ? parseFloat((priceTon * tonPrice).toFixed(4))
        : null;
      const amountOnSale = model.stats.count;
      return {
        name: model.name,
        amountOnSale,
        priceTon,
        priceUsd,
      };
    });
  } catch (error: any) {
    console.error(`Error fetching models for ${giftName}:`, error.message);
    return [];
  }
};

export const updateDailyDataForPreviousDay = async () => {
  console.log(
    `Daily data update started at: ${new Date().toLocaleTimeString()}`
  );
  try {
    const previousDate = new Date();
    previousDate.setDate(previousDate.getDate() - 1);
    const formattedPreviousDate = formatDateDDMMYYYY(previousDate);

    const giftData = await GiftModel.find();
    const giftsList = giftData.map((gift: GiftInterface) => gift.name);

    await addLifeData(giftsList, formattedPreviousDate);
    await addIndexData(formattedPreviousDate);
    for (let gift of giftData) {
      await addModelsLifeData(gift._id, formattedPreviousDate);
    }
  } catch (error: any) {
    console.error(
      `Failed to update daily data for previous day: ${error.message}`
    );
    throw error;
  }
};

export const addData = async () => {
  console.log("Data update started");
  let tonPrice: number | null = null;

  try {
    tonPrice = await fetchTonPrice();
    if (!tonPrice) throw new Error("Ton price fetch failed");

    const giftData = await fetchGiftPrices();

    const volumeData = await fetchVolume();
    const volumeMap = new Map<string, MergedCollection>();
    volumeData.forEach((item) => {
      volumeMap.set(item.name, item);
    });

    const nonPreSaleGifts = await GiftModel.find({
      preSale: { $ne: true },
    }).select("name");
    const nonPreSaleGiftNames = nonPreSaleGifts.map((gift) => gift.name);
    const validNonPreSaleGifts = giftData.filter((gift: any) =>
      nonPreSaleGiftNames.includes(gift.name)
    );

    const nonPreSalePromises = validNonPreSaleGifts.map(async (gift: any) => {
      if (!gift?.stats?.floor) return false;

      const dbGift = await GiftModel.findOne({ name: gift.name });
      if (!dbGift) return false;

      const volumeInfo = volumeMap.get(gift.name) || {
        volume: 0,
        salesCount: 0,
      };

      const data = await processData(
        {
          ...gift,
          volume: volumeInfo.volume,
          salesCount: volumeInfo.salesCount,
        },
        tonPrice!
      );

      await addWeekData(data);
      return true;
    });

    const preSaleGifts = await GiftModel.find({ preSale: true }).select("name");
    const preSaleGiftNames = preSaleGifts.map((gift) => gift.name);
    const preSalePrices = await fetchPreSaleGiftPrices(preSaleGiftNames);

    const preSalePromises = preSalePrices
      .filter((gift): gift is { name: string; price: number } => gift !== null)
      .map(async (gift) => {
        const dbGift = await GiftModel.findOne({ name: gift.name });
        if (!dbGift) return false;

        const data = await processPreSaleData(gift, tonPrice!);

        await addWeekData(data);
        return true;
      });

    const nonPreSaleModelsPromises = nonPreSaleGifts.map(async (gift) => {
      await delay(700);
      const models = await fetchGiftModels(gift.name, gift._id, tonPrice!);
      await addModelsWeekData({ giftId: gift._id, models });
    });

    await Promise.all(nonPreSalePromises);
    await Promise.all(preSalePromises);
    await Promise.all(nonPreSaleModelsPromises);

    console.log(`Data update finished at: ${new Date().toLocaleTimeString()}`);
  } catch (error: any) {
    console.error(`Unexpected error in addData: ${error.message}`);
    throw error;
  }
};

export const addDailyDataForDate = async (inputDate: any) => {
  const dateRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
  if (!dateRegex.test(inputDate)) {
    throw new Error(
      `Invalid date format: ${inputDate}. Expected format: dd-mm-yyyy`
    );
  }

  const [day, month, year] = inputDate.split("-").map(Number);
  const parsedDate = new Date(year, month - 1, day);
  if (
    isNaN(parsedDate.getTime()) ||
    parsedDate.getDate() !== day ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getFullYear() !== year
  ) {
    throw new Error(`Invalid date: ${inputDate}`);
  }

  const formattedDate = `${String(day).padStart(2, "0")}-${String(
    month
  ).padStart(2, "0")}-${year}`;
  console.log(
    `Daily data update started at: ${new Date().toLocaleTimeString()}`
  );

  try {
    const giftData = await GiftModel.find();
    const giftsList = giftData.map((gift: any) => gift.name);
    const nonPreSaleGifts = await GiftModel.find({
      preSale: { $ne: true },
    }).select("name -_id");
    const nonPreSaleGiftNames = nonPreSaleGifts.map((gift) => gift.name);

    await addLifeData(giftsList, formattedDate);
    await addIndexData(formattedDate);
    return formattedDate;
  } catch (error: any) {
    console.error(
      `Failed to add daily data for ${formattedDate}: ${error.message}`
    );
    throw error;
  }
};
