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
  activeRequestId: string | null,
  activeEnvironmentId: string | null,
  activeActivity: string | null,
  sidebarFilter: string,
  sidebarHidden: boolean,
  previewHidden: boolean,
  sidebarWidth: number,
  paneWidth: number,
  paneHeight: number,
  hasSeen: boolean,
  kongPortalRbacToken: string,
  kongPortalApiUrl: string,
  kongPortalUrl: string,
  kongPortalUserWorkspace: string,
  gitRepositoryId: string | null,
  cachedGitRepositoryBranch: string | null,
  cachedGitLastAuthor: string | null,
  cachedGitLastCommitTime: number | null,
};

export type WorkspaceMeta = BaseWorkspaceMeta & BaseModel;

export function init(): BaseWorkspaceMeta {
  return {
    parentId: null,
    activeRequestId: null,
    activeEnvironmentId: null,
    activeActivity: null,
    sidebarFilter: '',
    sidebarHidden: false,
    previewHidden: false,
    sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
    paneWidth: DEFAULT_PANE_WIDTH,
    paneHeight: DEFAULT_PANE_HEIGHT,
    hasSeen: true,
    kongPortalRbacToken: '',
    kongPortalApiUrl: '',
    kongPortalUrl: '',
    kongPortalUserWorkspace: '',
    gitRepositoryId: null,
    cachedGitRepositoryBranch: null,
    cachedGitLastAuthor: null,
    cachedGitLastCommitTime: null,
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

export async function updateByParentId(workspaceId: string, patch: Object = {}): Promise<WorkspaceMeta> {
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
