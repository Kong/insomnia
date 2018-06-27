// @flow
import * as db from '../common/database';
import type { BaseModel } from './index';

export const name = 'Stats';
export const type = 'Stats';
export const prefix = 'sta';
export const canDuplicate = false;

type BaseStats = {
  currentLaunch: number | null,
  lastLaunch: number | null,
  currentVersion: string | null,
  lastVersion: string | null,
  launches: number
};

export type Stats = BaseModel & BaseStats;

export function init(): BaseStats {
  return {
    currentLaunch: null,
    lastLaunch: null,
    currentVersion: null,
    lastVersion: null,
    launches: 0
  };
}

export function migrate(doc: Stats): Stats {
  return doc;
}

export function create(patch: Object = {}): Promise<Stats> {
  return db.docCreate(type, patch);
}

export async function update(patch: Object): Promise<Stats> {
  const stats = await get();
  return db.docUpdate(stats, patch);
}

export async function get(): Promise<Stats> {
  const results = await db.all(type);
  if (results.length === 0) {
    return create();
  } else {
    return results[0];
  }
}
