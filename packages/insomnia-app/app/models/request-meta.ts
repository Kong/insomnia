import { PREVIEW_MODE_FRIENDLY } from '../common/constants';
import { database as db } from '../common/database';
import type { BaseModel } from './index';

export const name = 'Request Meta';

export const type = 'RequestMeta';

export const prefix = 'reqm';

export const canDuplicate = false;

export const canSync = false;

interface BaseRequestMeta {
  parentId: string;
  previewMode: string;
  responseFilter: string;
  responseFilterHistory: string[];
  activeResponseId: string | null;
  savedRequestBody: Record<string, any>;
  pinned: boolean;
  lastActive: number;
  downloadPath: string | null;
}

export type RequestMeta = BaseModel & BaseRequestMeta;

export const isRequestMeta = (model: Pick<BaseModel, 'type'>): model is RequestMeta => (
  model.type === type
);

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

export function migrate(doc: RequestMeta) {
  return doc;
}

export function create(patch: Partial<RequestMeta> = {}) {
  if (!patch.parentId) {
    throw new Error('New RequestMeta missing `parentId` ' + JSON.stringify(patch));
  }

  // expectParentToBeRequest(patch.parentId);
  return db.docCreate<RequestMeta>(type, patch);
}

export function update(requestMeta: RequestMeta, patch: Partial<RequestMeta>) {
  // expectParentToBeRequest(patch.parentId || requestMeta.parentId);
  return db.docUpdate<RequestMeta>(requestMeta, patch);
}

export function getByParentId(parentId: string): Promise<RequestMeta | null> {
  // expectParentToBeRequest(parentId);
  return db.getWhere<RequestMeta>(type, { parentId });
}

export async function getOrCreateByParentId(parentId: string) {
  const requestMeta = await getByParentId(parentId);

  if (requestMeta) {
    return requestMeta;
  }

  return create({ parentId });
}

export async function updateOrCreateByParentId(parentId: string, patch: Partial<RequestMeta>) {
  const requestMeta = await getByParentId(parentId);

  if (requestMeta) {
    return update(requestMeta, patch);
  } else {
    const newPatch = Object.assign(
      {
        parentId,
      },
      patch,
    );
    return create(newPatch);
  }
}

export function all() {
  return db.all<RequestMeta>(type);
}

// TODO: Ensure the parent of RequestMeta can only be a Request - INS-341
// function expectParentToBeRequest(parentId: string) {
//   if (!isRequestId(parentId)) {
//     throw new Error('Expected the parent of RequestMeta to be a Request');
//   }
// }
