const throwError = () => {
  throw new Error('CookiesRuntime not available in node');
};

export const fromJSON = throwError;
export const parse = throwError;
export const toString = throwError;
export const getCookiesForUrl = throwError;
export const addSetCookies = throwError;
export const getResponseCookiesFromHeaders = throwError;
