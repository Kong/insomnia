import type { Schema } from '@develohpanda/fluent-builder';
import clone from 'clone';

import { type BaseModel, environment, grpcRequest, request, requestGroup, workspace } from '..';
import type { Environment } from '../environment';
import type { GrpcRequest } from '../grpc-request';
import type { Request } from '../request';
import type { RequestGroup } from '../request-group';
import type { Workspace } from '../workspace';

// move into fluent-builder
const toSchema = <T>(obj: T): Schema<T> => {
  const cloned = clone(obj);
  const output: Partial<Schema<T>> = {};

    // @ts-expect-error -- mapping unsoundness
  Object.keys(cloned).forEach(key => {
    // @ts-expect-error -- mapping unsoundness
    output[key] = () => cloned[key];
  });

  return output as Schema<T>;
};

export const baseModelSchema: Schema<BaseModel> = {
  _id: () => 'id',
  created: () => 1234,
  isPrivate: () => false,
  modified: () => 5678,
  name: () => 'name',
  parentId: () => '',
  type: () => 'base',
};

export const workspaceModelSchema: Schema<Workspace> = {
  ...baseModelSchema,
  ...toSchema(workspace.init()),
  certificates: () => undefined,
  type: () => workspace.type,
};

export const requestModelSchema: Schema<Request> = {
  ...baseModelSchema,
  ...toSchema(request.init()),
  type: () => request.type,
};

export const grpcRequestModelSchema: Schema<GrpcRequest> = {
  ...baseModelSchema,
  ...toSchema(grpcRequest.init()),
  type: () => grpcRequest.type,
};

export const requestGroupModelSchema: Schema<RequestGroup> = {
  ...baseModelSchema,
  ...toSchema(requestGroup.init()),
  type: () => requestGroup.type,
};

export const environmentModelSchema: Schema<Environment> = {
  ...baseModelSchema,
  ...toSchema(environment.init()),
  type: () => environment.type,
  environmentType: () => undefined,
  kvPairData: () => undefined,
};
