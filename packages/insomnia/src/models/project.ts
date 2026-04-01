import type { StorageRules } from 'insomnia-api';

import { database as db } from '../common/database';
import { generateId } from '../common/misc';
import type { BaseModel } from './types';

export const name = 'Project';
export const type = 'Project';
export const prefix = 'proj';
export const canDuplicate = false;
export const canSync = false;

export const SCRATCHPAD_PROJECT_ID = `${prefix}_scratchpad`;

// This is used to identify Git Projects that are not connected to a remote yet
export const EMPTY_GIT_PROJECT_ID = 'empty';

export function isEmptyGitProject(project: Project) {
  return project.gitRepositoryId === EMPTY_GIT_PROJECT_ID;
}

export const isScratchpadProject = (project: Pick<Project, '_id'>) => project._id === SCRATCHPAD_PROJECT_ID;
export const isLocalProject = (project: Pick<Project, 'remoteId'>): project is LocalProject =>
  project.remoteId === null;
export const isRemoteProject = (project: Pick<Project, 'remoteId'>): project is RemoteProject =>
  !isLocalProject(project);
export const isDirectoryProject = (project: Pick<Project, 'directoryPath'>): project is DirectoryProject =>
  typeof project.directoryPath === 'string' && project.directoryPath.trim().length > 0;
export const isGitProject = (project: Project): project is GitProject =>
  'gitRepositoryId' in project && (project.gitRepositoryId !== null || isEmptyGitProject(project));
export const projectHasSettings = (project: Pick<Project, '_id'>) => !isScratchpadProject(project);

interface CommonProject {
  directoryPath: string | null;
  name: string;
  mcpStdioAccess?: boolean;
}

export interface RemoteProject extends BaseModel, CommonProject {
  remoteId: string;
  gitRepositoryId: null;
  directoryPath: null;
}

export interface LocalProject extends BaseModel, CommonProject {
  remoteId: null;
  gitRepositoryId: null;
  directoryPath: null;
}

export interface DirectoryProject extends BaseModel, CommonProject {
  remoteId: null;
  gitRepositoryId: null;
  directoryPath: string;
}

export interface GitProject extends BaseModel, CommonProject {
  gitRepositoryId: string;
  remoteId: null;
  directoryPath: null;
}

export type Project = LocalProject | DirectoryProject | RemoteProject | GitProject;
export type ProjectStorageType = 'local' | 'directory' | 'remote' | 'git';

export const isProject = (model: Pick<BaseModel, 'type'>): model is Project => model.type === type;

export const isProjectId = (id: string | null) => id?.startsWith(`${prefix}_`);

export function init(): Partial<Project> {
  return {
    name: 'My Project',
    directoryPath: null,
    remoteId: null, // `null` is necessary for the model init logic to work properly
    gitRepositoryId: null,
    mcpStdioAccess: false,
  };
}

export function migrate(project: Project) {
  return project;
}

export function createId() {
  return generateId(prefix);
}

export function create(patch: Partial<Project> = {}) {
  return db.docCreate<Project>(type, patch);
}

export function getById(_id: string) {
  return db.findOne<Project>(type, { _id });
}

export function getByRemoteId(remoteId: string) {
  return db.findOne<Project>(type, { remoteId });
}

export function getAllByGitRepositoryIds(gitRepositoryIds: string[]) {
  return db.find<Project>(type, {
    gitRepositoryId: { $in: gitRepositoryIds },
  });
}

export function remove(project: Project) {
  return db.remove(project);
}

export function update(project: Project, patch: Partial<Project>) {
  return db.docUpdate(project, patch);
}

export async function all() {
  const projects = await db.find<Project>(type);
  return projects;
}

export function isDefaultOrganizationProject(project: Project) {
  // legacy remoteId = proj_team_xxx
  // new remoteId = proj_org_xxx
  return project.remoteId?.startsWith('proj_team') || project.remoteId?.startsWith('proj_org');
}

export function getProjectStorageType(project: Project): ProjectStorageType {
  if (isGitProject(project)) {
    return 'git';
  }

  if (isRemoteProject(project)) {
    return 'remote';
  }

  if (isDirectoryProject(project)) {
    return 'directory';
  }

  return 'local';
}

export function getDefaultProjectStorageType(storageRules: StorageRules, project?: Project): ProjectStorageType {
  // When the project exist. That means the user open the settings modal
  if (project) {
    if (isDirectoryProject(project)) {
      if (storageRules.enableLocalVault) {
        return 'directory';
      }
      if (storageRules.enableCloudSync) {
        return 'remote';
      }
      return 'git';
    }

    if (isGitProject(project)) {
      if (storageRules.enableGitSync) {
        return 'git';
      }
      if (storageRules.enableLocalVault) {
        return 'local';
      }
      return 'remote';
    }

    if (isRemoteProject(project)) {
      if (storageRules.enableCloudSync) {
        return 'remote';
      }
      if (storageRules.enableLocalVault) {
        return 'local';
      }
      return 'git';
    }

    if (storageRules.enableLocalVault) {
      return 'local';
    }

    if (storageRules.enableCloudSync) {
      return 'remote';
    }

    return 'git';
  }

  // When the project doesn't exist. That means the user create a new project
  if (storageRules.enableLocalVault) {
    return 'local';
  }

  if (storageRules.enableCloudSync) {
    return 'remote';
  }

  if (storageRules.enableGitSync) {
    return 'git';
  }

  return 'local';
}

export function getProjectStorageTypeLabel(storageRules: StorageRules): string {
  const storageTypes = {
    'Local Directory': storageRules.enableLocalVault,
    'Cloud Sync': storageRules.enableCloudSync,
    'Local Vault': storageRules.enableLocalVault,
    'Git Sync': storageRules.enableGitSync,
  };

  const allowedStorageTypes = Object.entries(storageTypes)
    .filter(([, enabled]) => enabled)
    .map(([label]) => label);

  // Join with ", " but use "and" before the last item
  return allowedStorageTypes.length
    ? allowedStorageTypes.join(', ').replace(/, ([^,]+)$/, ' and $1')
    : 'No storage types selected';
}
