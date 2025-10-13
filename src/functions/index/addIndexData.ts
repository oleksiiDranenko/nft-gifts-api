import { IndexModel } from "../../models/Index";
import { calculateAvgAndSave, calculateSumAndSave } from "./indexFunctions";

export const addIndexData = async (date: string) => {
  console.log("start for the date: " + date);
  try {
    const indexList = await IndexModel.find();

    console.log(indexList);

    for (let index of indexList) {
      if (index.shortName === "TMC") {
        await calculateAvgAndSave(index._id.toString(), date);
      } else if (index.shortName === "FDV") {
        await calculateAvgAndSave(index._id.toString(), date);
      } else if (index.shortName === "TS") {
        await calculateAvgAndSave(index._id.toString(), date);
      } else if (index.shortName === "VOL") {
        await calculateSumAndSave(index._id.toString(), date);
      } else if (index.shortName === "%onSale") {
        await calculateAvgAndSave(index._id.toString(), date);
      }
    }
  } catch (error: any) {
    console.error(`Error processing index data for ${date}: ${error.stack}`);
  }
};
