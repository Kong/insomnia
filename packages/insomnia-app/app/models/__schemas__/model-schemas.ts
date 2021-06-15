import { Schema } from '@develohpanda/fluent-builder';
import { BaseModel, workspace } from '..';
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
