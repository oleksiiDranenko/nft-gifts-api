import mongoose from 'mongoose';

const SubscriptoinSchema = new mongoose.Schema(
    {
        walletId: {type: String, required: true},
        createdAt: { type: Date, default: Date.now, expires: '30d' }  
    },
    { 
        collection: 'subscriptions',
        versionKey: false
     } 
);

export const SubscriptionModel = mongoose.model('subscriptioins', SubscriptoinSchema);
