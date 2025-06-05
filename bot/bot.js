import puppeteer from "puppeteer";
import randomUseragent from "random-useragent";
import { getDate, getTonPrice } from "./functions.js";
import { addWeekData } from "../routes/weekData.js";
import { addLifeData } from "../routes/lifeData.js";
import { getNames } from "../routes/gifts.js";
import { addIndexData } from "../routes/indexData.js";
import { GiftModel } from "../models/Gift.js";

const ONE_HOUR = 60 * 60 * 1000;

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

// Retry Pattern: Generic retry handler
const retryHandler = async (operation, retries = 3, backoff = 15000) => {
  try {
    return await operation();
  } catch (error) {
    if (
      (error.name === "TimeoutError" ||
        error.message.includes("429") ||
        error.message.includes("502")) &&
      retries > 0
    ) {
      const cappedBackoff = Math.min(backoff, 60000);
      console.log(`Retrying in ${cappedBackoff / 1000}s... (${retries} retries left)`);
      await delay(cappedBackoff);
      return retryHandler(operation, retries - 1, cappedBackoff * 2);
    }
    throw error;
  }
};

// Factory Pattern: Browser and page creation
const browserFactory = {
  createBrowser: async () => {
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
  },

  createPage: async (browser, giftName) => {
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
  },
};

// Strategy Pattern: Gift fetching strategies
const giftFetchStrategies = {
  preSaleFetch: (giftName) =>
    `{"price":{"$exists":true},"buyer":{"$exists":false},"gift_name":"${giftName}","asset":"TON"}`,
  nonPreSaleFetch: (giftName) =>
    `{"price":{"$exists":true},"refunded":{"$ne":true},"buyer":{"$exists":false},"export_at":{"$exists":true},"gift_name":"${giftName}","asset":"TON"}`,
};

// Template Method Pattern: Gift processing workflow
const processGiftTemplate = async (giftName, browser, fetchStrategy, processData, saveData) => {
  let page;
  try {
    console.log(`Processing gift: ${giftName}`);
    page = await browserFactory.createPage(browser, giftName);
    console.log(`Navigating to market for ${giftName}`);
    await page.goto("https://market.tonnel.network", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    console.log(`Navigation complete for ${giftName}`);

    const filter = fetchStrategy(giftName);
    const response = await retryHandler(() =>
      page.evaluate(
        async (name, filter) => {
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
        },
        giftName,
        filter
      )
    );
    const giftData = processData(response, giftName);
    await saveData(giftData);
    console.log(`Processed gift: ${giftName}`);
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

// Facade Pattern: Main scraper interface
const dataScraperFacade = () => {
  let tonPrice = null;
  let lastTonFetchTime = null;
  let currentDate = getDate().date;

  const fetchTonPrice = async () => {
    try {
      const price = await retryHandler(() => getTonPrice(), 3, 5000);
      console.log(`Fetched TON price: ${price}`);
      lastTonFetchTime = Date.now();
      tonPrice = price;
      return price;
    } catch (error) {
      console.error(`Failed to fetch TON price: ${error.message}`);
      return null;
    }
  };

  const processData = (response, giftName) => {
    const gift = response[0];
    if (!gift?.price) throw new Error(`Invalid response data for gift ${giftName}`);
    const { date, time } = getDate("Europe/London");
    const priceTon = parseFloat((gift.price * 1.1).toFixed(4));
    const priceUsd = tonPrice ? parseFloat((priceTon * tonPrice).toFixed(4)) : null;
    return { name: gift.name, priceTon, priceUsd, date, time };
  };

  const updateDailyData = async () => {
    const { date: updatedDate } = getDate();
    if (currentDate === updatedDate) return;

    console.log("New day detected!");
    try {
      const previousDate = new Date();
      previousDate.setDate(previousDate.getDate() - 1);
      const formattedDate = previousDate.toLocaleDateString("en-GB").split("/").join("-");

      const giftsList = await getNames();
      const nonPreSaleGifts = await GiftModel.find({ preSale: { $ne: true } }).select("name -_id");
      const nonPreSaleGiftNames = nonPreSaleGifts.map((gift) => gift.name);

      console.log(`Processing life data for ${giftsList.length} gifts: ${giftsList.join(", ")}`);
      console.log(`Processing index data for ${nonPreSaleGiftNames.length} non-preSale gifts: ${nonPreSaleGiftNames.join(", ")}`);

      await addLifeData(giftsList, formattedDate);
      await addIndexData(formattedDate);
      console.log("Added previous day data");
      currentDate = updatedDate;
    } catch (error) {
      console.error(`Failed to update daily data: ${error.message}`);
    }
  };

  return {
    scrapeAndUpdate: async () => {
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

        browser = await browserFactory.createBrowser();
        let processed = 0;
        for (const gift of gifts) {
          console.log(`Processing gift ${++processed}/${gifts.length}: ${gift}`);
          const isPreSale = await GiftModel.findOne({ name: gift }).select("preSale").then((g) => g?.preSale || false);
          const fetchStrategy = isPreSale ? giftFetchStrategies.preSaleFetch : giftFetchStrategies.nonPreSaleFetch;
          const success = await processGiftTemplate(gift, browser, fetchStrategy, processData, async (data) => {
            console.log(`Adding week data for ${gift}`);
            await addWeekData(data);
            console.log(`Week data added for ${gift}`);
          });
          if (!success) console.log(`Failed to process gift: ${gift}`);
          await delay(10000);
          logMemoryUsage();
        }

        await updateDailyData();
        console.log(`Data update completed at: ${new Date().toLocaleTimeString()}`);
      } catch (error) {
        console.error(`Unexpected error in scrapeAndUpdate: ${error.message}`);
        logMemoryUsage();
        throw error;
      } finally {
        if (browser) {
          console.log("Closing browser");
          await browser.close();
        }
        logMemoryUsage();
      }
    },
  };
};

// Export the facade's main function
export const addData = dataScraperFacade().scrapeAndUpdate;