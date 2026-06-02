import type { StorageRules } from 'insomnia-api';
import { generateId } from 'insomnia-data/common';

import type { BaseModel } from './base-types';

export const name = 'Project';
export const type = 'Project';
export const prefix = 'proj';
export const canDuplicate = false;
export const canSync = false;

export const SCRATCHPAD_PROJECT_ID = `${prefix}_scratchpad`;

// This is used to identify Git Projects that are not connected to a remote yet
export const EMPTY_GIT_PROJECT_ID = 'empty';

// Prefix used when encoding a GitRepository._id into gitRepositoryId for downgrade protection.
// The real GitRepository doc has _id = 'git_xxx'. We store 'gr_xxx' on the project so that the
// old app's getById('gr_xxx') returns null — preventing it from touching the git folder.
// The new app swaps the prefix back to recover the real ID.
export const PROTECTED_GIT_REPO_PREFIX = 'gr_';
const REAL_GIT_REPO_PREFIX = 'git_';

/**
 * Decode a raw gitRepositoryId string to the real GitRepository._id.
 * Handles both the protected ('gr_xxx') and legacy ('git_xxx') formats.
 */
export function decodeRepoId(id: string): string {
  if (id.startsWith(PROTECTED_GIT_REPO_PREFIX)) {
    return REAL_GIT_REPO_PREFIX + id.slice(PROTECTED_GIT_REPO_PREFIX.length);
  }
  return id;
}

/**
 * Given a connected GitProject, return the real GitRepository._id.
 * Returns null when the project is not connected (gitRepositoryId is 'empty').
 *
 * Handles two formats:
 *  - 'gr_xxx'  → protected (new format)  → returns 'git_xxx'
 *  - 'git_xxx' → legacy (pre-migration)  → returns 'git_xxx' as-is
 */
export function getEffectiveRepoId(project: GitProject): string | null {
  const id = project.gitRepositoryId;
  if (id === EMPTY_GIT_PROJECT_ID) return null;
  return decodeRepoId(id);
}

/**
 * Encode a real GitRepository._id ('git_xxx') into the protected format ('gr_xxx')
 * that is stored on the project's gitRepositoryId field.
 */
export function toProtectedRepoId(gitRepositoryId: string): string {
  if (gitRepositoryId.startsWith(REAL_GIT_REPO_PREFIX)) {
    return PROTECTED_GIT_REPO_PREFIX + gitRepositoryId.slice(REAL_GIT_REPO_PREFIX.length);
  }
  return gitRepositoryId; // already protected or unexpected format — pass through
}

/**
 * Return all values that may be stored in Project.gitRepositoryId for a given real
 * GitRepository._id, covering both legacy ('git_xxx') and protected ('gr_xxx') forms.
 * Use this when building DB queries that must match projects regardless of which
 * storage format they were written with.
 */
export function getQueryableGitRepositoryIds(gitRepositoryId: string): string[] {
  const realId = decodeRepoId(gitRepositoryId);
  const protectedId = toProtectedRepoId(realId);
  return Array.from(new Set([realId, protectedId]));
}

export function isEmptyGitProject(project: Project) {
  return project.gitRepositoryId === EMPTY_GIT_PROJECT_ID;
}

export function isConnectedGitProject(project: Project): project is GitProject {
  return isGitProject(project) && getEffectiveRepoId(project) !== null;
}

export const isScratchpadProject = (project: Pick<Project, '_id'>) => project._id === SCRATCHPAD_PROJECT_ID;
export const isLocalProject = (project: Pick<Project, 'remoteId'>): project is LocalProject =>
  project.remoteId === null;
export const isRemoteProject = (project: Pick<Project, 'remoteId'>): project is RemoteProject =>
  !isLocalProject(project);
export const isGitProject = (project: Project): project is GitProject =>
  'gitRepositoryId' in project && (project.gitRepositoryId !== null || isEmptyGitProject(project));
export const projectHasSettings = (project: Pick<Project, '_id'>) => !isScratchpadProject(project);

interface CommonProject {
  name: string;
  mcpStdioAccess?: boolean;
  konnectControlPlaneId?: string | null;
  konnectClusterType?: string | null;
}

export interface RemoteProject extends BaseModel, CommonProject {
  remoteId: string;
  gitRepositoryId: null;
}

export interface LocalProject extends BaseModel, CommonProject {
  remoteId: null;
  gitRepositoryId: null;
}

export interface GitProject extends BaseModel, CommonProject {
  gitRepositoryId: string;
  remoteId: null;
}

export type Project = LocalProject | RemoteProject | GitProject;

export const isProject = (model: Pick<BaseModel, 'type'>): model is Project => model.type === type;

export const isProjectId = (id: string | null) => id?.startsWith(`${prefix}_`);

export const optionalKeys = ['konnectControlPlaneId', 'konnectClusterType'];

export function init(): Partial<Project> {
  return {
    name: 'My Project',
    remoteId: null, // `null` is necessary for the model init logic to work properly
    gitRepositoryId: null,
    mcpStdioAccess: false,
  };
}

export function createId() {
  return generateId(prefix);
}

export function isDefaultOrganizationProject(project: Project) {
  // legacy remoteId = proj_team_xxx
  // new remoteId = proj_org_xxx
  return project.remoteId?.startsWith('proj_team') || project.remoteId?.startsWith('proj_org');
}

export const sortProjects = <T extends Project>(projects: T[]) => [
  ...projects.filter(project => isDefaultOrganizationProject(project)).sort((a, b) => a.name.localeCompare(b.name)),
  ...projects.filter(project => !isDefaultOrganizationProject(project)).sort((a, b) => a.name.localeCompare(b.name)),
];

export function getDefaultProjectStorageType(
  storageRules: StorageRules,
  project?: Project,
): 'local' | 'remote' | 'git' {
  // When the project exist. That means the user open the settings modal
  if (project) {
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
