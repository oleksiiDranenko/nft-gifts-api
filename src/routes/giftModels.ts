import express from 'express'
import { GiftModelsModel } from '../models/Models';
import { ModelsWeekChartModel } from '../models/ModelsWeekChart';

const router = express.Router();

// router.post('/', async (req, res) => {
//     const {giftId, models} = req.body;

//     try {
//         const newGiftModels = new GiftModelsModel({
//             giftId,
//             models
//         })

//         await newGiftModels.save()
//         res.json(newGiftModels)
//     } catch (error) {
//         res.status(500).json(error)
//     }
// })


router.get('/:giftId', async (req, res) => {
  const { giftId } = req.params;

  try {
    const giftModels = await GiftModelsModel.find({ giftId });

    // latest snapshot
    const latestChart = await ModelsWeekChartModel
      .findOne({ giftId })
      .sort({ createdAt: -1 });

    // 24h ago snapshot (skip 47 docs, take 1)
    const chart24hAgo = await ModelsWeekChartModel
      .find({ giftId })
      .sort({ createdAt: -1 })
      .skip(47)
      .limit(1);

    const snapshot24h = chart24hAgo.length > 0 ? chart24hAgo[0] : null;

    if (!latestChart) {
      return res.json(giftModels);
    }

    // map latest prices
    const priceMap: any = {};
    latestChart.models.forEach(model => {
      priceMap[model.name] = {
        priceTon: model.priceTon,
        priceUsd: model.priceUsd
      };
    });

    // map 24h ago prices
    const priceMap24h: any = {};
    if (snapshot24h) {
      snapshot24h.models.forEach(model => {
        priceMap24h[model.name] = {
          tonPrice24hAgo: model.priceTon,
          usdPrice24hAgo: model.priceUsd
        };
      });
    }

    // merge into response
    const result = giftModels.map(doc => {
      const docObj = doc.toObject();
      docObj.models = docObj.models.map(model => {
        const latest = priceMap[model.name];
        const ago = priceMap24h[model.name] || {};
        return {
          ...model,
          priceTon: latest ? latest.priceTon : null,
          priceUsd: latest ? latest.priceUsd : null,
          tonPrice24hAgo: ago.tonPrice24hAgo || null,
          usdPrice24hAgo: ago.usdPrice24hAgo || null,
        };
      });
      return docObj;
    });

    res.json(result);
  } catch (error) {
    res.status(500).json(error);
  }
});


router.patch("/addModel/:giftId", async (req, res) => {
  const { giftId } = req.params;
  const { name, rarity, image } = req.body;

  if (!name || !rarity || !image) {
    return res.status(400).json({ message: "name, rarity, and image are required" });
  }

  try {
    const updatedGiftModel = await GiftModelsModel.findOneAndUpdate(
      { giftId },
      {
        $push: {
          models: { name, rarity, image },
        },
      },
      { new: true }
    );

    if (!updatedGiftModel) {
      return res.status(404).json({ message: "Gift not found" });
    }

    res.status(200).json(updatedGiftModel);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});


export { router as GiftModelsRouter };  