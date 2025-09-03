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


export const addWeekData = async (data: any) => {
  try {
    const newGiftData = new WeekChartModel({
      name: data.name,
      date: data.date,
      time: data.time,
      amountOnSale: data.amountOnSale,
      volume: data.volume,
      salesCount: data.salesCount,
      priceTon: data.priceTon,
      priceUsd: data.priceUsd
    });

    await newGiftData.save();
  } catch (error) {
    console.log(error);
  }
};


export { router as WeekRouter };  