import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import axios from "axios";
import { getDate, getTonPrice } from "./functions.js";
import { addWeekData } from "../routes/weekData.js";
import { addLifeData } from "../routes/lifeData.js";
import { addIndexData } from "../routes/indexData.js";
import { GiftModel } from "../models/Gift.js";
import { WeekChartModel } from "../models/WeekChart.js";

puppeteer.use(StealthPlugin());

const MICRO_TON = 1_000_000_000;

const delay = (ms) => {
  console.log(`Delaying for ${ms / 1000} seconds...`);
  return new Promise((resolve) => {
    const start = Date.now();
    setTimeout(() => {
      console.log(`Delay of ${ms / 1000} seconds completed. Actual time: ${(Date.now() - start) / 1000} seconds`);
      resolve();
    }, ms);
  });
};

const retryHandler = async (operation, retries = 3, backoff = 15000) => {
  console.log(`Attempting operation, ${retries} retries left`);
  try {
    return await operation();
  } catch (error) {
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
      console.log(`Retrying in ${cappedBackoff / 1000}s... (${retries} retries left)`);
      await delay(cappedBackoff);
      return retryHandler(operation, retries - 1, cappedBackoff * 1.5);
    }
    throw error;
  }
};

const createBrowser = async () => {
  return puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    protocolTimeout: 60000,
  });
};

