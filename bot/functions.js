import axios from "axios";

export const getDate = (timezone = 'Europe/London') => {
    const currentDate = new Date();

    const dateFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const timeFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });

    const dateParts = Object.fromEntries(dateFormatter.formatToParts(currentDate).map(({ type, value }) => [type, value]));
    const timeParts = Object.fromEntries(timeFormatter.formatToParts(currentDate).map(({ type, value }) => [type, value]));

    const date = `${dateParts.day}-${dateParts.month}-${dateParts.year}`;
    const time = `${timeParts.hour}:${timeParts.minute}`;

    return { date, time };
};



export const getTonPrice = async () => {
	const res = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd')
	const tonPrice = res.data['the-open-network'].usd

	return tonPrice
}