import {
  DEFAULT_PANE_HEIGHT,
  DEFAULT_PANE_WIDTH,
  DEFAULT_SIDEBAR_WIDTH,
} from '../common/constants';
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
  activeRequestId: string | null;
  activeUnitTestSuiteId: string | null;
  cachedGitLastAuthor: string | null;
  cachedGitLastCommitTime: number | null;
  cachedGitRepositoryBranch: string | null;
  gitRepositoryId: string | null;
  hasSeen: boolean;
  paneHeight: number;
  paneWidth: number;
  parentId: string | null;
  sidebarFilter: string;
  sidebarHidden: boolean;
  sidebarWidth: number;
  pushSnapshotOnInitialize: boolean;
}

export type WorkspaceMeta = BaseWorkspaceMeta & BaseModel;

export const isWorkspaceMeta = (model: Pick<BaseModel, 'type'>): model is WorkspaceMeta => (
  model.type === type
);

export function init(): BaseWorkspaceMeta {
  return {
    activeActivity: null,
    activeEnvironmentId: null,
    activeRequestId: null,
    activeUnitTestSuiteId: null,
    cachedGitLastAuthor: null,
    cachedGitLastCommitTime: null,
    cachedGitRepositoryBranch: null,
    gitRepositoryId: null,
    hasSeen: true,
    paneHeight: DEFAULT_PANE_HEIGHT,
    paneWidth: DEFAULT_PANE_WIDTH,
    parentId: null,
    sidebarFilter: '',
    sidebarHidden: false,
    sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
    pushSnapshotOnInitialize: false,
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
  // @ts-expect-error -- TSCONVERSION needs generic for query
  return db.getWhere<WorkspaceMeta>(type, { gitRepositoryId });
}

export async function getOrCreateByParentId(parentId: string) {
  const doc = await getByParentId(parentId);
  return doc || create({ parentId });
}

export function all() {
  return db.all<WorkspaceMeta>(type);
}
