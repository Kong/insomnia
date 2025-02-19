import { database as db } from '../common/database';
import type { BaseModel } from './index';

export const name = 'Workspace Meta';
export const type = 'WorkspaceMeta';
export const prefix = 'wrkm';
export const canDuplicate = false;
export const canSync = false;

export interface BaseWorkspaceMeta {
  activeActivity: string | null;
  activeEnvironmentId: string | null;
  activeGlobalEnvironmentId: string | null;
  activeRequestId: string | null;
  activeUnitTestSuiteId: string | null;
  gitRepositoryId: string | null;
  parentId: string | null;
  pushSnapshotOnInitialize: boolean;
  hasUncommittedChanges: boolean;
  hasUnpushedChanges: boolean;
}

export type WorkspaceMeta = BaseWorkspaceMeta & BaseModel;

export const isWorkspaceMeta = (model: Pick<BaseModel, 'type'>): model is WorkspaceMeta => (
  model.type === type
);

export function init(): BaseWorkspaceMeta {
  return {
    activeActivity: null,
    activeEnvironmentId: null,
    activeGlobalEnvironmentId: null,
    activeRequestId: null,
    activeUnitTestSuiteId: null,
    gitRepositoryId: null,
    parentId: null,
    pushSnapshotOnInitialize: false,
    hasUncommittedChanges: false,
    hasUnpushedChanges: false,
  };
}

export function migrate(doc: WorkspaceMeta) {
  return doc;
}

export function create(patch: Partial<WorkspaceMeta> = {}) {
  if (!patch.parentId) {
    throw new Error(`New WorkspaceMeta missing parentId ${JSON.stringify(patch)}`);
  }

  return db.docCreate<WorkspaceMeta>(type, patch);
}

export function update(workspaceMeta: WorkspaceMeta, patch: Partial<WorkspaceMeta> = {}) {
  return db.docUpdate<WorkspaceMeta>(workspaceMeta, patch);
}

export async function updateByParentId(parentId: string, patch: Partial<WorkspaceMeta> = {}) {
  const meta = await getByParentId(parentId);
  // @ts-expect-error -- TSCONVERSION appears to be a genuine error not previously caught by Flow
  return db.docUpdate<WorkspaceMeta>(meta, patch);
}

export async function getByParentId(parentId: string) {
  return db.getWhere<WorkspaceMeta>(type, { parentId });
}

export async function getByGitRepositoryId(gitRepositoryId: string) {
  return db.getWhere<WorkspaceMeta>(type, { gitRepositoryId });
}

export async function getOrCreateByParentId(parentId: string) {
  const doc = await getByParentId(parentId);
  return doc || create({ parentId });
}

export function all() {
  return db.all<WorkspaceMeta>(type);
}
