import type { BaseModel } from './base-types';
import type { RequestAuthentication, RequestHeader, RequestParameter, RequestPathParameter } from './request';
import { replaceIdsInFields } from './utils/replace-ids-in-fields';

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
  settingPath?: string;
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
  settingPath: undefined,
  description: '',
  eventListeners: [],
});

export function rewriteReferences(request: SocketIORequest, idMapping: Map<string, string>): SocketIORequest {
  return {
    ...request,
    ...replaceIdsInFields(request, ['url', 'headers', 'authentication', 'parameters', 'pathParameters'], idMapping),
  };
}
