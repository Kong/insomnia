import type { Entity } from '../shared/entity';
import type { RequestAuthentication, RequestBody, RequestHeader, RequestParameter, RequestPathParameter } from './request-shared.entity';

export interface Request extends Entity {
  type: 'Request';
  url: string;
  name: string;
  description: string;
  method: string;
  body: RequestBody;
  preRequestScript?: string;
  afterResponseScript?: string;
  parameters: RequestParameter[];
  pathParameters?: RequestPathParameter[];
  headers: RequestHeader[];
  authentication: RequestAuthentication | {};
  metaSortKey: number;
  settingStoreCookies: boolean;
  settingSendCookies: boolean;
  settingDisableRenderRequestBody: boolean;
  settingEncodeUrl: boolean;
  settingRebuildPath: boolean;
  settingFollowRedirects: 'global' | 'on' | 'off';
  disableUserAgentHeader?: boolean;
  konnectRouteKey?: string | null;
  konnectManagedHeaderNames?: string[] | null;
}
