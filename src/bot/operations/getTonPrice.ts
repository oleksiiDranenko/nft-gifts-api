import axios from "axios";
import { retryHandler } from "./retryHandler";

export const getTonPrice = async () => {
  console.log("TON price request");

  const res = await axios.get(
    "https://api.cryptorank.io/v0/widget/price-ticker/toncoin?baseKey=united-states-dollar&secondaryKey=none&convertToBase=true"
  );
  const tonPriceString = res.data.data.price;
  const tonPrice = parseFloat(tonPriceString.replace(/[^0-9.]/g, ""));

  return tonPrice;
};

export const fetchTonPrice = async () => {
  try {
    const price = await retryHandler(() => getTonPrice(), 3, 5000);
    return price;
  } catch (error: any) {
    console.error(`Failed to fetch TON price: ${error.message}`);
    return null;
  }
};
