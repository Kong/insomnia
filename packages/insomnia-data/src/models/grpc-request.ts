import { z } from 'zod/v4';

import { type BaseModel, createModelSchema } from './base-types';
import { replaceIdsInFields } from './utils/replace-ids-in-fields';

export const name = 'gRPC Request';
export const type = 'GrpcRequest';
export const prefix = 'greq';
export const canDuplicate = true;
export const canSync = true;

export const GrpcRequestBodySchema = z.object({
  text: z.string().optional(),
});
export type GrpcRequestBody = z.infer<typeof GrpcRequestBodySchema>;

export const GrpcRequestHeaderSchema = z.object({
  name: z.string().optional().default(''),
  value: z.string().optional().default(''),
  description: z.string().optional(),
  disabled: z.boolean().optional(),
});
export type GrpcRequestHeader = z.infer<typeof GrpcRequestHeaderSchema>;

export const baseGrpcRequestSchema = z.object({
  url: z.string().optional().default(''),
  name: z.string().optional().default(''),
  description: z.string(),
  protoFileId: z.string().optional(),
  protoMethodName: z.string().optional(),
  body: GrpcRequestBodySchema,
  metadata: z.array(GrpcRequestHeaderSchema),
  metaSortKey: z.number(),
  reflectionApi: z.object({
    enabled: z.boolean().optional().default(false),
    url: z.string().optional().default(''),
    apiKey: z.string().optional().default(''),
    module: z.string().optional().default(''),
  }),
  disableUserAgentHeader: z.boolean().optional(),
  konnectRouteKey: z.string().nullable().optional(),
  konnectManagedHeaderNames: z.array(z.string()).nullable().optional(),
});
export type BaseGrpcRequest = z.infer<typeof baseGrpcRequestSchema>;

export const schema = createModelSchema(type, prefix).extend(baseGrpcRequestSchema.shape);
export type GrpcRequest = z.infer<typeof schema>;

export const isGrpcRequest = (model: Pick<BaseModel, 'type'>): model is GrpcRequest => model.type === type;

export const isGrpcRequestId = (id?: string | null) => id?.startsWith(`${prefix}_`);

export const optionalKeys: (keyof BaseGrpcRequest)[] = [
  'konnectRouteKey',
  'konnectManagedHeaderNames',
  'disableUserAgentHeader',
];

export function rewriteReferences(request: GrpcRequest, idMapping: Map<string, string>): GrpcRequest {
  return {
    ...request,
    protoFileId: request.protoFileId ? idMapping.get(request.protoFileId) : undefined,
    ...replaceIdsInFields(request, ['url', 'body', 'metadata'], idMapping),
    konnectRouteKey: null,
  };
}

export function init(): BaseGrpcRequest & Pick<BaseModel, 'isPrivate'> {
  return {
    url: '',
    name: 'New gRPC Request',
    description: '',
    protoFileId: '',
    protoMethodName: '',
    metadata: [],
    body: {
      text: '{}',
    },
    metaSortKey: -1 * Date.now(),
    isPrivate: false,
    reflectionApi: {
      enabled: false,
      url: 'https://buf.build',
      apiKey: '',
      module: 'buf.build/connectrpc/eliza',
    },
  };
}
