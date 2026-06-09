export const fromJSON = (cookie: any) => window.main.cookies.fromJSON(cookie);
export const parse = (cookie: string) => window.main.cookies.parse(cookie);
export const toString = (cookie: any) => window.main.cookies.toString(cookie);
export const getCookiesForUrl = (args: any) => window.main.cookies.getCookiesForUrl(args);
export const addSetCookies = (args: any) => window.main.cookies.addSetCookies(args);
export const getResponseCookiesFromHeaders = (headers: any) => window.main.cookies.getResponseCookiesFromHeaders(headers);
