import type { BaseModel } from '~/models/types';

export const name = 'Stats';

export const type = 'Stats';

export const prefix = 'sta';

export const canDuplicate = false;

export const canSync = false;

export interface BaseStats {
  currentLaunch: number | null;
  lastLaunch: number | null;
  currentVersion: string | null;
  lastVersion: string | null;
  launches: number;
  createdRequests: number;
  deletedRequests: number;
  executedRequests: number;
}

export type Stats = BaseModel & BaseStats;

export const isStats = (model: Pick<BaseModel, 'type'>): model is Stats => model.type === type;

export function init(): BaseStats {
  return {
    currentLaunch: null,
    lastLaunch: null,
    currentVersion: null,
    lastVersion: null,
    launches: 0,
    createdRequests: 0,
    deletedRequests: 0,
    executedRequests: 0,
  };
}
