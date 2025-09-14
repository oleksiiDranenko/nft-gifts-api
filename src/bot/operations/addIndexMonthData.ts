import { IndexModel } from "../../models/Index";
import { getDate } from "../functions";

const addIndexMonthData = async () => {
  try {
    const indexList = await IndexModel.find();
    const { date, time } = getDate("Europe/London");

    // indexList.map((index) => {
    //     if (index.shortName === '')
    // })
  } catch (error) {
    console.log(error);
  }
};
