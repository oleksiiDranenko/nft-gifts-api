import puppeteer from "puppeteer";
import randomUseragent from "random-useragent";
import { getDate, getTonPrice } from "./functions.js";
import { addWeekData } from "../routes/weekData.js";
import { addLifeData } from "../routes/lifeData.js";
import { getNames } from "../routes/gifts.js";
import { addIndexData } from "../routes/indexData.js";
import { GiftModel } from "../models/Gift.js";

const ONE_HOUR = 60 * 60 * 1000;
let tonPrice = null;
let lastTonFetchTime = null;
let currentDate = getDate().date;

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

const logMemoryUsage = () => {
  const used = process.memoryUsage();
  console.log("Memory Usage:");
  for (let key in used) {
    console.log(`${key}: ${Math.round(used[key] / 1024 / 1024 * 100) / 100} MB`);
  }
};

const fetchTonPrice = async (retries = 3, backoff = 5000) => {
  try {
    const price = await getTonPrice();
    console.log(`Fetched TON price: ${price}`);
    lastTonFetchTime = Date.now();
    tonPrice = price;
    return price;
  } catch (error) {
    if (error.response?.status === 429 && retries > 0) {
      console.log(`Rate limit hit. Retrying in ${backoff / 1000}s... (${retries} retries left)`);
      await delay(backoff);
      return fetchTonPrice(retries - 1, backoff * 2);
    }
    console.error(`Failed to fetch TON price: ${error.message}`);
    return null;
  }
};

const setupBrowser = async () => {
  return puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--single-process",
      "--no-zygote",
      "--disable-background-networking",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    protocolTimeout: 60000,
  });
};

const configurePage = async (browser, giftName) => {
  const page = await browser.newPage();
  try {
    const userAgent = randomUseragent.getRandom();
    await page.setUserAgent(userAgent);
    console.log(`Set User-Agent for ${giftName}: ${userAgent}`);

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      request.continue({
        headers: {
          ...request.headers(),
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          Accept: "*/*",
          "Content-Type": "application/json",
          Origin: "https://market.tonnel.network",
          Referer: "https://market.tonnel.network/",
        },
      });
    });

    return page;
  } catch (error) {
    await page.close();
    throw error;
  }
};

