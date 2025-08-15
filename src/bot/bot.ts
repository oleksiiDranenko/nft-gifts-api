import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import axios from "axios";
import { getDate, getTonPrice } from "./functions";
import { addWeekData } from "../routes/weekData";
import { addLifeData } from "../routes/lifeData";
import { GiftModel } from "../models/Gift";
import { WeekChartModel } from "../models/WeekChart";
import { addIndexData } from "../functions/index/addIndexData";

puppeteer.use(StealthPlugin());

const MICRO_TON = 1_000_000_000;

const delay = (ms: number) => {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
};

const retryHandler = async (operation: any, retries = 3, backoff = 15000) => {
  try {
    return await operation();
  } catch (error: any) {
    console.error(`Operation failed: ${error.message}`);
    if (
      (error.name === "TimeoutError" ||
        error.message.includes("429") ||
        error.message.includes("502") ||
        error.message.includes("Failed to fetch") ||
        error.message.includes("Protocol error")) &&
      retries > 0
    ) {
      const cappedBackoff = Math.min(backoff, 60000);
      await delay(cappedBackoff);
      return retryHandler(operation, retries - 1, cappedBackoff * 1.5);
    }
    throw error;
  }
};

const createBrowser = async () => {
  return puppeteer.launch({
    headless: "new" as any,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    protocolTimeout: 60000,
  });
};

const createPage = async (browser: any, giftName: any) => {
  const page = await browser.newPage();
  try {
    const userAgent =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
    await retryHandler(async () => {
      try {
        await page.setUserAgent(userAgent);
      } catch (error: any) {
        throw new Error(`Failed to set user agent: ${error.message}`);
      }
    });

    await page.setRequestInterception(true);
    page.on("request", (request: any) => {
      if (["image", "stylesheet", "font"].includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue({
          headers: {
            ...request.headers(),
            "User-Agent": userAgent,
            Accept: "application/json, text/plain, */*",
            "Content-Type": "application/json",
            Origin: "https://market.tonnel.network",
            Referer: "https://market.tonnel.network/",
          },
        });
      }
    });
    return page;
  } catch (error) {
    await page.close();
    throw error;
  }
};

const giftFetchStrategies = {
  preSaleFetch: (giftName: any) =>
    `{"price":{"$exists":true},"buyer":{"$exists":false},"gift_name":"${giftName}","asset":"TON"}`,
};

const fetchPreSaleGift = async (giftName: any, browser: any, tonPrice: any) => {
  let page: any;
  try {
    page = await createPage(browser, giftName);
    await retryHandler(
      async () => {
        await page.goto("https://market.tonnel.network", {
          waitUntil: "networkidle2",
          timeout: 30000,
        });
      },
      3,
      10000
    );

    const filter = giftFetchStrategies.preSaleFetch(giftName);
    const response = await retryHandler(
      async () => {
        try {
          const result = await page.evaluate(
            async (name: any, filter: any, userAgent: any) => {
              try {
                const response = await fetch(
                  "https://gifts2.tonnel.network/api/pageGifts",
                  {
                    method: "POST",
                    headers: {
                      Accept: "application/json, text/plain, */*",
                      "Content-Type": "application/json",
                      "User-Agent": userAgent,
                      Origin: "https://market.tonnel.network",
                      Referer: "https://market.tonnel.network/",
                    },
                    body: JSON.stringify({
                      page: 1,
                      limit: 1,
                      sort: '{"price":1,"gift_id":-1}',
                      filter,
                      ref: 0,
                      price_range: null,
                      user_auth: "",
                    }),
                  }
                );
                if (!response.ok) {
                  const text = await response.text();
                  throw new Error(
                    `HTTP error! Status: ${response.status}, Body: ${text}`
                  );
                }
                return response.json();
              } catch (err: any) {
                throw new Error(`Fetch failed: ${err.message}`);
              }
            },
            giftName,
            filter,
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
          );
          return result;
        } catch (err: any) {
          throw new Error(`Evaluate failed: ${err.message}`);
        }
      },
      3,
      10000
    );
    const gift = response[0];
    if (!gift?.price) throw new Error(`Invalid response data for ${giftName}`);
    const { date, time } = getDate("Europe/London");
    const priceTon = parseFloat((gift.price * 1.06).toFixed(4));
    const priceUsd = tonPrice
      ? parseFloat((priceTon * tonPrice).toFixed(4))
      : null;

    const lastRecord = await WeekChartModel.findOne({ name: giftName })
      .sort({ createdAt: -1 })
      .select("priceTon");
    if (lastRecord && priceTon < lastRecord.priceTon * 0.4) {
      return {
        name: gift.name,
        priceTon: lastRecord.priceTon,
        priceUsd: tonPrice
          ? parseFloat((lastRecord.priceTon * tonPrice).toFixed(4))
          : null,
        date,
        time,
      };
    }
    return { name: gift.name, priceTon, priceUsd, date, time };
  } catch (error: any) {
    console.error(
      `Error processing pre-sale gift ${giftName}: ${error.message}`,
      {
        stack: error.stack,
        giftName,
        timestamp: new Date().toISOString(),
      }
    );
    return null;
  } finally {
    if (page) {
      await page.close();
    }
  }
};

