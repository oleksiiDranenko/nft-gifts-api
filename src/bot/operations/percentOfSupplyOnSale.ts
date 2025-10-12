import { WeekChartModel } from "../../models/WeekChart";
import { getNonPreSaleGifts } from "../shared/getNonPreSaleGifts";

// Interface definitions for type safety
interface Gift {
  name: string;
  upgradedSupply?: number;
}

interface WeekChartDocument {
  name: string;
  amountOnSale?: number;
  createdAt: Date;
}

const countTotalAmountOnSale = async (): Promise<number> => {
  const nonPreSaleGifts: Gift[] = await getNonPreSaleGifts();
  console.log("nonPreSaleGifts:", JSON.stringify(nonPreSaleGifts, null, 2));

  if (!nonPreSaleGifts?.length) {
    console.warn(
      "No non-pre-sale gifts found, returning 0 for totalAmountOnSale"
    );
    return 0;
  }

  const nonPreSaleGiftNames = nonPreSaleGifts.map((gift) => gift.name);
  console.log("nonPreSaleGiftNames:", nonPreSaleGiftNames);

  const docs = await Promise.all(
    nonPreSaleGiftNames.map(async (name) => {
      const doc = await WeekChartModel.findOne({ name })
        .sort({ createdAt: -1 })
        .exec();
      console.log(
        `WeekChartModel for name "${name}":`,
        JSON.stringify(doc, null, 2)
      );
      return doc;
    })
  );

  const totalAmountOnSale = docs.reduce((sum, doc) => {
    const amount = doc?.amountOnSale ?? 0;
    console.log(`amountOnSale for doc ${doc?.name ?? "null"}:`, amount);
    return sum + amount;
  }, 0);

  console.log("totalAmountOnSale:", totalAmountOnSale);
  return totalAmountOnSale;
};

const countTotalNonPreSaleSupply = async (): Promise<number> => {
  const nonPreSaleGifts: Gift[] = await getNonPreSaleGifts();
  console.log(
    "nonPreSaleGifts for supply:",
    JSON.stringify(nonPreSaleGifts, null, 2)
  );

  if (!nonPreSaleGifts?.length) {
    console.warn("No non-pre-sale gifts found for supply, returning 0");
    return 0;
  }

  const totalSupply = nonPreSaleGifts.reduce((sum, gift) => {
    const supply = gift?.upgradedSupply ?? 0;
    console.log(`upgradedSupply for gift ${gift?.name ?? "null"}:`, supply);
    return sum + supply;
  }, 0);

  console.log("totalSupply:", totalSupply);
  return totalSupply;
};

export const calculatePercentOnSale = async (): Promise<number> => {
  const totalAmountOnSale = await countTotalAmountOnSale();
  const totalSupply = await countTotalNonPreSaleSupply();

  console.log("Calculating percentOnSale:", { totalAmountOnSale, totalSupply });

  if (totalSupply === 0) {
    console.warn("totalSupply is 0, returning 0 for percentOnSale");
    return 0;
  }

  const percentOnSale = (totalAmountOnSale / totalSupply) * 100;
  const roundedPercent = Number(percentOnSale.toFixed(4));
  console.log(
    "percentOnSale (raw):",
    percentOnSale,
    "rounded:",
    roundedPercent
  );

  return roundedPercent;
};
