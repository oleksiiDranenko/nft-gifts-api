import express from 'express';
import { WeekChartModel } from '../models/WeekChart';  

const router = express.Router();

router.get('/', async (req, res) => {
    const { name } = req.query;

    try {

        const weekList = await WeekChartModel.find({name})

        res.status(200).json(weekList)
        
    } catch (error) {
        res.status(500).json({
            error: error
        })
    }
})

// router.get('/remove-models', async (req, res) => {
//   try {
//     const result = await WeekChartModel.updateMany(
//     { models: { $exists: true } },
//     { $unset: { models: "" } }
//   );
//   res.json(result)
//   } catch (error) {
//     res.json(error)
//   }
// })


export const addWeekData = async (data: any) => {
  try {
    const newGiftData = new WeekChartModel({
      name: data.name,
      date: data.date,
      time: data.time,
      priceTon: data.priceTon,
      priceUsd: data.priceUsd
    });

    await newGiftData.save();
  } catch (error) {
    console.log(error);
  }
};


export { router as WeekRouter };  