/**
 * Git Service - Main Git Operations Handler
 *
 * This module provides the main Git service for Insomnia, handling all Git operations
 * including cloning, pushing, pulling, branching, and merging. It integrates with
 * isomorphic-git to provide Git functionality within the Electron app.
 *
 * Key responsibilities:
 * - Repository management (clone, init, update, reset)
 * - Branch operations (create, checkout, merge, delete)
 * - Sync operations (push, pull, fetch)
 * - OAuth integration with GitHub and GitLab
 * - Legacy migration support
 *
 */
import fs from 'node:fs';
import path from 'node:path';

import { app, BrowserWindow } from 'electron/main';
import { fromUrl } from 'hosted-git-info';
import type {
  BaseModel,
  GitProject,
  GitRemoteProviderType,
  GitRepository,
  Workspace,
  WorkspaceMeta,
  WorkspaceScope,
} from 'insomnia-data';
import { models, services } from 'insomnia-data';
import { Errors, type PromiseFsClient } from 'isomorphic-git';
import YAML, { parse } from 'yaml';

import { invariant } from '~/common/utils/invariant';
import { GitVCSOperationErrors } from '~/sync/git/git-vcs-operation-errors';
import {
  gitRemoteProviderRegistry,
  initializeGitRemoteProviders,
  type ProviderEmail,
  type ProviderRepository,
} from '~/sync/git/providers';
import type { FileIssue, FileIssueKind } from '~/sync/git/repo-file-watcher';

import { INSOMNIA_GITLAB_API_URL } from '../common/constants';
import { database } from '../common/database';
import { InsomniaFileSchema, InsomniaFileTypeValues } from '../common/import-v5-parser';
import { migrateToLatestYaml } from '../common/insomnia-schema-migrations';
import { insomniaSchemaTypeToScope } from '../common/insomnia-v5';
import { fsClient } from '../sync/git/fs-client';
import { CURRENT_MIGRATION_VERSION, migrateRepoStructureIfNeeded } from '../sync/git/git-repo-migration';
import GitVCS, {
  fetchRemoteBranches,
  GIT_CLONE_DIR,
  GIT_INSOMNIA_DIR,
  GIT_INSOMNIA_DIR_NAME,
  GIT_INTERNAL_DIR,
  type GitFileStatus,
  type GitFileStatusSymbol,
  GitVCS as GitVCSClass,
  MergeConflictError,
  type Status,
} from '../sync/git/git-vcs';
import { MemClient } from '../sync/git/mem-client';
import { NeDBClient } from '../sync/git/ne-db-client';
import { projectRoutableFSClient } from '../sync/git/project-routable-fs-client';
import { RepoFileWatcherRegistry, type WatcherNotifier } from '../sync/git/repo-file-watcher';
import { routableFSClient } from '../sync/git/routable-fs-client';
import { shallowClone } from '../sync/git/shallow-clone';
import type { AutoResolvedConflict, MergeConflict } from '../sync/types';
import { AnalyticsEvent, trackAnalyticsEvent } from './analytics';
import { ipcMainHandle } from './ipc/electron';

// Initialize Git Remote Providers on module load
initializeGitRemoteProviders();

/**
 * Set of repo IDs for which conflict problems should be suppressed in the
 * file-problems-changed IPC broadcast.  Active while the user is resolving
 * conflicts via SyncMergeModal so the generic "CLI conflict" blocking modal
 * does not appear on top of the interactive resolver.
 */
const suppressedConflictRepos = new Set<string>();

function createElectronNotifier(): WatcherNotifier {
  return {
    onDbSynced: () => {
      for (const w of BrowserWindow.getAllWindows()) {
        w.webContents.send('git.db-synced');
      }
    },
    onProblemsChanged: payload => {
      for (const w of BrowserWindow.getAllWindows()) {
        w.webContents.send('git.file-problems-changed', payload);
      }
    },
  };
}

const _electronNotifier = createElectronNotifier();
const conflictFilteringNotifier: WatcherNotifier = {
  onDbSynced: () => _electronNotifier.onDbSynced(),
  onProblemsChanged: payload => {
    _electronNotifier.onProblemsChanged({
      ...payload,
      conflictsSuppressed: suppressedConflictRepos.has(payload.repoId),
    });
  },
};

const repoFileWatcherRegistry = new RepoFileWatcherRegistry(conflictFilteringNotifier);

function suppressConflictProblems(repoId: string): void {
  suppressedConflictRepos.add(repoId);
}

function clearConflictSuppression(repoId: string): void {
  suppressedConflictRepos.delete(repoId);
}

type PushPull = 'push' | 'pull';
type VCSAction =
  | PushPull
  | `force_${PushPull}`
  | 'create_branch'
  | 'merge_branch'
  | 'delete_branch'
  | 'checkout_branch'
  | 'commit'
  | 'stage_all'
  | 'stage'
  | 'unstage_all'
  | 'unstage'
  | 'rollback'
  | 'rollback_all'
  | 'update'
  | 'setup'
  | 'clone';

/**
 * Converts various error types into user-friendly error messages
 * Handles network errors, Git-specific errors, and unknown errors
 *
 * @param error - The error object to convert
 * @returns A user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message || '';

    // Check for network-related errors.
    if (
      message.includes('net::ERR_UNEXPECTED') ||
      message.includes('net::ERR_INTERNET_DISCONNECTED') ||
      message.includes('net::ERR_NAME_NOT_RESOLVED')
    ) {
      return 'A network error occurred.';
    }

    // Isomorphic-git return this error when it cannot find the remote branch
    // TODO: Handle this error more gracefully
    if (message.includes("Cannot read properties of null (reading 'length')")) {
      return 'Cannot find remote branch.';
    }

    // Default fallback
    return message;
  }

  // Non-Error objects
  return 'Unknown Error';
}
export function vcsEventProperties(type: 'git', action: VCSAction, error?: string) {
  return { type, action, error };
}

export interface WorkspaceFileIssue {
  workspaceId: string;
  gitRepositoryId: string;
  relPath: string;
  kind: FileIssueKind;
  message: string;
}

interface GetProjectGitFileIssuesOptions {
  projectId: string;
  workspaceId?: string;
  gitRepositoryId?: string;
}

/**
 * Converts various Git URL formats to HTTPS URLs
 * Handles SSH URLs, Git URLs, and self-hosted Git servers
 *
 * @param s - The Git URL to convert
 * @returns The converted HTTPS URL
 */
