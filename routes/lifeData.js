import express from 'express';
import { LifeChartModel } from '../models/LifeChart.js';
import { WeekChartModel } from '../models/WeekChart.js';

const router = express.Router();

router.get('/', async (req, res) => {
    const { name } = req.query;

    try {

        const lifeList = await LifeChartModel.find({name})

        res.status(200).json(lifeList)
        
    } catch (error) {
        res.status(500).json({
            error: error
        })
    }
})



export const addLifeData = async (giftsList, date) => {
    try {
        for (const gift of giftsList) {
            const list = await WeekChartModel.find({ name: gift, date });

            let sumTon = 0;
            let sumUsd = 0;

            list.forEach((item) => {
                sumTon += item.priceTon;
                sumUsd += item.priceUsd;
            });

            const avgPriceTon = list.length > 0 ? parseFloat((sumTon / list.length).toFixed(3)) : 0;
            const avgPriceUsd = list.length > 0 ? parseFloat((sumUsd / list.length).toFixed(3)) : 0;
            
            const newObject = new LifeChartModel({
                name: gift,
                date,
                priceTon: avgPriceTon,
                priceUsd: avgPriceUsd
            });

            await newObject.save();
        }

    } catch (error) {
        console.log(error)
    }
}



export { router as LifeRouter };  