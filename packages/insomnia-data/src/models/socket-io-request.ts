import { z } from 'zod/v4';

import { type BaseModel, createModelSchema } from './base-types';
import { AuthenticationSchema, HeadersSchema, RequestParametersSchema, RequestPathParametersSchema } from './request';
import { replaceIdsInFields } from './utils/replace-ids-in-fields';

export const name = 'Socket.IO Request';

export const type = 'SocketIORequest';

export const prefix = 'socketio-req';

export const canDuplicate = true;

export const canSync = true;

export const SocketIOEventListenerSchema = z.object({
  id: z.string(),
  eventName: z.string().optional().default(''),
  desc: z.string().optional().default(''),
  isOpen: z.boolean().optional().default(false),
});
export type SocketIOEventListener = z.infer<typeof SocketIOEventListenerSchema>;

export const baseSocketIORequestSettingsSchema = z.object({
  // Settings
  settingEncodeUrl: z.boolean().optional().default(true),
  settingStoreCookies: z.boolean().optional().default(true),
  settingSendCookies: z.boolean().optional().default(true),
  settingPath: z.string().optional(),
});
export const baseSocketIORequestSchema = z.object({
  url: z.string().optional().default(''),
  name: z.string().optional().default(''),
  description: z.string().optional().default(''),
  metaSortKey: z.number(),
  authentication: AuthenticationSchema.optional().default({}),
  headers: HeadersSchema.optional().default([]),
  parameters: RequestParametersSchema.optional().default([]),
  pathParameters: RequestPathParametersSchema.optional(),
  eventListeners: SocketIOEventListenerSchema.array().optional().default([]),
  disableUserAgentHeader: z.boolean().optional(),
});
export const baseSocketIORequestWithSettingsSchema = z.object({
  ...baseSocketIORequestSchema.shape,
  ...baseSocketIORequestSettingsSchema.shape,
});

export type BaseSocketIORequest = z.infer<typeof baseSocketIORequestWithSettingsSchema>;

export const schema = createModelSchema(type, prefix).extend(baseSocketIORequestWithSettingsSchema.shape);
export type SocketIORequest = z.infer<typeof schema>;

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

export const optionalKeys: (keyof BaseSocketIORequest)[] = ['disableUserAgentHeader'];

export function rewriteReferences(request: SocketIORequest, idMapping: Map<string, string>): SocketIORequest {
  return {
    ...request,
    ...replaceIdsInFields(request, ['url', 'headers', 'authentication', 'parameters', 'pathParameters'], idMapping),
  };
}
