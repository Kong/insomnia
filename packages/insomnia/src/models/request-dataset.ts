import * as crypto from 'crypto';

import { database as db } from '../common/database';
import type { BaseModel } from './index';
import { Request } from './request';

export const name = 'Dataset';

export const type = 'RequestDataset';

export const prefix = 'rds';

export const canDuplicate = true;

export const canSync = true;

export const REQUEST_DATASET_SETTING_COLLAPSE = 'collapse';

interface BaseRequestDataset {
  name: string;
  applyEnv?: string | null;
  environment: Record<string, any>;
  environmentPropertyOrder: Record<string, any> | null;
  description?: string;
  default: boolean;
  selected?: boolean;
  settings?: Record<string, any>;
}

export type RequestDataSet = BaseModel & BaseRequestDataset;

export const isRequestDataset = (
  model: Pick<BaseModel, 'type'>
): model is RequestDataSet => model.type === type;

export function init(): BaseRequestDataset {
  return {
    name: 'New dataset',
    environment: {},
    environmentPropertyOrder: null,
    default: false,
    selected: false,
    applyEnv: null,
    settings: {},
  };
}

export function migrate(doc: RequestDataSet) {
  return doc;
}

export async function create(patch: Partial<RequestDataSet> = {}) {
  if (!patch.parentId) {
    throw new Error(
      'New RequestGroup missing `parentId`: ' + JSON.stringify(patch)
    );
  }
  const baseDataset = await getOrCreateForRequestId(patch.parentId);
  return duplicate(baseDataset, patch);
}

export function update(
  requestGroup: RequestDataSet,
  patch: Partial<RequestDataSet> = {}
) {
  return db.docUpdate<RequestDataSet>(requestGroup, patch);
}

export function getById(id: string) {
  return db.get<RequestDataSet>(type, id);
}

export function findByParentId(parentId: string) {
  return db.find<RequestDataSet>(type, { parentId });
}

export async function getOrCreateForRequestId(requestId: string) {
  let datasets = await db.find<RequestDataSet>(type, {
    parentId: requestId,
  });

  if (!datasets || !datasets.length) {
    const baseId = `${prefix}_${crypto
      .createHash('sha1')
      .update(requestId)
      .digest('hex')}`;
    try {
      return await db.docCreate<RequestDataSet>(type, {
        parentId: requestId,
        name: 'Base Dataset',
        // Deterministic base env ID. It helps reduce sync complexity since we won't have to
        // de-duplicate environments.
        _id: baseId,
        default: true,
        selected: true,
      });
    } catch {
      datasets = await db.find<RequestDataSet>(type, {
        parentId: requestId,
      });
    }
  }

  return datasets.filter(ds => ds.default)[0];
}

export async function getOrCreateForRequest(request: Request) {
  return getOrCreateForRequestId(request._id);
}

export function remove(requestGroup: RequestDataSet) {
  return db.remove(requestGroup);
}

export function all() {
  return db.all<RequestDataSet>(type);
}

export async function duplicate(
  requestGroup: RequestDataSet,
  patch: Partial<RequestDataSet> = {}
) {
  if (!patch.name) {
    patch.name = `${requestGroup.name} (Copy)`;
  }
  return db.duplicate<RequestDataSet>(requestGroup, {
    ...patch,
    default: false,
    selected: false,
  });
}
