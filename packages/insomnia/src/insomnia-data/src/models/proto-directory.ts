import { generateId } from 'insomnia-data/common';

import type { BaseModel } from './base-types';

export const name = 'Proto Directory';

export const type = 'ProtoDirectory';

export const prefix = 'pd';

export const canDuplicate = true;

export const canSync = true;

interface BaseProtoDirectory {
  name: string;
}

export type ProtoDirectory = BaseModel & BaseProtoDirectory;

export const isProtoDirectory = (model: Pick<BaseModel, 'type'>): model is ProtoDirectory => model.type === type;

export function init(): BaseProtoDirectory {
  return {
    name: 'New Proto Directory',
  };
}

export function createId() {
  return generateId(prefix);
}
