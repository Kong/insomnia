import { database as db } from '../common/database';
import { strings } from '../common/strings';
import type { BaseModel } from './index';

export const name = 'ApiSpecRuleset';

export const type = 'ApiSpecRuleset';

export const prefix = 'spcrs';

export const canDuplicate = true;

export const canSync = false;

export interface BaseApiSpecRuleset {
  fileName: string;
  contentType: 'json' | 'yaml';
  contents: string;
}

export type ApiSpecRuleset = BaseModel & BaseApiSpecRuleset;

export const isApiSpecRuleset = (model: Pick<BaseModel, 'type'>): model is ApiSpecRuleset => (
  model.type === type
);

export function init(): BaseApiSpecRuleset {
  return {
    fileName: `New ${strings.document.singular}`,
    contents: '',
    contentType: 'yaml',
  };
}

export async function migrate(doc: ApiSpecRuleset) {
  return doc;
}

export function getByParentId(workspaceId: string) {
  return db.getWhere<ApiSpecRuleset>(type, { parentId: workspaceId });
}

export async function getOrCreateForParentId(
  workspaceId: string,
  patch: Partial<ApiSpecRuleset> = {},
) {
  const spec = await db.getWhere<ApiSpecRuleset>(type, {
    parentId: workspaceId,
  });

  if (!spec) {
    return db.docCreate<ApiSpecRuleset>(type, { ...patch, parentId: workspaceId });
  }

  return spec;
}

export async function updateOrCreateForParentId(
  workspaceId: string,
  patch: Partial<ApiSpecRuleset> = {},
) {
  const spec = await getOrCreateForParentId(workspaceId);
  return db.docUpdate(spec, patch);
}

export async function all() {
  return db.all<ApiSpecRuleset>(type);
}

export function update(ApiSpecRuleset: ApiSpecRuleset, patch: Partial<ApiSpecRuleset> = {}) {
  return db.docUpdate(ApiSpecRuleset, patch);
}

export function removeWhere(parentId: string) {
  return db.removeWhere(type, { parentId });
}
