import type { BaseModel } from './base-types';
import { replaceIdsInFields } from './utils/replace-ids-in-fields';

export const name = 'gRPC Request';
export const type = 'GrpcRequest';
export const prefix = 'greq';
export const canDuplicate = true;
export const canSync = true;

export interface GrpcRequestBody {
  text?: string;
}

export interface GrpcRequestHeader {
  name: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

interface BaseGrpcRequest {
  name: string;
  url: string;
  description: string;
  protoFileId?: string;
  protoMethodName?: string;
  body: GrpcRequestBody;
  metadata: GrpcRequestHeader[];
  metaSortKey: number;
  isPrivate: boolean;
  reflectionApi: {
    enabled: boolean;
    url: string;
    apiKey: string;
    module: string;
  };
  disableUserAgentHeader: boolean;
  konnectRouteKey?: string | null;
  konnectManagedHeaderNames?: string[] | null;
}

export type GrpcRequest = BaseModel & BaseGrpcRequest;

export const isGrpcRequest = (model: Pick<BaseModel, 'type'>): model is GrpcRequest => model.type === type;

export const isGrpcRequestId = (id?: string | null) => id?.startsWith(`${prefix}_`);

export const optionalKeys = ['konnectRouteKey', 'konnectManagedHeaderNames'];

export function rewriteReferences(request: GrpcRequest, idMapping: Map<string, string>): GrpcRequest {
  return {
    ...request,
    protoFileId: request.protoFileId ? idMapping.get(request.protoFileId) : undefined,
    ...replaceIdsInFields(request, ['url', 'body', 'metadata'], idMapping),
    konnectRouteKey: null,
  };
}

export function init(): BaseGrpcRequest {
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
    disableUserAgentHeader: false,
  };
}
