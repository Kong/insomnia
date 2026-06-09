const error = new Error('CookiesRuntime not available in node');
const rejectPromise = () => Promise.reject(error);

export const fromJSON = rejectPromise;
export const parse = rejectPromise;
export const toString = rejectPromise;
export const getCookiesForUrl = rejectPromise;
export const addSetCookies = rejectPromise;
export const getResponseCookiesFromHeaders = rejectPromise;
