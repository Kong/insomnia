// @flow
import * as db from '../common/database';
import { PREVIEW_MODE_FRIENDLY } from '../common/constants';
import type { BaseModel } from './index';
import { prefix as requestPrefix } from './request';

export const name = 'Request Meta';
export const type = 'RequestMeta';
export const prefix = 'reqm';
export const canDuplicate = false;
export const canSync = false;

type BaseRequestMeta = {
  parentId: string,
  previewMode: string,
  responseFilter: string,
  responseFilterHistory: Array<string>,
  activeResponseId: string | null,
  savedRequestBody: Object,
  pinned: boolean,
  lastActive: number,
  downloadPath: string | null,
};

export type RequestMeta = BaseModel & BaseRequestMeta;

export function init() {
  return {
    parentId: null,
    previewMode: PREVIEW_MODE_FRIENDLY,
    responseFilter: '',
    responseFilterHistory: [],
    activeResponseId: null,
    savedRequestBody: {},
    pinned: false,
    lastActive: 0,
    downloadPath: null,
  };
}

export function migrate(doc: RequestMeta): RequestMeta {
  return doc;
}

export function create(patch: $Shape<RequestMeta> = {}) {
  if (!patch.parentId) {
    throw new Error('New RequestMeta missing `parentId` ' + JSON.stringify(patch));
  }

  if (!patch.parentId.startsWith(`${requestPrefix}_`)) {
    throw new Error('Expected the parent of RequestMeta to be a Request');
  }

  return db.docCreate(type, patch);
}

export function update(requestMeta: RequestMeta, patch: $Shape<RequestMeta>) {
  return db.docUpdate(requestMeta, patch);
}

export function getByParentId(parentId: string) {
  return db.getWhere(type, { parentId });
}

export async function getOrCreateByParentId(parentId: string) {
  const requestMeta = await getByParentId(parentId);

  if (requestMeta) {
    return requestMeta;
  }

  return create({ parentId });
}

export async function updateOrCreateByParentId(parentId: string, patch: $Shape<RequestMeta>) {
  const requestMeta = await getByParentId(parentId);

  if (requestMeta) {
    return update(requestMeta, patch);
  } else {
    const newPatch = Object.assign({ parentId }, patch);
    return create(newPatch);
  }
}

export function all(): Promise<Array<RequestMeta>> {
  return db.all(type);
}
