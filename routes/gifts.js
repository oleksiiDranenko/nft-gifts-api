import express from 'express';
import { GiftModel } from '../models/Gift.js';
import { WeekChartModel } from '../models/WeekChart.js';
import { LifeChartModel } from '../models/LifeChart.js';
import puppeteer from 'puppeteer';
import randomUseragent from 'random-useragent';

const router = express.Router();

// Initialize Puppeteer browser (adjust as needed for your setup)
let browser;
const initializeBrowser = async () => {
  if (!browser) {
    browser = await puppeteer.launch({ headless: true });
  }
  return browser;
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

const fetchGiftData = async (page, giftName, isPreSale) => {
  console.log(`Navigating to market for ${giftName}`);
  await page.goto("https://market.tonnel.network", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  console.log(`Navigation complete for ${giftName}`);

  // Define the filter based on preSale status
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
        filter: filter,
        ref: 0,
        price_range: null,
        user_auth: "",
      }),
    });

    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    return response.json();
  }, giftName, filter);
};

// Modified getNames to return names and preSaleNames
export const getNames = async () => {
  try {
    const gifts = await GiftModel.find().select('name preSale -_id');
    const names = gifts
      .filter(gift => gift.preSale !== true)
      .map(gift => gift.name);
    const preSaleNames = gifts
      .filter(gift => gift.preSale === true)
      .map(gift => gift.name);

    console.log('Non-pre-sale names:', names);
    console.log('Pre-sale names:', preSaleNames);

    return { names, preSaleNames };
  } catch (error) {
    console.error('Error fetching gift names:', error);
    throw error;
  }
};

// Existing route: Get all gifts with aggregated data
router.get('/', async (req, res) => {
  try {
    const finalGiftsList = await GiftModel.aggregate([
      { $match: {} },
      {
        $lookup: {
          from: 'weekChart',
          let: { giftName: '$name' },
          pipeline: [
            { $match: { $expr: { $eq: ['$name', '$$giftName'] } } },
            { $sort: { createdAt: -1 } },
            { $skip: 23 },
            { $limit: 1 },
            { $project: { priceTon: 1, priceUsd: 1 } }
          ],
          as: 'last24hData'
        }
      },
      {
        $lookup: {
          from: 'weekChart',
          let: { giftName: '$name' },
          pipeline: [
            { $match: { $expr: { $eq: ['$name', '$$giftName'] } } },
            { $sort: { createdAt: 1 } },
            { $limit: 1 },
            { $project: { priceTon: 1, priceUsd: 1 } }
          ],
          as: 'lastWeekData'
        }
      },
      {
        $lookup: {
          from: 'lifeChart',
          let: { giftName: '$name' },
          pipeline: [
            { $match: { $expr: { $eq: ['$name', '$$giftName'] } } },
            { $sort: { _id: -1 } },
            { $skip: 29 },
            { $limit: 1 },
            { $project: { priceTon: 1, priceUsd: 1 } }
          ],
          as: 'lastMonthData'
        }
      },
      {
        $lookup: {
          from: 'weekChart',
          let: { giftName: '$name' },
          pipeline: [
            { $match: { $expr: { $eq: ['$name', '$$giftName'] } } },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
            { $project: { priceTon: 1, priceUsd: 1 } }
          ],
          as: 'currentPrice'
        }
      },
      {
        $project: {
          name: 1,
          image: 1,
          supply: 1,
          initSupply: 1,
          releaseDate: 1,
          starsPrice: 1,
          upgradePrice: 1,
          initTonPrice: 1,
          initUsdPrice: 1,
          staked: 1,
          preSale: 1,
          tonPrice24hAgo: { $arrayElemAt: ['$last24hData.priceTon', 0] },
          usdPrice24hAgo: { $arrayElemAt: ['$last24hData.priceUsd', 0] },
          tonPriceWeekAgo: { $arrayElemAt: ['$lastWeekData.priceTon', 0] },
          usdPriceWeekAgo: { $arrayElemAt: ['$lastWeekData.priceUsd', 0] },
          tonPriceMonthAgo: { $arrayElemAt: ['$lastMonthData.priceTon', 0] },
          usdPriceMonthAgo: { $arrayElemAt: ['$lastMonthData.priceUsd', 0] },
          priceTon: { $arrayElemAt: ['$currentPrice.priceTon', 0] },
          priceUsd: { $arrayElemAt: ['$currentPrice.priceUsd', 0] }
        }
      }
    ]);

    res.json(finalGiftsList);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Existing route: Get gift by ID
router.get('/:giftId', async (req, res) => {
  const { giftId } = req.params;
  try {
    const gift = await GiftModel.findById(giftId);
    const currentPrice = await WeekChartModel.find({ name: gift.name })
      .sort({ createdAt: -1 })
      .limit(1)
      .lean();

    const finalGift = {
      ...gift.toObject(),
      priceTon: currentPrice.length ? currentPrice[0].priceTon : null,
      priceUsd: currentPrice.length ? currentPrice[0].priceUsd : null
    };

    res.json(finalGift);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// New route: Get non-pre-sale and pre-sale gift names
router.get('/gift-names', async (req, res) => {
  try {
    const { names, preSaleNames } = await getNames();
    res.json({ names, preSaleNames });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// New route: Fetch data for non-pre-sale gifts
router.get('/fetch-non-presale/:giftName', async (req, res) => {
  const { giftName } = req.params;
  try {
    const { names } = await getNames();
    if (!names.includes(giftName)) {
      return res.status(400).json({ message: `${giftName} is not a non-pre-sale gift` });
    }

    const browser = await initializeBrowser();
    const page = await configurePage(browser, giftName);
    const giftData = await fetchGiftData(page, giftName, false); // Non-pre-sale filter
    await page.close();
    res.json(giftData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// New route: Fetch data for pre-sale gifts
router.get('/fetch-presale/:giftName', async (req, res) => {
  const { giftName } = req.params;
  try {
    const { preSaleNames } = await getNames();
    if (!preSaleNames.includes(giftName)) {
      return res.status(400).json({ message: `${giftName} is not a pre-sale gift` });
    }

    const browser = await initializeBrowser();
    const page = await configurePage(browser, giftName);
    const giftData = await fetchGiftData(page, giftName, true); // Pre-sale filter
    await page.close();
    res.json(giftData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Existing route: Create a new gift
router.post('/', async (req, res) => {
  console.log(req.body);
  const {
    name, image, supply, initSupply, releaseDate, starsPrice, upgradePrice, initTonPrice, initUsdPrice, preSale
  } = req.body;

  try {
    const newGiftData = new GiftModel({
      name,
      image,
      supply,
      initSupply,
      releaseDate,
      starsPrice,
      upgradePrice,
      initTonPrice,
      initUsdPrice,
      preSale
    });

    await newGiftData.save();
    res.json(newGiftData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export { router as GiftsRouter };