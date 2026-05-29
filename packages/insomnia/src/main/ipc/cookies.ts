import { Cookie as ToughCookie, CookieJar } from 'tough-cookie';

import type { Cookie } from '~/insomnia-data';

import { ipcMainHandle } from './electron';

type CookieInput = Cookie | string;

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

export interface CookiesBridgeAPI {
  fromJSON: (cookie: CookieInput) => Promise<Cookie | null>;
  parse: (cookie: string) => Promise<Cookie | null>;
  toString: (cookie: CookieInput) => Promise<string>;
  getCookiesForUrl: (args: { cookies: Cookie[]; url: string }) => Promise<Cookie[]>;
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
}
