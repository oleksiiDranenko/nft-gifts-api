import express from 'express';
import { IndexModel } from '../models/Index.js';
import { IndexDataModel } from '../models/IndexData.js';
import { LifeChartModel } from '../models/LifeChart.js';
import { GiftModel } from '../models/Gift.js';

const router = express.Router();

router.get('/get-all/:indexId', async (req, res) => {
    const { indexId } = req.params;
    try {
        const indexExists = await IndexModel.findById(indexId)
        if (!indexExists) {
            return res.status(404).json({ error: `Index ${indexId} not found` })
        }

        const dataList = await IndexDataModel.find({ indexId })
        res.json(dataList);
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
});

const calculateMarketCapAndSave = async (date, indexId, giftsList, lifeData) => {
    try {
        if (!lifeData.length) {
            console.log(`No LifeChart data found for date: ${date}`);
            return;
        }
        if (!giftsList.length) {
            console.log(`No Gift data found`);
            return;
        }

        const supplyMap = {};
        giftsList.forEach(gift => {
            supplyMap[gift.name] = gift.supply;
        });

        let totalPriceTon = 0;
        let totalPriceUsd = 0;

        for (const record of lifeData) {
            const supply = supplyMap[record.name] || 0;
            if (supply === 0) {
                console.log(`No supply found for gift: ${record.name}`);
                continue;
            }
            totalPriceTon += (record.priceTon || 0) * supply;
            totalPriceUsd += (record.priceUsd || 0) * supply;
        }

        totalPriceTon = parseFloat(totalPriceTon.toFixed(4));
        totalPriceUsd = parseFloat(totalPriceUsd.toFixed(4));

        const newData = new IndexDataModel({
            indexId: indexId.toString(),
            date,
            priceTon: totalPriceTon,
            priceUsd: totalPriceUsd,
        });

        await newData.save();
        console.log(`Saved index data for ${date}, ${indexId}: TON=${totalPriceTon}, USD=${totalPriceUsd}`);
    } catch (error) {
        console.error(`Error saving market cap data for ${date}, ${indexId}: ${error.stack}`);
    }
};

const calculateMCISave = async (date, indexId, giftsList, lifeData) => {
    try {
        if (!lifeData.length) {
            console.log(`No LifeChart data found for date: ${date}`);
            return;
        }
        if (!giftsList.length) {
            console.log(`No Gift data found`);
            return;
        }

        const supplyMap = {};
        let totalSupply = 0;
        giftsList.forEach(gift => {
            supplyMap[gift.name] = gift.supply;
            totalSupply += gift.supply || 0;
        });

        if (totalSupply === 0) {
            console.log(`Total supply is zero for date: ${date}`);
            return;
        }

        let totalPriceTon = 0;
        let totalPriceUsd = 0;

        for (const record of lifeData) {
            const supply = supplyMap[record.name] || 0;
            if (supply === 0) {
                console.log(`No supply found for gift: ${record.name}`);
                continue;
            }
            totalPriceTon += ((record.priceTon || 0) * supply * 100) / totalSupply;
            totalPriceUsd += ((record.priceUsd || 0) * supply * 100) / totalSupply;
        }

        totalPriceTon = parseFloat(totalPriceTon.toFixed(4));
        totalPriceUsd = parseFloat(totalPriceUsd.toFixed(4));

        const newData = new IndexDataModel({
            indexId: indexId.toString(),
            date,
            priceTon: totalPriceTon,
            priceUsd: totalPriceUsd,
        });

        await newData.save();
        console.log(`Saved MCI data for ${date}, ${indexId}: TON=${totalPriceTon}, USD=${totalPriceUsd}`);
    } catch (error) {
        console.error(`Error saving MCI data for ${date}, ${indexId}: ${error.stack}`);
    }
};

const calculateR10Save = async (date, indexId, giftsList, lifeData) => {
    try {
        if (!lifeData.length) {
            console.log(`No LifeChart data found for date: ${date}`);
            return;
        }
        if (!giftsList.length) {
            console.log(`No Gift data found`);
            return;
        }

        const supplyMap = {};
        let totalR10Supply = 0;
        giftsList.forEach(gift => {
            if (gift.supply <= 10000) {
                supplyMap[gift.name] = gift.supply;
                totalR10Supply += gift.supply || 0;
            }
        });

        if (totalR10Supply === 0) {
            console.log(`Total R10 supply is zero for date: ${date}`);
            return;
        }

        let totalPriceTon = 0;
        let totalPriceUsd = 0;

        for (const record of lifeData) {
            const supply = supplyMap[record.name] || 0;
            if (supply === 0) {
                continue;
            }
            totalPriceTon += ((record.priceTon || 0) * supply * 10) / totalR10Supply;
            totalPriceUsd += ((record.priceUsd || 0) * supply * 10) / totalR10Supply;
        }

        totalPriceTon = parseFloat(totalPriceTon.toFixed(4));
        totalPriceUsd = parseFloat(totalPriceUsd.toFixed(4));

        const newData = new IndexDataModel({
            indexId: indexId.toString(),
            date,
            priceTon: totalPriceTon,
            priceUsd: totalPriceUsd,
        });

        await newData.save();
        console.log(`Saved R10 data for ${date}, ${indexId}: TON=${totalPriceTon}, USD=${totalPriceUsd}`);
    } catch (error) {
        console.error(`Error saving R10 data for ${date}, ${indexId}: ${error.stack}`);
    }
};

export const addIndexData = async (date) => {
    try {
        const indexList = await IndexModel.find();
        const giftsList = await GiftModel.find();
        const lifeData = await LifeChartModel.find({ date });

        for (let index of indexList) {
            if (index.shortName === 'TMC') {
                await calculateMarketCapAndSave(date, index._id, giftsList, lifeData);
            } else if (index.shortName === 'TMI') {
                await calculateMCISave(date, index._id, giftsList, lifeData);
            } else 
            if (index.shortName === 'R10') {
                await calculateR10Save(date, index._id, giftsList, lifeData);
            }
        }
    } catch (error) {
        console.error(`Error processing index data for ${date}: ${error.stack}`);
    }
};

export { router as IndexDataRouter };