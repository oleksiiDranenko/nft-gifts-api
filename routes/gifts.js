import express from 'express';
import { GiftModel } from '../models/Gift.js';
import { WeekChartModel } from '../models/WeekChart.js';
import { LifeChartModel } from '../models/LifeChart.js'

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const finalGiftsList = await GiftModel.aggregate([
      // Step 1: Fetch all gifts
      { $match: {} }, // Match all gifts (you can add filters if needed)

      // Step 2: Lookup last 24h data from WeekChartModel
      {
        $lookup: {
          from: 'weekcharts', // Collection name for WeekChartModel
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

      // Step 3: Lookup last week data from WeekChartModel
      {
        $lookup: {
          from: 'weekcharts',
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

      // Step 4: Lookup last month data from LifeChartModel
      {
        $lookup: {
          from: 'lifecharts', // Collection name for LifeChartModel
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

      // Step 5: Lookup current price from WeekChartModel
      {
        $lookup: {
          from: 'weekcharts',
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

router.get('/:giftId', async (req, res) => {
    const { giftId } = req.params;
    
    try {

        const gift = await GiftModel.findById(giftId)

        const currentPrice = await WeekChartModel.find({ name: gift.name })
            .sort({ createdAt: -1 })
            .limit(1)
            .lean();
        
        const finalGift = {
            ...gift.toObject(),
                priceTon: currentPrice.length ?  currentPrice[0].priceTon : null,
                priceUsd: currentPrice.length ?  currentPrice[0].priceUsd : null
        }

        res.json(finalGift)
        
    } catch (error) {
        res.json({
            message: error
        })
    }
})

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
        name, image, supply, initSupply, releaseDate, starsPrice, upgradePrice, initTonPrice, initUsdPrice
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
            initUsdPrice
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