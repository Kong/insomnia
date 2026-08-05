import type { Entity } from '../shared/entity';

export interface GrpcRequestBody {
  text?: string;
}

export interface GrpcRequestHeader {
  name: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

export interface GrpcRequest extends Entity {
  type: 'GrpcRequest';
  name: string;
  url: string;
  description: string;
  protoFileId?: string;
  protoMethodName?: string;
  body: GrpcRequestBody;
  metadata: GrpcRequestHeader[];
  metaSortKey: number;
  reflectionApi: {
    enabled: boolean;
    url: string;
    apiKey: string;
    module: string;
  };
  disableUserAgentHeader?: boolean;
  konnectRouteKey?: string | null;
  konnectManagedHeaderNames?: string[] | null;
}
