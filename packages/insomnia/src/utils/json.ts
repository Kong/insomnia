export const isValidJSONString = (input: string): boolean => {
  try {
    JSON.parse(input);
    return true;
  } catch (error) {
    return false;
  }
};
