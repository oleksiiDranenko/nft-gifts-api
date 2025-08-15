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
    const latestGift = await ModelsWeekChartModel
      .findOne({ giftId })
      .sort({ createdAt: -1 });

    if (!latestGift) {
      return res.status(404).json({ message: 'No data found for this giftId' });
    }

    const totalPrice = latestGift.models.reduce(
      (acc, model) => {
        acc.priceTon += model.priceTon;
        acc.priceUsd += model.priceUsd;
        return acc;
      },
      { priceTon: 0, priceUsd: 0 }
    );

    res.json({
      latestGift,
      totalPrice
    });
  } catch (error) {
    res.status(500).json(error);
  }
});


export { router as GiftModelsRouter };  