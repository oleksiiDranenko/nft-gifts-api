import puppeteer from "puppeteer";
import { getDate, getTonPrice } from "./functions.js";
import randomUseragent  from "random-useragent";
import { addWeekData } from "../routes/weekData.js";
import { addLifeData } from "../routes/lifeData.js";
import { getNames } from "../routes/gifts.js";

let ton;
let {date: currentDate} = getDate();
const intervalMinutes = 60;


const makeWeekRequest = async (giftName) => {
	const browser = await puppeteer.launch({
		// executablePath: '/opt/render/project/src/.cache/puppeteer/chrome/linux-134.0.6998.35/chrome-linux64/chrome',
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

	const { date, time } = getDate('Europe/London');
	const priceTon = parseFloat((firstObject.price * 1.1).toFixed(4));
	const priceUsd = parseFloat((priceTon * ton).toFixed(4))

  	const newObject = {
  	  	name: firstObject.name,
  	  	priceTon,
		priceUsd,
		date,
		time: time
  	};


	await addWeekData(newObject)

	console.log(newObject)

  	await browser.close();  
}

const delay = (ms) => new Promise(res => setTimeout(res, ms));



export const run = async () => {
    console.log(`Request at: ${new Date().toLocaleTimeString()}`);

    ton = await getTonPrice();

	const gifts = await getNames()

    for (let gift of gifts) {
        await makeWeekRequest(gift);
		await delay(5000)
    }


    scheduleNextRun();
};


export const scheduleNextRun = async () => {
    const now = new Date();
    const nextRun = new Date(now);

    nextRun.setMinutes(Math.ceil(now.getMinutes() / intervalMinutes) * intervalMinutes, 0, 0);

    if (nextRun <= now) {
        nextRun.setMinutes(nextRun.getMinutes() + intervalMinutes);
    }

    const delay = nextRun - now;
    console.log(`Next request scheduled at: ${nextRun.toLocaleTimeString()} (${delay / 1000} sec delay)`);

    const { date: updatedDate } = getDate();

    if (currentDate !== updatedDate) {
        console.log('New day detected!');

        const previousDate = new Date();
        previousDate.setDate(previousDate.getDate() - 1);
        const formattedPreviousDate = previousDate.toLocaleDateString('en-GB').split('/').join('-'); 

		const giftsList = await getNames()

        await addLifeData(giftsList, formattedPreviousDate);

        console.log('Added previous day data');
        currentDate = updatedDate;
    }

    setTimeout(run, delay);
};



