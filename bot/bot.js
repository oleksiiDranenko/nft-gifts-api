import puppeteer from "puppeteer";
import { getDate, getTonPrice } from "./functions.js";
import randomUseragent from "random-useragent";
import { addWeekData } from "../routes/weekData.js";
import { addLifeData } from "../routes/lifeData.js";
import { getNames } from "../routes/gifts.js";

let ton;

const makeWeekRequest = async (giftName, attempt = 1, maxAttempts = 3) => {
    let browser;
    try {
        console.log(`Attempt ${attempt}/${maxAttempts} for gift: ${giftName}`);
        browser = await puppeteer.launch({
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

            if (!res.ok) {
                throw new Error(`Request failed with status code ${res.status}`);
            }

            return await res.json();
        }, giftName);

        const firstObject = response[0];
        if (!firstObject) throw new Error(`No data returned for ${giftName}`);

        const { date, time } = getDate('Europe/Berlin');
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
        console.log(newObject);

        await browser.close();
        return true;
    } catch (error) {
        console.error(`Error on attempt ${attempt}/${maxAttempts} for ${giftName}:`, error.message);
        if (browser) await browser.close();

        if (error.message.includes('429') && attempt < maxAttempts) {
            const retryDelay = 10000 * attempt; // 10s, 20s, 30s
            console.log(`Rate limit hit (429). Retrying in ${retryDelay / 1000} seconds...`);
            await delay(retryDelay);
            return await makeWeekRequest(giftName, attempt + 1, maxAttempts);
        }
        throw error; // Re-throw if not 429 or max attempts reached
    }
};

const delay = (ms) => new Promise(res => setTimeout(res, ms));

export const addData = async () => {
    console.log(`Data update started at: ${new Date().toLocaleTimeString('en-US', { timeZone: 'Europe/Berlin' })}`);

    try {
        ton = await getTonPrice();
        if (!ton) throw new Error("Failed to get TON price");

        const gifts = await getNames();
        if (!gifts || gifts.length === 0) throw new Error("No gifts retrieved");

        // Add week data
        for (let gift of gifts) {
            try {
                await makeWeekRequest(gift);
                await delay(10000); // Increased to 10 seconds between requests
            } catch (error) {
                console.error(`Error processing week data for ${gift}:`, error.message);
            }
        }

        // Add life data for the previous day
        const now = new Date();
        const previousDate = new Date();
        previousDate.setDate(now.getDate() - 1);
        const formattedPreviousDate = previousDate.toLocaleDateString('en-GB', { timeZone: 'Europe/Berlin' }).split('/').join('-');

        await addLifeData(gifts, formattedPreviousDate);
        console.log(`Life data added for ${formattedPreviousDate}`);

    } catch (error) {
        console.error("Error in addData:", error.message);
    }
};