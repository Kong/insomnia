import type * as Har from 'har-format';
import type { Cookie } from 'insomnia-data';
import { Cookie as ToughCookie, CookieJar } from 'tough-cookie';

import { getResponseCookiesFromHeaders } from '../har';
import { ipcMainHandle } from './electron';

type CookieInput = Cookie | string;

interface AddSetCookiesArgs {
  setCookieStrings: string[];
  currentUrl: string;
  cookieJar: Cookie[];
}

interface AddSetCookiesResult {
  cookies: Cookie[];
  rejectedCookies: string[];
}

const parseCookieFromJSON = (cookie: CookieInput) => {
  return typeof cookie === 'string' ? ToughCookie.fromJSON(cookie) : ToughCookie.fromJSON(cookie);
};

const cookieToString = (cookie: CookieInput) => {
  const parsedCookie = parseCookieFromJSON(cookie);

  if (parsedCookie === null) {
    throw new Error(`Unable to read cookie: ${cookie}`);
  }

  let value = parsedCookie.toString();

  if (parsedCookie.domain && parsedCookie.hostOnly) {
    value += `; Domain=${parsedCookie.domain}`;
  }

  return value;
};

const getCookiesForUrl = (cookies: Cookie[], url: string): Cookie[] => {
  try {
    const sanitized = cookies.map(c => ({
      ...c,
      expires: c.expires === null || c.expires === undefined ? 'Infinity' : c.expires,
    }));
    const jar = CookieJar.fromJSON(JSON.stringify({ cookies: sanitized }));
    jar.rejectPublicSuffixes = false;
    jar.looseMode = true;
    return jar.getCookiesSync(url).map(c => c.toJSON() as Cookie);
  } catch {
    return [];
  }
};

const addSetCookiesToToughCookieJar = ({
  setCookieStrings,
  currentUrl,
  cookieJar,
}: AddSetCookiesArgs): AddSetCookiesResult => {
  const rejectedCookies: string[] = [];
  try {
    const cookieJarWithDefaults = CookieJar.fromJSON(
      JSON.stringify({
        cookies: cookieJar.map(c => ({
          ...c,
          expires: c.expires === null || c.expires === undefined ? 'Infinity' : c.expires,
        })),
      }),
    );

    cookieJarWithDefaults.rejectPublicSuffixes = false;
    cookieJarWithDefaults.looseMode = true;

    for (const setCookieStr of setCookieStrings) {
      try {
        cookieJarWithDefaults.setCookieSync(setCookieStr, currentUrl);
      } catch (err) {
        if (err instanceof Error) {
          rejectedCookies.push(err.message);
        }
      }
    }

    return {
      cookies: cookieJarWithDefaults.getCookiesSync(currentUrl).map(c => c.toJSON() as Cookie),
      rejectedCookies,
    };
  } catch (error) {
    if (error instanceof Error) {
      rejectedCookies.push(error.message);
    }

    return {
      cookies: [],
      rejectedCookies,
    };
  }
};

export interface CookiesBridgeAPI {
  fromJSON: (cookie: CookieInput) => Promise<Cookie | null>;
  parse: (cookie: string) => Promise<Cookie | null>;
  toString: (cookie: CookieInput) => Promise<string>;
  getCookiesForUrl: (args: { cookies: Cookie[]; url: string }) => Promise<Cookie[]>;
  addSetCookies: (args: AddSetCookiesArgs) => Promise<AddSetCookiesResult>;
  getResponseCookiesFromHeaders: (headers: Har.Cookie[]) => Promise<Har.Cookie[]>;
}

export function registerCookieHandlers() {
  ipcMainHandle('cookies.fromJSON', (_, cookie: CookieInput) => {
    return parseCookieFromJSON(cookie)?.toJSON() as Cookie | null;
  });
  ipcMainHandle('cookies.parse', (_, cookie: string) => {
    return ToughCookie.parse(cookie, { loose: true })?.toJSON() as Cookie | null;
  });
  ipcMainHandle('cookies.toString', (_, cookie: CookieInput) => {
    return cookieToString(cookie);
  });
  ipcMainHandle('cookies.getCookiesForUrl', (_, { cookies, url }: { cookies: Cookie[]; url: string }) => {
    return getCookiesForUrl(cookies, url);
  });
  ipcMainHandle('cookies.addSetCookies', (_, args: AddSetCookiesArgs) => {
    return addSetCookiesToToughCookieJar(args);
  });
  ipcMainHandle('cookies.getResponseCookiesFromHeaders', (_, headers: { name: string; value: string }[]) => {
    return getResponseCookiesFromHeaders(headers);
  });
}
