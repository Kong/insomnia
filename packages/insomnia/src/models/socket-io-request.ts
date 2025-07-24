import { database } from '../common/database';
import type { BaseModel } from '.';
import type { RequestAuthentication, RequestHeader, RequestParameter, RequestPathParameter } from './request';

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

export const getById = (_id: string) => database.getWhere<SocketIORequest>(type, { _id });

export const migrate = (doc: SocketIORequest) => doc;

export const remove = (obj: SocketIORequest) => database.remove(obj);
