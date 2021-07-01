import { Schema } from '@develohpanda/fluent-builder';
import { BaseModel, gitRepository, workspace } from '..';
import { GitRepository } from '../git-repository';
import { Workspace } from '../workspace';

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

export const gitRepositorySchema: Schema<GitRepository> = {
  ...baseModelSchema,
  type: () => gitRepository.type,
  author: () => ({ name: '', email: '' }),
  credentials: () => null,
  uri: () => '',
  needsFullClone: () => false,
  uriNeedsMigration: () => true,
};
