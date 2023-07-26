import crypto from 'crypto';

import { database as db } from '../common/database';
import type { BaseModel } from './index';

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

export const isCookieJar = (model: Pick<BaseModel, 'type'>): model is CookieJar => (
  model.type === type
);

export function init() {
  return {
    name: 'Default Jar',
    cookies: [],
  };
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

export async function create(patch: Partial<CookieJar>) {
  if (!patch.parentId) {
    throw new Error(`New CookieJar missing \`parentId\`: ${JSON.stringify(patch)}`);
  }

  return db.docCreate<CookieJar>(type, patch);
}

export async function getOrCreateForParentId(parentId: string) {
  const cookieJars = await db.find<CookieJar>(type, { parentId });

  if (cookieJars.length === 0) {
    return create({
      parentId,
      // Deterministic ID. It helps reduce sync complexity since we won't have to
      // de-duplicate environments.
      _id: `${prefix}_${crypto.createHash('sha1').update(parentId).digest('hex')}`,
    });
  } else {
    return cookieJars[0];
  }
}

export async function all() {
  return db.all<BaseModel>(type);
}

export async function getById(id: string): Promise<CookieJar | null> {
  return db.get(type, id);
}

export async function update(cookieJar: CookieJar, patch: Partial<CookieJar> = {}) {
  return db.docUpdate(cookieJar, patch);
}

/** Ensure every cookie has an ID property */
function migrateCookieId(cookieJar: CookieJar) {
  for (const cookie of cookieJar.cookies) {
    if (!cookie.id) {
      cookie.id = Math.random().toString().replace('0.', '');
    }
  }

  return cookieJar;
}
