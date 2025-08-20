import { GiftModel } from "../models/Gift";
import { getUpgradedSupply } from "./getUpgradedSupply";

export const updateUpgradedSupply = async () => {
    const allGifts = await GiftModel.find();

    for (const gift of allGifts) {
      try {
        const result = await getUpgradedSupply(gift.name);

        if (result && result.totalSupply) {
          gift.supply = result.totalSupply;
          gift.upgradedSupply = result.upgradedSupply;
          await gift.save();
          console.log(
            `Updated ${gift.name}: totalSupply=${result.totalSupply}`
          );
        } else {
          console.warn(
            `Could not retrieve totalSupply for ${gift.name}. Result:`,
            result
          );
        }
      } catch (error) {
        console.error(`Error updating ${gift.name}:`, error);
      }
    }
}