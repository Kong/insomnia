import { replaceIdsInFields } from '~/models/helpers/replace-ids-in-fields';
import type { BaseModel } from '~/models/types';

import type { RequestAuthentication, RequestHeader, RequestParameter, RequestPathParameter } from './request';

export const name = 'WebSocket Request';

export const type = 'WebSocketRequest';

export const prefix = 'ws-req';

export const canDuplicate = true;

export const canSync = true;

export interface BaseWebSocketRequest {
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
  settingFollowRedirects: 'global' | 'on' | 'off';
  settingUseProxy?: boolean;
}

export type WebSocketRequest = BaseModel & BaseWebSocketRequest & { type: typeof type };

export const isWebSocketRequest = (model: Pick<BaseModel, 'type'>): model is WebSocketRequest => model.type === type;

export const isWebSocketRequestId = (id?: string | null) => id?.startsWith(`${prefix}_`);

// for those keys do not need to add in model init method but can update
export const optionalKeys = ['settingUseProxy'];

export const init = (): BaseWebSocketRequest => ({
  name: 'New WebSocket Request',
  url: '',
  metaSortKey: -1 * Date.now(),
  headers: [],
  authentication: {},
  parameters: [],
  pathParameters: undefined,
  settingEncodeUrl: true,
  settingStoreCookies: true,
  settingSendCookies: true,
  settingFollowRedirects: 'global',
  description: '',
});

export function rewriteReferences(request: WebSocketRequest, idMapping: Map<string, string>): WebSocketRequest {
  return {
    ...request,
    ...replaceIdsInFields(request, ['url', 'headers', 'authentication', 'parameters', 'pathParameters'], idMapping),
  };
}
