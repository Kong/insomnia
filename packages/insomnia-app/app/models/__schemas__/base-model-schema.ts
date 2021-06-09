import { Schema } from '@develohpanda/fluent-builder';
import { BaseModel } from '..';

export const baseModelSchema: Schema<BaseModel> = {
  _id: () => 'id',
  created: () => 1234,
  isPrivate: () => false,
  modified: () => 5678,
  name: () => 'name',
  parentId: () => '',
  type: () => 'base',
};
