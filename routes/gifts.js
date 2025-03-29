import express from 'express';
import { GiftModel } from '../models/Gift.js';
import { WeekChartModel } from '../models/WeekChart.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const giftsList = await GiftModel.find();
        const finalGiftsList = [];

        for (let gift of giftsList) {
            const last24hData = await WeekChartModel.find({ name: gift.name })
                .sort({ createdAt: -1 })
                .skip(23)
                .limit(1)
                .lean();

            const currentPrice = await WeekChartModel.find({ name: gift.name })
                .sort({ createdAt: -1 })
                .limit(1)
                .lean();

            finalGiftsList.push({
                ...gift.toObject(),
                tonPrice24hAgo: last24hData.length ? last24hData[0].priceTon : null,
                usdPrice24hAgo: last24hData.length ? last24hData[0].priceUsd : null,
                priceTon: currentPrice.length ?  currentPrice[0].priceTon : null,
                priceUsd: currentPrice.length ?  currentPrice[0].priceUsd : null
            });
        }

        res.json(finalGiftsList);
    } catch (error) {
        res.status(500).json({ message: error.message});
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