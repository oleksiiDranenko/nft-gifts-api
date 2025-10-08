import { IndexModel } from "../../models/Index";
import { getDate } from "../../bot/functions";
import { GiftModel } from "../../models/Gift";
import { IndexMonthDataModel } from "../../models/IndexMonthData";
import {
  calculateFDVAndSave,
  calculatePercentOnSaleAndSave,
  calculateTMCAndSave,
  calculateTSAndSave,
  calculateVolumeAndSave,
} from "./indexMonthDataFunctions";

const addIndexMonthData = async () => {
  try {
    const indexList = await IndexModel.find();
    const giftsList = await GiftModel.find();
    const { date, time } = getDate("Europe/London");
    const monthData = await IndexMonthDataModel.find()
      .sort({ _id: -1 })
      .limit(giftsList.length);

    indexList.map((index) => {
      if (index.shortName === "TMC") {
        calculateTMCAndSave(date, time, index._id, giftsList, monthData);
      } else if (index.shortName === "FDV") {
        calculateFDVAndSave(date, time, index._id, giftsList, monthData);
      } else if (index.shortName === "TS") {
        calculateTSAndSave(date, time, index._id, giftsList);
      } else if (index.shortName === "VOL") {
        calculateVolumeAndSave(date, time, index._id, giftsList, monthData);
      } else if (index.shortName === "%onSale") {
        calculatePercentOnSaleAndSave(date, time, index._id);
      }
    });
  } catch (error) {
    console.log(error);
  }
};
