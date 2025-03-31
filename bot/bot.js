import puppeteer from "puppeteer";
import { getDate, getTonPrice } from "../functions.js";
import randomUseragent from "random-useragent";
import { addWeekData } from "../routes/weekData.js";
import { addLifeData } from "../routes/lifeData.js";
import { getNames } from "../routes/gifts.js";

let ton; // Cached TON price
let { date: currentDate } = getDate();
let lastTonFetchTime = null; // Track last fetch time

const delay = (ms) => new Promise(res => setTimeout(res, ms));

// Wrapper for getTonPrice with retry logic
const fetchTonPriceWithRetry = async (retries = 3, backoff = 5000) => {
    try {
        const price = await getTonPrice(); // Your Axios function
        console.log(`Fetched TON price: ${price}`);
        lastTonFetchTime = Date.now();
        return price;
    } catch (error) {
        if (error.response && error.response.status === 429 && retries > 0) {
            console.log(`Rate limit hit on TON price fetch. Retrying in ${backoff / 1000} seconds... (${retries} retries left)`);
            await delay(backoff);
            return fetchTonPriceWithRetry(retries - 1, backoff * 2); // Exponential backoff
        }
        console.error(`Failed to fetch TON price after retries: ${error.stack}`);
        return null; // Fallback to null if all retries fail
    }
};

const makeWeekRequest = async (giftName, retries = 3, backoff = 10000) => {
    let browser;
    try {
        console.log(`Launching browser for gift: ${giftName}`);
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
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

        console.log(`Navigating to market.tonnel.network for gift: ${giftName}`);
        await page.goto('https://market.tonnel.network', { waitUntil: 'networkidle2', timeout: 60000 });

        console.log(`Fetching data for gift: ${giftName}`);
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
        if (!firstObject || !firstObject.price) {
            throw new Error(`Invalid response data for gift ${giftName}`);
        }

        const { date, time } = getDate('Europe/London');
        const priceTon = parseFloat((firstObject.price * 1.1).toFixed(4));
        const priceUsd = ton ? parseFloat((priceTon * ton).toFixed(4)) : null;

        const newObject = {
            name: firstObject.name,
            priceTon,
            priceUsd,
            date,
            time
        };

        await addWeekData(newObject);
        console.log(`Processed gift: ${giftName}`, newObject);

        return true;
    } catch (error) {
        console.error(`Error processing gift ${giftName}: ${error.stack}`);
        if ((error.message.includes('429') || error.message.includes('502')) && retries > 0) {
            console.log(`Error (429 or 502) for ${giftName}. Retrying in ${backoff / 1000} seconds... (${retries} retries left)`);
            await delay(backoff);
            return makeWeekRequest(giftName, retries - 1, backoff * 2);
        }
        console.log(`Skipping gift ${giftName} after retries exhausted or non-retryable error`);
        return false;
    } finally {
        if (browser) {
            console.log(`Closing browser for gift: ${giftName}`);
            await browser.close();
        }
    }
};

export const addData = async () => {
    console.log(`Data update started at: ${new Date().toLocaleTimeString()}`);
    
    try {
        // Fetch TON price with retries and caching
        const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
        if (!lastTonFetchTime || (Date.now() - lastTonFetchTime) > oneHour) {
            ton = await fetchTonPriceWithRetry();
        } else {
            console.log(`Using cached TON price: ${ton}`);
        }

        let gifts;
        try {
            gifts = await getNames();
            console.log(`Fetched ${gifts.length} gifts`);
        } catch (error) {
            console.error(`Failed to fetch gift names: ${error.stack}`);
            gifts = [];
        }

        for (let gift of gifts) {
            const success = await makeWeekRequest(gift);
            if (success) {
                console.log(`Successfully processed gift: ${gift}`);
            } else {
                console.log(`Failed to process gift: ${gift}, continuing to next gift`);
            }
            await delay(10000);
        }

        const { date: updatedDate } = getDate();
        if (currentDate !== updatedDate) {
            console.log('New day detected!');
            try {
                const previousDate = new Date();
                previousDate.setDate(previousDate.getDate() - 1);
                const formattedPreviousDate = previousDate.toLocaleDateString('en-GB').split('/').join('-'); 

                const giftsList = await getNames();
                await addLifeData(giftsList, formattedPreviousDate);

                console.log('Added previous day data');
                currentDate = updatedDate;
            } catch (error) {
                console.error(`Failed to update life data: ${error.stack}`);
            }
        }

        console.log(`Data update completed at: ${new Date().toLocaleTimeString()}`);
    } catch (error) {
        console.error(`Unexpected error in addData: ${error.stack}`);
        throw error; // Let endpoint handle
    }
};