const fetchTonPrice = async () => {
  try {
    const price = await retryHandler(() => getTonPrice(), 3, 5000);
    return price;
  } catch (error: any) {
    console.error(`Failed to fetch TON price: ${error.message}`);
    return null;
  }
};

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

const processData = async (gift: any, tonPrice: any) => {
  const { date, time } = getDate("Europe/London");
  const priceTon = parseFloat((parseInt(gift.stats.floor) / MICRO_TON).toFixed(2));
  const priceUsd = tonPrice ? parseFloat((priceTon * tonPrice).toFixed(4)) : null;

  const lastRecord = await WeekChartModel.findOne({ name: gift.name })
    .sort({ createdAt: -1 })
    .select("priceTon");

  if (lastRecord && priceTon < lastRecord.priceTon * 0.4) {
    return {
      name: gift.name,
      priceTon: lastRecord.priceTon,
      priceUsd: tonPrice ? parseFloat((lastRecord.priceTon * tonPrice).toFixed(4)) : null,
      date,
      time
    };
  }

  return { name: gift.name, priceTon, priceUsd, date, time };
};

const fetchGiftModels = async (giftName: string, tonPrice: any) => {
  try {
    const res = await axios.post("https://proxy.thermos.gifts/api/v1/attributes", {
      collections: [giftName]
    });

    const models = res.data[giftName]?.models || [];

    return models.map((m: any) => {
      const priceTon = m.stats?.floor
        ? parseFloat((parseInt(m.stats.floor) / MICRO_TON).toFixed(2))
        : 0;
      const priceUsd = tonPrice ? parseFloat((priceTon * tonPrice).toFixed(4)) : null;

      return {
        name: m.name,
        priceTon,
        priceUsd
      };
    });
  } catch (error: any) {
    console.error(`Error fetching models for ${giftName}:`, error.message);
    return [];
  }
};

function formatDateDDMMYYYY(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

export const updateDailyDataForPreviousDay = async () => {
  console.log(
    `Daily data update started at: ${new Date().toLocaleTimeString()}`
  );
  try {
    const previousDate = new Date();
    previousDate.setDate(previousDate.getDate() - 1);
    const formattedPreviousDate = formatDateDDMMYYYY(previousDate);

    const giftData = await fetchGiftPrices();
    const giftsList = giftData.map((gift: any) => gift.name);
    const nonPreSaleGifts = await GiftModel.find({
      preSale: { $ne: true },
    }).select("name -_id");
    const nonPreSaleGiftNames = nonPreSaleGifts.map((gift) => gift.name);

    await addLifeData(giftsList, formattedPreviousDate);
    await addIndexData(formattedPreviousDate);
    return formattedPreviousDate;
  } catch (error: any) {
    console.error(
      `Failed to update daily data for previous day: ${error.message}`
    );
    throw error;
  }
};

export const addData = async () => {
  console.log(`Data update started at: ${new Date().toLocaleTimeString()}`);
  let browser: any;
  let tonPrice: number | null = null;

  try {
    tonPrice = await fetchTonPrice();
    if (!tonPrice) throw new Error("Ton price fetch failed");

    const giftData = await fetchGiftPrices();

    const nonPreSaleGifts = await GiftModel.find({ preSale: { $ne: true } }).select("name -_id");
    const nonPreSaleGiftNames = nonPreSaleGifts.map((gift) => gift.name);

    const validNonPreSaleGifts = giftData.filter((gift: any) =>
      nonPreSaleGiftNames.includes(gift.name)
    );

    const nonPreSalePromises = validNonPreSaleGifts.map(async (gift: any) => {
      if (!gift?.stats?.floor) return false;

      const data = await processData(gift, tonPrice!);

      await delay(700);

      const models = await fetchGiftModels(gift.name, tonPrice!);

      await addWeekData({ ...data, models });

      return true;
    });

    await Promise.all(nonPreSalePromises);

    console.log(`Data update finished at: ${new Date().toLocaleTimeString()}`);
  } catch (error: any) {
    console.error(`Unexpected error in addData: ${error.message}`);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
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
    const giftData = await fetchGiftPrices();
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
