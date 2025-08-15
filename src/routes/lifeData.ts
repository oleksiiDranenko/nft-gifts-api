import express from 'express';
import { LifeChartModel } from '../models/LifeChart';
import { WeekChartModel } from '../models/WeekChart';

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



export const addLifeData = async (giftsList: any, date: any) => {
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

            const openTon = list.length > 0 ? list[0].priceTon : 0;
            const closeTon = list.length > 0 ? list[list.length - 1].priceTon : 0; 
            const highTon = list.length > 0 ? Math.max(...list.map(item => item.priceTon)) : 0;
            const lowTon = list.length > 0 ? Math.min(...list.map(item => item.priceTon)) : 0;

            const newObject = new LifeChartModel({
                name: gift,
                date,
                priceTon: avgPriceTon,
                priceUsd: avgPriceUsd,
                openTon,
                closeTon,
                highTon,
                lowTon
            });

            await newObject.save();
        }
    } catch (error) {
        console.log(error);
    }
};



export { router as LifeRouter };  