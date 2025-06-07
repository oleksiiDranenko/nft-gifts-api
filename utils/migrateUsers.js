// utils/migrateUsers.js
import { UserModel } from '../models/User.js';
import { hashValue } from './hash.js';

export async function migrateTelegramIds() {
    const users = await UserModel.find();

    for (const user of users) {
        const isHashed = /^[a-f0-9]{64}$/.test(user.telegramId);
        if (!isHashed) {
            const hashedId = hashValue(user.telegramId);
            await UserModel.updateOne(
                { _id: user._id },
                { $set: { telegramId: hashedId } }
            );
        }
    }

    console.log('✅ Telegram ID migration completed.');
}
