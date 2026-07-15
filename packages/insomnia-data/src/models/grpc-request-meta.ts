import type { BaseModel } from './base-types';

export const name = 'gRPC Request Meta';

export const type = 'GrpcRequestMeta';

export const prefix = 'greqm';

export const canDuplicate = false;

export const canSync = false;

interface BaseGrpcRequestMeta {
  pinned: boolean;
  lastActive: number;
}

export type GrpcRequestMeta = BaseModel & BaseGrpcRequestMeta;

export const isGrpcRequestMeta = (model: Pick<BaseModel, 'type'>): model is GrpcRequestMeta => model.type === type;

export function init() {
  return {
    pinned: false,
    lastActive: 0,
  };
}
