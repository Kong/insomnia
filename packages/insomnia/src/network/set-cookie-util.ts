import { cookiesFromJar, jarFromCookies } from '../common/cookies';
import { Cookie } from '../models/cookie-jar';

export const addSetCookiesToToughCookieJar = async ({ setCookieStrings, currentUrl, cookieJar }: any) => {
  const rejectedCookies: string[] = [];
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
  return { cookies, rejectedCookies };
};