export function parseGitToHttpsURL(url: string) {
  // try to convert any git URL to https URL
  let parsed = fromUrl(url)?.https({ noGitPlus: true }) || '';

  // fallback for self-hosted git servers, see https://github.com/Kong/insomnia/issues/5967
  // and https://github.com/npm/hosted-git-info/issues/11
  if (parsed === '') {
    let tempURL = url;
    // handle "shorter scp-like syntax"
    tempURL = tempURL.replace(/^git@([^:]+):/, 'https://$1/');
    // handle proper SSH URLs
    tempURL = tempURL.replace(/^ssh:\/\//, 'https://');

    // final URL fallback for any other git URL
    tempURL = (URL.canParse(tempURL) ? URL.parse(tempURL)?.href : url) || '';
    parsed = tempURL;
  }

  return parsed;
}

async function getGitRepository({ projectId, workspaceId }: { projectId: string; workspaceId?: string }) {
  if (workspaceId) {
    const workspace = await services.workspace.getById(workspaceId);
    invariant(workspace, 'Workspace not found');
    const workspaceMeta = await services.workspaceMeta.getByParentId(workspaceId);
    invariant(workspaceMeta, 'Workspace meta not found');
    if (!workspaceMeta.gitRepositoryId) {
      throw new Error('Workspace is not linked to a git repository');
    }

    const gitRepository = await services.gitRepository.getById(workspaceMeta.gitRepositoryId);
    invariant(gitRepository, 'Git Repository not found');

    return gitRepository;
  }

  invariant(projectId, 'Project ID is required');
  const project = await services.project.get(projectId);
  invariant(project, 'Project not found');
  invariant(models.project.isConnectedGitProject(project), 'Project is not linked to a git repository');
  const repoId = models.project.getEffectiveRepoId(project);
  invariant(repoId, 'Project is not linked to a git repository');
  const gitRepository = await services.gitRepository.getById(repoId);
  invariant(gitRepository, 'Git Repository not found');
  return gitRepository;
}

function toPosixRelPath(relPath: string) {
  return relPath.split(path.sep).join(path.posix.sep);
}

async function getProjectWorkspacesWithMeta(projectId: string) {
  const workspaces = await services.workspace.findByParentId(projectId);
  const metas = await Promise.all(
    workspaces.map(async workspace => ({
      workspace,
      meta: await services.workspaceMeta.getByParentId(workspace._id),
    })),
  );

  return metas;
}

export function mapWorkspaceFileIssues({
  issues,
  repoId,
  metas,
  workspaceId,
}: {
  issues: FileIssue[];
  repoId: string;
  metas: { workspace: Workspace; meta: WorkspaceMeta | null | undefined }[];
  workspaceId?: string;
}) {
  const relPathToWorkspaceId = new Map<string, string>();

  for (const { workspace, meta } of metas) {
    if (workspaceId && workspace._id !== workspaceId) {
      continue;
    }

    if (!meta?.gitFilePath) {
      continue;
    }

    relPathToWorkspaceId.set(toPosixRelPath(meta.gitFilePath), workspace._id);
  }

  return issues.flatMap<WorkspaceFileIssue>(issue => {
    const matchedWorkspaceId = relPathToWorkspaceId.get(toPosixRelPath(issue.relPath));
    if (!matchedWorkspaceId) {
      return [];
    }

    return [
      {
        workspaceId: matchedWorkspaceId,
        gitRepositoryId: repoId,
        relPath: issue.relPath,
        kind: issue.kind,
        message: issue.message,
      },
    ];
  });
}

export async function getProjectGitFileIssues({
  projectId,
  workspaceId,
  gitRepositoryId,
}: GetProjectGitFileIssuesOptions): Promise<WorkspaceFileIssue[]> {
  const project = await services.project.get(projectId);
  if (!project || !models.project.isConnectedGitProject(project)) {
    return [];
  }

  const effectiveRepoId = models.project.getEffectiveRepoId(project);
  if (gitRepositoryId && gitRepositoryId !== effectiveRepoId) {
    return [];
  }

  return mapWorkspaceFileIssues({
    issues: repoFileWatcherRegistry.getProblems(effectiveRepoId!),
    repoId: effectiveRepoId!,
    metas: await getProjectWorkspacesWithMeta(projectId),
    workspaceId,
  });
}

export interface BranchRemoteInfo {
  trackingRemote: string | null;
  isOrigin: boolean;
  remoteUrl: string | null;
  remotes: { remote: string; url: string }[];
}

export const getBranchRemoteInfo = async ({
  projectId,
  workspaceId,
}: {
  projectId: string;
  workspaceId?: string;
}): Promise<BranchRemoteInfo> => {
  await getGitRepository({ projectId, workspaceId });
  const branchInfo = await GitVCS.getBranchRemoteInfo();
  const remotes = await GitVCS.listRemotes();
  return { ...branchInfo, remotes };
};

async function assertBranchOnOrigin(context: string): Promise<void> {
  const { trackingRemote, isOrigin, remoteUrl } = await GitVCS.getBranchRemoteInfo();
  if (!isOrigin) {
    const branch = await GitVCS.getCurrentBranch();
    throw new Error(
      `Cannot ${context}: branch "${branch}" tracks remote "${trackingRemote}" (${remoteUrl}), ` +
        `but Insomnia only manages the "origin" remote. ` +
        `Use the git CLI to ${context} this branch, or run: ` +
        `git branch --set-upstream-to=origin/${branch}`,
    );
  }
}

/**
 * Creates a file system client for Git operations
 * Returns different clients based on whether we're working with a workspace or project
 *
 * @param projectId - The project ID
 * @param workspaceId - Optional workspace ID (if provided, uses workspace-specific client)
 * @param gitRepositoryId - The Git repository ID
 * @returns File system client configured for the appropriate context
 */
async function getGitFSClient({
  projectId,
  workspaceId,
  gitRepositoryId,
}: {
  projectId: string;
  workspaceId?: string;
  gitRepositoryId: string;
}) {
  // Base directory where Git data is stored
  const baseDir = path.join(
    process.env['INSOMNIA_DATA_PATH'] || app.getPath('userData'),
    `version-control/git/${gitRepositoryId}`,
  );

  // Workspace FS Client - used when working with a specific workspace
  if (workspaceId) {
    // All app data is stored within a namespaced GIT_INSOMNIA_DIR directory at the root of the repository and is read/written from the local NeDB database
    const neDbClient = NeDBClient.createClient(workspaceId, projectId);

    // All git metadata in the GIT_INTERNAL_DIR directory is stored in a git/ directory on the filesystem
    const gitDataClient = fsClient(baseDir);

    // All data outside the directories listed below will be stored in an 'other' directory. This is so we can support files that exist outside the ones the app is specifically in charge of.
    const otherDataClient = fsClient(path.join(baseDir, 'other'));

    // The routable FS client directs isomorphic-git to read/write from the database or from the correct directory on the file system while performing git operations.
    const routableFS = routableFSClient(otherDataClient, {
      [GIT_INSOMNIA_DIR]: neDbClient,
      [GIT_INTERNAL_DIR]: gitDataClient,
    });

    return routableFS;
  }

  // Project FS Client
  // All git metadata in the GIT_INTERNAL_DIR directory is stored in a .git/ directory on the filesystem
  const gitDataClient = fsClient(baseDir);

  // All files (YAML + non-YAML) are stored at the repository root so that
  // native Git tools can operate directly on the repository directory.
  // The RepoFileWatcher is solely responsible for syncing YAML ↔ NeDB.
  const diskClient = fsClient(baseDir);

  // The routable FS client routes prefix-matched paths (e.g. .git) to
  // specialised FS clients; everything else goes to the disk client.
  const routableFS = projectRoutableFSClient(diskClient, {
    [GIT_INTERNAL_DIR]: gitDataClient,
  });

  return routableFS;
}

/**
 * Validate that the stored Git credential is currently accepted by the remote.
 *
 * For GitHub credentials the GitHub REST API (`GET /user`) is used because the
 * git wire protocol (`listServerRefs`) can succeed anonymously on public repos
 * even after a token has been revoked or a GitHub App has been uninstalled.
 * The REST endpoint reliably returns HTTP 401 in those cases.
 *
 * For providers that do not implement `validateCredentials` we fall back to
 * `fetchRemoteBranches`, which uses the git wire protocol and performs a
 * basic authentication check against the remote.
 *
 * Throws an error starting with `HTTP Error: 4xx` on auth failures so the
 * existing `shouldShowHttp40OAuthReauthHint` banner logic is triggered.
 */
async function validateGitCredentials({
  credentialsId,
  uri,
}: {
  credentialsId?: string | null;
  uri: string;
}): Promise<void> {
  if (!credentialsId) return;

  const credentials = await services.gitCredentials.getById(credentialsId);
  if (!credentials) return;

  if (!models.gitCredentials.isGitCredentialsV2(credentials)) {
    // V1 (legacy) credentials may have provider 'githubapp', which is no longer
    // registered. Falling back to fetchRemoteBranches would silently "pass" on
    // public repos even when the token has been revoked, so we bail with a clear error.
    throw new Error('Legacy git credentials are no longer supported. Please re-authenticate.');
  }

  const provider = gitRemoteProviderRegistry.get(credentials.provider);

  await (provider?.validateCredentials
    ? provider.validateCredentials(credentials)
    : fetchRemoteBranches({ uri: parseGitToHttpsURL(uri), credentialsId }));
}

export async function validateGitRepositoryCredentials({
  projectId,
  workspaceId,
}: {
  projectId: string;
  workspaceId?: string;
}): Promise<{ errors?: string[] }> {
  try {
    const gitRepository = await getGitRepository({ projectId, workspaceId });
    await validateGitCredentials({
      credentialsId: gitRepository.credentialsId,
      uri: gitRepository.uri,
    });
    return {};
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Error validating git credentials.';
    return { errors: [errorMessage] };
  }
}

/**
 * Validates a credential by its ID without requiring a repo URI.
 * Works for OAuth providers (GitHub, GitLab) which have a dedicated validate endpoint.
 * PAT/custom credentials are skipped since they require a repo URI to validate.
 */
export async function validateGitCredentialById({
  credentialsId,
}: {
  credentialsId: string;
}): Promise<{ errors?: string[] }> {
  try {
    const credentials = await services.gitCredentials.getById(credentialsId);
    if (!credentials) {
      return { errors: ['Credential not found.'] };
    }
    if (!models.gitCredentials.isGitCredentialsV2(credentials)) {
      return { errors: ['Legacy git credentials are no longer supported. Please re-authenticate.'] };
    }
    const provider = gitRemoteProviderRegistry.get(credentials.provider);
    if (provider?.validateCredentials) {
      await provider.validateCredentials(credentials);
    }
    return {};
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Error validating git credentials.';
    return { errors: [errorMessage] };
  }
}

export async function loadGitRepository({ projectId, workspaceId }: { projectId: string; workspaceId?: string }) {
  try {
    const gitRepository = await getGitRepository({ workspaceId, projectId });

    const baseDir = path.join(
      process.env['INSOMNIA_DATA_PATH'] || app.getPath('userData'),
      `version-control/git/${gitRepository._id}`,
    );

    const bufferId = await database.bufferChanges();
    const fsClient = await getGitFSClient({ gitRepositoryId: gitRepository._id, projectId, workspaceId });

    if (GitVCS.isInitializedForRepo(gitRepository._id) && !gitRepository.needsFullClone) {
      let legacyInsomniaWorkspace;
      if (!workspaceId) {
        legacyInsomniaWorkspace = await containsLegacyInsomniaDir({ fsClient });
        // Ensure watcher is running (idempotent)
        await repoFileWatcherRegistry.startWatcher(gitRepository._id, baseDir, projectId);
      }

      return {
        branch: await GitVCS.getCurrentBranch(),
        branches: await GitVCS.listBranches(),
        gitRepository: gitRepository,
        legacyInsomniaWorkspace,
        branchRemoteInfo: {
          ...(await GitVCS.getBranchRemoteInfo()),
          remotes: await GitVCS.listRemotes(),
        },
      };
    }

    // Init VCS
    const { credentialsId, uri } = gitRepository;
    if (gitRepository.needsFullClone) {
      await GitVCS.initFromClone({
        repoId: gitRepository._id,
        url: uri,
        credentialsId,
        directory: GIT_CLONE_DIR,
        fs: fsClient,
        gitDirectory: GIT_INTERNAL_DIR,
      });

      await services.gitRepository.update(gitRepository, {
        needsFullClone: false,
      });
    } else {
      await GitVCS.init({
        repoId: gitRepository._id,
        uri,
        directory: GIT_CLONE_DIR,
        fs: fsClient,
        gitDirectory: GIT_INTERNAL_DIR,
        credentialsId,
        legacyDiff: Boolean(workspaceId),
      });

      // GitVCS.init() opens the local repo without a network call, so explicitly
      // verify credentials here to surface revoked tokens as HTTP 4xx errors.
      await validateGitCredentials({ credentialsId, uri });
    }

    // Configure basic info
    await GitVCS.setAuthor();
    await GitVCS.addRemote(uri);

    // Start file watcher for project-scoped repos so external YAML edits
    // (native git CLI, VS Code, etc.) flow back into the database.
    // The watcher automatically imports all YAML files during creation.
    if (!workspaceId) {
      await repoFileWatcherRegistry.startWatcher(gitRepository._id, baseDir, projectId);
    }

    let legacyInsomniaWorkspace;
    if (!workspaceId) {
      legacyInsomniaWorkspace = await containsLegacyInsomniaDir({ fsClient });
    }

    await database.flushChanges(bufferId);

    return {
      branch: await GitVCS.getCurrentBranch(),
      branches: await GitVCS.listBranches(),
      gitRepository,
      legacyInsomniaWorkspace,
      branchRemoteInfo: {
        ...(await GitVCS.getBranchRemoteInfo()),
        remotes: await GitVCS.listRemotes(),
      },
    };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Error while fetching git repository.';
    return {
      errors: [errorMessage],
    };
  }
}

export type GitBranchesLoaderData =
  | {
      branches: string[];
      remoteBranches: string[];
    }
  | {
      errors: string[];
    };

export const getGitBranches = async ({
  projectId,
  workspaceId,
}: {
  projectId: string;
  workspaceId?: string;
}): Promise<GitBranchesLoaderData> => {
  try {
    await getGitRepository({ projectId, workspaceId });
    const branches = await GitVCS.listBranches();
    const remoteBranches = await GitVCS.fetchRemoteBranches();

    return {
      branches,
      remoteBranches,
    };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Could not fetch remote branches.';
    return {
      errors: [errorMessage],
    };
  }
};

export const gitFetchAction = async ({ projectId, workspaceId }: { projectId: string; workspaceId?: string }) => {
  try {
    await assertBranchOnOrigin('fetch');
    const gitRepository = await getGitRepository({ projectId, workspaceId });
    await GitVCS.fetch({
      singleBranch: true,
      depth: 1,
      credentialsId: gitRepository.credentialsId,
    });

    return {
      errors: [],
      success: true,
    };
  } catch (e) {
    console.error(e);
    if (
      e instanceof Errors.UserCanceledError ||
      (e instanceof Errors.HttpError && (e.data.statusCode === 401 || e.data.statusCode === 403))
    ) {
      return {
        errors: [GitVCSOperationErrors.AuthenticationRequiredError],
      };
    }
    return {
      errors: ['Failed to fetch from remote'],
    };
  }
};

export const gitLogLoader = async ({ projectId, workspaceId }: { projectId: string; workspaceId?: string }) => {
  try {
    await getGitRepository({ projectId, workspaceId });
    const log = await GitVCS.log({ depth: 35 });

    return {
      log,
    };
  } catch (e) {
    console.error(e);
    return {
      log: [],
      errors: ['Failed to fetch log'],
    };
  }
};

export interface GitChangesLoaderData {
  changes: {
    staged: {
      name: string;
      path: string;
      status: Status;
      type: GitFileStatus;
      symbol: GitFileStatusSymbol;
    }[];
    unstaged: {
      name: string;
      path: string;
      status: Status;
      type: GitFileStatus;
      symbol: GitFileStatusSymbol;
    }[];
  };
  branch: string;
  gitRepository?: GitRepository | null;
  errors?: string[];
}

export const gitChangesLoader = async ({
  projectId,
  workspaceId,
}: {
  projectId: string;
  workspaceId?: string;
}): Promise<GitChangesLoaderData> => {
  try {
    const gitRepository = await getGitRepository({ projectId, workspaceId });
    // Flush DB changes to disk before checking git status
    await repoFileWatcherRegistry.flushNow(gitRepository._id);
    const branch = await GitVCS.getCurrentBranch();

    const { changes, hasUncommittedChanges } = await getGitChanges();

    await services.gitRepository.update(gitRepository, {
      hasUncommittedChanges,
    });

    return {
      branch,
      changes,
      gitRepository,
    };
  } catch {
    return {
      branch: '',
      changes: {
        staged: [],
        unstaged: [],
      },
      errors: ['Failed to get changes'],
    };
  }
};

export interface GitCanPushLoaderData {
  canPush: boolean;
}

export const canPushLoader = async ({
  projectId,
  workspaceId,
}: {
  projectId: string;
  workspaceId?: string;
}): Promise<GitCanPushLoaderData> => {
  try {
    const { isOrigin } = await GitVCS.getBranchRemoteInfo();
    if (!isOrigin) {
      return { canPush: false };
    }
    let hasUnpushedChanges = false;
    const gitRepository = await getGitRepository({ workspaceId, projectId });
    hasUnpushedChanges = await GitVCS.canPush(gitRepository.credentialsId);

    await services.gitRepository.update(gitRepository, {
      hasUnpushedChanges,
    });

    return { canPush: hasUnpushedChanges };
  } catch {
    return { canPush: false };
  }
};

async function containsLegacyInsomniaDir({ fsClient }: { fsClient: PromiseFsClient }): Promise<
  | {
      scope: WorkspaceScope;
      name: string;
      path: string;
    }
  | undefined
> {
  try {
    const legacyInsomniaFolderStat = await fsClient.promises.lstat(GIT_INSOMNIA_DIR_NAME);

    if (!legacyInsomniaFolderStat.isDirectory()) {
      return;
    }

    const legacyInsomniaWorkspaceFolderPath = path.join(GIT_INSOMNIA_DIR_NAME, models.workspace.type);

    const [workspaceFile] = await fsClient.promises.readdir(legacyInsomniaWorkspaceFolderPath);
    const workspaceFilePath = path.join(legacyInsomniaWorkspaceFolderPath, workspaceFile);

    const workspaceFileContents = await fsClient.promises.readFile(workspaceFilePath, 'utf8');
    const workspaceDocument = YAML.parse(workspaceFileContents);

    const workspaceName = workspaceDocument.name || 'Untitled';
    const workspaceScope = workspaceDocument.scope;

    return {
      name: workspaceName,
      scope: workspaceScope,
      path: GIT_INSOMNIA_DIR_NAME,
    };
  } catch {
    return;
  }
}

/**
 * The legacy git sync functionality stores one `.insomnia` directory in the root of the repository.
 * The structure looks like this:
 *
 * ROOT_REPOSITORY_DIR/
 * └── .insomnia/
 *     ├── Workspace/
 *     │   └── wrk-{{UUID}}.yaml
 *     ├── Request/
 *     │   ├── req-{{UUID}}.yaml
 *     │   └── req-{{UUID}}.yaml
 *     └── OtherModel/
 *         └── other-{{UUID}}.yaml
 *
 * All entities are stored inside a subdirectory named after the model it represents (e.g., `Request`),
 * and each file is named with the database ID as its name, with the `.yaml` extension.
 *
 * This function migrates the legacy structure to the new v5 file format.
 *
 * @param fsClient - File system client for reading the repository
 * @param projectId - The project ID to associate migrated workspaces with
 * @returns Object containing changes made during migration or errors
 */
async function importLegacyInsomniaFolder({ fsClient, projectId }: { fsClient: PromiseFsClient; projectId: string }) {
  const changes: { path: string; status: Status }[] = [];
  try {
    // Check if the legacy .insomnia directory exists
    const legacyInsomniaFolderStat = await fsClient.promises.lstat(GIT_INSOMNIA_DIR_NAME);

    if (!legacyInsomniaFolderStat.isDirectory()) {
      return {};
    }

    // Get all model type folders (Workspace, Request, etc.)
    const legacyInsomniaModelFolders = await fsClient.promises.readdir(GIT_INSOMNIA_DIR_NAME);

    const legacyInsomniaFiles: { filePath: string; type: string }[] = [];

    // Recursively collect all YAML files from each model folder
    for (const folder of legacyInsomniaModelFolders) {
      const folderPath = path.join(GIT_INSOMNIA_DIR_NAME, folder);
      const folderStat = await fsClient.promises.lstat(folderPath);

      if (folderStat.isDirectory()) {
        const folderFiles = await fsClient.promises.readdir(folderPath);

        for (const file of folderFiles) {
          const filePath = path.join(folderPath, file);
          const fileStat = await fsClient.promises.lstat(filePath);

          if (fileStat.isFile()) legacyInsomniaFiles.push({ filePath, type: folder });
        }
      }
    }

    if (legacyInsomniaFiles.length === 0) {
      return {};
    }

    // Process each legacy file and migrate it to the database
    for (const legacyInsomniaFile of legacyInsomniaFiles) {
      const fileContents = await fsClient.promises.readFile(legacyInsomniaFile.filePath, 'utf8');

      const type = legacyInsomniaFile.type;

      // Skip the file if there is a conflict marker (Git merge conflict)
      if (fileContents.split('\n').includes('=======')) {
        return {
          errors: [`File ${legacyInsomniaFile.filePath} contains a merge conflict`],
        };
      }

      // Parse the YAML file to get the document
      const doc: BaseModel = YAML.parse(fileContents);

      // Validate that the document ID matches the file path
      if (!legacyInsomniaFile.filePath.includes(doc._id)) {
        throw new Error(`Doc _id does not match file path [${doc._id} - ${legacyInsomniaFile.filePath}]`);
      }

      // Validate that the document type matches the folder name
      if (type !== doc.type) {
        throw new Error(`Doc type does not match file path [${doc.type} != ${type || 'null'}]`);
      }

      // Special handling for workspaces: ensure they're associated with the correct project
      if (models.workspace.isWorkspace(doc)) {
        console.log('[git] setting workspace parent to be that of the active project', {
          original: doc.parentId,
          new: projectId,
        });
        // Whenever we write a workspace into nedb we should set the parentId to be that of the current project
        // This is because the parentId (or a project) is not synced into git, so it will be cleared whenever git writes the workspace into the db, thereby removing it from the project on the client
        // In order to reproduce this bug, comment out the following line, then clone a repository into a local project, then open the workspace, you'll notice it will have moved into the default project
        doc.parentId = projectId;

        // Create workspace metadata and set the new Git file path
        const workspaceMeta = await services.workspaceMeta.getOrCreateByParentId(doc._id);

        const gitFilePath = `insomnia.${doc._id}.yaml`;
        await services.workspaceMeta.update(workspaceMeta, { gitFilePath });

        // Track the change for Git staging
        changes.push({
          path: gitFilePath,
          status: [0, 1, 0], // Added to working directory
        });
      }

      // Update the document in the database
      await database.update(doc);

      // Track the removal of the legacy file
      changes.push({
        path: legacyInsomniaFile.filePath,
        // It existed and was removed from the git repository
        status: [1, 0, 1], // Deleted from working directory
      });
    }

    // Remove the legacy folder
    await fsClient.promises.rmdir(GIT_INSOMNIA_DIR_NAME, { recursive: true });

    return {
      changes,
    };
  } catch (e) {
    return {
      errors: [`Failed to import legacy Insomnia folder: ${e.message}`],
    };
  }
}

async function isInsomniaFile(fullPath: string, fsClient: PromiseFsClient) {
  if (!fullPath.endsWith('.yaml')) {
    return false;
  }

  const fileContents = await fsClient.promises.readFile(fullPath, 'utf8');
  const fileTypeStr = fileContents.split('\n')[0].trim();
  const doesFileContainInsomniaV5FormatTypeString = InsomniaFileTypeValues.some(fileType =>
    fileTypeStr.includes(fileType),
  );

  return doesFileContainInsomniaV5FormatTypeString;
}

// Recursively finds all .yaml files in a repository that are Insomnia files and returns their paths relative to the repo root.
// Insomnia files are defined as files that contain the string 'insomnia.rest' in the first line.
const recursivelyFindInsomniaFiles = async (
  fsClient: PromiseFsClient,
  dir: string,
  files: string[] = [],
): Promise<string[]> => {
  const dirFiles = await fsClient.promises.readdir(dir);
  for (const file of dirFiles) {
    const repoRelativePath = path.join(dir, file);
    const isDirectory = (await fsClient.promises.stat(repoRelativePath)).isDirectory();

    if (isDirectory) {
      await recursivelyFindInsomniaFiles(fsClient, repoRelativePath, files);
    }

    if (!isDirectory && (await isInsomniaFile(repoRelativePath, fsClient))) {
      files.push(repoRelativePath);
    }
  }

  return files;
};

// Actions
export const initGitRepoCloneAction = async ({
  uri,
  credentialsId,
  ref,
}: {
  organizationId: string;
  uri: string;
  credentialsId?: string;
  ref?: string;
}): Promise<
  | {
      files: {
        scope: WorkspaceScope;
        name: string;
        path: string;
      }[];
      legacyInsomniaFile?: {
        scope: WorkspaceScope;
        name: string;
      };
    }
  | {
      errors: string[];
    }
> => {
  const repoSettingsPatch: Partial<GitRepository> = {};
  repoSettingsPatch.uri = parseGitToHttpsURL(uri);

  repoSettingsPatch.credentialsId = credentialsId;

  repoSettingsPatch.needsFullClone = true;

  const inMemoryFsClient = MemClient.createClient();

  try {
    await shallowClone({
      ref,
      fsClient: inMemoryFsClient,
      gitRepository: repoSettingsPatch as GitRepository,
    });
  } catch (e) {
    console.error(e);

    if (e instanceof Errors.HttpError) {
      return {
        errors: [`${e.message}, ${e.data.response}`],
      };
    }

    return {
      errors: [e.message],
    };
  }

  const insomniaFiles = await recursivelyFindInsomniaFiles(inMemoryFsClient, GIT_CLONE_DIR);
  // Get all files that start with 'insomnia.' recursively in the root directory

  const files: {
    scope: WorkspaceScope;
    name: string;
    path: string;
  }[] = [];

  for (const file of insomniaFiles) {
    const fileContents = await inMemoryFsClient.promises.readFile(path.join(GIT_CLONE_DIR, file), 'utf8');
    // Apply schema migration before parsing to handle older schema versions
    const migratedContents = migrateToLatestYaml(fileContents);
    const yamlDocument = parse(migratedContents);
    const fileSchemaParser = InsomniaFileSchema.safeParse(yamlDocument);
    // Validate that the file conforms to the Insomnia file schema
    if (fileSchemaParser.success) {
      const insomniaFile = fileSchemaParser.data;
      files.push({
        scope: insomniaSchemaTypeToScope(insomniaFile.type),
        name: insomniaFile.name || 'Untitled',
        path: file,
      });
    }
  }

  const legacyInsomniaFile = await containsLegacyInsomniaDir({ fsClient: inMemoryFsClient });

  if (legacyInsomniaFile) {
    // Add the legacy Insomnia file on the top of the list
    files.unshift(legacyInsomniaFile);
  }

  return { files };
};

export const cloneGitRepoAction = async ({
  organizationId,
  projectId,
  cloneIntoProjectId,
  credentialsId,
  name,
  uri,
  ref,
  selectedAuthorEmail,
}: {
  organizationId: string;
  projectId?: string;
  cloneIntoProjectId?: string;
  credentialsId: string | null;
  name?: string;
  uri: string;
  ref?: string;
  selectedAuthorEmail?: string | null;
}) => {
  try {
    const repoSettingsPatch: Partial<GitRepository> = {};
    repoSettingsPatch.uri = parseGitToHttpsURL(uri);

    repoSettingsPatch.credentialsId = credentialsId;
    if (selectedAuthorEmail !== undefined) {
      repoSettingsPatch.selectedAuthorEmail = selectedAuthorEmail;
    }

    let provider = 'custom';
    if (credentialsId) {
      const credentials = await services.gitCredentials.getById(credentialsId);
      invariant(credentials, 'Git Credentials not found');
      if (!models.gitCredentials.isGitCredentialsV2(credentials)) {
        throw new Error('Invalid Git Credentials');
      }
      provider = credentials.provider;
    }

    if (!projectId) {
      trackAnalyticsEvent(AnalyticsEvent.vcsSyncStart, {
        ...vcsEventProperties('git', 'clone'),
        provider,
        repoId: repoSettingsPatch._id,
      });
      repoSettingsPatch.needsFullClone = true;

      const inMemoryFsClient = MemClient.createClient();

      let providerName = 'custom';
      if (repoSettingsPatch.credentialsId) {
        const credentials = await services.gitCredentials.getById(repoSettingsPatch.credentialsId);
        invariant(credentials, 'Git Credentials not found');
        providerName = credentials.provider;
      }

      try {
        await shallowClone({
          ref,
          fsClient: inMemoryFsClient,
          gitRepository: repoSettingsPatch as GitRepository,
        });
      } catch (e) {
        console.error(e);

        if (e instanceof Errors.HttpError) {
          return {
            errors: [`${e.message}, ${e.data.response}`],
            gitRepository: repoSettingsPatch,
          };
        }

        return {
          errors: [e.message],
          gitRepository: repoSettingsPatch,
        };
      }

      const rootDirFiles: string[] = await inMemoryFsClient.promises.readdir(GIT_CLONE_DIR);
      const insomniaFiles = rootDirFiles.filter(fileOrFolder => fileOrFolder.startsWith('insomnia.'));
      const insomniaFilesIds = insomniaFiles.map(file => file.split('.')[1]);

      if (insomniaFilesIds.length > 0) {
        // Check for existing workspaces with the same IDs (currently commented out)
        const existingWorkspaces = await database.find(models.workspace.type, {
          _id: { $in: insomniaFilesIds },
        });

        if (existingWorkspaces.length > 0) {
          return {
            errors: ['The repository being cloned contains workspaces that already exist in Insomnia.'],
          };
        }
      }
      const bufferId = await database.bufferChanges();

      const gitRepository = await services.gitRepository.create(repoSettingsPatch);

      async function getProject() {
        if (cloneIntoProjectId) {
          const project = await services.project.get(cloneIntoProjectId);
          invariant(project, 'Project not found');

          await services.project.update(project, {
            remoteId: null,
            gitRepositoryId: models.project.toProtectedRepoId(gitRepository._id),
          });

          return project;
        }

        const project = await services.project.create({
          name: name || gitRepository.uri.split('/').pop() || 'New Git Project',
          parentId: organizationId,
          gitRepositoryId: models.project.toProtectedRepoId(gitRepository._id),
        });

        return project;
      }

      const project = await getProject();

      const fsClient = await getGitFSClient({ projectId: project._id, gitRepositoryId: gitRepository._id });

      if (gitRepository.needsFullClone) {
        await GitVCS.initFromClone({
          repoId: gitRepository._id,
          url: uri,
          credentialsId: gitRepository.credentialsId,
          directory: GIT_CLONE_DIR,
          fs: fsClient,
          gitDirectory: GIT_INTERNAL_DIR,
          ref,
        });

        await services.gitRepository.update(gitRepository, {
          needsFullClone: false,
        });
      } else {
        await GitVCS.init({
          repoId: gitRepository._id,
          uri,
          directory: GIT_CLONE_DIR,
          fs: fsClient,
          gitDirectory: GIT_INTERNAL_DIR,
          credentialsId: gitRepository.credentialsId,
        });
      }

      await GitVCS.setAuthor();
      await GitVCS.addRemote(uri);

      const hasLegacyInsomniaDir = await containsLegacyInsomniaDir({ fsClient: inMemoryFsClient });
      if (hasLegacyInsomniaDir) {
        await migrateLegacyInsomniaFolderToFile({ projectId: project._id });
      }

      // Start watcher — it automatically imports all YAML files during creation
      const cloneBaseDir = path.join(
        process.env['INSOMNIA_DATA_PATH'] || app.getPath('userData'),
        `version-control/git/${gitRepository._id}`,
      );

      // If the project already has a ruleset in the DB (e.g. cloud → git migration),
      // write it to disk now so its mtime is newer than the cloned file. This ensures
      // the cloud ruleset is preserved and it shows up as a diff in the commit modal rather than being silently replaced by the repo's file.
      const existingRuleset = await services.projectLintRuleset.getByParentId(project._id);
      if (existingRuleset) {
        const rulesetPath = path.join(cloneBaseDir, '.spectral.yaml');
        await fs.promises.writeFile(rulesetPath, existingRuleset.rulesetContent, 'utf8');
      }

      await repoFileWatcherRegistry.startWatcher(gitRepository._id, cloneBaseDir, project._id);

      const updateRepository = await services.gitRepository.getById(gitRepository._id);
      invariant(updateRepository, 'Git Repository not found');

      await services.gitRepository.update(updateRepository, {
        cachedGitLastCommitTime: Date.now(),
        cachedGitRepositoryBranch: await GitVCS.getCurrentBranch(),
      });

      await database.flushChanges(bufferId);
      trackAnalyticsEvent(AnalyticsEvent.vcsSyncComplete, {
        ...vcsEventProperties('git', 'clone'),
        providerName,
        repoId: repoSettingsPatch._id,
      });

      return {
        organizationId,
        projectId: project._id,
      };
    }

    const project = await services.project.get(projectId);
    invariant(project, 'Project not found');

    trackAnalyticsEvent(AnalyticsEvent.vcsSyncStart, {
      ...vcsEventProperties('git', 'clone'),
      provider,
      repoId: repoSettingsPatch._id,
    });
    repoSettingsPatch.needsFullClone = true;

    const inMemoryFsClient = MemClient.createClient();

    try {
      await shallowClone({
        ref,
        fsClient: inMemoryFsClient,
        gitRepository: repoSettingsPatch as GitRepository,
      });
    } catch (e) {
      console.error(e);

      if (e instanceof Errors.HttpError) {
        return {
          errors: [`${e.message}, ${e.data.response}`],
        };
      }

      return {
        errors: [e.message],
      };
    }

    const containsInsomniaDir = async (fsClient: Record<string, any>): Promise<boolean> => {
      const rootDirs: string[] = await fsClient.promises.readdir(GIT_CLONE_DIR);
      return rootDirs.includes(GIT_INSOMNIA_DIR_NAME);
    };

    const containsInsomniaWorkspaceDir = async (fsClient: Record<string, any>): Promise<boolean> => {
      if (!(await containsInsomniaDir(fsClient))) {
        return false;
      }

      const rootDirs: string[] = await fsClient.promises.readdir(GIT_INSOMNIA_DIR);
      return rootDirs.includes(models.workspace.type);
    };

    // Stop the DB from pushing updates to the UI temporarily
    const bufferId = await database.bufferChanges();
    let workspaceId = '';
    let scope: 'design' | 'collection' = models.workspace.WorkspaceScopeKeys.design;
    // If no workspace exists we create a new one
    if (!(await containsInsomniaWorkspaceDir(inMemoryFsClient))) {
      // Create a new workspace

      const workspace = await services.workspace.create({
        name: repoSettingsPatch.uri?.split('/').pop(),
        scope: scope,
        parentId: project._id,
        description: `Insomnia Workspace for ${repoSettingsPatch.uri}}`,
      });
      await services.apiSpec.getOrCreateForParentId(workspace._id);

      trackAnalyticsEvent(AnalyticsEvent.vcsSyncComplete, {
        ...vcsEventProperties('git', 'clone', 'no directory found'),
        providerName: provider,
        repoId: repoSettingsPatch._id,
      });

      workspaceId = workspace._id;

      const newRepo = await services.gitRepository.create(repoSettingsPatch);
      const meta = await services.workspaceMeta.getOrCreateByParentId(workspaceId);
      await services.workspaceMeta.update(meta, {
        gitRepositoryId: newRepo._id,
      });
    } else {
      // Clone all entities from the repository
      const workspaceBase = path.join(GIT_INSOMNIA_DIR, models.workspace.type);
      const workspaces = await inMemoryFsClient.promises.readdir(workspaceBase);

      if (workspaces.length === 0) {
        trackAnalyticsEvent(AnalyticsEvent.vcsSyncComplete, {
          ...vcsEventProperties('git', 'clone', 'no workspaces found'),
          providerName: provider,
          repoId: repoSettingsPatch._id,
        });

        return {
          errors: ['No workspaces found in repository'],
        };
      }

      if (workspaces.length > 1) {
        trackAnalyticsEvent(AnalyticsEvent.vcsSyncComplete, {
          ...vcsEventProperties('git', 'clone', 'multiple workspaces found'),
          providerName: provider,
          repoId: repoSettingsPatch._id,
        });

        return {
          errors: ['Multiple workspaces found in repository. Expected one.'],
        };
      }

      // Only one workspace
      const workspacePath = path.join(workspaceBase, workspaces[0]);
      const workspaceJson = await inMemoryFsClient.promises.readFile(workspacePath);
      const workspace = YAML.parse(workspaceJson.toString());
      workspaceId = workspace._id;
      scope =
        workspace.scope === models.workspace.WorkspaceScopeKeys.collection
          ? models.workspace.WorkspaceScopeKeys.collection
          : models.workspace.WorkspaceScopeKeys.design;
      // Check if the workspace already exists
      const existingWorkspace = await services.workspace.getById(workspace._id);

      if (existingWorkspace) {
        const project = await services.project.get(existingWorkspace.parentId);
        if (!project) {
          return {
            errors: [
              'It seems that the repository being cloned is connected to an orphaned workspace. Please move that workspace to a project and try again.',
            ],
          };
        }

        const organizationId = project?.parentId;

        return {
          existingWorkspace: {
            organizationId,
            workspaceId: existingWorkspace._id,
            projectId: project._id,
          },
        };
      }

      // Store GitRepository settings and set it as active
      const gitRepository = await services.gitRepository.create(repoSettingsPatch);
      const meta = await services.workspaceMeta.getOrCreateByParentId(workspaceId);
      await services.workspaceMeta.update(meta, {
        gitRepositoryId: gitRepository._id,
      });

      const routableFS = await getGitFSClient({
        projectId,
        workspaceId,
        gitRepositoryId: gitRepository._id,
      });

      // Configure basic info
      if (gitRepository.needsFullClone) {
        await GitVCS.initFromClone({
          repoId: gitRepository._id,
          url: uri,
          credentialsId: gitRepository.credentialsId,
          directory: GIT_CLONE_DIR,
          fs: routableFS,
          gitDirectory: GIT_INTERNAL_DIR,
        });

        await services.gitRepository.update(gitRepository, {
          needsFullClone: false,
        });
      } else {
        await GitVCS.init({
          repoId: gitRepository._id,
          uri,
          directory: GIT_CLONE_DIR,
          fs: routableFS,
          gitDirectory: GIT_INTERNAL_DIR,
          credentialsId: gitRepository.credentialsId,
          legacyDiff: true,
        });
      }

      await GitVCS.setAuthor();
      await GitVCS.addRemote(uri);
    }

    // Flush DB changes
    await database.flushChanges(bufferId);
    trackAnalyticsEvent(AnalyticsEvent.vcsSyncComplete, {
      ...vcsEventProperties('git', 'clone'),
      providerName: provider,
      repoId: repoSettingsPatch._id,
    });

    invariant(workspaceId, 'Workspace ID is required');

    return {
      workspaceId,
      scope,
    };
  } catch (e) {
    return {
      errors: [e.message],
    };
  }
};

export const updateGitRepoAction = async ({
  projectId,
  workspaceId,
  credentialsId,
  uri,
  ref,
  selectedAuthorEmail,
}: {
  projectId: string;
  workspaceId?: string;
  credentialsId: string | null;
  uri: string;
  ref?: string;
  selectedAuthorEmail?: string | null;
}) => {
  try {
    let gitRepositoryId: string | null | undefined = null;
    const gitURI = parseGitToHttpsURL(uri);

    if (workspaceId) {
      const workspace = await services.workspace.getById(workspaceId);
      invariant(workspace, 'Workspace not found');

      const workspaceMeta = await services.workspaceMeta.getByParentId(workspaceId);
      gitRepositoryId = workspaceMeta?.gitRepositoryId;
    } else if (projectId) {
      const project = await services.project.get(projectId);
      invariant(project, 'Project not found');
      gitRepositoryId = project.gitRepositoryId;
    }

    let gitRepository: GitRepository | undefined;

    if (gitRepositoryId && gitRepositoryId !== models.project.EMPTY_GIT_PROJECT_ID) {
      const effectiveId = models.project.decodeRepoId(gitRepositoryId);
      gitRepository = await services.gitRepository.getById(effectiveId);
      invariant(gitRepository, 'GitRepository not found');
    } else {
      const newRepo: Partial<GitRepository> = {
        uri: gitURI,
        credentialsId: credentialsId,
        needsFullClone: true,
      };
      if (selectedAuthorEmail !== undefined) {
        newRepo.selectedAuthorEmail = selectedAuthorEmail;
      }
      gitRepository = await services.gitRepository.create(newRepo);
    }

    if (workspaceId) {
      await services.workspaceMeta.updateByParentId(workspaceId, {
        gitRepositoryId: gitRepository._id,
      });
    } else if (projectId) {
      const project = await services.project.get(projectId);
      invariant(project, 'Project not found');
      await services.project.update(project, {
        gitRepositoryId: models.project.toProtectedRepoId(gitRepository._id),
      });
    }

    await GitVCS.init({
      repoId: gitRepository._id,
      uri,
      directory: GIT_CLONE_DIR,
      fs: await getGitFSClient({ projectId, workspaceId, gitRepositoryId: gitRepository._id }),
      gitDirectory: GIT_INTERNAL_DIR,
      credentialsId: credentialsId,
      legacyDiff: Boolean(workspaceId),
      ref,
    });

    await GitVCS.setAuthor();
    await GitVCS.addRemote(uri);

    const { hasUncommittedChanges } = await getGitChanges();
    const hasUnpushedChanges = await GitVCS.canPush(credentialsId);

    const updatePatch: Partial<GitRepository> = {
      uri: gitURI,
      credentialsId: credentialsId,
      hasUncommittedChanges,
      hasUnpushedChanges,
    };

    if (selectedAuthorEmail !== undefined) {
      updatePatch.selectedAuthorEmail = selectedAuthorEmail;
    }

    await services.gitRepository.update(gitRepository, updatePatch);
    await database.flushChanges();

    return null;
  } catch (e) {
    return {
      errors: [e.message],
    };
  }
};

export const resetGitRepoAction = async ({ projectId, workspaceId }: { projectId: string; workspaceId?: string }) => {
  const repo = await getGitRepository({ projectId, workspaceId });

  invariant(repo, 'Git Repository not found');

  const flushId = await database.bufferChanges();

  if (workspaceId) {
    const workspaceMeta = await services.workspaceMeta.getByParentId(workspaceId);
    invariant(workspaceMeta, 'Workspace meta not found');
    await services.workspaceMeta.update(workspaceMeta, {
      gitRepositoryId: null,
    });
  } else if (projectId) {
    const project = await services.project.get(projectId);
    invariant(project, 'Project not found');
    await services.project.update(project, {
      gitRepositoryId: models.project.EMPTY_GIT_PROJECT_ID,
    });
  }

  await services.gitRepository.remove(repo);
  // Stop the file watcher for this repository (project-scoped flow only).
  repoFileWatcherRegistry.stopWatcher(repo._id);
  clearConflictSuppression(repo._id);

  await database.flushChanges(flushId);

  return null;
};

export interface CommitToGitRepoResult {
  errors?: string[];
}

export const commitToGitRepoAction = async ({
  projectId,
  workspaceId,
  message,
}: {
  projectId: string;
  workspaceId?: string;
  message: string;
}): Promise<CommitToGitRepoResult> => {
  try {
    const gitRepository = await getGitRepository({ workspaceId, projectId });
    // Flush DB changes to disk before committing
    await repoFileWatcherRegistry.flushNow(gitRepository._id);
    await GitVCS.setAuthor();
    await GitVCS.commit(message);

    let providerName = 'custom';
    if (gitRepository?.credentialsId) {
      const credentials = await services.gitCredentials.getById(gitRepository.credentialsId);
      invariant(credentials, 'Git Credentials not found');
      providerName = credentials.provider;
    }

    trackAnalyticsEvent(AnalyticsEvent.vcsAction, {
      ...vcsEventProperties('git', 'commit'),
      providerName,
      repoId: gitRepository._id,
    });

    const hasUnpushedChanges = await GitVCS.canPush(gitRepository.credentialsId);
    // update workspace meta with git sync data, use for show unpushed changes on collection card
    await services.gitRepository.update(gitRepository, {
      hasUnpushedChanges,
      cachedGitLastCommitTime: Date.now(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error while committing changes';
    return { errors: [message] };
  }

  return {
    errors: [],
  };
};

export const multipleCommitToGitRepoAction = async ({
  projectId,
  workspaceId,
  commits,
}: {
  projectId: string;
  workspaceId?: string;
  commits: {
    message: string;
    files: string[];
  }[];
}) => {
  const gitRepository = await getGitRepository({ projectId, workspaceId });
  // Flush DB changes to disk before committing
  await repoFileWatcherRegistry.flushNow(gitRepository._id);
  await GitVCS.setAuthor();

  for (const commit of commits) {
    // Get current git status
    const { changes } = await getGitChanges();

    // First, unstage everything to start with a clean slate for this commit
    if (changes.staged.length > 0) {
      await GitVCS.unstageChanges(changes.staged);
    }

    // Now stage only the files that should be included in this commit
    const filesToStageForCommit: { path: string; status: [any, any, any] }[] = [];

    // Refresh changes after unstaging everything
    const { changes: currentChanges } = await getGitChanges();

    for (const file of commit.files) {
      const fileChange = currentChanges.unstaged.find(c => c.path === file);
      if (fileChange) {
        filesToStageForCommit.push(fileChange);
      }
    }

    // Stage the files for this commit
    if (filesToStageForCommit.length > 0) {
      await GitVCS.stageChanges(filesToStageForCommit);

      // Commit the staged files
      await GitVCS.commit(commit.message);
    }
  }

  return null;
};

export const migrateLegacyInsomniaFolderToFile = async ({ projectId }: { projectId: string }) => {
  const gitRepository = await getGitRepository({ projectId });

  const fsClient = await getGitFSClient({ projectId, gitRepositoryId: gitRepository._id });

  const result = await importLegacyInsomniaFolder({ fsClient, projectId });

  if (result.errors) {
    console.error('Failed to import legacy Insomnia folder', result.errors);
    return;
  }

  if (result.changes) {
    await GitVCS.setAuthor();
    await GitVCS.stageChanges(result.changes);
    await commitToGitRepoAction({
      projectId,
      message: 'Migrated legacy .insomnia folder to file',
    });
  }
};

export const commitAndPushToGitRepoAction = async ({
  projectId,
  workspaceId,
  message,
}: {
  projectId: string;
  workspaceId?: string;
  message: string;
}): Promise<CommitToGitRepoResult> => {
  await assertBranchOnOrigin('push');
  const repo = await getGitRepository({ workspaceId, projectId });

  // Validate credentials before committing to prevent orphaned local commits
  // when the subsequent push would fail due to authentication issues.
  try {
    await validateGitCredentials({ credentialsId: repo.credentialsId, uri: repo.uri });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Authentication failed';
    return { errors: [errorMessage] };
  }

  try {
    // Flush DB changes to disk before committing
    await repoFileWatcherRegistry.flushNow(repo._id);
    await GitVCS.setAuthor();
    await GitVCS.commit(message);

    let providerName = 'custom';
    if (repo.credentialsId) {
      const credentials = await services.gitCredentials.getById(repo.credentialsId);
      invariant(credentials, 'Git Credentials not found');
      providerName = credentials.provider;
    }

    trackAnalyticsEvent(AnalyticsEvent.vcsAction, {
      ...vcsEventProperties('git', 'commit'),
      providerName,
      repoId: repo._id,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error while committing changes';
    return { errors: [message] };
  }

  let canPush = false;
  try {
    canPush = await GitVCS.canPush(repo.credentialsId);
  } catch (err) {
    if (err instanceof Errors.HttpError) {
      return {
        errors: [`${err.message}, ${err.data.response}`],
      };
    }
    const errorMessage = getErrorMessage(err);

    return { errors: [errorMessage] };
  }
  // If nothing to push, display that to the user
  if (!canPush) {
    return {
      errors: ['Nothing to push'],
    };
  }

  const bufferId = await database.bufferChanges();
  let providerName = 'custom';
  if (repo.credentialsId) {
    const credentials = await services.gitCredentials.getById(repo.credentialsId);
    invariant(credentials, 'Git Credentials not found');
    providerName = credentials.provider;
  }
  try {
    await GitVCS.push(repo.credentialsId);

    trackAnalyticsEvent(AnalyticsEvent.vcsAction, {
      ...vcsEventProperties('git', 'push'),
      providerName,
      repoId: repo._id,
    });

    const hasUnpushedChanges = await GitVCS.canPush(repo.credentialsId);

    await services.gitRepository.update(repo, {
      hasUnpushedChanges,
      cachedGitLastCommitTime: Date.now(),
    });
  } catch (err: unknown) {
    if (err instanceof Errors.PushRejectedError && err.data.reason === 'not-fast-forward') {
      return {
        errors: [GitVCSOperationErrors.RequiredPullRemoteChangesError],
      };
    }

    if (err instanceof Errors.PushRejectedError && err.data.reason === 'tag-exists') {
      return {
        errors: [
          'Push Rejected. It seems that the tag you are trying to push already exists in the remote repository.',
        ],
      };
    }

    if (err instanceof Errors.HttpError) {
      return {
        errors: [`${err.message}, ${err.data.response}`],
      };
    }
    const errorMessage = getErrorMessage(err);

    trackAnalyticsEvent(AnalyticsEvent.vcsAction, {
      ...vcsEventProperties('git', 'push', errorMessage),
      providerName,
      repoId: repo._id,
    });

    return {
      errors: [`Error Pushing Repository, ${errorMessage}`],
    };
  }

  await database.flushChanges(bufferId);

  return {
    errors: [],
  };
};

export interface CreateNewGitBranchResult {
  errors?: string[];
}

export const createNewGitBranchAction = async ({
  projectId,
  workspaceId,
  branch,
}: {
  projectId: string;
  workspaceId?: string;
  branch: string;
}): Promise<CreateNewGitBranchResult> => {
  const gitRepository = await getGitRepository({ workspaceId, projectId });
  invariant(typeof branch === 'string', 'Branch name is required');

  try {
    let providerName = 'custom';
    if (gitRepository?.credentialsId) {
      const credentials = await services.gitCredentials.getById(gitRepository.credentialsId);
      invariant(credentials, 'Git Credentials not found');
      providerName = credentials.provider;
    }
    await GitVCS.checkout(branch);
    trackAnalyticsEvent(AnalyticsEvent.vcsAction, {
      ...vcsEventProperties('git', 'create_branch'),
      providerName,
      repoId: gitRepository._id,
    });

    const { hasUncommittedChanges } = await getGitChanges();

    let hasUnpushedChanges = false;
    try {
      hasUnpushedChanges = await GitVCS.canPush(gitRepository.credentialsId);
    } catch (err) {
      console.error('Error checking for unpushed changes', err);
      hasUnpushedChanges = false;
    }

    await services.gitRepository.update(gitRepository, {
      hasUncommittedChanges,
      hasUnpushedChanges,
      cachedGitRepositoryBranch: branch,
    });
  } catch (err) {
    if (err instanceof Errors.HttpError) {
      return {
        errors: [`${err.message}, ${err.data.response}`],
      };
    }
    const errorMessage = err instanceof Error ? err.message : 'Something went wrong while creating a new branch';
    return {
      errors: [errorMessage],
    };
  }

  return {};
};

export interface CheckoutGitBranchResult {
  errors?: string[];
  success?: boolean;
  warnings?: string[];
}

export const checkoutGitBranchAction = async ({
  projectId,
  workspaceId,
  branch,
}: {
  projectId: string;
  workspaceId?: string;
  branch: string;
}): Promise<CheckoutGitBranchResult> => {
  try {
    const gitRepository = await getGitRepository({ workspaceId, projectId });

    const bufferId = await database.bufferChanges();
    await GitVCS.checkout(branch);

    // Import all YAML files from disk into the DB after checkout
    await repoFileWatcherRegistry.importAllFiles(gitRepository._id);

    const log = (await GitVCS.log({ depth: 1 })) || [];

    const author = log[0] ? log[0].commit.author : null;
    const cachedGitLastCommitTime = author ? author.timestamp * 1000 : Date.now();

    const { hasUncommittedChanges } = await getGitChanges();

    let hasUnpushedChanges = false;
    try {
      hasUnpushedChanges = await GitVCS.canPush(gitRepository.credentialsId);
    } catch (err) {
      console.error('Error checking for unpushed changes', err);
      hasUnpushedChanges = false;
    }

    await services.gitRepository.update(gitRepository, {
      cachedGitLastCommitTime,
      cachedGitRepositoryBranch: branch,
      cachedGitLastAuthor: author?.name || null,
      hasUncommittedChanges,
      hasUnpushedChanges,
    });

    await database.flushChanges(bufferId);

    const branchRemoteInfo = await GitVCS.getBranchRemoteInfo(branch);
    if (!branchRemoteInfo.isOrigin) {
      return {
        success: true,
        warnings: [
          `Branch "${branch}" tracks remote "${branchRemoteInfo.trackingRemote}". ` +
            `Push, pull, and fetch will not work from Insomnia. Use the git CLI to sync this branch.`,
        ],
      };
    }

    return {
      success: true,
    };
  } catch (err) {
    if (err instanceof Errors.HttpError) {
      return {
        errors: [`${err.message}, ${err.data.response}`],
      };
    }

    if (err instanceof Errors.CheckoutConflictError) {
      try {
        const { hasUncommittedChanges } = await getGitChanges();

        if (!hasUncommittedChanges) {
          // Retry checkout with force if there are no uncommitted changes
          await GitVCS.checkout(branch, { force: true });
          return {
            success: true,
          };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : error.toString();
        return {
          errors: [errorMessage],
        };
      }

      return {
        errors: [`${err.message} - Please commit or discard your changes before switching branches.`],
      };
    }

    const errorMessage = err instanceof Error ? err.message : err.toString();

    return {
      errors: [getErrorMessage(errorMessage)],
    };
  }
};

export const mergeGitBranch = async ({
  projectId,
  workspaceId,
  theirsBranch,
  allowUncommittedChangesBeforeMerge = false,
}: {
  theirsBranch: string;
  projectId: string;
  workspaceId?: string;
  allowUncommittedChangesBeforeMerge?: boolean;
}) => {
  const gitRepository = await getGitRepository({ workspaceId, projectId });
  let providerName = 'custom';
  if (gitRepository?.credentialsId) {
    const credentials = await services.gitCredentials.getById(gitRepository.credentialsId);
    invariant(credentials, 'Git Credentials not found');
    providerName = credentials.provider;
  }

  invariant(typeof theirsBranch === 'string', 'Branch name is required');

  const bufferId = await database.bufferChanges();

  try {
    suppressConflictProblems(gitRepository._id);
    await GitVCS.merge({
      theirsBranch,
      allowUncommittedChangesBeforeMerge,
    });
    // isomorphic-git does not update the working area after merge, we need to do it manually by checking out the current branch
    const currentBranch = await GitVCS.getCurrentBranch();
    await GitVCS.checkout(currentBranch);

    // Import all YAML files from disk into the DB after merge + checkout
    const gitRepoId = gitRepository._id;
    await repoFileWatcherRegistry.importAllFiles(gitRepoId);
    clearConflictSuppression(gitRepository._id);

    trackAnalyticsEvent(AnalyticsEvent.vcsAction, {
      ...vcsEventProperties('git', 'merge_branch'),
      providerName,
      repoId: gitRepository._id,
    });

    const log = (await GitVCS.log({ depth: 1 })) || [];

    const author = log[0] ? log[0].commit.author : null;
    const cachedGitLastCommitTime = author ? author.timestamp * 1000 : Date.now();
    await services.gitRepository.update(gitRepository, {
      cachedGitLastCommitTime,
      cachedGitRepositoryBranch: await GitVCS.getCurrentBranch(),
    });

    await database.flushChanges(bufferId, true);
    return {};
  } catch (err) {
    if (err instanceof MergeConflictError) {
      // Keep suppression active — user will resolve via SyncMergeModal.
      return err.data;
    }
    clearConflictSuppression(gitRepository._id);
    let errorMessage = getErrorMessage(err);

    if (err instanceof Errors.HttpError) {
      errorMessage = `${err.message}, ${err.data.response}`;
    }

    trackAnalyticsEvent(AnalyticsEvent.vcsAction, {
      ...vcsEventProperties('git', 'merge_branch', errorMessage),
      providerName,
      repoId: gitRepository._id,
    });

    return {
      errors: [errorMessage],
    };
  }
};

export interface DeleteGitBranchResult {
  errors?: string[];
}

export const deleteGitBranchAction = async ({
  projectId,
  workspaceId,
  branch,
}: {
  projectId: string;
  workspaceId?: string;
  branch: string;
}): Promise<DeleteGitBranchResult> => {
  try {
    const repo = await getGitRepository({ workspaceId, projectId });
    await GitVCS.deleteBranch(branch);

    let providerName = 'custom';
    if (repo.credentialsId) {
      const credentials = await services.gitCredentials.getById(repo.credentialsId);
      invariant(credentials, 'Git Credentials not found');
      providerName = credentials.provider;
    }

    trackAnalyticsEvent(AnalyticsEvent.vcsAction, {
      ...vcsEventProperties('git', 'delete_branch'),
      providerName,
      repoId: repo._id,
    });
    return {};
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    return { errors: [errorMessage] };
  }
};

export interface PushToGitRemoteResult {
  errors?: string[];
  success?: boolean;
  gitRepository?: GitRepository;
}

export const pushToGitRemoteAction = async ({
  projectId,
  workspaceId,
  // @TODO - Force is never used
  force,
}: {
  projectId: string;
  workspaceId?: string;
  force?: boolean;
}): Promise<PushToGitRemoteResult> => {
  await assertBranchOnOrigin('push');
  const gitRepository = await getGitRepository({ projectId, workspaceId });

  // Flush DB changes to disk before pushing
  await repoFileWatcherRegistry.flushNow(gitRepository._id);

  // Check if there is anything to push
  let canPush = false;
  try {
    canPush = await GitVCS.canPush(gitRepository.credentialsId);
  } catch (err) {
    if (
      err instanceof Errors.UserCanceledError ||
      (err instanceof Errors.HttpError && (err.data.statusCode === 401 || err.data.statusCode === 403))
    ) {
      return {
        errors: [GitVCSOperationErrors.AuthenticationRequiredError],
        gitRepository,
      };
    }

    if (err instanceof Errors.HttpError) {
      return {
        errors: [`${err.message}, ${err.data.response}`],
        gitRepository,
      };
    }
    const errorMessage = getErrorMessage(err);

    return { errors: [errorMessage], gitRepository };
  }
  // If nothing to push, display that to the user
  if (!canPush) {
    return {
      errors: ['Nothing to push'],
      gitRepository,
    };
  }

  let providerName = 'custom';
  if (gitRepository?.credentialsId) {
    const credentials = await services.gitCredentials.getById(gitRepository.credentialsId);
    invariant(credentials, 'Git Credentials not found');
    providerName = credentials.provider;
  }
  try {
    const bufferId = await database.bufferChanges();
    await GitVCS.push(gitRepository.credentialsId);

    trackAnalyticsEvent(AnalyticsEvent.vcsAction, {
      ...vcsEventProperties('git', force ? 'force_push' : 'push'),
      providerName,
      repoId: gitRepository._id,
    });

    await services.gitRepository.update(gitRepository, {
      hasUnpushedChanges: false,
    });
    await database.flushChanges(bufferId);
  } catch (err: unknown) {
    if (err instanceof Errors.PushRejectedError && err.data.reason === 'not-fast-forward') {
      return {
        errors: [GitVCSOperationErrors.RequiredPullRemoteChangesError],

        gitRepository,
      };
    }

    if (err instanceof Errors.PushRejectedError && err.data.reason === 'tag-exists') {
      return {
        errors: [
          'Push Rejected. It seems that the tag you are trying to push already exists in the remote repository.',
        ],
      };
    }

    if (
      err instanceof Errors.UserCanceledError ||
      (err instanceof Errors.HttpError && (err.data.statusCode === 401 || err.data.statusCode === 403))
    ) {
      return {
        errors: [GitVCSOperationErrors.AuthenticationRequiredError],
        gitRepository,
      };
    }

    if (err instanceof Errors.HttpError) {
      return {
        errors: [`${err.message}, ${err.data.response}`],
        gitRepository,
      };
    }
    const errorMessage = getErrorMessage(err);

    trackAnalyticsEvent(AnalyticsEvent.vcsAction, {
      ...vcsEventProperties('git', 'push', errorMessage),
      providerName,
      repoId: gitRepository._id,
    });

    return {
      errors: [`Error Pushing Repository, ${errorMessage}`],
      gitRepository,
    };
  }

  return {
    success: true,
  };
};

export async function fetchGitRemoteBranches({
  uri,
  credentialsId,
}: {
  uri: string;
  credentialsId?: string;
}): Promise<{ branches: string[]; errors?: string[] }> {
  try {
    if (!credentialsId) {
      return { branches: [] };
    }

    const credentials = await services.gitCredentials.getById(credentialsId);

    if (!credentials) {
      return { branches: [] };
    }
    const gitProvider = gitRemoteProviderRegistry.get(credentials.provider as GitRemoteProviderType);
    const validateResult = await gitProvider?.validateUrl(uri);
    if (!validateResult?.valid) {
      throw new Error('Invalid Git Repository URL');
    }
    const branches = await fetchRemoteBranches({
      uri: parseGitToHttpsURL(uri),
      credentialsId,
    });

    return { branches };
  } catch (err) {
    const errorMessage = `Could not fetch remote branches: ${getErrorMessage(err)}`;
    return { branches: [], errors: [errorMessage] };
  }
}

export async function pullFromGitRemote({ projectId, workspaceId }: { projectId: string; workspaceId?: string }) {
  let repoId: string | null = null;
  try {
    await assertBranchOnOrigin('pull');
    const gitRepository = await getGitRepository({ projectId, workspaceId });
    repoId = gitRepository._id;
    suppressConflictProblems(repoId);
    invariant(gitRepository.credentialsId, 'Git Credentials ID is required');
    const credentials = await services.gitCredentials.getById(gitRepository.credentialsId);
    invariant(credentials, 'Git Credentials not found');

    const bufferId = await database.bufferChanges();
    await GitVCS.pullWithConflictSupport(gitRepository.credentialsId);

    // Import all YAML files from disk into the DB after pull
    await repoFileWatcherRegistry.importAllFiles(gitRepository._id);
    clearConflictSuppression(repoId);

    trackAnalyticsEvent(AnalyticsEvent.vcsAction, {
      ...vcsEventProperties('git', 'pull'),
      providerName: credentials.provider,
      repoId: gitRepository._id,
    });

    const log = (await GitVCS.log({ depth: 1 })) || [];

    const author = log[0] ? log[0].commit.author : null;
    const cachedGitLastCommitTime = author ? author.timestamp * 1000 : Date.now();
    await services.gitRepository.update(gitRepository, {
      cachedGitLastCommitTime,
      cachedGitRepositoryBranch: await GitVCS.getCurrentBranch(),
    });

    await database.flushChanges(bufferId);

    return {
      success: true,
    };
  } catch (err: unknown) {
    if (err instanceof MergeConflictError) {
      // Keep suppression active — user will resolve via SyncMergeModal.
      // clearConflictSuppression is called by continueMerge or abortMergeAction.
      return err.data;
    }

    if (repoId) clearConflictSuppression(repoId);

    if (
      err instanceof Errors.UserCanceledError ||
      (err instanceof Errors.HttpError && (err.data.statusCode === 401 || err.data.statusCode === 403))
    ) {
      return {
        success: false,
        errors: [GitVCSOperationErrors.AuthenticationRequiredError],
      };
    }

    let errorMessage = getErrorMessage(err);

    if (err instanceof Errors.HttpError) {
      errorMessage = `${err.message}, ${err.data.response}`;
    }

    const gitRepository = await getGitRepository({ projectId, workspaceId });
    let providerName = 'custom';
    if (gitRepository?.credentialsId) {
      const credentials = await services.gitCredentials.getById(gitRepository.credentialsId);
      invariant(credentials, 'Git Credentials not found');
      providerName = credentials.provider;
    }

    trackAnalyticsEvent(AnalyticsEvent.vcsAction, {
      ...vcsEventProperties('git', 'pull', errorMessage),
      providerName,
      repoId: gitRepository._id,
    });

    return {
      success: false,
      errors: [errorMessage],
    };
  }
}

export const continueMerge = async ({
  projectId,
  workspaceId,
  handledMergeConflicts,
  autoResolvedConflicts,
  commitMessage,
  commitParent,
}: {
  projectId: string;
  workspaceId?: string;
  handledMergeConflicts: MergeConflict[];
  autoResolvedConflicts?: AutoResolvedConflict[];
  commitMessage: string;
  commitParent: string[];
}) => {
  try {
    const gitRepository = await getGitRepository({ workspaceId, projectId });
    const bufferId = await database.bufferChanges();

    await GitVCS.continueMerge({
      handledMergeConflicts,
      autoResolvedConflicts,
      commitMessage,
      commitParent,
    });

    // Import all YAML files from disk into the DB after merge resolution
    await repoFileWatcherRegistry.importAllFiles(gitRepository._id);
    // Files are clean now — lift the conflict suppression so any remaining
    // issues (parse errors etc.) are reported normally.
    clearConflictSuppression(gitRepository._id);

    const log = (await GitVCS.log({ depth: 1 })) || [];

    const author = log[0] ? log[0].commit.author : null;
    const cachedGitLastCommitTime = author ? author.timestamp * 1000 : Date.now();
    await services.gitRepository.update(gitRepository, {
      cachedGitLastCommitTime,
      cachedGitRepositoryBranch: await GitVCS.getCurrentBranch(),
    });

    await database.flushChanges(bufferId);

    return {};
  } catch (err) {
    return {
      errors: [err instanceof Error ? err.message : 'Error while continuing merge'],
    };
  }
};

export interface GitChange {
  path: string;
  type: string;
  status: string;
  staged: boolean;
  added: boolean;
  editable: boolean;
}

async function getGitChanges() {
  const changes = await GitVCS.status();
  return {
    changes,
    hasUncommittedChanges: changes.staged.length > 0 || changes.unstaged.length > 0,
  };
}

async function diff() {
  const diff = await GitVCS.diff();
  return diff;
}

export const discardChangesAction = async ({
  projectId,
  workspaceId,
  paths,
}: {
  projectId: string;
  workspaceId?: string;
  paths: string[];
}): Promise<{
  success?: boolean;
  errors?: string[];
}> => {
  try {
    const gitRepository = await getGitRepository({ workspaceId, projectId });
    const { changes } = await getGitChanges();

    const files = changes.unstaged.filter(change => paths.includes(change.path));

    await GitVCS.discardChanges(files);

    // Discarding an untracked, never-committed workspace deletes its YAML from disk.
    // Remove the orphaned workspace from the DB instead of resurrecting it, otherwise
    // the discarded change reappears immediately.
    await repoFileWatcherRegistry.importAllFiles(gitRepository._id, { removeLocalOnlyOrphans: true });

    await services.gitRepository.update(gitRepository, {
      cachedGitLastCommitTime: Date.now(),
    });

    return {
      success: true,
    };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Error while rolling back changes';
    return {
      success: false,
      errors: [errorMessage],
    };
  }
};

export const abortMergeAction = async ({ projectId, workspaceId }: { projectId: string; workspaceId?: string }) => {
  const gitRepository = await getGitRepository({ projectId, workspaceId });
  clearConflictSuppression(gitRepository._id);
  return GitVCS.abortMerge();
};

export interface GitStatusResult {
  status: {
    localChanges: number;
  };
}

export const gitStatusAction = async ({
  projectId,
  workspaceId,
}: {
  projectId: string;
  workspaceId?: string;
}): Promise<GitStatusResult> => {
  try {
    const gitRepository = await getGitRepository({ workspaceId, projectId });
    // Flush DB changes to disk before checking git status
    await repoFileWatcherRegistry.flushNow(gitRepository._id);
    const { hasUncommittedChanges, changes } = await getGitChanges();
    const localChanges = changes.staged.length + changes.unstaged.length;

    await services.gitRepository.update(gitRepository, {
      hasUncommittedChanges,
    });

    return {
      status: {
        localChanges,
      },
    };
  } catch (e) {
    console.error(e);
    return {
      status: {
        localChanges: 0,
      },
    };
  }
};

export const stageChangesAction = async ({
  projectId,
  workspaceId,
  paths,
}: {
  projectId: string;
  workspaceId?: string;
  paths: string[];
}): Promise<{
  errors?: string[];
}> => {
  try {
    await getGitRepository({ workspaceId, projectId });
    const { changes } = await getGitChanges();

    const files = changes.unstaged.filter(change => paths.includes(change.path));

    await GitVCS.stageChanges(files);
    return {};
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Error while staging changes';
    return {
      errors: [errorMessage],
    };
  }
};

export const unstageChangesAction = async ({
  projectId,
  workspaceId,
  paths,
}: {
  projectId: string;
  workspaceId?: string;
  paths: string[];
}): Promise<{
  errors?: string[];
}> => {
  try {
    await getGitRepository({ workspaceId, projectId });
    const { changes } = await getGitChanges();

    const files = changes.staged.filter(change => paths.includes(change.path));

    await GitVCS.unstageChanges(files);
    return {};
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Error while unstaging changes';
    return {
      errors: [errorMessage],
    };
  }
};

function getPreviewItemNameAndScope(previewDiffItem: { before: string; after: string }) {
  let prevName = '';
  let nextName = '';

  let prevScope: WorkspaceScope = 'collection';
  let nextScope: WorkspaceScope = 'collection';

  try {
    const prev = parse(previewDiffItem.before);

    if ((prev && 'fileName' in prev) || 'name' in prev) {
      prevName = prev.fileName || prev.name;
    }
    if ('type' in prev) {
      prevScope = insomniaSchemaTypeToScope(prev.type);
    }
  } catch {
    // Nothing to do
  }

  try {
    const next = parse(previewDiffItem.after);
    if ((next && 'fileName' in next) || 'name' in next) {
      nextName = next.fileName || next.name;
    }
    if ('type' in next) {
      nextScope = insomniaSchemaTypeToScope(next.type);
    }
  } catch {
    // Nothing to do
  }

  return {
    name: nextName || prevName,
    scope: nextScope || prevScope,
  };
}

export type GitDiffResult =
  | {
      name: string;
      diff?: {
        before: string;
        after: string;
      };
      filepath: string;
      scope: WorkspaceScope;
      staged: boolean;
    }
  | {
      errors: string[];
    };

export const diffFileLoader = async ({
  projectId,
  workspaceId,
  filepath,
  staged,
}: {
  projectId: string;
  workspaceId?: string;
  filepath: string;
  staged: boolean;
}): Promise<GitDiffResult> => {
  try {
    await getGitRepository({ workspaceId, projectId });
    const fileStatus = await GitVCS.fileStatus(filepath);

    const diff = staged
      ? {
          before: fileStatus.head,
          after: fileStatus.stage,
        }
      : {
          before: fileStatus.stage || fileStatus.head,
          after: fileStatus.workdir,
        };

    const { name, scope } = getPreviewItemNameAndScope(diff);

    return {
      name: name || filepath,
      diff,
      filepath,
      scope,
      staged,
    };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Error while unstaging changes';
    return {
      errors: [errorMessage],
    };
  }
};

interface GitRepoFile {
  id: string;
  name: string;
  type: 'file';
}

interface GitRepoDirectory {
  id: string;
  name: string;
  type: 'directory';
  children: (GitRepoDirectory | GitRepoFile)[];
}

type FileTree =
  | {
      id: string;
      name: string;
      type: 'root';
      children: (GitRepoDirectory | GitRepoFile)[];
    }
  | GitRepoDirectory
  | GitRepoFile;

const getRepositoryDirectoryTree = async ({
  projectId,
}: {
  projectId: string;
}): Promise<{
  repositoryTree: FileTree;
  folderList: Record<string, string[]>;
}> => {
  const project = await services.project.get(projectId);

  if (project && models.project.isEmptyGitProject(project)) {
    return {
      repositoryTree: {
        id: '',
        name: 'Repository',
        type: 'root',
        children: [],
      },
      folderList: {},
    };
  }

  const gitRepository = await getGitRepository({ projectId });
  const fs = await getGitFSClient({ projectId, gitRepositoryId: gitRepository._id });

  const rootContents = await fs.promises.readdir(GIT_CLONE_DIR);

  const folderList: Record<string, string[]> = {
    '': rootContents,
  };

  const recursivelyGetDirectoryTree = async (directoryContents: string[], parentPath: string) => {
    const tree: (GitRepoDirectory | GitRepoFile)[] = await Promise.all(
      directoryContents.map(async (file: string) => {
        const fileOrDirPath = path.join(parentPath, file);
        const stats = await fs.promises.lstat(fileOrDirPath);
        if (await stats.isDirectory()) {
          const subDirectoryContents = await fs.promises.readdir(fileOrDirPath);
          folderList[fileOrDirPath] = subDirectoryContents;
          return {
            id: fileOrDirPath,
            name: file,
            type: 'directory',
            children: await recursivelyGetDirectoryTree(subDirectoryContents, fileOrDirPath),
          };
        }
        return {
          id: fileOrDirPath,
          name: file,
          type: 'file',
        };
      }),
    );

    return tree;
  };

  const tree = await recursivelyGetDirectoryTree(rootContents, GIT_CLONE_DIR);

  return {
    repositoryTree: {
      id: '',
      name: gitRepository.uri.split('/').pop()?.replace('.git', '').toUpperCase() || 'Repository',
      type: 'root',
      children: tree,
    } satisfies FileTree,
    folderList,
  };
};

async function listGitProviders() {
  const providers = gitRemoteProviderRegistry.listProviderOptions();

  return providers;
}

async function initSignInToGitProvider({ provider }: { provider: GitRemoteProviderType }) {
  const gitProvider = gitRemoteProviderRegistry.get(provider);

  invariant(gitProvider, `Git provider ${provider} not found`);

  invariant(gitProvider.initiateOAuth, `Git provider ${provider} does not support OAuth`);

  try {
    await gitProvider.initiateOAuth();

    return {};
  } catch (error) {
    console.error(`Failed to initiate the ${provider} OAuth flow:`, error);
    return { errors: [`Failed to initiate the ${provider} OAuth flow. ${getErrorMessage(error)}`] };
  }
}

async function completeSignInToGitProvider({
  provider,
  code,
  state,
  isEditing,
}: {
  provider: GitRemoteProviderType;
  code: string;
  state: string;
  isEditing?: boolean;
}) {
  const gitProvider = gitRemoteProviderRegistry.get(provider);

  invariant(gitProvider, `Git provider ${provider} not found`);
  invariant(gitProvider.completeOAuth, `Git provider ${provider} does not support OAuth`);

  try {
    const result = await gitProvider.completeOAuth(code, state);

    if (!result.success) {
      return { errors: [result.error || `Failed to complete the ${provider} OAuth flow`] };
    }

    if (isEditing) {
      trackAnalyticsEvent(AnalyticsEvent.gitAuthenticationUpdated, { provider });
    } else {
      trackAnalyticsEvent(AnalyticsEvent.gitAuthenticationCompleted, { provider });
    }

    return {};
  } catch (error) {
    console.error('Failed to complete OAuth flow:', provider, error);
    return { errors: [`Failed to complete the ${provider} OAuth flow. ${getErrorMessage(error)}`] };
  }
}

async function getGitProviderRepositories({
  credentialsId,
  refresh,
}: {
  credentialsId: string;
  refresh?: boolean;
}): Promise<{
  repos: ProviderRepository[];
  errors: string[];
}> {
  try {
    const credentials = await services.gitCredentials.getById(credentialsId);
    invariant(credentials, 'Git credentials not found');
    invariant(models.gitCredentials.isGitCredentialsV2(credentials), 'Invalid Git credentials');

    // Use the appropriate provider for fetching repositories
    const provider = gitRemoteProviderRegistry.get(credentials.provider);
    if (!provider?.supportsFetchRepos || !provider.fetchRepositories) {
      return {
        errors: [`${credentials.provider} provider not available.`],
        repos: [],
      };
    }

    const providerRepos = await provider.fetchRepositories(credentials, refresh);

    return { repos: providerRepos, errors: [] };
  } catch (error) {
    const errorMessage = `Failed to fetch repositories from Git provider. ${getErrorMessage(error)}`;
    return { repos: [], errors: [errorMessage] };
  }
}

async function getGitProviderEmails({ credentialsId }: { credentialsId: string }): Promise<{
  emails: ProviderEmail[];
  errors: string[];
}> {
  try {
    const credentials = await services.gitCredentials.getById(credentialsId);
    invariant(credentials, 'Git credentials not found');
    invariant(models.gitCredentials.isGitCredentialsV2(credentials), 'Invalid Git credentials');

    const provider = gitRemoteProviderRegistry.get(credentials.provider);
    if (!provider?.supportsFetchEmails || !provider.fetchUserEmails) {
      return {
        errors: [`${credentials.provider} provider does not support fetching emails.`],
        emails: [],
      };
    }

    const emails = await provider.fetchUserEmails(credentials);

    if (credentials.credentials) {
      await services.gitCredentials.update(credentials, {
        credentials: {
          ...credentials.credentials,
          emails,
        },
      } as any);
    }

    return { emails, errors: [] };
  } catch (error) {
    const errorMessage = `Failed to fetch emails from Git provider. ${getErrorMessage(error)}`;
    return { emails: [], errors: [errorMessage] };
  }
}

export const getGitLabOauthApiURL = () => INSOMNIA_GITLAB_API_URL || 'https://gitlab.com';

async function getCurrentBranchByRepositoryId({
  repositoryId,
  projectId,
}: {
  repositoryId: string;
  projectId: string;
}): Promise<any> {
  const fs = await getGitFSClient({ gitRepositoryId: repositoryId, projectId });
  return GitVCSClass.getRepoCurrentBranch({
    fs,
  });
}

export interface MigrationSummary {
  logs: string[];
  failedProjects: { id: string; name: string }[];
  totalProjects: number;
}

export async function runAllGitRepoMigrations(): Promise<MigrationSummary> {
  const logs: string[] = [];
  const failedProjects: { id: string; name: string }[] = [];

  const allProjects = await services.project.list();
  const gitProjects = allProjects.filter((p): p is GitProject => models.project.isConnectedGitProject(p));

  if (gitProjects.length === 0) return { logs, failedProjects, totalProjects: 0 };

  // Batch-fetch all git repositories in one query instead of N individual lookups.
  const repoIds = gitProjects.map(p => models.project.getEffectiveRepoId(p)).filter(Boolean) as string[];
  const gitRepositories = await database.find<GitRepository>(models.gitRepository.type, {
    _id: { $in: repoIds },
  });
  const repoById = new Map(gitRepositories.map(r => [r._id, r]));

  // Hoist — same value for every repo.
  const baseDataPath = process.env['INSOMNIA_DATA_PATH'] || app.getPath('userData');

  const ts = () => new Date().toISOString();
  const projectList = gitProjects.map(p => `"${p.name}"`).join(', ');
  logs.push(
    `${ts()} [INFO] Starting migration v${CURRENT_MIGRATION_VERSION} for ${gitProjects.length} repo(s): ${projectList}`,
  );

  let migratedCount = 0;

  await Promise.all(
    gitProjects.map(async project => {
      const gitRepository = repoById.get(models.project.getEffectiveRepoId(project)!);
      if (!gitRepository) return;

      const repoId = gitRepository._id;
      const logger = (level: 'info' | 'warn' | 'error', message: string) => {
        logs.push(`${ts()} [${level.toUpperCase()}] ["${project.name}"] ${message}`);
      };

      const allowedBase = path.resolve(baseDataPath);
      const baseDir = path.resolve(allowedBase, 'version-control', 'git', repoId);
      if (!baseDir.startsWith(allowedBase + path.sep)) {
        logger('warn', `Skipping repo with unsafe path — repoId may contain path traversal: ${repoId}`);
        return;
      }

      const success = await migrateRepoStructureIfNeeded(baseDir, project._id, repoId, logger);
      if (!success) {
        failedProjects.push({ id: project._id, name: project.name });
      } else {
        migratedCount++;
      }
    }),
  );

  // In case we have any failed projects, convert them to local projects.
  await Promise.all(
    failedProjects.map(async ({ id, name }) => {
      logs.push(`${ts()} [INFO] ["${name}"] Converting to local project`);
      try {
        const project = await services.project.get(id);
        if (!project || !models.project.isConnectedGitProject(project)) {
          logs.push(`${ts()} [WARN] ["${name}"] Project not found or already local — skipping`);
          return;
        }

        const effectiveRepoId = models.project.getEffectiveRepoId(project as GitProject);
        const gitRepository = effectiveRepoId ? await services.gitRepository.getById(effectiveRepoId) : null;
        if (gitRepository) {
          await services.gitRepository.remove(gitRepository);
          logs.push(`${ts()} [INFO] ["${name}"] Removed git repository ${effectiveRepoId}`);
        }

        await services.project.update(project, { name, gitRepositoryId: null });
        logs.push(`${ts()} [INFO] ["${name}"] Successfully converted to local`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error && err.stack ? `\n${err.stack}` : '';
        logs.push(`${ts()} [ERROR] ["${name}"] Failed to convert to local: ${message}${stack}`);
      }
    }),
  );

  return { logs, failedProjects, totalProjects: migratedCount };
}

export interface GitServiceAPI {
  loadGitRepository: typeof loadGitRepository;
  getGitBranches: typeof getGitBranches;
  gitFetchAction: typeof gitFetchAction;
  gitLogLoader: typeof gitLogLoader;
  gitChangesLoader: typeof gitChangesLoader;
  canPushLoader: typeof canPushLoader;
  initGitRepoClone: typeof initGitRepoCloneAction;
  cloneGitRepo: typeof cloneGitRepoAction;
  updateGitRepo: typeof updateGitRepoAction;
  resetGitRepo: typeof resetGitRepoAction;
  commitToGitRepo: typeof commitToGitRepoAction;
  commitAndPushToGitRepo: typeof commitAndPushToGitRepoAction;
  multipleCommitToGitRepo: typeof multipleCommitToGitRepoAction;
  createNewGitBranch: typeof createNewGitBranchAction;
  checkoutGitBranch: typeof checkoutGitBranchAction;
  mergeGitBranch: typeof mergeGitBranch;
  deleteGitBranch: typeof deleteGitBranchAction;
  pushToGitRemote: typeof pushToGitRemoteAction;
  pullFromGitRemote: typeof pullFromGitRemote;
  continueMerge: typeof continueMerge;
  discardChanges: typeof discardChangesAction;
  abortMerge: typeof abortMergeAction;
  gitStatus: typeof gitStatusAction;
  diff: typeof diff;
  stageChanges: typeof stageChangesAction;
  unstageChanges: typeof unstageChangesAction;
  diffFileLoader: typeof diffFileLoader;
  getRepositoryDirectoryTree: typeof getRepositoryDirectoryTree;
  migrateLegacyInsomniaFolderToFile: typeof migrateLegacyInsomniaFolderToFile;
  fetchGitRemoteBranches: typeof fetchGitRemoteBranches;
  validateGitRepositoryCredentials: typeof validateGitRepositoryCredentials;
  validateGitCredentialById: typeof validateGitCredentialById;
  getProjectGitFileIssues: typeof getProjectGitFileIssues;

  initSignInToGitProvider: typeof initSignInToGitProvider;
  completeSignInToGitProvider: typeof completeSignInToGitProvider;
  getCurrentBranchByRepositoryId: typeof getCurrentBranchByRepositoryId;

  getGitProviderRepositories: typeof getGitProviderRepositories;
  getGitProviderEmails: typeof getGitProviderEmails;
  listGitProviders: typeof listGitProviders;
  getBranchRemoteInfo: typeof getBranchRemoteInfo;
  runAllGitRepoMigrations: typeof runAllGitRepoMigrations;
}

export const registerGitServiceAPI = () => {
  ipcMainHandle('git.loadGitRepository', (_, options: Parameters<typeof loadGitRepository>[0]) =>
    loadGitRepository(options),
  );
  ipcMainHandle('git.getGitBranches', (_, options: Parameters<typeof getGitBranches>[0]) => getGitBranches(options));
  ipcMainHandle('git.fetchGitRemoteBranches', (_, options: Parameters<typeof fetchGitRemoteBranches>[0]) =>
    fetchGitRemoteBranches(options),
  );
  ipcMainHandle(
    'git.validateGitRepositoryCredentials',
    (_, options: Parameters<typeof validateGitRepositoryCredentials>[0]) => validateGitRepositoryCredentials(options),
  );
  ipcMainHandle('git.validateGitCredentialById', (_, options: Parameters<typeof validateGitCredentialById>[0]) =>
    validateGitCredentialById(options),
  );
  ipcMainHandle('git.getProjectGitFileIssues', (_, options: Parameters<typeof getProjectGitFileIssues>[0]) =>
    getProjectGitFileIssues(options),
  );
  ipcMainHandle('git.gitFetchAction', (_, options: Parameters<typeof gitFetchAction>[0]) => gitFetchAction(options));
  ipcMainHandle('git.gitLogLoader', (_, options: Parameters<typeof gitLogLoader>[0]) => gitLogLoader(options));
  ipcMainHandle('git.gitChangesLoader', (_, options: Parameters<typeof gitChangesLoader>[0]) =>
    gitChangesLoader(options),
  );
  ipcMainHandle('git.canPushLoader', (_, options: Parameters<typeof canPushLoader>[0]) => canPushLoader(options));
  ipcMainHandle('git.cloneGitRepo', (_, options: Parameters<typeof cloneGitRepoAction>[0]) =>
    cloneGitRepoAction(options),
  );
  ipcMainHandle('git.initGitRepoClone', (_, options: Parameters<typeof initGitRepoCloneAction>[0]) =>
    initGitRepoCloneAction(options),
  );
  ipcMainHandle('git.updateGitRepo', (_, options: Parameters<typeof updateGitRepoAction>[0]) =>
    updateGitRepoAction(options),
  );
  ipcMainHandle('git.resetGitRepo', (_, options: Parameters<typeof resetGitRepoAction>[0]) =>
    resetGitRepoAction(options),
  );
  ipcMainHandle('git.commitToGitRepo', (_, options: Parameters<typeof commitToGitRepoAction>[0]) =>
    commitToGitRepoAction(options),
  );
  ipcMainHandle('git.commitAndPushToGitRepo', (_, options: Parameters<typeof commitAndPushToGitRepoAction>[0]) =>
    commitAndPushToGitRepoAction(options),
  );
  ipcMainHandle('git.multipleCommitToGitRepo', (_, options: Parameters<typeof multipleCommitToGitRepoAction>[0]) =>
    multipleCommitToGitRepoAction(options),
  );
  ipcMainHandle('git.createNewGitBranch', (_, options: Parameters<typeof createNewGitBranchAction>[0]) =>
    createNewGitBranchAction(options),
  );
  ipcMainHandle('git.checkoutGitBranch', (_, options: Parameters<typeof checkoutGitBranchAction>[0]) =>
    checkoutGitBranchAction(options),
  );
  ipcMainHandle('git.mergeGitBranch', (_, options: Parameters<typeof mergeGitBranch>[0]) => mergeGitBranch(options));
  ipcMainHandle('git.deleteGitBranch', (_, options: Parameters<typeof deleteGitBranchAction>[0]) =>
    deleteGitBranchAction(options),
  );
  ipcMainHandle('git.pushToGitRemote', (_, options: Parameters<typeof pushToGitRemoteAction>[0]) =>
    pushToGitRemoteAction(options),
  );
  ipcMainHandle('git.pullFromGitRemote', (_, options: Parameters<typeof pullFromGitRemote>[0]) =>
    pullFromGitRemote(options),
  );
  ipcMainHandle('git.continueMerge', (_, options: Parameters<typeof continueMerge>[0]) => continueMerge(options));
  ipcMainHandle('git.discardChanges', (_, options: Parameters<typeof discardChangesAction>[0]) =>
    discardChangesAction(options),
  );
  ipcMainHandle('git.abortMerge', (_, options: Parameters<typeof abortMergeAction>[0]) => abortMergeAction(options));
  ipcMainHandle('git.gitStatus', (_, options: Parameters<typeof gitStatusAction>[0]) => gitStatusAction(options));
  ipcMainHandle('git.diff', () => diff());
  ipcMainHandle('git.stageChanges', (_, options: Parameters<typeof stageChangesAction>[0]) =>
    stageChangesAction(options),
  );
  ipcMainHandle('git.unstageChanges', (_, options: Parameters<typeof unstageChangesAction>[0]) =>
    unstageChangesAction(options),
  );
  ipcMainHandle('git.diffFileLoader', (_, options: Parameters<typeof diffFileLoader>[0]) => diffFileLoader(options));
  ipcMainHandle('git.getRepositoryDirectoryTree', (_, options: Parameters<typeof getRepositoryDirectoryTree>[0]) =>
    getRepositoryDirectoryTree(options),
  );
  ipcMainHandle(
    'git.migrateLegacyInsomniaFolderToFile',
    (_, options: Parameters<typeof migrateLegacyInsomniaFolderToFile>[0]) => migrateLegacyInsomniaFolderToFile(options),
  );

  ipcMainHandle('git.initSignInToGitProvider', (_, options: Parameters<typeof initSignInToGitProvider>[0]) =>
    initSignInToGitProvider(options),
  );
  ipcMainHandle('git.completeSignInToGitProvider', (_, options: Parameters<typeof completeSignInToGitProvider>[0]) =>
    completeSignInToGitProvider(options),
  );

  ipcMainHandle('git.listGitProviders', () => listGitProviders());
  ipcMainHandle('git.getGitProviderRepositories', (_, options: Parameters<typeof getGitProviderRepositories>[0]) =>
    getGitProviderRepositories(options),
  );
  ipcMainHandle('git.getGitProviderEmails', (_, options: Parameters<typeof getGitProviderEmails>[0]) =>
    getGitProviderEmails(options),
  );
  ipcMainHandle(
    'git.getCurrentBranchByRepositoryId',
    (_, options: Parameters<typeof getCurrentBranchByRepositoryId>[0]) => getCurrentBranchByRepositoryId(options),
  );
  ipcMainHandle('git.getBranchRemoteInfo', (_, options: Parameters<typeof getBranchRemoteInfo>[0]) =>
    getBranchRemoteInfo(options),
  );
  ipcMainHandle('git.runAllGitRepoMigrations', () => runAllGitRepoMigrations());
};
