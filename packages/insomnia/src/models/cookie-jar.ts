import crypto from 'node:crypto';

import { databaseSchema } from '~/models/schema';

import { database as db } from '../common/database';
import type { BaseModel } from './index';

const type = databaseSchema.CookieJar.type;

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
      // de-duplicate cookie jar.
      _id: `${databaseSchema.CookieJar.prefix}_${crypto.createHash('sha1').update(parentId).digest('hex')}`,
    });
  }
  return cookieJars[0];
}

export async function all() {
  return db.find<BaseModel>(type);
}

export async function getById(id: string): Promise<CookieJar | undefined> {
  return db.findOne<CookieJar>(type, { _id: id });
}

export async function update(cookieJar: CookieJar, patch: Partial<CookieJar> = {}) {
  return db.docUpdate(cookieJar, patch);
}
