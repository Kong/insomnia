import type { BaseModel } from '~/models/types';

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
  gitFilePath: string | null;
}

export type WorkspaceMeta = BaseWorkspaceMeta & BaseModel;

export const isWorkspaceMeta = (model: Pick<BaseModel, 'type'>): model is WorkspaceMeta => model.type === type;

export function init(): BaseWorkspaceMeta {
  return {
    activeActivity: null,
    activeEnvironmentId: null,
    activeGlobalEnvironmentId: null,
    activeRequestId: null,
    activeUnitTestSuiteId: null,
    gitRepositoryId: null,
    gitFilePath: null,
    parentId: null,
    pushSnapshotOnInitialize: false,
    hasUncommittedChanges: false,
    hasUnpushedChanges: false,
  };
}