const createPage = async (browser, giftName) => {
  const page = await browser.newPage();
  try {
    const userAgent =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
    await retryHandler(async () => {
      try {
        await page.setUserAgent(userAgent);
      } catch (error) {
        throw new Error(`Failed to set user agent: ${error.message}`);
      }
    });
    console.log(`Set User-Agent for ${giftName}: ${userAgent}`);

    await page.setRequestInterception(true);
    page.on("request", (request) => {
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
  preSaleFetch: (giftName) =>
    `{"price":{"$exists":true},"buyer":{"$exists":false},"gift_name":"${giftName}","asset":"TON"}`,
};

const fetchPreSaleGift = async (giftName, browser, tonPrice) => {
  let page;
  try {
    console.log(`Processing pre-sale gift: ${giftName}`);
    page = await createPage(browser, giftName);
    console.log(`Navigating to market for ${giftName}`);
    await retryHandler(async () => {
      await page.goto("https://market.tonnel.network", {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
    }, 3, 10000);
    console.log(`Navigation complete for ${giftName}`);

    const filter = giftFetchStrategies.preSaleFetch(giftName);
    const response = await retryHandler(
      async () => {
        try {
          const result = await page.evaluate(
            async (name, filter, userAgent) => {
              try {
                const response = await fetch("https://gifts2.tonnel.network/api/pageGifts", {
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
                });
                if (!response.ok) {
                  const text = await response.text();
                  throw new Error(`HTTP error! Status: ${response.status}, Body: ${text}`);
                }
                return response.json();
              } catch (err) {
                throw new Error(`Fetch failed: ${err.message}`);
              }
            },
            giftName,
            filter,
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
          );
          return result;
        } catch (err) {
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
    const priceUsd = tonPrice ? parseFloat((priceTon * tonPrice).toFixed(4)) : null;

    // Check last price in WeekChartModel
    const lastRecord = await WeekChartModel.findOne({ name: giftName })
      .sort({ createdAt: -1 })
      .select("priceTon");
    if (lastRecord && priceTon < lastRecord.priceTon * 0.4) {
      console.log(`Price drop too low for ${giftName}: ${priceTon} TON vs last ${lastRecord.priceTon} TON. Using last price.`);
      return { name: gift.name, priceTon: lastRecord.priceTon, priceUsd: tonPrice ? parseFloat((lastRecord.priceTon * tonPrice).toFixed(4)) : null, date, time };
    }
    return { name: gift.name, priceTon, priceUsd, date, time };
  } catch (error) {
    console.error(`Error processing pre-sale gift ${giftName}: ${error.message}`, {
      stack: error.stack,
      giftName,
      timestamp: new Date().toISOString(),
    });
    return null;
  } finally {
    if (page) {
      console.log(`Closing page for ${giftName}`);
      await page.close();
    }
  }
};

const fetchTonPrice = async () => {
  try {
    const price = await retryHandler(() => getTonPrice(), 3, 5000);
    console.log(`Fetched TON price: ${price}`);
    return price;
  } catch (error) {
    console.error(`Failed to fetch TON price: ${error.message}`);
    return null;
  }
};

const fetchGiftPrices = async () => {
  try {
    const response = await retryHandler(async () => {
      const { data } = await axios.get("https://proxy.thermos.gifts/api/v1/collections");
      return data;
    }, 3, 15000);
    return response;
  } catch (error) {
    console.error(`Failed to fetch gift prices: ${error.message}`);
    return [];
  }
};

const processData = async (gift, tonPrice) => {
  const { date, time } = getDate("Europe/London");
  const priceTon = parseFloat((parseInt(gift.stats.floor) / MICRO_TON).toFixed(2));
  const priceUsd = tonPrice ? parseFloat((priceTon * tonPrice).toFixed(4)) : null;

  // Check last price in WeekChartModel
  const lastRecord = await WeekChartModel.findOne({ name: gift.name })
    .sort({ createdAt: -1 })
    .select("priceTon");
  if (lastRecord && priceTon < lastRecord.priceTon * 0.4) {
    console.log(`Price drop too low for ${gift.name}: ${priceTon} TON vs last ${lastRecord.priceTon} TON. Using last price.`);
    return { name: gift.name, priceTon: lastRecord.priceTon, priceUsd: tonPrice ? parseFloat((lastRecord.priceTon * tonPrice).toFixed(4)) : null, date, time };
  }
  return { name: gift.name, priceTon, priceUsd, date, time };
};

export const updateDailyData = async (lastProcessedDate) => {
  const { date: currentDate } = getDate("Europe/London");
  
  // Use dd-mm-yyyy format for consistent comparison
  const formattedCurrentDate = currentDate; // Already in dd-mm-yyyy
  const formattedLastProcessedDate = lastProcessedDate || null;

  // Check if it's a new day
  if (formattedLastProcessedDate === formattedCurrentDate) {
    console.log(`No new day detected. Last processed: ${lastProcessedDate}, Current: ${currentDate}`);
    return lastProcessedDate;
  }

  console.log(`New day detected! Processing data for ${currentDate}`);
  try {
    // Get the previous day's date
    const previousDate = new Date();
    previousDate.setDate(previousDate.getDate() - 1);
    const formattedPreviousDate = previousDate.toLocaleDateString("en-GB").split("/").join("-");

    const giftData = await fetchGiftPrices();
    const giftsList = giftData.map((gift) => gift.name);
    const nonPreSaleGifts = await GiftModel.find({ preSale: { $ne: true } }).select("name -_id");
    const nonPreSaleGiftNames = nonPreSaleGifts.map((gift) => gift.name);

    console.log(`Processing life data for ${giftsList.length} gifts: ${giftsList.join(", ")}`);
    console.log(`Processing index data for ${nonPreSaleGiftNames.length} non-preSale gifts: ${nonPreSaleGiftNames.join(", ")}`);

    await addLifeData(giftsList, formattedPreviousDate);
    await addIndexData(formattedPreviousDate);
    console.log(`Added data for previous day: ${formattedPreviousDate}`);

    // Return the updated lastProcessedDate
    console.log(`Updated lastProcessedDate to: ${currentDate}`);
    return currentDate;
  } catch (error) {
    console.error(`Failed to update daily data: ${error.message}`);
    return lastProcessedDate;
  }
};

export const addData = async () => {
  console.log(`Data update started at: ${new Date().toLocaleTimeString()}`);
  let browser;
  let tonPrice = null;
  let lastProcessedDate = getDate("Europe/London").date; // Default to current date if not provided

  try {
    tonPrice = await fetchTonPrice();

    // Fetch gift list from API
    const giftData = await fetchGiftPrices();
    const gifts = giftData.map((gift) => gift.name);
    console.log(`Fetched ${gifts.length} gifts: ${gifts.join(", ")}`);

    // Get pre-sale gifts from GiftModel
    const preSaleGifts = await GiftModel.find({ preSale: true }).select("name -_id");
    const preSaleGiftNames = preSaleGifts.map((gift) => gift.name);
    console.log(`Fetched ${preSaleGiftNames.length} pre-sale gifts: ${preSaleGiftNames.join(", ")}`);

    // Process non-pre-sale gifts first
    console.log("Processing non-pre-sale gifts");
    let processed = 0;
    const nonPreSalePromises = giftData
      .filter((gift) => !preSaleGiftNames.includes(gift.name))
      .map(async (gift) => {
        const giftName = gift.name;
        console.log(`Processing non-pre-sale gift ${++processed}/${gifts.length - preSaleGiftNames.length}: ${giftName}`);

        if (!gift?.stats?.floor) {
          console.log(`No price data for ${giftName}`);
          return false;
        }

        const data = await processData(gift, tonPrice);
        console.log(`Adding week data for non-pre-sale ${giftName}`);
        await addWeekData(data);
        console.log(`Week data added for ${giftName}`);
        return true;
      });

    await Promise.all(nonPreSalePromises);
    console.log("Completed processing non-pre-sale gifts");

    // Process pre-sale gifts
    console.log("Processing pre-sale gifts");
    browser = await createBrowser();
    processed = 0;

    for (let i = 0; i < preSaleGiftNames.length; i += 3) {
      const batch = preSaleGiftNames.slice(i, i + 3);
      console.log(`Processing pre-sale batch ${Math.floor(i / 3) + 1}: ${batch.join(", ")}`);

      const batchPromises = batch.map(async (giftName) => {
        console.log(`Processing pre-sale gift ${++processed}/${preSaleGiftNames.length}: ${giftName}`);
        const data = await fetchPreSaleGift(giftName, browser, tonPrice);
        if (data) {
          console.log(`Adding week data for pre-sale ${giftName}`);
          await addWeekData(data);
          console.log(`Week data added for ${giftName}`);
          return true;
        }
        console.log(`Failed to process pre-sale gift: ${giftName}`);
        return false;
      });

      await Promise.all(batchPromises);
      console.log(`Pre-sale batch ${Math.floor(i / 3) + 1} completed`);
      await delay(15000);
    }

    // Update daily data
    lastProcessedDate = await updateDailyData(lastProcessedDate);
    console.log(`Data update completed at: ${new Date().toLocaleTimeString()}`);
    return lastProcessedDate;
  } catch (error) {
    console.error(`Unexpected error in addData: ${error.message}`);
    throw error;
  } finally {
    if (browser) {
      console.log("Closing browser");
      await browser.close();
    }
  }
};

export const addDailyDataForDate = async (inputDate) => {
  // Validate input date format (dd-mm-yyyy)
  const dateRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
  if (!dateRegex.test(inputDate)) {
    throw new Error(`Invalid date format: ${inputDate}. Expected format: dd-mm-yyyy`);
  }

  // Parse and validate the date
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

  // Format the date to dd-mm-yyyy for consistency
  const formattedDate = `${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}-${year}`;
  console.log(`Processing daily data for manually entered date: ${formattedDate}`);

  try {
    const giftData = await fetchGiftPrices();
    const giftsList = giftData.map((gift) => gift.name);
    const nonPreSaleGifts = await GiftModel.find({ preSale: { $ne: true } }).select("name -_id");
    const nonPreSaleGiftNames = nonPreSaleGifts.map((gift) => gift.name);

    console.log(`Processing life data for ${giftsList.length} gifts: ${giftsList.join(", ")}`);
    console.log(`Processing index data for ${nonPreSaleGiftNames.length} non-preSale gifts: ${nonPreSaleGiftNames.join(", ")}`);

    await addLifeData(giftsList, formattedDate);
    await addIndexData(formattedDate);
    console.log(`Added daily data for: ${formattedDate}`);
    return formattedDate;
  } catch (error) {
    console.error(`Failed to add daily data for ${formattedDate}: ${error.message}`);
    throw error;
  }
};