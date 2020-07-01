// @flow
import type { BaseModel } from './index';
import * as db from '../common/database';
import {
  DEFAULT_SIDEBAR_WIDTH,
  DEFAULT_PANE_WIDTH,
  DEFAULT_PANE_HEIGHT,
} from '../common/constants';

export const name = 'Workspace Meta';
export const type = 'WorkspaceMeta';
export const prefix = 'wrkm';
export const canDuplicate = false;
export const canSync = false;

type BaseWorkspaceMeta = {
  activeActivity: string | null,
  activeEnvironmentId: string | null,
  activeRequestId: string | null,
  activeUnitTestSuiteId: string | null,
  cachedGitLastAuthor: string | null,
  cachedGitLastCommitTime: number | null,
  cachedGitRepositoryBranch: string | null,
  gitRepositoryId: string | null,
  hasSeen: boolean,
  paneHeight: number,
  paneWidth: number,
  previewHidden: boolean,
  sidebarFilter: string,
  sidebarHidden: boolean,
  sidebarWidth: number,
};

export type WorkspaceMeta = BaseWorkspaceMeta & BaseModel;

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
    previewHidden: false,
    sidebarFilter: '',
    sidebarHidden: false,
    sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
  };
}

export function migrate(doc: WorkspaceMeta): WorkspaceMeta {
  return doc;
}

export function create(patch: $Shape<WorkspaceMeta> = {}): Promise<WorkspaceMeta> {
  if (!patch.parentId) {
    throw new Error(`New WorkspaceMeta missing parentId ${JSON.stringify(patch)}`);
  }

  return db.docCreate(type, patch);
}

export function update(
  workspaceMeta: WorkspaceMeta,
  patch: $Shape<WorkspaceMeta> = {},
): Promise<WorkspaceMeta> {
  return db.docUpdate(workspaceMeta, patch);
}

export async function updateByParentId(
  workspaceId: string,
  patch: Object = {},
): Promise<WorkspaceMeta> {
  const meta = await getByParentId(workspaceId);
  return db.docUpdate(meta, patch);
}

export async function getByParentId(parentId: string): Promise<WorkspaceMeta | null> {
  return db.getWhere(type, { parentId });
}

export async function getByGitRepositoryId(gitRepositoryId: string): Promise<WorkspaceMeta | null> {
  return db.getWhere(type, { gitRepositoryId });
}

export async function getOrCreateByParentId(parentId: string): Promise<WorkspaceMeta> {
  const doc = await getByParentId(parentId);
  return doc || this.create({ parentId });
}

export function all(): Promise<Array<WorkspaceMeta>> {
  return db.all(type);
}
