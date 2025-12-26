import { database } from '../common/database';
import type { RequestAuthentication, RequestHeader, RequestParameter, RequestPathParameter } from './request';
import type { BaseModel } from './types';

export const name = 'Socket.IO Request';

export const type = 'SocketIORequest';

export const prefix = 'socketio-req';

export const canDuplicate = true;

export const canSync = true;

export interface SocketIOEventListener {
  id: string;
  eventName: string;
  desc: string;
  isOpen: boolean;
}

export interface BaseSocketIORequest {
  name: string;
  description: string;
  url: string;
  metaSortKey: number;
  headers: RequestHeader[];
  authentication: RequestAuthentication | {};
  parameters: RequestParameter[];
  pathParameters?: RequestPathParameter[];
  settingEncodeUrl: boolean;
  settingStoreCookies: boolean;
  settingSendCookies: boolean;
  eventListeners: SocketIOEventListener[];
}

export type SocketIORequest = BaseModel & BaseSocketIORequest & { type: typeof type };

export const isSocketIORequest = (model: Pick<BaseModel, 'type'>): model is SocketIORequest => model.type === type;

export const isSocketIORequestId = (id?: string | null) => id?.startsWith(`${prefix}_`);

export const init = (): BaseSocketIORequest => ({
  name: 'New Socket.IO Request',
  url: '',
  metaSortKey: -1 * Date.now(),
  headers: [],
  authentication: {},
  parameters: [],
  pathParameters: undefined,
  settingEncodeUrl: true,
  settingStoreCookies: true,
  settingSendCookies: true,
  description: '',
  eventListeners: [],
});

export const create = (patch: Partial<SocketIORequest> = {}) => {
  if (!patch.parentId) {
    throw new Error(`New Socket.IO Request missing \`parentId\`: ${JSON.stringify(patch)}`);
  }

  return database.docCreate<SocketIORequest>(type, patch);
};

export const getById = (_id: string) => database.findOne<SocketIORequest>(type, { _id });

export const migrate = (doc: SocketIORequest) => doc;

export const remove = (obj: SocketIORequest) => database.remove(obj);

export const update = (obj: SocketIORequest, patch: Partial<SocketIORequest> = {}) => database.docUpdate(obj, patch);

// This is duplicated (lol) from models/request.js
export async function duplicate(request: SocketIORequest, patch: Partial<SocketIORequest> = {}) {
  // Only set name and "(Copy)" if the patch does
  // not define it and the request itself has a name.
  // Otherwise leave it blank so the request URL can
  // fill it in automatically.
  if (!patch.name && request.name) {
    patch.name = `${request.name} (Copy)`;
  }

  // Get sort key of next request
  const q = {
    metaSortKey: {
      $gt: request.metaSortKey,
    },
  };

  const [nextRequest] = await database.find<SocketIORequest>(type, q, {
    metaSortKey: 1,
  });
  const nextSortKey = nextRequest ? nextRequest.metaSortKey : request.metaSortKey + 100;
  // Calculate new sort key
  const sortKeyIncrement = (nextSortKey - request.metaSortKey) / 2;
  const metaSortKey = request.metaSortKey + sortKeyIncrement;
  return database.duplicate<SocketIORequest>(request, {
    name,
    metaSortKey,
    ...patch,
  });
}
