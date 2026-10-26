import type { Schema } from '@develohpanda/fluent-builder';
import clone from 'clone';
import type { AllTypes, BaseModel, Workspace } from 'insomnia-data';
import { models } from 'insomnia-data';

const { workspace } = models;

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
  type: () => 'base' as AllTypes,
};

export const workspaceModelSchema: Schema<Workspace> = {
  ...baseModelSchema,
  ...toSchema(workspace.init()),
  certificates: () => {},
  type: () => workspace.type,
};
