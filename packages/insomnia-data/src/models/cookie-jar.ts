import type { BaseModel } from './base-types';

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
  // 'manual' cookies (added/edited via the Cookie Jar UI, or written by a script) may contain
  // template syntax that gets rendered; 'response' cookies came from a server's Set-Cookie
  // header (or an import) and are always rendered as plain literal text.
  source?: 'manual' | 'response';
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
