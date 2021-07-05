import { Schema } from '@develohpanda/fluent-builder';
import { BaseModel, gitRepository, grpcRequest, request, requestGroup, workspace } from '..';
import { GitRepository } from '../git-repository';
import { Workspace } from '../workspace';
import { Request } from '../request';
import clone from 'clone';
import { GrpcRequest } from '../grpc-request';
import { RequestGroup } from '../request-group';

// move into fluent-builder
const toSchema = <T>(obj: T): Schema<T> => {
  const cloned = clone(obj);
  const output: Partial<Schema<T>> = {};

  Object.keys(cloned).forEach(key => {
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
  type: () => workspace.type,
  description: () => '',
  certificates: () => undefined,
  scope: () => 'collection',
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

export const gitRepositorySchema: Schema<GitRepository> = {
  ...baseModelSchema,
  type: () => gitRepository.type,
  author: () => ({ name: '', email: '' }),
  credentials: () => null,
  uri: () => '',
  needsFullClone: () => false,
  uriNeedsMigration: () => true,
};
