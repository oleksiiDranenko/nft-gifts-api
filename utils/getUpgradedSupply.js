import axios from 'axios';
import fs from 'fs';
import * as cheerio from 'cheerio';


export async function getUpgradedSupply(giftName) {;
    try {

        let formattedGiftName;
        switch(giftName) {
            case "Durov's Cap": 
                formattedGiftName = 'DurovsCap'
                break;
            case "Jack-in-the-Box":
                formattedGiftName = 'JackInTheBox'
                break;
            case "B-Day Candle":
                formattedGiftName = 'BDayCandle'
                break;
            default:
                formattedGiftName = giftName.replace(' ', '')
        }

        const response = await axios.get(`https://t.me/nft/${formattedGiftName}-1`);

        const htmlContent = response.data;

        const fileName = 'telegram_nft_page.html';
        fs.writeFileSync(fileName, htmlContent, 'utf8');

        const $ = cheerio.load(htmlContent);

        const quantityRow = $('th:contains("Quantity")').parent();
        const quantityText = quantityRow.find('td').text().trim();

        if (quantityText) {
            
            const numbersPart = quantityText.replace(' issued', '').trim();
            const parts = numbersPart.split('/');

            if (parts.length === 2) {
                const upgradedSupply = parseInt(parts[0].replace(/\s/g, ''), 10); 
                const totalSupply = parseInt(parts[1].replace(/\s/g, ''), 10);

                if (!isNaN(upgradedSupply) && !isNaN(totalSupply)) {
                    return upgradedSupply
                } else {
                    console.warn('Could not parse numbers from quantity text:', quantityText);
                }
            } else {
                console.warn('Quantity text format not as expected (missing "/"):', quantityText);
            }
        } else {
            console.warn('Quantity information not found in the HTML.');
        }

    } catch (error) {
        console.error(`Error fetching URL: ${url}`);
        if (error.response) {
            console.error(`HTTP Status: ${error.response.status}`);
            console.error(`Response Data (Error):`, error.response.data);
            console.error(`Response Headers (Error):`, error.response.headers);
        } else if (error.request) {
            console.error(`No response received. Possible network error or CORS issue.`);
        } else {
            console.error(`Error message: ${error.message}`);
        }
    }
}
