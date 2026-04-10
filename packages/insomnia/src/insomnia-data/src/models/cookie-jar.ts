import { v4 as uuidv4 } from 'uuid';

import type { BaseModel } from '~/models/types';

export const name = 'Cookie Jar';

export const type = 'CookieJar';

export const prefix = 'jar';

export const canDuplicate = true;

export const canSync = false;

export interface Cookie {
  id: string;
  key: string;
  value: string;
  expires: Date | string | number | null;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  extensions?: any[];
  creation?: Date;
  creationIndex?: number;
  hostOnly?: boolean;
  pathIsDefault?: boolean;
  lastAccessed?: Date;
}

export interface BaseCookieJar {
  name: string;
  cookies: Cookie[];
}

export type CookieJar = BaseModel & BaseCookieJar;

export const isCookieJar = (model: Pick<BaseModel, 'type'>): model is CookieJar => model.type === type;

export function init() {
  return {
    name: 'Default Jar',
    cookies: [],
  };
}

/** Ensure every cookie has an ID property */
function migrateCookieId(cookieJar: CookieJar) {
  for (const cookie of cookieJar.cookies) {
    if (!cookie.id) {
      cookie.id = uuidv4();
    }
  }

  return cookieJar;
}

export function migrate(doc: CookieJar) {
  try {
    doc = migrateCookieId(doc);
    return doc;
  } catch (e) {
    console.log('[db] Error during cookie jar migration', e);
    throw e;
  }
}
