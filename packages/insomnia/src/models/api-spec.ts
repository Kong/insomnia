import { databaseSchema } from '~/models/schema';

import { database as db } from '../common/database';
import type { BaseModel } from './index';
const type = databaseSchema.ApiSpec.type;

export interface BaseApiSpec {
  fileName: string;
  contentType: 'json' | 'yaml';
  contents: string;
}

export type ApiSpec = BaseModel & BaseApiSpec;

export const isApiSpec = (model: Pick<BaseModel, 'type'>): model is ApiSpec => model.type === type;

export function getByParentId(workspaceId: string) {
  return db.findOne<ApiSpec>(type, { parentId: workspaceId });
}

export async function getOrCreateForParentId(workspaceId: string, patch: Partial<ApiSpec> = {}) {
  const spec = await db.findOne<ApiSpec>(type, {
    parentId: workspaceId,
  });

  if (!spec) {
    return db.docCreate<ApiSpec>(type, { ...patch, parentId: workspaceId });
  }

  return spec;
}

export async function updateOrCreateForParentId(workspaceId: string, patch: Partial<ApiSpec> = {}) {
  const spec = await getOrCreateForParentId(workspaceId);
  return db.docUpdate(spec, patch);
}

export async function all() {
  return db.find<ApiSpec>(type);
}

export function update(apiSpec: ApiSpec, patch: Partial<ApiSpec> = {}) {
  return db.docUpdate(apiSpec, patch);
}

export function removeWhere(parentId: string) {
  return db.removeWhere(type, { parentId });
}
