import express from 'express';
import { GiftModel } from '../models/Gift.js';
import { WeekChartModel } from '../models/WeekChart.js';
import puppeteer from "puppeteer";
import randomUseragent  from "random-useragent";

const router = express.Router();

const updatePrice = async (ton) => {
    const browser = await puppeteer.launch({
		executablePath: '/opt/render/project/src/.cache/puppeteer/chrome/linux-134.0.6998.35/chrome-linux64/chrome',
    	headless: true,
    	args: ['--no-sandbox', '--disable-setuid-sandbox']
	});

  	const page = await browser.newPage();
	
	const userAgent = randomUseragent.getRandom(); 
	await page.setUserAgent(userAgent);

  	await page.setRequestInterception(true);
  	page.on('request', (request) => {
  	  	request.continue({
  	    	headers: {
  	      		...request.headers(),
  	      		'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  	      		'Accept': '*/*',
  	      		'Content-Type': 'application/json',
  	      		'Origin': 'https://market.tonnel.network',
  	      		'Referer': 'https://market.tonnel.network/',
  	    	},
  	  	});
  	});

  	await page.goto('https://market.tonnel.network');  

  	const response = await page.evaluate(async (giftName) => {
  	  	const res = await fetch('https://gifts2.tonnel.network/api/pageGifts', {
  	    	method: 'POST',
  	    	headers: {
  	    	  'Accept': '*/*',
  	    	  'Content-Type': 'application/json',
  	    	  'Origin': 'https://market.tonnel.network',
  	    	  'Referer': 'https://market.tonnel.network/',
  	    	},
  	    	body: JSON.stringify({
  	    	  "page": 1,
  	    	  "limit": 30,
  	    	  "sort": "{\"price\":1,\"gift_id\":-1}",
  	    	  "filter": `{\"price\":{\"$exists\":true},\"refunded\":{\"$ne\":true},\"buyer\":{\"$exists\":false},\"export_at\":{\"$exists\":true},\"gift_name\":\"${giftName}\",\"asset\":\"TON\"}`,
  	    	  "ref": 0,
  	    	  "price_range": null,
  	    	  "user_auth": "",  
  	    	})
  	  	});

  	  	return await res.json();  
  	}, giftName);  


  	const firstObject = response[0];

	const priceTon = parseFloat((firstObject.price * 1.1).toFixed(4));
	const priceUsd = parseFloat((priceTon * ton).toFixed(4))

    return {priceTon, priceUsd}
}


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

            const ton = currentPrice[0].priceUsd / currentPrice[0].priceTon;

            const {priceTon, priceUsd} = await updatePrice(ton)

            
            finalGiftsList.push({
                ...gift.toObject(),
                tonPrice24hAgo: last24hData.length ? last24hData[0].priceTon : null,
                usdPrice24hAgo: last24hData.length ? last24hData[0].priceUsd : null,
                priceTon,
                priceUsd
            });
        }

        res.json(finalGiftsList);
    } catch (error) {
        res.status(500).json({ message: error.message, gift: gift });
    }
});

router.get('/:giftId', async (req, res) => {
    const { giftId } = req.params;
    
    try {

        const gift = await GiftModel.findById(giftId)

        res.json(gift)
        
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

export { router as giftsRouter };  