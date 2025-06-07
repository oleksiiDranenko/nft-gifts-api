import crypto from 'crypto';

export const hashValue = (value) => {
    return crypto.createHash('sha256').update(value.toString()).digest('hex');
}