import express from 'express';
import { GiftModel } from '../models/Gift.js';
import { WeekChartModel } from '../models/WeekChart.js';
import { getUpgradedSupply } from '../utils/getUpgradedSupply.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const finalGiftsList = await GiftModel.aggregate([
      // Step 1: Fetch all gifts
      { $match: {} }, // Match all gifts (you can add filters if needed)

      // Step 2: Lookup last 24h data from WeekChartModel (24 hours ago)
      {
        $lookup: {
          from: 'weekChart', // Correct collection name for WeekChartModel
          let: { giftName: '$name' },
          pipeline: [
            { $match: { $expr: { $eq: ['$name', '$$giftName'] } } },
            { $sort: { createdAt: -1 } },
            { $skip: 23 }, // Skip 23 records to get ~24 hours ago
            { $limit: 1 },
            { $project: { priceTon: 1, priceUsd: 1 } }
          ],
          as: 'last24hData'
        }
      },

      // Step 3: Lookup last week data from WeekChartModel (oldest record)
      {
        $lookup: {
          from: 'weekChart', // Correct collection name for WeekChartModel
          let: { giftName: '$name' },
          pipeline: [
            { $match: { $expr: { $eq: ['$name', '$$giftName'] } } },
            { $sort: { createdAt: 1 } }, // Oldest first
            { $limit: 1 },
            { $project: { priceTon: 1, priceUsd: 1 } }
          ],
          as: 'lastWeekData'
        }
      },

      // Step 4: Lookup last month data from LifeChartModel (30 days ago)
      {
        $lookup: {
          from: 'lifeChart', // Correct collection name for LifeChartModel
          let: { giftName: '$name' },
          pipeline: [
            { $match: { $expr: { $eq: ['$name', '$$giftName'] } } },
            { $sort: { _id: -1 } },
            { $skip: 29 }, // Skip 29 records to get ~30 days ago
            { $limit: 1 },
            { $project: { priceTon: 1, priceUsd: 1 } }
          ],
          as: 'lastMonthData'
        }
      },

      // Step 5: Lookup current price from WeekChartModel (most recent)
      {
        $lookup: {
          from: 'weekChart', // Correct collection name for WeekChartModel
          let: { giftName: '$name' },
          pipeline: [
            { $match: { $expr: { $eq: ['$name', '$$giftName'] } } },
            { $sort: { createdAt: -1 } }, // Most recent first
            { $limit: 1 },
            { $project: { priceTon: 1, priceUsd: 1 } }
          ],
          as: 'currentPrice'
        }
      },

      // Step 6: Project the final output
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

    // Add upgradedSupply to each gift
    const finalGiftsWithUpgradedSupply = await Promise.all(
      finalGiftsList.map(async (gift) => {
        const upgradedSupply = await getUpgradedSupply(gift.name);
        return { ...gift, upgradedSupply };
      })
    );

    res.json(finalGiftsWithUpgradedSupply);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:giftId', async (req, res) => {
  const { giftId } = req.params;

  try {
    const gift = await GiftModel.findById(giftId);

    if (!gift) {
      return res.status(404).json({ message: 'Gift not found' });
    }

    const currentPrice = await WeekChartModel.find({ name: gift.name })
      .sort({ createdAt: -1 })
      .limit(1)
      .lean();

    const upgradedSupply = await getUpgradedSupply(gift.name);

    const finalGift = {
      ...gift.toObject(),
      priceTon: currentPrice.length ? currentPrice[0].priceTon : null,
      priceUsd: currentPrice.length ? currentPrice[0].priceUsd : null,
      upgradedSupply
    };

    res.json(finalGift);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


export const getNames = async () => {
    try {
        const gifts = await GiftModel.find().select('name -_id');
        const giftNames = gifts.map(gift => gift.name);
        console.log(giftNames)

        return giftNames
        
    } catch (error) {
        console.log(error)
    }
}


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
        })
        
        await newGiftData.save()

        res.json(newGiftData)

    } catch (error) {
        res.json({
            message: error
        })
    }
})

export { router as GiftsRouter };  