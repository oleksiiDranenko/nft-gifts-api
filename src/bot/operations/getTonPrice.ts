import axios from "axios"
import { retryHandler } from "./retryHandler"

export const getTonPrice = async () => {
    console.log('ton price request')
	const res = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd')
	const tonPrice = res.data['the-open-network'].usd

	return tonPrice
}

export const fetchTonPrice = async () => {
  try {
    const price = await retryHandler(() => getTonPrice(), 3, 5000);
    return price;
  } catch (error: any) {
    console.error(`Failed to fetch TON price: ${error.message}`);
    return null;
  }
};