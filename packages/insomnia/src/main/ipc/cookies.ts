import { Cookie as ToughCookie } from 'tough-cookie';

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

export interface CookiesBridgeAPI {
  fromJSON: (cookie: CookieInput) => Promise<Cookie | null>;
  parse: (cookie: string) => Promise<Cookie | null>;
  toString: (cookie: CookieInput) => Promise<string>;
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
}
