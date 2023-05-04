import { database as db } from '../common/database';
import { strings } from '../common/strings';
import type { BaseModel } from './index';

export const name = 'ApiSpec';

export const type = 'ApiSpec';

export const prefix = 'spc';

export const canDuplicate = true;

export const canSync = true;

export interface BaseApiSpec {
  fileName: string;
  contentType: 'json' | 'yaml';
  contents: string;
}

export type ApiSpec = BaseModel & BaseApiSpec;

export const isApiSpec = (model: Pick<BaseModel, 'type'>): model is ApiSpec => (
  model.type === type
);

export function init(): BaseApiSpec {
  return {
    fileName: `New ${strings.document.singular}`,
    contents: '',
    contentType: 'yaml',
  };
}

export function migrate(doc: ApiSpec) {
  return doc;
}

export function getByParentId(workspaceId: string) {
  return db.getWhere<ApiSpec>(type, { parentId: workspaceId });
}

export async function getOrCreateForParentId(
  workspaceId: string,
  patch: Partial<ApiSpec> = {},
) {
  const spec = await db.getWhere<ApiSpec>(type, {
    parentId: workspaceId,
  });

  if (!spec) {
    return db.docCreate<ApiSpec>(type, { ...patch, parentId: workspaceId });
  }

  return spec;
}

export async function updateOrCreateForParentId(
  workspaceId: string,
  patch: Partial<ApiSpec> = {},
) {
  const spec = await getOrCreateForParentId(workspaceId);
  return db.docUpdate(spec, patch);
}

export async function all() {
  return db.all<ApiSpec>(type);
}

export function update(apiSpec: ApiSpec, patch: Partial<ApiSpec> = {}) {
  return db.docUpdate(apiSpec, patch);
}

export function removeWhere(parentId: string) {
  return db.removeWhere(type, { parentId });
}
