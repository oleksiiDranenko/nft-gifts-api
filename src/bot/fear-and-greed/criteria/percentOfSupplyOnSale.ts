import { WeekChartModel } from "../../../models/WeekChart";
import { getNonPreSaleGifts } from "../../shared/getNonPreSaleGifts";

const countTotalAmountOnSale = async () => {
  const nonPreSaleGifts = await getNonPreSaleGifts();

  const nonPreSaleGiftNames = nonPreSaleGifts.map((gift) => gift.name);

  const docs = await Promise.all(
    nonPreSaleGiftNames.map(name =>
      WeekChartModel.findOne({ name })
        .sort({ createdAt: -1 })
        .exec()
    )
  );
  const totalAmountOnSale = docs.reduce((sum, doc) => {
    return sum + (doc?.amountOnSale || 0);
  }, 0);

  return totalAmountOnSale;
};

const countTotalNonPreSaleSupply = async () => {
  const nonPreSaleGifts = await getNonPreSaleGifts();

  const totalSupply = nonPreSaleGifts.reduce((sum, gift) => {
    return sum + (gift?.upgradedSupply || 0);
  }, 0);

  return totalSupply;
};

export const calculatePercentOnSale = async () => {
  const totalAmountOnSale = await countTotalAmountOnSale();
  const totalSupply = await countTotalNonPreSaleSupply();

  if (totalSupply === 0) return 0;

  const percentOnSale = (totalAmountOnSale / totalSupply) * 100;

  return percentOnSale;
};
