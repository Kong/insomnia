export const wrapToIndex = (index: number, maxCount: number) => {
  if (maxCount < 0) {
    throw new Error(`negative maximum is invalid: ${JSON.stringify({ index, maxCount })}`);
  }

  return (index + maxCount) % maxCount;
};
