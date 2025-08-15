import { GiftModel } from '../../models/Gift';
import { IndexModel } from '../../models/Index';
import { LifeChartModel } from '../../models/LifeChart';
import {calculateTMCAndSave, calculateFDVAndSave} from './indexFunctions'

export const addIndexData = async (date: string) => {
  try {
    const indexList = await IndexModel.find();
    const giftsList = await GiftModel.find();
    const lifeData = await LifeChartModel.find({ date });

    for (let index of indexList) {
        if (index.shortName === 'TMC') {
          await calculateTMCAndSave(date, index._id, giftsList, lifeData);
        } else if (index.shortName === 'FDV') {
          await calculateFDVAndSave(date, index._id, giftsList, lifeData);
        }
    }
  } catch (error: any) {
    console.error(`Error processing index data for ${date}: ${error.stack}`);
  }
};
