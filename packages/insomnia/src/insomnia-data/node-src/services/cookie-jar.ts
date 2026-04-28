import * as crypto from 'node:crypto';

import type { CookieJar } from '~/insomnia-data';
import { database as db, models } from '~/insomnia-data';

const { type, prefix } = models.cookieJar;

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
      _id: `${prefix}_${crypto.createHash('sha1').update(parentId).digest('hex')}`,
    });
  }
  return cookieJars[0];
}

export async function all() {
  return db.find<CookieJar>(type);
}

export async function getById(id: string): Promise<CookieJar | undefined> {
  return db.findOne<CookieJar>(type, { _id: id });
}

export async function update(cookieJar: CookieJar, patch: Partial<CookieJar> = {}) {
  return db.docUpdate(cookieJar, patch);
}
