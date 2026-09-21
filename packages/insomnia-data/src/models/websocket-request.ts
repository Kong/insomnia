import { z } from 'zod/v4';

import { type BaseModel, createModelSchema } from './base-types';
import { AuthenticationSchema, HeadersSchema, RequestParametersSchema, RequestPathParametersSchema } from './request';
import { replaceIdsInFields } from './utils/replace-ids-in-fields';

export const name = 'WebSocket Request';

export const type = 'WebSocketRequest';

export const prefix = 'ws-req';

export const canDuplicate = true;

export const canSync = true;

export const baseWebSocketRequestSettingsSchema = z.object({
  // Settings
  settingStoreCookies: z.boolean().optional().default(true),
  settingSendCookies: z.boolean().optional().default(true),
  settingEncodeUrl: z.boolean().optional().default(true),
  settingFollowRedirects: z.enum(['global', 'on', 'off']).optional().default('global'),
  settingUseProxy: z.boolean().optional(),
});
export const baseWebSocketRequestSchema = z.object({
  url: z.string().optional().default(''),
  name: z.string().optional().default(''),
  description: z.string().optional().default(''),
  metaSortKey: z.number(),
  headers: HeadersSchema,
  authentication: AuthenticationSchema.optional().default({}),
  parameters: RequestParametersSchema.optional().default([]),
  pathParameters: RequestPathParametersSchema.optional(),
  disableUserAgentHeader: z.boolean().optional(),
  konnectRouteKey: z.string().nullable().optional(),
  konnectManagedHeaderNames: z.array(z.string()).nullable().optional(),
});
export const baseWebSocketRequestWithSettingsSchema = z.object({
  ...baseWebSocketRequestSchema.shape,
  ...baseWebSocketRequestSettingsSchema.shape,
});
export type BaseWebSocketRequest = z.infer<typeof baseWebSocketRequestWithSettingsSchema>;

export const schema = createModelSchema(type, prefix).extend(baseWebSocketRequestWithSettingsSchema.shape);
export type WebSocketRequest = z.infer<typeof schema>;

export const isWebSocketRequest = (model: Pick<BaseModel, 'type'>): model is WebSocketRequest => model.type === type;

export const isWebSocketRequestId = (id?: string | null) => id?.startsWith(`${prefix}_`);

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

// for those keys do not need to add in model init method but can update
export const optionalKeys: (keyof BaseWebSocketRequest)[] = [
  'settingUseProxy',
  'konnectRouteKey',
  'konnectManagedHeaderNames',
  'disableUserAgentHeader',
];

export function rewriteReferences(request: WebSocketRequest, idMapping: Map<string, string>): WebSocketRequest {
  return {
    ...request,
    ...replaceIdsInFields(request, ['url', 'headers', 'authentication', 'parameters', 'pathParameters'], idMapping),
    konnectRouteKey: null,
  };
}
