import { IndexModel } from "../../models/Index";
import { calculateAvgAndSave, calculateSumAndSave } from "./indexFunctions";

export const addIndexData = async (date: string) => {
  console.log("start for the date: " + date);
  try {
    const indexList = await IndexModel.find();

    for (let index of indexList) {
      if (index.shortName === "TMC") {
        calculateAvgAndSave(index._id, date);
      } else if (index.shortName === "FDV") {
        calculateAvgAndSave(index._id, date);
      } else if (index.shortName === "TS") {
        calculateAvgAndSave(index._id, date);
      } else if (index.shortName === "VOL") {
        calculateSumAndSave(index._id, date);
      } else if (index.shortName === "%onSale") {
        calculateAvgAndSave(index._id, date);
      }
    }
  } catch (error: any) {
    console.error(`Error processing index data for ${date}: ${error.stack}`);
  }
};
