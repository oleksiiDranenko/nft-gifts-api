export const getTopMovers = (gifts: any[]) => {
  const processed = gifts.map((gift) => {
    let change = null;

    if (gift.priceTon && gift.tonPrice24hAgo && gift.tonPrice24hAgo !== 0) {
      change =
        ((gift.priceTon - gift.tonPrice24hAgo) / gift.tonPrice24hAgo) * 100;
    }

    return {
      ...gift,
      change,
    };
  });

  const valid = processed.filter((g) => g.change !== null);

  const gainers = [...valid].sort((a, b) => b.change - a.change).slice(0, 5);
  const losers = [...valid].sort((a, b) => a.change - b.change).slice(0, 5);

  return { gainers, losers };
};
