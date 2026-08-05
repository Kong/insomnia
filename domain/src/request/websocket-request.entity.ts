import type { Entity } from '../shared/entity';
import type { RequestAuthentication, RequestHeader, RequestParameter, RequestPathParameter } from './request-shared.entity';

export interface WebSocketRequest extends Entity {
  type: 'WebSocketRequest';
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
  disableUserAgentHeader?: boolean;
  konnectRouteKey?: string | null;
  konnectManagedHeaderNames?: string[] | null;
}
