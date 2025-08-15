import crypto from 'crypto';

export const hashValue = (value: any) => {
    return crypto.createHash('sha256').update(value.toString()).digest('hex');
}