import { v4 as uuidv4 } from 'uuid';

import { CONTENT_TYPE_JSON } from '../common/constants';
import { database } from '../common/database';
import { replaceIdsInFields } from './helpers/replace-ids-in-fields';
import type { BaseModel } from './types';

export const name = 'SocketIO Payload';

export const type = 'SocketIOPayload';

export const prefix = 'socket-io-payload';

export const canDuplicate = true;

export const canSync = true;

export interface SocketIOArg {
  id: string;
  value: string;
  mode: string;
}

export interface BaseSocketIOPayload {
  args: SocketIOArg[];
  eventName?: string;
  ack?: boolean;
}

export type SocketIOPayload = BaseModel & BaseSocketIOPayload & { type: typeof type };

export const isSocketIOPayload = (model: Pick<BaseModel, 'type'>): model is SocketIOPayload => model.type === type;

export const isSocketIOPayloadId = (id: string | null) => id?.startsWith(`${prefix}_`);

export const init = (): BaseSocketIOPayload => {
  return {
    args: [{ id: uuidv4(), value: '', mode: CONTENT_TYPE_JSON }],
    eventName: '',
    ack: false,
  };
};

export const migrate = (doc: SocketIOPayload) => doc;

export const create = (patch: Partial<SocketIOPayload> = {}) => {
  if (!patch.parentId) {
    throw new Error(`New SocketIOPayload missing \`parentId\`: ${JSON.stringify(patch)}`);
  }

  return database.docCreate<SocketIOPayload>(type, patch);
};

export const remove = (obj: SocketIOPayload) => database.remove(obj);

export const update = (obj: SocketIOPayload, patch: Partial<SocketIOPayload> = {}) => database.docUpdate(obj, patch);

export async function duplicate(request: SocketIOPayload, patch: Partial<SocketIOPayload> = {}) {
  // Only set name and "(Copy)" if the patch does
  // not define it and the request itself has a name.
  // Otherwise leave it blank so the request URL can
  // fill it in automatically.
  if (!patch.name && request.name) {
    patch.name = `${request.name} (Copy)`;
  }

  return database.duplicate<SocketIOPayload>(request, {
    name,
    ...patch,
  });
}

export const getById = (_id: string) => database.findOne<SocketIOPayload>(type, { _id });
export const getByParentId = (parentId: string) => database.findOne<SocketIOPayload>(type, { parentId });

export async function updateOrCreateByParentId(parentId: string, patch: Partial<SocketIOPayload>) {
  const requestPayload = await getByParentId(parentId);

  if (requestPayload) {
    return update(requestPayload, patch);
  }
  const newPatch = Object.assign(
    {
      parentId,
    },
    patch,
  );
  return create(newPatch);
}

export async function getOrCreateByParentId(parentId: string) {
  const doc = await getByParentId(parentId);
  return doc || create({ parentId });
}

export const all = () => database.find<SocketIOPayload>(type);

export function rewriteReferences(payload: SocketIOPayload, idMapping: Map<string, string>): SocketIOPayload {
  return { ...payload, ...replaceIdsInFields(payload, ['args'], idMapping) };
}
