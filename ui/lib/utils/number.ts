export const roundToInt = (value: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
};

export const roundTo1Decimal = (value: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
};
