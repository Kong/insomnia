import {
  type ApiSpec,
  database,
  type GitRepository,
  type MockServer,
  models,
  type Project,
  services,
  type Workspace,
  type WorkspaceScope,
} from 'insomnia-data';

import { parseApiSpec, type ParsedApiSpec } from '~/common/api-specs';
import { scopeToLabelMap } from '~/common/get-workspace-label';
import { isNotNullOrUndefined } from '~/common/misc';
import { descendingNumberSort } from '~/common/sorting';

export interface InsomniaFile {
  id: string;
  name: string;
  remoteId?: string;
  scope: WorkspaceScope | 'unsynced';
  label: 'Document' | 'API Collection' | 'Mock Server' | 'Unsynced' | 'Environment' | 'MCP Client';
  created: number;
  lastModifiedTimestamp: number;
  branch?: string;
  lastCommit?: string;
  version?: string;
  oasFormat?: string;
  mockServer?: MockServer;
  workspace?: Workspace;
  apiSpec?: ApiSpec;
  hasUncommittedChanges?: boolean;
  hasUnpushedChanges?: boolean;
  gitFilePath?: string | null;
  fileIssue?: {
    kind: 'conflict' | 'parse-error';
    message: string;
  };
}

// How long a caller will wait in queue for the lock before giving up. Without
// this, a slow or stuck lock holder (e.g. a background project sync) blocks
// every other queued operation (e.g. creating a project) indefinitely, with
// no error surfaced to the user.
const LOCK_ACQUIRE_TIMEOUT_MS = 15_000;

const lockGenerator = () => {
  // Simple mutex lock implementation
  let isLocked = false;
  const lockQueue: (() => void)[] = [];

  const lock = async () => {
    if (!isLocked) {
      isLocked = true;
      return;
    }

    // If already locked, wait in queue
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = lockQueue.indexOf(onUnlocked);
        if (index !== -1) {
          lockQueue.splice(index, 1);
        }
        reject(new Error('Timed out waiting for another project operation to finish. Please try again.'));
      }, LOCK_ACQUIRE_TIMEOUT_MS);

      const onUnlocked = () => {
        clearTimeout(timer);
        resolve();
      };
      lockQueue.push(onUnlocked);
    });
  };

  const unlock = async () => {
    if (lockQueue.length > 0) {
      // Process next in queue
      const nextResolve = lockQueue.shift();
      nextResolve?.();
    } else {
      // No one waiting, release lock
      isLocked = false;
    }
  };

  const wrapWithLock = <T extends (...args: any[]) => Promise<any>>(fn: T): T => {
    const wrappedFn = async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      // TEMP DIAGNOSTIC: timing breakdown to root-cause the intermittent
      // "Create project" hang seen in CI (see insomnia PR #10556). Remove
      // once the real bottleneck is identified from CI console-log output.
      const callId = Math.random().toString(36).slice(2, 8);
      const waitStart = Date.now();
      console.log(`[lock-timing] ${callId} waiting for lock`);
      await lock();
      const waitMs = Date.now() - waitStart;
      console.log(`[lock-timing] ${callId} acquired lock after ${waitMs}ms`);
      try {
        const runStart = Date.now();
        const result = await fn(...args);
        console.log(`[lock-timing] ${callId} fn() finished after ${Date.now() - runStart}ms (holding lock)`);
        return result;
      } finally {
        await unlock();
        console.log(`[lock-timing] ${callId} released lock`);
      }
    };
    return wrappedFn as T;
  };

  return { wrapWithLock, lock, unlock };
};

// All project write operations should be wrapped with this lock,
// otherwise they may interfere with each other, which may cause duplicate projects or other inconsistencies.
// TODO: move all project operations to this file to ensure they are properly wrapped with locks
export const projectLock = lockGenerator();

export const checkSingleProjectSyncStatus = async (projectId: string) => {
  const projectWorkspaces = await services.workspace.listByParentId(projectId);
  const workspaceMetas = await services.workspaceMeta.list({
    parentId: {
      $in: projectWorkspaces.map(w => w._id),
    },
  });
  return workspaceMetas.some(item => item.hasUncommittedChanges || item.hasUnpushedChanges);
};

const isNotSyncProject = (project: Project) =>
  models.project.isLocalProject(project) && !models.project.isGitProject(project);

export const checkAllProjectSyncStatus = async (projects: Project[]) => {
  const taskList = projects.map(project =>
    isNotSyncProject(project) ? Promise.resolve(false) : checkSingleProjectSyncStatus(project._id),
  );
  const res = await Promise.all(taskList);
  const obj: Record<string, boolean> = {};
  projects.forEach((project, index) => {
    obj[project._id] = res[index];
  });
  return obj;
};

