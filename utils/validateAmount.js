export const parseValidAmount = (amount) => {
  const numAmount = parseFloat(amount);
  return !isNaN(numAmount) && numAmount > 0 ? numAmount : null;
};
