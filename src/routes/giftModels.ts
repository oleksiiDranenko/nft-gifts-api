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

    const latestChart = await ModelsWeekChartModel
      .findOne({ giftId })
      .sort({ createdAt: -1 });

    if (!latestChart) {
      return res.json(giftModels);
    }

    const priceMap: any = {};
    latestChart.models.forEach(model => {
      priceMap[model.name] = {
        priceTon: model.priceTon,
        priceUsd: model.priceUsd
      };
    });

    const result = giftModels.map(doc => {
      const docObj = doc.toObject();
      docObj.models = docObj.models.map(model => {
        const prices = priceMap[model.name];
        return {
          ...model,
          priceTon: prices ? prices.priceTon : null,
          priceUsd: prices ? prices.priceUsd : null
        };
      });
      return docObj;
    });

    res.json(result);
  } catch (error) {
    res.status(500).json(error);
  }
});


export { router as GiftModelsRouter };  