const fetchGiftData = async (page, giftName) => {
  console.log(`Navigating to market for ${giftName}`);
  await page.goto("https://market.tonnel.network", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  console.log(`Navigation complete for ${giftName}`);

  // Check if the gift has preSale property
  const gift = await GiftModel.findOne({ name: giftName }).select("preSale");
  const isPreSale = gift?.preSale || false;

  // Set the filter based on preSale status
  const filter = isPreSale
    ? `{"price":{"$exists":true},"buyer":{"$exists":false},"gift_name":"${giftName}","asset":"TON"}`
    : `{"price":{"$exists":true},"refunded":{"$ne":true},"buyer":{"$exists":false},"export_at":{"$exists":true},"gift_name":"${giftName}","asset":"TON"}`;

  return page.evaluate(async (name, filter) => {
    const response = await fetch("https://gifts2.tonnel.network/api/pageGifts", {
      method: "POST",
      headers: {
        Accept: "*/*",
        "Content-Type": "application/json",
        Origin: "https://market.tonnel.network",
        Referer: "https://market.tonnel.network/",
      },
      body: JSON.stringify({
        page: 1,
        limit: 30,
        sort: '{"price":1,"gift_id":-1}',
        filter,
        ref: 0,
        price_range: null,
        user_auth: "",
      }),
    });

    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    return response.json();
  }, giftName, filter);
};

const fetchGiftDataWithRetry = async (page, giftName, retries = 3, backoff = 15000) => {
  try {
    return await fetchGiftData(page, giftName);
  } catch (error) {
    if (
      (error.name === "TimeoutError" ||
        error.message.includes("429") ||
        error.message.includes("502")) &&
      retries > 0
    ) {
      const cappedBackoff = Math.min(backoff, 60000);
      console.log(`Retrying fetchGiftData for ${giftName} in ${cappedBackoff / 1000}s... (${retries} retries left)`);
      await delay(cappedBackoff);
      return fetchGiftDataWithRetry(page, giftName, retries - 1, cappedBackoff * 2);
    }
    throw error;
  }
};

const processGiftData = (response, giftName) => {
  const gift = response[0];
  if (!gift?.price) throw new Error(`Invalid response data for gift ${giftName}`);

  const { date, time } = getDate("Europe/London");
  const priceTon = parseFloat((gift.price * 1.1).toFixed(4));
  const priceUsd = tonPrice ? parseFloat((priceTon * tonPrice).toFixed(4)) : null;

  return {
    name: gift.name,
    priceTon,
    priceUsd,
    date,
    time,
  };
};

const processGift = async (giftName, browser) => {
  let page;
  try {
    console.log(`Processing gift: ${giftName}`);
    page = await configurePage(browser, giftName);
    const response = await fetchGiftDataWithRetry(page, giftName);
    const giftData = processGiftData(response, giftName);
    console.log(`Adding week data for ${giftName}`);
    await addWeekData(giftData);
    console.log(`Week data added for ${giftName}`);
    return true;
  } catch (error) {
    console.error(`Error processing gift ${giftName}: ${error.message}`);
    return false;
  } finally {
    if (page) {
      console.log(`Closing page for ${giftName}`);
      await page.close();
    }
  }
};

const updateDailyData = async () => {
  const { date: updatedDate } = getDate();
  if (currentDate === updatedDate) return;

  console.log("New day detected!");
  try {
    const previousDate = new Date();
    previousDate.setDate(previousDate.getDate() - 1);
    const formattedDate = previousDate.toLocaleDateString("en-GB").split("/").join("-");

    // Fetch all gift names for addLifeData
    const giftsList = await getNames();
    
    // Fetch non-preSale gift names for addIndexData
    const nonPreSaleGifts = await GiftModel.find({ preSale: { $ne: true } }).select("name -_id");
    const nonPreSaleGiftNames = nonPreSaleGifts.map(gift => gift.name);

    console.log(`Processing life data for ${giftsList.length} gifts: ${giftsList.join(", ")}`);
    console.log(`Processing index data for ${nonPreSaleGiftNames.length} non-preSale gifts: ${nonPreSaleGiftNames.join(", ")}`);

    await addLifeData(giftsList, formattedDate);
    await addIndexData(nonPreSaleGiftNames, formattedDate);
    console.log("Added previous day data");
    currentDate = updatedDate;
  } catch (error) {
    console.error(`Failed to update daily data: ${error.message}`);
  }
};

export const addData = async () => {
  console.log(`Data update started at: ${new Date().toLocaleTimeString()}`);
  let browser;
  try {
    logMemoryUsage();
    if (!lastTonFetchTime || Date.now() - lastTonFetchTime > ONE_HOUR) {
      await fetchTonPrice();
    } else {
      console.log(`Using cached TON price: ${tonPrice}`);
    }

    const gifts = await getNames().catch((error) => {
      console.error(`Failed to fetch gift names: ${error.message}`);
      return [];
    });
    console.log(`Fetched ${gifts.length} gifts: ${gifts.join(", ")}`);

    browser = await setupBrowser();
    let processed = 0;
    for (const gift of gifts) {
      console.log(`Processing gift ${++processed}/${gifts.length}: ${gift}`);
      try {
        const success = await processGift(gift, browser);
        if (!success) console.log(`Failed to process gift: ${gift}`);
        await delay(10000); // Increased to 10 seconds
        logMemoryUsage();
      } catch (error) {
        console.error(`Unexpected error processing gift ${gift}: ${error.message}`);
        continue;
      }
    }

    await updateDailyData();
    console.log(`Data update completed at: ${new Date().toLocaleTimeString()}`);
  } catch (error) {
    console.error(`Unexpected error in addData: ${error.message}`);
    logMemoryUsage();
    throw error;
  } finally {
    if (browser) {
      console.log("Closing browser");
      await browser.close();
    }
    logMemoryUsage();
  }
};