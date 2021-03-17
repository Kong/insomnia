// @flow
import type { BaseModel } from './index';
import * as db from '../common/database';
import { strings } from '../common/strings';

export const name = 'ApiSpec';
export const type = 'ApiSpec';
export const prefix = 'spc';
export const canDuplicate = true;
export const canSync = false;

type BaseApiSpec = {
  fileName: string,
  contentType: 'json' | 'yaml',
  contents: string,
};

export type ApiSpec = BaseModel & BaseApiSpec;

export function init(): BaseApiSpec {
  return {
    fileName: `New ${strings.document}`,
    contents: '',
    contentType: 'yaml',
  };
}

export async function migrate(doc: ApiSpec): Promise<ApiSpec> {
  return doc;
}

export function getByParentId(workspaceId: string): Promise<ApiSpec | null> {
  return db.getWhere(type, { parentId: workspaceId });
}

export async function getOrCreateForParentId(
  workspaceId: string,
  patch: $Shape<ApiSpec> = {},
): Promise<ApiSpec> {
  const spec = await db.getWhere(type, { parentId: workspaceId });

  if (!spec) {
    return db.docCreate(type, { ...patch, parentId: workspaceId });
  }

  return spec;
}

export async function updateOrCreateForParentId(
  workspaceId: string,
  patch: $Shape<ApiSpec> = {},
): Promise<ApiSpec> {
  const spec = await getOrCreateForParentId(workspaceId);
  return db.docUpdate(spec, patch);
}

export async function all(): Promise<Array<ApiSpec>> {
  return db.all(type);
}

export function update(apiSpec: ApiSpec, patch: $Shape<ApiSpec> = {}): Promise<ApiSpec> {
  return db.docUpdate(apiSpec, patch);
}

export function removeWhere(parentId: string): Promise<void> {
  return db.removeWhere(type, { parentId });
}
