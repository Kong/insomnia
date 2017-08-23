// @flow
import * as db from '../common/database';
import type {BaseModel} from './index';
export const name = 'Cookie Jar';
export const type = 'CookieJar';
export const prefix = 'jar';
export const canDuplicate = true;

export type Cookie = {
  id: string,
  domain: string,
  path: string,
  key: string,
  value: string,
  expires: number | null,
  httpOnly: boolean,
  secure: boolean
}

type BaseCookieJar = {
  name: string,
  cookies: Array<Cookie>
};

export type CookieJar = BaseModel & BaseCookieJar;

export function init () {
  return {
    name: 'Default Jar',
    cookies: []
  };
}

export function migrate (doc: CookieJar): CookieJar {
  doc = migrateCookieId(doc);
  return doc;
}

export function create (patch: Object = {}) {
  return db.docCreate(type, patch);
}

export async function getOrCreateForParentId (parentId: string) {
  const cookieJars = await db.find(type, {parentId});
  if (cookieJars.length === 0) {
    return await create({parentId});
  } else {
    return cookieJars[0];
  }
}

export function all () {
  return db.all(type);
}

export function getById (id: string) {
  return db.get(type, id);
}

export function update (cookieJar: CookieJar, patch: Object = {}) {
  return db.docUpdate(cookieJar, patch);
}

/** Ensure every cookie has an ID property */
function migrateCookieId (cookieJar: CookieJar) {
  for (const cookie of cookieJar.cookies) {
    if (!cookie.id) {
      cookie.id = Math.random().toString().replace('0.', '');
    }
  }
  return cookieJar;
}
