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

export const formatDateDDMMYYYY = (date: Date): string  => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

export const delay = (ms: number) => {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
};