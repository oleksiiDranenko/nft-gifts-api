import puppeteer from "puppeteer";
import { getDate, getTonPrice } from "./functions.js";
import randomUseragent from "random-useragent";
import { addWeekData } from "../routes/weekData.js";
import { addLifeData } from "../routes/lifeData.js";
import { getNames } from "../routes/gifts.js";

let ton;
let { date: currentDate } = getDate();
const intervalMinutes = 60;
const maxRetries = 3;
const retryDelayMs = 10000;

const makeWeekRequest = async (giftName, attempt = 1) => {
    let browser;
    try {
        console.log(`Attempt ${attempt}/${maxRetries} for gift: ${giftName}`);
        browser = await puppeteer.launch({
            executablePath: '/opt/render/project/src/.cache/puppeteer/chrome/linux-134.0.6998.35/chrome-linux64/chrome',
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            timeout: 60000,
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

        await page.goto('https://market.tonnel.network', { waitUntil: 'networkidle2', timeout: 60000 });

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
                }),
            });
            return await res.json();
        }, giftName);

        if (!response || !response[0]) {
            throw new Error(`No valid response data for ${giftName}`);
        }

        const firstObject = response[0];
        const { date, time } = getDate('Europe/Berlin');
        const priceTon = parseFloat((firstObject.price * 1.1).toFixed(4));
        const priceUsd = parseFloat((priceTon * ton).toFixed(4));

        const newObject = {
            name: firstObject.name,
            priceTon,
            priceUsd,
            date,
            time,
        };

        await addWeekData(newObject);
        console.log(`Success for ${giftName}:`, newObject);

        return true;
    } catch (error) {
        console.error(`Error on attempt ${attempt}/${maxRetries} for ${giftName}:`, error.message);
        if (attempt < maxRetries) {
            console.log(`Retrying ${giftName} in ${retryDelayMs / 1000} seconds...`);
            await delay(retryDelayMs);
            return await makeWeekRequest(giftName, attempt + 1);
        } else {
            console.error(`Max retries reached for ${giftName}. Giving up.`);
            throw error;
        }
    } finally {
        if (browser) {
            await browser.close().catch(err => console.error(`Error closing browser: ${err.message}`));
        }
    }
};

const delay = (ms) => new Promise(res => setTimeout(res, ms));

export const run = async () => {
    console.log(`Request started at: ${new Date().toLocaleTimeString()}`);

    try {
        ton = await getTonPrice();
        if (!ton) throw new Error("Failed to get TON price");

        const gifts = await getNames();
        if (!gifts || gifts.length === 0) throw new Error("No gifts retrieved");

        for (let gift of gifts) {
            try {
                await makeWeekRequest(gift);
                await delay(5000);
            } catch (error) {
                console.error(`Failed to process ${gift} after retries:`, error.message);
            }
        }
    } catch (error) {
        console.error("Error in run:", error.message);
    }

    await scheduleNextRun();
};

export const scheduleNextRun = async () => {
    try {
        const now = new Date();
        const nextRun = new Date(now);
        nextRun.setHours(now.getHours() + 1, 0, 0, 0);

        let delayMs = nextRun - now;
        if (delayMs <= 0) {
            nextRun.setHours(nextRun.getHours() + 1);
            delayMs = nextRun - now;
        }

        console.log(`Next request scheduled at: ${nextRun.toLocaleTimeString('en-US', { timeZone: 'Europe/Berlin' })} (${delayMs / 1000} sec delay)`);

        const { date: updatedDate } = getDate('Europe/Berlin');

        if (currentDate !== updatedDate) {
            console.log('New day detected!');
            const previousDate = new Date();
            previousDate.setDate(previousDate.getDate() - 1);
            const formattedPreviousDate = previousDate.toLocaleDateString('en-GB', { timeZone: 'Europe/Berlin' }).split('/').join('-');

            const giftsList = await getNames();
            if (!giftsList || giftsList.length === 0) throw new Error("No gifts for life data");

            await addLifeData(giftsList, formattedPreviousDate);
            console.log('Added previous day data');
            currentDate = updatedDate;
        }

        setTimeout(run, delayMs);
    } catch (error) {
        console.error("Error in scheduleNextRun:", error.message);
        setTimeout(run, intervalMinutes * 60 * 1000);
    }
};