export async function getAllLocalFiles({ projectId }: { projectId: string }) {
  const projectWorkspaces = await services.workspace.listByParentId(projectId);
  const [workspaceMetas, apiSpecs, mockServers] = await Promise.all([
    services.workspaceMeta.list({
      parentId: {
        $in: projectWorkspaces.map(w => w._id),
      },
    }),
    database.find<ApiSpec>(models.apiSpec.type, {
      parentId: {
        $in: projectWorkspaces.map(w => w._id),
      },
    }),
    database.find<MockServer>(models.mockServer.type, {
      parentId: {
        $in: projectWorkspaces.map(w => w._id),
      },
    }),
  ]);

  const gitRepositories = await database.find<GitRepository>(models.gitRepository.type, {
    parentId: {
      $in: workspaceMetas.map(wm => wm.gitRepositoryId).filter(isNotNullOrUndefined),
    },
  });

  const files: InsomniaFile[] = projectWorkspaces.map(workspace => {
    const apiSpec = apiSpecs.find(spec => spec.parentId === workspace._id);
    const mockServer = mockServers.find(mock => mock.parentId === workspace._id);
    let spec: ParsedApiSpec['contents'] = null;
    let specFormat: ParsedApiSpec['format'] = null;
    let specFormatVersion: ParsedApiSpec['formatVersion'] = null;
    if (apiSpec) {
      try {
        const result = parseApiSpec(apiSpec.contents);
        spec = result.contents;
        specFormat = result.format;
        specFormatVersion = result.formatVersion;
      } catch {
        // Assume there is no spec
        // TODO: Check for parse errors if it's an invalid spec
      }
    }
    const workspaceMeta = workspaceMetas.find(wm => wm.parentId === workspace._id);
    const gitRepository = gitRepositories.find(gr => gr._id === workspaceMeta?.gitRepositoryId);

    const lastActiveBranch = gitRepository?.cachedGitRepositoryBranch;

    const lastCommitAuthor = gitRepository?.cachedGitLastAuthor;

    // WorkspaceMeta is a good proxy for last modified time
    const workspaceModified = workspaceMeta?.modified || workspace.modified;

    const modifiedLocally = models.workspace.isDesign(workspace) ? apiSpec?.modified || 0 : workspaceModified;

    // Span spec, workspace and sync related timestamps for card last modified label and sort order
    const lastModifiedFrom = [
      workspace?.modified,
      workspaceMeta?.modified,
      modifiedLocally,
      gitRepository?.cachedGitLastCommitTime,
    ];

    const lastModifiedTimestamp = lastModifiedFrom.filter(isNotNullOrUndefined).sort(descendingNumberSort)[0];

    const hasUnsavedChanges = Boolean(
      models.workspace.isDesign(workspace) &&
        gitRepository?.cachedGitLastCommitTime &&
        modifiedLocally > gitRepository?.cachedGitLastCommitTime,
    );

    const specVersion = spec?.info?.version ? String(spec?.info?.version) : '';

    return {
      id: workspace._id,
      name: workspace.name,
      scope: workspace.scope,
      label: scopeToLabelMap[workspace.scope],
      created: workspace.created,
      lastModifiedTimestamp:
        (hasUnsavedChanges && modifiedLocally) || gitRepository?.cachedGitLastCommitTime || lastModifiedTimestamp,
      branch: lastActiveBranch || '',
      lastCommit:
        hasUnsavedChanges && gitRepository?.cachedGitLastCommitTime && lastCommitAuthor ? `by ${lastCommitAuthor}` : '',
      version: specVersion ? `${specVersion?.startsWith('v') ? '' : 'v'}${specVersion}` : '',
      oasFormat: specFormat ? `${specFormat === 'openapi' ? 'OpenAPI' : 'Swagger'} ${specFormatVersion || ''}` : '',
      mockServer,
      apiSpec,
      workspace,
      hasUncommittedChanges: workspaceMeta?.hasUncommittedChanges,
      hasUnpushedChanges: workspaceMeta?.hasUnpushedChanges,
      gitFilePath: workspaceMeta?.gitFilePath,
    };
  });
  return files;
}

export const getUnsyncedRemoteWorkspaces = (remoteFiles: InsomniaFile[], workspaces: Workspace[]) => {
  const seenIds = new Set<string>();
  const uniqueRemoteFiles = remoteFiles.filter(file => {
    if (seenIds.has(file.id)) {
      console.warn(
        `[Duplicate Remote File] Duplicate remote file found with id: ${file.id} and remote id: ${file.remoteId}`,
      );
      return false;
    }
    seenIds.add(file.id);
    return true;
  });

  return uniqueRemoteFiles.filter(remoteFile => !workspaces.some(w => w._id === remoteFile.id));
};

/**
 * Get all projects for an organization with their associated git repositories
 */
export async function getProjectsWithGitRepositories({
  organizationId,
}: {
  organizationId: string;
}): Promise<(Project & { gitRepository?: GitRepository })[]> {
  const projects = await services.project.listByOrganizationIds(organizationId);

  const gitRepositoryIds = projects
    .map(p => (models.project.isConnectedGitProject(p) ? models.project.getEffectiveRepoId(p) : null))
    .filter(isNotNullOrUndefined);
  const gitRepositories = await database.find<GitRepository>('GitRepository', {
    _id: {
      $in: gitRepositoryIds,
    },
  });

  return projects.map(project => {
    const effectiveId = models.project.isConnectedGitProject(project)
      ? models.project.getEffectiveRepoId(project)
      : null;
    const gitRepository = gitRepositories.find(gr => gr._id === effectiveId);
    return {
      ...project,
      gitRepository,
    };
  });
}

export const syncProjects = projectLock.wrapWithLock(async (organizationId: string) => {
  await services.project.syncProjects(organizationId);
});
