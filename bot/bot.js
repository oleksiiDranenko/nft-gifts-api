import puppeteer from "puppeteer";
import { getDate, getTonPrice } from "./functions.js";
import randomUseragent from "random-useragent";
import { addWeekData } from "../routes/weekData.js";
import { addLifeData } from "../routes/lifeData.js";
import { getNames } from "../routes/gifts.js";

let ton;
let { date: currentDate } = getDate();

const delay = (ms) => new Promise(res => setTimeout(res, ms));

const makeWeekRequest = async (giftName, retries = 3, backoff = 10000) => {
    const browser = await puppeteer.launch({
        executablePath: '/opt/render/project/src/.cache/puppeteer/chrome/linux-134.0.6998.35/chrome-linux64/chrome',
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
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

            if (!res.ok) {
                throw new Error(`HTTP error! Status: ${res.status}`);
            }

            return await res.json();  
        }, giftName);  

        const firstObject = response[0];

        const { date, time } = getDate('Europe/London');
        const priceTon = parseFloat((firstObject.price * 1.1).toFixed(4));
        const priceUsd = parseFloat((priceTon * ton).toFixed(4));

        const newObject = {
            name: firstObject.name,
            priceTon,
            priceUsd,
            date,
            time
        };

        await addWeekData(newObject);
        console.log(`Processed gift: ${giftName}`, newObject);

        return true; // Success
    } catch (error) {
        console.error(`Error processing gift ${giftName}: ${error.message}`);
        if (error.message.includes('429') && retries > 0) {
            console.log(`Rate limit hit for ${giftName}. Retrying in ${backoff / 1000} seconds... (${retries} retries left)`);
            await delay(backoff);
            return makeWeekRequest(giftName, retries - 1, backoff * 2); // Exponential backoff
        }
        throw error; // Re-throw if no retries left or different error
    } finally {
        await browser.close();  
    }
};

export const addData = async () => {
    console.log(`Data update started at: ${new Date().toLocaleTimeString()}`);
    
    try {
        // Update week data
        ton = await getTonPrice();
        const gifts = await getNames();

        console.log(`Processing ${gifts.length} gifts`);
        for (let gift of gifts) {
            try {
                await makeWeekRequest(gift);
                await delay(10000); // Increased to 10 seconds between requests
            } catch (error) {
                console.error(`Failed to process gift ${gift}: ${error.message}`);
                // Continue with next gift instead of failing entirely
            }
        }

        // Check and update life data if it's a new day
        const { date: updatedDate } = getDate();

        if (currentDate !== updatedDate) {
            console.log('New day detected!');

            const previousDate = new Date();
            previousDate.setDate(previousDate.getDate() - 1);
            const formattedPreviousDate = previousDate.toLocaleDateString('en-GB').split('/').join('-'); 

            const giftsList = await getNames();
            await addLifeData(giftsList, formattedPreviousDate);

            console.log('Added previous day data');
            currentDate = updatedDate; // Update the global currentDate
        }

        console.log(`Data update completed at: ${new Date().toLocaleTimeString()}`);
    } catch (error) {
        console.error(`Data update failed: ${error.message}`);
        throw error; // Let the cron job or caller handle the error
    }
};