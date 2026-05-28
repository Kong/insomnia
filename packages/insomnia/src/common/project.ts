import { parseApiSpec, type ParsedApiSpec } from '~/common/api-specs';
import { scopeToLabelMap } from '~/common/get-workspace-label';
import { isNotNullOrUndefined } from '~/common/misc';
import { descendingNumberSort } from '~/common/sorting';
import {
  type ApiSpec,
  database,
  type GitRepository,
  type GrpcRequest,
  type MockServer,
  models,
  type Project,
  type Request,
  services,
  type SocketIORequest,
  type WebSocketRequest,
  type Workspace,
  type WorkspaceMeta,
  type WorkspaceScope,
} from '~/insomnia-data';

export interface InsomniaFile {
  id: string;
  name: string;
  remoteId?: string;
  scope: WorkspaceScope | 'unsynced';
  label: 'Document' | 'Collection' | 'Mock Server' | 'Unsynced' | 'Environment' | 'MCP Client';
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
    return new Promise<void>(resolve => {
      lockQueue.push(resolve);
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
      await lock();
      try {
        return await fn(...args);
      } finally {
        await unlock();
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

type TrackableRecentRequest = Request | WebSocketRequest | GrpcRequest | SocketIORequest;

export interface RecentProjectRequest {
  workspaceId: string;
  request: TrackableRecentRequest;
}

interface CachedProjectRecentRequest {
  requestId: string;
  workspaceId: string;
}

// Keep a small buffer beyond the 3 visible items so Jump back in stays populated after deletions.
const MAX_RECENT_PROJECT_REQUESTS = 5;
const RECENT_PROJECT_REQUESTS_STORAGE_KEY_PREFIX = 'recent-project-requests';

const getRecentProjectRequestsStorageKey = (projectId: string) =>
  `${RECENT_PROJECT_REQUESTS_STORAGE_KEY_PREFIX}:${projectId}`;

const writeCachedProjectRecentRequests = (projectId: string, recentRequests: CachedProjectRecentRequest[]) => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  const trimmedRecentRequests = recentRequests.slice(0, MAX_RECENT_PROJECT_REQUESTS);

  const storageKey = getRecentProjectRequestsStorageKey(projectId);

  if (trimmedRecentRequests.length === 0) {
    window.localStorage.removeItem(storageKey);
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(trimmedRecentRequests));
};

export const getCachedProjectRecentRequests = (projectId?: string): CachedProjectRecentRequest[] => {
  if (!projectId || typeof window === 'undefined' || !window.localStorage) {
    return [];
  }

  try {
    const storedRequestIds = window.localStorage.getItem(getRecentProjectRequestsStorageKey(projectId));

    if (!storedRequestIds) {
      return [];
    }

    const parsedRequestIds = JSON.parse(storedRequestIds);

    if (!Array.isArray(parsedRequestIds)) {
      return [];
    }

    return parsedRequestIds as CachedProjectRecentRequest[];
  } catch {
    return [];
  }
};

export const recordProjectRecentRequest = ({
  projectId,
  requestId,
  workspaceId,
}: {
  projectId: string;
  requestId: string;
  workspaceId: string;
}) => {
  if (!projectId || !requestId || !workspaceId) {
    return;
  }

  const existingRecentRequests = getCachedProjectRecentRequests(projectId);
  writeCachedProjectRecentRequests(projectId, [
    { requestId, workspaceId },
    ...existingRecentRequests.filter(storedRequest => storedRequest.requestId !== requestId),
  ]);
};

export const getProjectRecentRequests = async (projectId?: string) => {
  const cachedRecentRequests = getCachedProjectRecentRequests(projectId);

  if (!projectId || cachedRecentRequests.length === 0) {
    return [];
  }

  const recentRequests = (
    await Promise.all(
      cachedRecentRequests.map(async ({ requestId, workspaceId }): Promise<RecentProjectRequest | null> => {
        try {
          const request = (await services.helpers.getRequestById(requestId)) as TrackableRecentRequest | null;

          if (!request) {
            return null;
          }

          return {
            workspaceId,
            request,
          };
        } catch {
          return null;
        }
      }),
    )
  ).filter(isNotNullOrUndefined);

  return recentRequests;
};

export const checkSingleProjectSyncStatus = async (projectId: string) => {
  const projectWorkspaces = await services.workspace.findByParentId(projectId);
  const workspaceMetas = await database.find<WorkspaceMeta>(models.workspaceMeta.type, {
    parentId: {
      $in: projectWorkspaces.map(w => w._id),
    },
  });
  return workspaceMetas.some(item => item.hasUncommittedChanges || item.hasUnpushedChanges);
};

export const checkAllProjectSyncStatus = async (projects: Project[]) => {
  const taskList = projects.map(project => checkSingleProjectSyncStatus(project._id));
  const res = await Promise.all(taskList);
  const obj: Record<string, boolean> = {};
  projects.forEach((project, index) => {
    obj[project._id] = res[index];
  });
  return obj;
};

export async function getAllLocalFiles({ projectId }: { projectId: string }) {
  const projectWorkspaces = await services.workspace.findByParentId(projectId);
  const [workspaceMetas, apiSpecs, mockServers] = await Promise.all([
    database.find<WorkspaceMeta>(models.workspaceMeta.type, {
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

export const getAllRemoteBackendProjectsByProjectId = async ({
  teamProjectId,
  organizationId,
}: {
  teamProjectId: string;
  organizationId: string;
}) => {
  return window.main.sync.remoteBackendProjects({ teamId: organizationId, teamProjectId });
};

export const getUnsyncedRemoteWorkspaces = (remoteFiles: InsomniaFile[], workspaces: Workspace[]) =>
  remoteFiles.filter(remoteFile => !workspaces.find(w => w._id === remoteFile.id));

export async function getAllRemoteFiles({ projectId, organizationId }: { projectId: string; organizationId: string }) {
  try {
    const project = await services.project.get(projectId);

    const remoteId = project?.remoteId;
    if (!remoteId) {
      return [];
    }

    console.log(
      '[getAllRemoteFiles] start fetching remote backend workspaces for project',
      projectId,
      `remoteId: ${remoteId}`,
    );

    const [allPulledBackendProjectsForRemoteId, allFetchedRemoteBackendProjectsForRemoteId] = await Promise.all([
      window.main.sync.localBackendProjects().then(projects => projects.filter(p => p.id === remoteId)),
      // Remote backend projects are fetched from the backend since they are not stored locally
      window.main.sync.remoteBackendProjects({ teamId: organizationId, teamProjectId: remoteId }),
    ]);
    console.log(
      `[getAllRemoteFiles] found allPulledBackendProjectsForRemoteId: ${allPulledBackendProjectsForRemoteId.length} and allFetchedRemoteBackendProjectsForRemoteId: ${allFetchedRemoteBackendProjectsForRemoteId.length} for remoteId: ${remoteId}`,
    );
    // Get all workspaces that are connected to backend projects and under the current project
    const workspacesWithBackendProjects = await database.find<Workspace>(models.workspace.type, {
      _id: {
        $in: [...allPulledBackendProjectsForRemoteId, ...allFetchedRemoteBackendProjectsForRemoteId].map(
          p => p.rootDocumentId,
        ),
      },
      parentId: project._id,
    });
    console.log(`[getAllRemoteFiles] found workspacesWithBackendProjects: ${workspacesWithBackendProjects.length}`);
    // Get the list of remote backend projects that we need to pull
    const backendProjectsToPull = allFetchedRemoteBackendProjectsForRemoteId.filter(
      p => !workspacesWithBackendProjects.find(w => w._id === p.rootDocumentId),
    );
    console.log(`[getAllRemoteFiles] get ${backendProjectsToPull.length} unsynced files`);
    return backendProjectsToPull.map(backendProject => {
      const file: InsomniaFile = {
        id: backendProject.rootDocumentId,
        name: backendProject.name,
        scope: 'unsynced',
        label: 'Unsynced',
        remoteId: backendProject.id,
        created: 0,
        lastModifiedTimestamp: 0,
      };

      return file;
    });
  } catch (e) {
    console.warn('Failed to load backend projects', e);
  }

  return [];
}

/**
 * Get all projects for an organization with their associated git repositories
 */
export async function getProjectsWithGitRepositories({
  organizationId,
}: {
  organizationId: string;
}): Promise<(Project & { gitRepository?: GitRepository })[]> {
  const projects = await database.find<Project>('Project', {
    parentId: organizationId,
  });

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
