import { cookiesFromJar, jarFromCookies } from '../common/cookies';
import type { Cookie } from '../models/cookie-jar';

export const addSetCookiesToToughCookieJar = async ({ setCookieStrings, currentUrl, cookieJar }: any) => {
  const rejectedCookies: string[] = [];
  
  // map existing cookies to preserve their IDs after the tough-cookie roundtrip
  const existingCookieIds = new Map<string, string>();
  for (const cookie of cookieJar.cookies) {
    const cookieKey = `${cookie.domain}|${cookie.path}|${cookie.key}`;
    existingCookieIds.set(cookieKey, cookie.id);
  }
  
  const jar = jarFromCookies(cookieJar.cookies);
  for (const setCookieStr of setCookieStrings) {
    try {
      jar.setCookieSync(setCookieStr, currentUrl);
    } catch (err) {
      if (err instanceof Error) {
        rejectedCookies.push(err.message);
      }
    }
  }
  
  const cookies = (await cookiesFromJar(jar)) as Cookie[];
  
  // restore original cookie IDs
  for (const cookie of cookies) {
    const cookieKey = `${cookie.domain}|${cookie.path}|${cookie.key}`;
    const existingId = existingCookieIds.get(cookieKey);
    if (existingId) {
      cookie.id = existingId;
    }
  }
  
  return { cookies, rejectedCookies };
};
