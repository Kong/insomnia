export const isValidJSONString = (input: string): boolean => {
  try {
    JSON.parse(input);
    return true;
  } catch {
    return false;
  }
};

export const isBase64String = (str: string) => {
  // Refer: https://stackoverflow.com/questions/7860392/determine-if-string-is-in-base64-using-javascript
  // Use regex to check if the string is base64 encoded rather than decoding it
  const base64Regex = /^(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?$/;
  return base64Regex.test(str);
};
