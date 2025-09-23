import { IndexModel } from "../../models/Index";
import { getDate } from "../../bot/functions";

const addIndexMonthData = async () => {
  try {
    const indexList = await IndexModel.find();
    const { date, time } = getDate("Europe/London");

    indexList.map((index) => {
      if (index.shortName === "TMC") {
      } else if (index.shortName === "FDV") {
      } else if (index.shortName === "TS") {
      } else if (index.shortName === "Vol") {
      }
    });
  } catch (error) {
    console.log(error);
  }
};
