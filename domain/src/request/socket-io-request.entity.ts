import type { Entity } from '../shared/entity';
import type { RequestAuthentication, RequestHeader, RequestParameter, RequestPathParameter } from './request-shared.entity';

export interface SocketIOEventListener {
  id: string;
  eventName: string;
  desc: string;
  isOpen: boolean;
}

export interface SocketIORequest extends Entity {
  type: 'SocketIORequest';
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
  disableUserAgentHeader?: boolean;
  eventListeners: SocketIOEventListener[];
}
