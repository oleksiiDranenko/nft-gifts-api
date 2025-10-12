import { GiftModel } from "../../models/Gift";

export const getNonPreSaleGifts = async () => {
  const nonPreSaleGifts = await GiftModel.find({
    preSale: { $ne: true },
  });
  return nonPreSaleGifts;
};
