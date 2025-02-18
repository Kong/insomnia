import { createHash, randomBytes } from 'crypto';
import { shell } from 'electron';
import { app, net } from 'electron/main';
import { fromUrl } from 'hosted-git-info';
import { Errors } from 'isomorphic-git';
import path from 'path';
import { v4 } from 'uuid';
import YAML from 'yaml';

import { getApiBaseURL, getAppWebsiteBaseURL, getGitHubGraphQLApiURL, getGitHubRestApiUrl, INSOMNIA_GITLAB_API_URL, INSOMNIA_GITLAB_CLIENT_ID, INSOMNIA_GITLAB_REDIRECT_URI, PLAYWRIGHT } from '../common/constants';
import { database } from '../common/database';
import * as models from '../models';
import type { GitRepository } from '../models/git-repository';
import { WorkspaceScopeKeys } from '../models/workspace';
import { fsClient } from '../sync/git/fs-client';
import GitVCS, { GIT_CLONE_DIR, GIT_INSOMNIA_DIR, GIT_INSOMNIA_DIR_NAME, GIT_INTERNAL_DIR } from '../sync/git/git-vcs';
import { MemClient } from '../sync/git/mem-client';
import { NeDBClient } from '../sync/git/ne-db-client';
import { routableFSClient } from '../sync/git/routable-fs-client';
import { shallowClone } from '../sync/git/shallow-clone';
import { getOauth2FormatName } from '../sync/git/utils';
import type { MergeConflict } from '../sync/types';
import { invariant } from '../utils/invariant';
import { SegmentEvent, trackSegmentEvent } from './analytics';
import { ipcMainHandle } from './ipc/electron';

type PushPull = 'push' | 'pull';
type VCSAction = PushPull | `force_${PushPull}` |
  'create_branch' | 'merge_branch' | 'delete_branch' | 'checkout_branch' |
  'commit' | 'stage_all' | 'stage' | 'unstage_all' | 'unstage' | 'rollback' | 'rollback_all' |
  'update' | 'setup' | 'clone';

export function vcsSegmentEventProperties(
  type: 'git',
  action: VCSAction,
  error?: string
) {
  return { type, action, error };
}

function parseGitToHttpsURL(s: string) {
  // try to convert any git URL to https URL
  let parsed = fromUrl(s)?.https({ noGitPlus: true }) || '';

  // fallback for self-hosted git servers, see https://github.com/Kong/insomnia/issues/5967
  // and https://github.com/npm/hosted-git-info/issues/11
  if (parsed === '') {
    let temp = s;
    // handle "shorter scp-like syntax"
    temp = temp.replace(/^git@([^:]+):/, 'https://$1/');
    // handle proper SSH URLs
    temp = temp.replace(/^ssh:\/\//, 'https://');

    // final URL fallback for any other git URL
    temp = new URL(temp).href;
    parsed = temp;
  }

  return parsed;
}

async function getGitRepository({ workspaceId }: { projectId: string; workspaceId: string }) {
  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');
  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);
  invariant(workspaceMeta, 'Workspace meta not found');
  if (!workspaceMeta.gitRepositoryId) {
    throw new Error('Workspace is not linked to a git repository');
  }

  const gitRepository = await models.gitRepository.getById(
    workspaceMeta.gitRepositoryId
  );
  invariant(gitRepository, 'Git Repository not found');

  return gitRepository;
}

async function getGitFSClient({
  projectId,
  workspaceId,
  gitRepositoryId,
}: {
  projectId: string;
  workspaceId: string;
  gitRepositoryId: string;
}) {
  const baseDir = path.join(
    process.env['INSOMNIA_DATA_PATH'] || app.getPath('userData'),
    `version-control/git/${gitRepositoryId}`
  );

  // Workspace FS Client
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

export async function loadGitRepository({
  projectId,
  workspaceId,
}: {
  projectId: string;
  workspaceId: string;
}) {
  try {
    const gitRepository = await getGitRepository({ workspaceId, projectId });

    if (GitVCS.isInitializedForRepo(gitRepository._id)) {
      return {
        branch: await GitVCS.getCurrentBranch(),
        branches: await GitVCS.listBranches(),
        gitRepository: gitRepository,
      };
    }

    const fsClient = await getGitFSClient({ gitRepositoryId: gitRepository._id, projectId, workspaceId });

    // Init VCS
    const { credentials, uri, author } = gitRepository;
    if (gitRepository.needsFullClone) {
      await GitVCS.initFromClone({
        repoId: gitRepository._id,
        url: uri,
        gitCredentials: credentials,
        directory: GIT_CLONE_DIR,
        fs: fsClient,
        gitDirectory: GIT_INTERNAL_DIR,
      });

      await models.gitRepository.update(gitRepository, {
        needsFullClone: false,
      });
    } else {
      await GitVCS.init({
        repoId: gitRepository._id,
        uri,
        directory: GIT_CLONE_DIR,
        fs: fsClient,
        gitDirectory: GIT_INTERNAL_DIR,
        gitCredentials: credentials,
      });
    }

    // Configure basic info
    await GitVCS.setAuthor(author.name, author.email);
    await GitVCS.addRemote(uri);

    return {
      branch: await GitVCS.getCurrentBranch(),
      branches: await GitVCS.listBranches(),
      gitRepository,
    };
  } catch (e) {
    const errorMessage =
      e instanceof Error ? e.message : 'Error while fetching git repository.';
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

export const getGitBranches = async ({ projectId, workspaceId }: {
  projectId: string;
  workspaceId: string;
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

export const gitFetchAction = async ({ projectId, workspaceId }: {
  projectId: string;
  workspaceId: string;
}) => {
  try {
    const gitRepository = await getGitRepository({ projectId, workspaceId });
    await GitVCS.fetch({
      singleBranch: true,
      depth: 1,
      credentials: gitRepository.credentials,
    });

    return {
      errors: [],
    };
  } catch (e) {
    console.error(e);
    return {
      errors: ['Failed to fetch from remote'],
    };
  }
};

export const gitLogLoader = async ({ projectId, workspaceId }: {
  projectId: string;
  workspaceId: string;
}) => {
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
    }[];
    unstaged: {
      name: string;
      path: string;
    }[];
  };
  branch: string;
  errors?: string[];
}

export const gitChangesLoader = async ({
  projectId,
  workspaceId,
}: {
  projectId: string;
  workspaceId: string;
}): Promise<GitChangesLoaderData> => {
  try {
    const gitRepository = await getGitRepository({ projectId, workspaceId });
    const branch = await GitVCS.getCurrentBranch();

    const { changes, hasUncommittedChanges } = await getGitChanges(GitVCS);

    await models.gitRepository.update(gitRepository, {
      hasUncommittedChanges,
    });

    return {
      branch,
      changes,
    };
  } catch (e) {
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

export const canPushLoader = async ({ projectId, workspaceId }: {
  projectId: string;
  workspaceId: string;
}): Promise<GitCanPushLoaderData> => {
  try {
    let hasUnpushedChanges = false;
    const gitRepository = await getGitRepository({ workspaceId, projectId });
    hasUnpushedChanges = await GitVCS.canPush(gitRepository.credentials);

    await models.gitRepository.update(gitRepository, {
      hasUnpushedChanges,
    });

    return { canPush: hasUnpushedChanges };
  } catch (err) {
    return { canPush: false };
  }
};

// Actions
export const cloneGitRepoAction = async ({
  projectId,
  uri,
  authorName,
  authorEmail,
  token,
  username,
  oauth2format,
}: {
  organizationId: string;
  projectId: string;
  uri: string;
  authorName: string;
  authorEmail: string;
  token: string;
  username: string;
  oauth2format?: string;
}) => {
  try {
    const project = await models.project.getById(projectId);
    invariant(project, 'Project not found');

    const repoSettingsPatch: Partial<GitRepository> = {};
    repoSettingsPatch.uri = parseGitToHttpsURL(uri);
    repoSettingsPatch.author = {
      name: authorName,
      email: authorEmail,
    };

    // Git Credentials
    if (oauth2format) {
      invariant(
        oauth2format === 'gitlab' || oauth2format === 'github',
        'OAuth2 format is required'
      );

      repoSettingsPatch.credentials = {
        username,
        token,
        oauth2format,
      };
    } else {
      invariant(typeof token === 'string', 'Token is required');
      invariant(typeof username === 'string', 'Username is required');

      repoSettingsPatch.credentials = {
        password: token,
        username,
      };
    }

    trackSegmentEvent(
      SegmentEvent.vcsSyncStart,
      vcsSegmentEventProperties('git', 'clone'),
    );
    repoSettingsPatch.needsFullClone = true;

    const inMemoryFsClient = MemClient.createClient();

    const providerName = getOauth2FormatName(repoSettingsPatch.credentials);
    try {
      await shallowClone({
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

    const containsInsomniaDir = async (
      fsClient: Record<string, any>
    ): Promise<boolean> => {
      const rootDirs: string[] = await fsClient.promises.readdir(GIT_CLONE_DIR);
      return rootDirs.includes(GIT_INSOMNIA_DIR_NAME);
    };

    const containsInsomniaWorkspaceDir = async (
      fsClient: Record<string, any>
    ): Promise<boolean> => {
      if (!(await containsInsomniaDir(fsClient))) {
        return false;
      }

      const rootDirs: string[] = await fsClient.promises.readdir(
        GIT_INSOMNIA_DIR
      );
      return rootDirs.includes(models.workspace.type);
    };

    // Stop the DB from pushing updates to the UI temporarily
    const bufferId = await database.bufferChanges();
    let workspaceId = '';
    let scope: 'design' | 'collection' = WorkspaceScopeKeys.design;
    // If no workspace exists we create a new one
    if (!(await containsInsomniaWorkspaceDir(inMemoryFsClient))) {
      // Create a new workspace

      const workspace = await models.workspace.create({
        name: repoSettingsPatch.uri?.split('/').pop(),
        scope: scope,
        parentId: project._id,
        description: `Insomnia Workspace for ${repoSettingsPatch.uri}}`,
      });
      await models.apiSpec.getOrCreateForParentId(workspace._id);

      trackSegmentEvent(
        SegmentEvent.vcsSyncComplete,
        {
          ...vcsSegmentEventProperties('git', 'clone', 'no directory found'),
          providerName,
        },
      );

      workspaceId = workspace._id;

      const newRepo = await models.gitRepository.create(repoSettingsPatch);
      const meta = await models.workspaceMeta.getOrCreateByParentId(workspaceId);
      await models.workspaceMeta.update(meta, {
        gitRepositoryId: newRepo._id,
      });
    } else {
      // Clone all entities from the repository
      const workspaceBase = path.join(GIT_INSOMNIA_DIR, models.workspace.type);
      const workspaces = await inMemoryFsClient.promises.readdir(workspaceBase);

      if (workspaces.length === 0) {
        trackSegmentEvent(
          SegmentEvent.vcsSyncComplete, {
          ...vcsSegmentEventProperties('git', 'clone', 'no workspaces found'),
          providerName,
        },
        );

        return {
          errors: ['No workspaces found in repository'],
        };
      }

      if (workspaces.length > 1) {
        trackSegmentEvent(
          SegmentEvent.vcsSyncComplete,
          {
            ...vcsSegmentEventProperties(
              'git',
              'clone',
              'multiple workspaces found'
            ),
            providerName,
          },
        );

        return {
          errors: ['Multiple workspaces found in repository. Expected one.'],
        };
      }

      // Only one workspace
      const workspacePath = path.join(workspaceBase, workspaces[0]);
      const workspaceJson = await inMemoryFsClient.promises.readFile(workspacePath);
      const workspace = YAML.parse(workspaceJson.toString());
      workspaceId = workspace._id;
      scope = (workspace.scope === WorkspaceScopeKeys.collection) ? WorkspaceScopeKeys.collection : WorkspaceScopeKeys.design;
      // Check if the workspace already exists
      const existingWorkspace = await models.workspace.getById(workspace._id);

      if (existingWorkspace) {
        const project = await models.project.getById(existingWorkspace.parentId);
        if (!project) {
          return {
            errors: ['It seems that the repository being cloned is connected to an orphaned workspace. Please move that workspace to a project and try again.'],
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
      const gitRepository = await models.gitRepository.create(repoSettingsPatch);
      const meta = await models.workspaceMeta.getOrCreateByParentId(workspaceId);
      await models.workspaceMeta.update(meta, {
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
          gitCredentials: gitRepository.credentials,
          directory: GIT_CLONE_DIR,
          fs: routableFS,
          gitDirectory: GIT_INTERNAL_DIR,
        });

        await models.gitRepository.update(gitRepository, {
          needsFullClone: false,
        });
      } else {
        await GitVCS.init({
          repoId: gitRepository._id,
          uri,
          directory: GIT_CLONE_DIR,
          fs: routableFS,
          gitDirectory: GIT_INTERNAL_DIR,
          gitCredentials: gitRepository.credentials,
        });
      }

      await GitVCS.setAuthor(gitRepository.author.name, gitRepository.author.email);
      await GitVCS.addRemote(uri);
    }

    // Flush DB changes
    await database.flushChanges(bufferId);
    trackSegmentEvent(SegmentEvent.vcsSyncComplete, {
      ...vcsSegmentEventProperties('git', 'clone'),
      providerName,
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
  workspaceId,
  authorEmail,
  authorName,
  uri,
  oauth2format,
  username,
  token,
}: {
  projectId: string;
  workspaceId: string;
  authorName: string;
  authorEmail: string;
  uri: string;
  oauth2format?: string;
  username: string;
  token: string;
}) => {
  let gitRepositoryId: string | null | undefined = null;

  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);
  gitRepositoryId = workspaceMeta?.gitRepositoryId;

  const repoSettingsPatch: Partial<GitRepository> = {};

  // URI
  repoSettingsPatch.uri = parseGitToHttpsURL(uri);

  // Author
  repoSettingsPatch.author = {
    name: authorName,
    email: authorEmail,
  };

  // Git Credentials
  if (oauth2format) {
    invariant(
      oauth2format === 'gitlab' || oauth2format === 'github',
      'OAuth2 format is required'
    );

    repoSettingsPatch.credentials = {
      username,
      token,
      oauth2format,
    };
  } else {
    repoSettingsPatch.credentials = {
      password: token,
      username,
    };
  }

  async function setupGitRepository() {
    if (gitRepositoryId) {
      const gitRepository = await models.gitRepository.getById(gitRepositoryId);
      invariant(gitRepository, 'GitRepository not found');
      await models.gitRepository.update(gitRepository, repoSettingsPatch);

      return gitRepository;
    }

    repoSettingsPatch.needsFullClone = true;
    const gitRepository = await models.gitRepository.create(repoSettingsPatch);

    return gitRepository;
  }

  const gitRepository = await setupGitRepository();

  await models.workspaceMeta.updateByParentId(workspaceId, {
    gitRepositoryId: gitRepository._id,
  });

  const { hasUncommittedChanges } = await getGitChanges(GitVCS);
  const hasUnpushedChanges = await GitVCS.canPush(gitRepository.credentials);

  await models.gitRepository.update(gitRepository, {
    hasUncommittedChanges,
    hasUnpushedChanges,
  });

  return null;
};

export const resetGitRepoAction = async ({ projectId, workspaceId }: {
  projectId: string;
  workspaceId: string;
}) => {
  const repo = await getGitRepository({ projectId, workspaceId });

  invariant(repo, 'Git Repository not found');

  const flushId = await database.bufferChanges();

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);
  invariant(workspaceMeta, 'Workspace meta not found');
  await models.workspaceMeta.update(workspaceMeta, {
    gitRepositoryId: null,
  });

  await models.gitRepository.remove(repo);
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
  workspaceId: string;
  message: string;
}): Promise<CommitToGitRepoResult> => {
  try {
    const gitRepository = await getGitRepository({ workspaceId, projectId });
    await GitVCS.commit(message);

    const providerName = getOauth2FormatName(gitRepository?.credentials);

    trackSegmentEvent(SegmentEvent.vcsAction, {
      ...vcsSegmentEventProperties('git', 'commit'),
      providerName,
    });

    const hasUnpushedChanges = await GitVCS.canPush(gitRepository.credentials);
    // update workspace meta with git sync data, use for show unpushed changes on collection card
    await models.gitRepository.update(gitRepository, {
      hasUnpushedChanges,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : 'Error while committing changes';
    return { errors: [message] };
  }

  return {
    errors: [],
  };
};

export const commitAndPushToGitRepoAction = async ({
  projectId,
  workspaceId,
  message,
}: {
  projectId: string;
  workspaceId: string;
  message: string;
}): Promise<CommitToGitRepoResult> => {
  const repo = await getGitRepository({ workspaceId, projectId });
  try {
    await GitVCS.commit(message);

    const providerName = getOauth2FormatName(repo?.credentials);

    trackSegmentEvent(
      SegmentEvent.vcsAction, {
      ...vcsSegmentEventProperties('git', 'commit'),
      providerName,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : 'Error while committing changes';
    return { errors: [message] };
  }

  let canPush = false;
  try {
    canPush = await GitVCS.canPush(repo.credentials);
  } catch (err) {
    if (err instanceof Errors.HttpError) {
      return {
        errors: [`${err.message}, ${err.data.response}`],
      };
    }
    const errorMessage = err instanceof Error ? err.message : 'Unknown Error';

    return { errors: [errorMessage] };
  }
  // If nothing to push, display that to the user
  if (!canPush) {
    return {
      errors: ['Nothing to push'],
    };
  }

  const bufferId = await database.bufferChanges();
  const providerName = getOauth2FormatName(repo.credentials);
  try {
    await GitVCS.push(repo.credentials);

    trackSegmentEvent(SegmentEvent.vcsAction, {
      ...vcsSegmentEventProperties('git', 'push'),
      providerName,
    });

    const hasUnpushedChanges = await GitVCS.canPush(repo.credentials);

    await models.gitRepository.update(repo, {
      hasUnpushedChanges,
    });
  } catch (err: unknown) {
    if (err instanceof Errors.HttpError) {
      return {
        errors: [`${err.message}, ${err.data.response}`],
      };
    }
    const errorMessage = err instanceof Error ? err.message : 'Unknown Error';

    trackSegmentEvent(SegmentEvent.vcsAction, {
      ...vcsSegmentEventProperties('git', 'push', errorMessage),
      providerName,
    });

    if (err instanceof Errors.PushRejectedError) {
      return {
        errors: [`Push Rejected, ${errorMessage}`],
      };
    }

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
  workspaceId: string;
  branch: string;
}): Promise<CreateNewGitBranchResult> => {
  const gitRepository = await getGitRepository({ workspaceId, projectId });
  invariant(typeof branch === 'string', 'Branch name is required');

  try {
    const providerName = getOauth2FormatName(gitRepository?.credentials);
    await GitVCS.checkout(branch);
    trackSegmentEvent(SegmentEvent.vcsAction, {
      ...vcsSegmentEventProperties('git', 'create_branch'),
      providerName,
    });

    const { hasUncommittedChanges } = await getGitChanges(GitVCS);
    const hasUnpushedChanges = await GitVCS.canPush(gitRepository.credentials);

    await models.gitRepository.update(gitRepository, {
      hasUncommittedChanges,
      hasUnpushedChanges,
    });
  } catch (err) {
    if (err instanceof Errors.HttpError) {
      return {
        errors: [`${err.message}, ${err.data.response}`],
      };
    }
    const errorMessage =
      err instanceof Error
        ? err.message
        : 'Something went wrong while creating a new branch';
    return {
      errors: [errorMessage],
    };
  }

  return {};
};

export interface CheckoutGitBranchResult {
  errors?: string[];
}

export const checkoutGitBranchAction = async ({
  projectId,
  workspaceId,
  branch,
}: {
  projectId: string;
  workspaceId: string;
  branch: string;
}): Promise<CheckoutGitBranchResult> => {
  const gitRepository = await getGitRepository({ workspaceId, projectId });

  const bufferId = await database.bufferChanges();
  try {
    await GitVCS.checkout(branch);
  } catch (err) {
    if (err instanceof Errors.HttpError) {
      return {
        errors: [`${err.message}, ${err.data.response}`],
      };
    }
    const errorMessage = err instanceof Error ? err.message : err;
    return {
      errors: [errorMessage],
    };
  }

  const log = (await GitVCS.log({ depth: 1 })) || [];

  const author = log[0] ? log[0].commit.author : null;
  const cachedGitLastCommitTime = author ? author.timestamp * 1000 : null;

  await models.gitRepository.update(gitRepository, {
    cachedGitLastCommitTime,
    cachedGitRepositoryBranch: branch,
    cachedGitLastAuthor: author?.name || null,
  });

  const { hasUncommittedChanges } = await getGitChanges(GitVCS);
  const hasUnpushedChanges = await GitVCS.canPush(gitRepository.credentials);

  await models.gitRepository.update(gitRepository, {
    hasUncommittedChanges,
    hasUnpushedChanges,
  });

  await database.flushChanges(bufferId);
  return {};
};

export const mergeGitBranch = async ({
  projectId,
  workspaceId,
  theirsBranch,
  allowUncommittedChangesBeforeMerge = false,
}: {
  theirsBranch: string;
  projectId: string;
  workspaceId: string;
  allowUncommittedChangesBeforeMerge?: boolean;
}) => {
  const gitRepository = await getGitRepository({ workspaceId, projectId });
  const providerName = getOauth2FormatName(gitRepository.credentials);

  invariant(typeof theirsBranch === 'string', 'Branch name is required');

  const bufferId = await database.bufferChanges();

  try {
    await GitVCS.merge({
      theirsBranch,
      allowUncommittedChangesBeforeMerge,
    });
    // isomorphic-git does not update the working area after merge, we need to do it manually by checking out the current branch
    const currentBranch = await GitVCS.getCurrentBranch();
    await GitVCS.checkout(currentBranch);
    trackSegmentEvent(SegmentEvent.vcsAction, {
      ...vcsSegmentEventProperties('git', 'merge_branch'),
      providerName,
    });
    await database.flushChanges(bufferId, true);
    return {};
  } catch (err) {
    if (err instanceof Errors.HttpError) {
      err = new Error(`${err.message}, ${err.data.response}`);
    }
    const errorMessage = err instanceof Error ? err.message : 'Unknown Error';

    trackSegmentEvent(
      SegmentEvent.vcsAction,
      vcsSegmentEventProperties('git', 'merge_branch', errorMessage),
    );

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
  workspaceId: string;
  branch: string;
}): Promise<DeleteGitBranchResult> => {
  try {
    const repo = await getGitRepository({ workspaceId, projectId });
    await GitVCS.deleteBranch(branch);

    trackSegmentEvent(SegmentEvent.vcsAction, {
      ...vcsSegmentEventProperties('git', 'delete_branch'),
      providerName: getOauth2FormatName(repo?.credentials),
    });
    return {};
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return { errors: [errorMessage] };
  }
};

export interface PushToGitRemoteResult {
  errors?: string[];
}

export const pushToGitRemoteAction = async ({
  projectId,
  workspaceId,
  // @TODO - Force is never used
  force,
}: {
  projectId: string;
  workspaceId: string;
  force?: boolean;
}): Promise<PushToGitRemoteResult> => {
  const gitRepository = await getGitRepository({ projectId, workspaceId });

  // Check if there is anything to push
  let canPush = false;
  try {
    canPush = await GitVCS.canPush(gitRepository.credentials);
  } catch (err) {
    if (err instanceof Errors.HttpError) {
      return {
        errors: [`${err.message}, ${err.data.response}`],
      };
    }
    const errorMessage = err instanceof Error ? err.message : 'Unknown Error';

    return { errors: [errorMessage] };
  }
  // If nothing to push, display that to the user
  if (!canPush) {
    return {
      errors: ['Nothing to push'],
    };
  }

  const providerName = getOauth2FormatName(gitRepository.credentials);
  try {
    const bufferId = await database.bufferChanges();
    await GitVCS.push(gitRepository.credentials);

    trackSegmentEvent(SegmentEvent.vcsAction, {
      ...vcsSegmentEventProperties('git', force ? 'force_push' : 'push'),
      providerName,
    });

    await models.gitRepository.update(gitRepository, {
      hasUnpushedChanges: false,
    });
    await database.flushChanges(bufferId);
  } catch (err: unknown) {
    if (err instanceof Errors.HttpError) {
      return {
        errors: [`${err.message}, ${err.data.response}`],
      };
    }
    const errorMessage = err instanceof Error ? err.message : 'Unknown Error';

    trackSegmentEvent(SegmentEvent.vcsAction, {
      ...vcsSegmentEventProperties('git', 'push', errorMessage),
      providerName,
    });

    if (err instanceof Errors.PushRejectedError) {
      return {
        errors: [`Push Rejected, ${errorMessage}`],
      };
    }

    return {
      errors: [`Error Pushing Repository, ${errorMessage}`],
    };
  }

  return {};
};

export async function pullFromGitRemote({
  projectId,
  workspaceId,
}: {
  projectId: string;
  workspaceId: string;
}) {
  try {
    const gitRepository = await getGitRepository({ projectId, workspaceId });
    const providerName = getOauth2FormatName(gitRepository.credentials);
    const bufferId = await database.bufferChanges();
    await GitVCS.pull(gitRepository.credentials);
    trackSegmentEvent(SegmentEvent.vcsAction, {
      ...vcsSegmentEventProperties('git', 'pull'),
      providerName,
    });
    await database.flushChanges(bufferId);

    return {};
  } catch (err: unknown) {
    if (err instanceof Errors.HttpError) {
      err = new Error(`${err.message}, ${err.data.response}`);
    }
    const errorMessage = err instanceof Error ? err.message : 'Unknown Error';
    trackSegmentEvent(
      SegmentEvent.vcsAction,
      vcsSegmentEventProperties('git', 'pull', errorMessage),
    );

    return {
      errors: [errorMessage],
    };
  }
};

export const continueMerge = async (
  {
    projectId,
    workspaceId,
    handledMergeConflicts,
    commitMessage,
    commitParent,
  }: {
    projectId: string;
    workspaceId: string;
    handledMergeConflicts: MergeConflict[];
    commitMessage: string;
    commitParent: string[];
  }
) => {
  try {
    await getGitRepository({ workspaceId, projectId });
    const bufferId = await database.bufferChanges();

    await GitVCS.continueMerge({
      handledMergeConflicts,
      commitMessage,
      commitParent,
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

async function getGitChanges(vcs: typeof GitVCS) {
  const changes = await vcs.status();

  return {
    changes,
    hasUncommittedChanges: changes.staged.length > 0 || changes.unstaged.length > 0,
  };
}

export const discardChangesAction = async ({
  projectId,
  workspaceId,
  paths,
}: {
  projectId: string;
  workspaceId: string;
  paths: string[];
}): Promise<{
  errors?: string[];
}> => {
  try {
    await getGitRepository({ workspaceId, projectId });
    const { changes } = await getGitChanges(GitVCS);

    const files = changes.unstaged
      .filter(change => paths.includes(change.path));

    await GitVCS.discardChanges(files);
    return {};
  } catch (e) {
    const errorMessage =
      e instanceof Error ? e.message : 'Error while rolling back changes';
    return {
      errors: [errorMessage],
    };
  }
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
  workspaceId: string;
}): Promise<GitStatusResult> => {
  try {
    const gitRepository = await getGitRepository({ workspaceId, projectId });
    const { hasUncommittedChanges, changes } = await getGitChanges(GitVCS);
    const localChanges = changes.staged.length + changes.unstaged.length;

    await models.gitRepository.update(gitRepository, {
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
  workspaceId: string;
  paths: string[];
}): Promise<{
  errors?: string[];
}> => {
  try {
    await getGitRepository({ workspaceId, projectId });
    const { changes } = await getGitChanges(GitVCS);

    const files = changes.unstaged
      .filter(change => paths.includes(change.path));

    await GitVCS.stageChanges(files);
    return {};
  } catch (e) {
    const errorMessage =
      e instanceof Error ? e.message : 'Error while staging changes';
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
  workspaceId: string;
  paths: string[];
}): Promise<{
  errors?: string[];
}> => {
  try {
    await getGitRepository({ workspaceId, projectId });
    const { changes } = await getGitChanges(GitVCS);

    const files = changes.staged
      .filter(change => paths.includes(change.path));

    await GitVCS.unstageChanges(files);
    return {};
  } catch (e) {
    const errorMessage =
      e instanceof Error ? e.message : 'Error while unstaging changes';
    return {
      errors: [errorMessage],
    };
  }

};

export type GitDiffResult = {
  diff?: {
    before: string;
    after: string;
  };
} | {
  errors: string[];
};

export const diffFileLoader = async ({
  projectId,
  workspaceId,
  filepath,
  staged,
}: {
  projectId: string;
  workspaceId: string;
  filepath: string;
  staged: boolean;
}): Promise<GitDiffResult> => {
  try {
    await getGitRepository({ workspaceId, projectId });
    const fileStatus = await GitVCS.fileStatus(filepath);

    return {
      diff: staged ? {
        before: fileStatus.head,
        after: fileStatus.stage,
      } : {
        before: fileStatus.stage || fileStatus.head,
        after: fileStatus.workdir,
      },
    };
  } catch (e) {
    const errorMessage =
      e instanceof Error ? e.message : 'Error while unstaging changes';
    return {
      errors: [errorMessage],
    };
  }
};

export const GITHUB_GRAPHQL_API_URL = getGitHubGraphQLApiURL();

/**
 * This cache stores the states that are generated for the OAuth flow.
 * This is used to check if a command to exchange a code for a token has been initiated by the app or not.
 * More info https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps#2-users-are-redirected-back-to-your-site-by-github
 */
const statesCache = new Set<string>();

async function initSignInToGitHub() {
  const state = v4();
  statesCache.add(state);
  const url = new URL(getAppWebsiteBaseURL() + '/oauth/github-app');

  url.search = new URLSearchParams({
    state,
  }).toString();

  // eslint-disable-next-line no-restricted-properties
  await shell.openExternal(url.toString());
}

interface GitHubUserApiResponse {
  name: string;
  login: string;
  email: string | null;
  avatar_url: string;
  url: string;
}

async function completeSignInToGitHub({
  code,
  state,
}: {
  code: string;
  state: string;
}) {
  if (!PLAYWRIGHT && !statesCache.has(state)) {
    throw new Error(
      'Invalid state parameter. It looks like the authorization flow was not initiated by the app.'
    );
  }

  const response = await net.fetch(getApiBaseURL() + '/v1/oauth/github-app', {
    method: 'POST',
    body: JSON.stringify({
      code,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json() as { access_token: string };
  statesCache.delete(state);
  const existingGitHubCredentials = await models.gitCredentials.getByProvider('github');

  // need both requests because the email in GET /user
  // is the public profile email and may not exist
  const emailsPromise = fetch(getGitHubRestApiUrl() + '/user/emails', {
    method: 'GET',
    headers: {
      Authorization: `token ${data.access_token}`,
    },
  }).then(response => response.json() as Promise<{ email: string; primary: boolean }[]>);

  const userPromise = fetch(getGitHubRestApiUrl() + '/user', {
    method: 'GET',
    headers: {
      Authorization: `token ${data.access_token}`,
    },
  }).then(response => response.json() as Promise<GitHubUserApiResponse>);

  const [emails, user] = await Promise.all([
    emailsPromise,
    userPromise,
  ]);

  const userProfileEmail = user.email ?? '';
  const email = emails.find(e => e.primary)?.email ?? userProfileEmail;

  if (existingGitHubCredentials) {
    await models.gitCredentials.update(existingGitHubCredentials, {
      token: data.access_token,
      provider: 'githubapp',
      author: {
        email,
        name: user.name,
        avatarUrl: user.avatar_url,
      },
    });
  } else {
    await models.gitCredentials.create({
      token: data.access_token,
      provider: 'githubapp',
      author: {
        email,
        name: user.name,
        avatarUrl: user.avatar_url,
      },
    });
  }
}

async function signOutOfGitHub() {
  const existingGitHubCredentials = await models.gitCredentials.getByProvider('github');

  if (existingGitHubCredentials) {
    await models.gitCredentials.remove(existingGitHubCredentials);
  }
}

/**
 * This cache stores the states that are generated for the OAuth flow.
 * This is used to check if a command to exchange a code for a token has been initiated by the app or not.
 */
const gitLabStatesCache = new Map<string, string>();

// GitLab API config
const getGitLabConfig = async () => {
  // Validate and use the environment variables if provided
  if (
    (INSOMNIA_GITLAB_REDIRECT_URI && !INSOMNIA_GITLAB_CLIENT_ID) ||
    (!INSOMNIA_GITLAB_REDIRECT_URI && INSOMNIA_GITLAB_CLIENT_ID)
  ) {
    throw new Error('GitLab Client ID and Redirect URI must both be set.');
  }

  if (INSOMNIA_GITLAB_REDIRECT_URI && INSOMNIA_GITLAB_CLIENT_ID) {
    return {
      clientId: INSOMNIA_GITLAB_CLIENT_ID,
      redirectUri: INSOMNIA_GITLAB_REDIRECT_URI,
    };
  }

  const configResponse = await fetch(getApiBaseURL() + '/v1/oauth/gitlab/config', {
    method: 'GET',
  });

  const { applicationId: clientId, redirectUri } = await configResponse.json() as { applicationId: string; redirectUri: string };

  return {
    clientId,
    redirectUri,
  };
};

function base64URLEncode(buffer: Buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export const getGitLabOauthApiURL = () => INSOMNIA_GITLAB_API_URL || 'https://gitlab.com';

async function initSignInToGitLab() {
  const state = v4();

  const verifier = base64URLEncode(randomBytes(32));
  gitLabStatesCache.set(state, verifier);

  const scopes = [
    // Needed to read the user's email address, username and avatar_url from the /user GitLab API
    'read_user',
    // Read/Write access to the user's projects to allow for syncing (push/pull etc.)
    'write_repository',
  ];

  const scope = scopes.join(' ');

  function sha256(str: string) {
    return createHash('sha256').update(str).digest();
  }

  const challenge = base64URLEncode(sha256(verifier));

  const gitlabURL = new URL(`${getGitLabOauthApiURL()}/oauth/authorize`);
  const { clientId, redirectUri } = await getGitLabConfig();
  gitlabURL.search = new URLSearchParams({
    client_id: clientId,
    scope,
    state,
    response_type: 'code',
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();

  // eslint-disable-next-line no-restricted-properties
  await shell.openExternal(gitlabURL.toString());
}

async function completeSignInToGitLab({
  code,
  state,
}: {
  code: string;
  state: string;
}) {
  let verifier = gitLabStatesCache.get(state);

  if (PLAYWRIGHT) {
    verifier = 'test-verifier';
  }
  if (!verifier) {
    throw new Error(
      'Invalid state parameter. It looks like the authorization flow was not initiated by the app.'
    );
  }
  const { clientId, redirectUri } = await getGitLabConfig();
  const url = new URL(`${getGitLabOauthApiURL()}/oauth/token`);
  url.search = new URLSearchParams({
    code,
    state,
    client_id: clientId,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code_verifier: verifier,
  }).toString();

  const gitLabResponse = await fetch(getGitLabOauthApiURL() + url.pathname + url.search, {
    method: 'POST',
  });

  const {
    access_token,
    refresh_token,
  } = await gitLabResponse.json() as { access_token: string; refresh_token: string };

  gitLabStatesCache.delete(state);
  const existingGitLabCredentials = await models.gitCredentials.getByProvider('gitlab');

  const gitLabUserResponse = await fetch(`${getGitLabOauthApiURL()}/api/v4/user`, {
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  });

  const user = await gitLabUserResponse.json() as {
    id: number;
    username: string;
    name: string;
    avatar_url: string;
    public_email: string;
    email: string;
    projects_limit: number;
    commit_email: string;
  };

  if (existingGitLabCredentials) {
    return await models.gitCredentials.update(existingGitLabCredentials, {
      token: access_token,
      refreshToken: refresh_token,
      provider: 'gitlab',
      author: {
        email: user.commit_email ?? user.public_email ?? user.email,
        name: user.username ?? user.name,
        avatarUrl: user.avatar_url,
      },
    });
  }

  return await models.gitCredentials.create({
    token: access_token,
    refreshToken: refresh_token,
    provider: 'gitlab',
    author: {
      email: user.commit_email ?? user.public_email ?? user.email,
      name: user.username ?? user.name,
      avatarUrl: user.avatar_url,
    },
  });
}

async function signOutOfGitLab() {
  const existingGitLabCredentials = await models.gitCredentials.getByProvider('gitlab');

  if (existingGitLabCredentials) {
    await models.gitCredentials.remove(existingGitLabCredentials);
  }
}

export interface GitServiceAPI {
  loadGitRepository: typeof loadGitRepository;
  getGitBranches: typeof getGitBranches;
  gitFetchAction: typeof gitFetchAction;
  gitLogLoader: typeof gitLogLoader;
  gitChangesLoader: typeof gitChangesLoader;
  canPushLoader: typeof canPushLoader;
  cloneGitRepo: typeof cloneGitRepoAction;
  updateGitRepo: typeof updateGitRepoAction;
  resetGitRepo: typeof resetGitRepoAction;
  commitToGitRepo: typeof commitToGitRepoAction;
  commitAndPushToGitRepo: typeof commitAndPushToGitRepoAction;
  createNewGitBranch: typeof createNewGitBranchAction;
  checkoutGitBranch: typeof checkoutGitBranchAction;
  mergeGitBranch: typeof mergeGitBranch;
  deleteGitBranch: typeof deleteGitBranchAction;
  pushToGitRemote: typeof pushToGitRemoteAction;
  pullFromGitRemote: typeof pullFromGitRemote;
  continueMerge: typeof continueMerge;
  discardChanges: typeof discardChangesAction;
  gitStatus: typeof gitStatusAction;
  stageChanges: typeof stageChangesAction;
  unstageChanges: typeof unstageChangesAction;
  diffFileLoader: typeof diffFileLoader;
  initSignInToGitHub: typeof initSignInToGitHub;
  completeSignInToGitHub: typeof completeSignInToGitHub;
  signOutOfGitHub: typeof signOutOfGitHub;
  initSignInToGitLab: typeof initSignInToGitLab;
  completeSignInToGitLab: typeof completeSignInToGitLab;
  signOutOfGitLab: typeof signOutOfGitLab;
}

export const registerGitServiceAPI = () => {
  ipcMainHandle('git.loadGitRepository', (_, options: Parameters<typeof loadGitRepository>[0]) => loadGitRepository(options));
  ipcMainHandle('git.getGitBranches', (_, options: Parameters<typeof getGitBranches>[0]) => getGitBranches(options));
  ipcMainHandle('git.gitFetchAction', (_, options: Parameters<typeof gitFetchAction>[0]) => gitFetchAction(options));
  ipcMainHandle('git.gitLogLoader', (_, options: Parameters<typeof gitLogLoader>[0]) => gitLogLoader(options));
  ipcMainHandle('git.gitChangesLoader', (_, options: Parameters<typeof gitChangesLoader>[0]) => gitChangesLoader(options));
  ipcMainHandle('git.canPushLoader', (_, options: Parameters<typeof canPushLoader>[0]) => canPushLoader(options));
  ipcMainHandle('git.cloneGitRepo', (_, options: Parameters<typeof cloneGitRepoAction>[0]) => cloneGitRepoAction(options));
  ipcMainHandle('git.updateGitRepo', (_, options: Parameters<typeof updateGitRepoAction>[0]) => updateGitRepoAction(options));
  ipcMainHandle('git.resetGitRepo', (_, options: Parameters<typeof resetGitRepoAction>[0]) => resetGitRepoAction(options));
  ipcMainHandle('git.commitToGitRepo', (_, options: Parameters<typeof commitToGitRepoAction>[0]) => commitToGitRepoAction(options));
  ipcMainHandle('git.commitAndPushToGitRepo', (_, options: Parameters<typeof commitAndPushToGitRepoAction>[0]) => commitAndPushToGitRepoAction(options));
  ipcMainHandle('git.createNewGitBranch', (_, options: Parameters<typeof createNewGitBranchAction>[0]) => createNewGitBranchAction(options));
  ipcMainHandle('git.checkoutGitBranch', (_, options: Parameters<typeof checkoutGitBranchAction>[0]) => checkoutGitBranchAction(options));
  ipcMainHandle('git.mergeGitBranch', (_, options: Parameters<typeof mergeGitBranch>[0]) => mergeGitBranch(options));
  ipcMainHandle('git.deleteGitBranch', (_, options: Parameters<typeof deleteGitBranchAction>[0]) => deleteGitBranchAction(options));
  ipcMainHandle('git.pushToGitRemote', (_, options: Parameters<typeof pushToGitRemoteAction>[0]) => pushToGitRemoteAction(options));
  ipcMainHandle('git.pullFromGitRemote', (_, options: Parameters<typeof pullFromGitRemote>[0]) => pullFromGitRemote(options));
  ipcMainHandle('git.continueMerge', (_, options: Parameters<typeof continueMerge>[0]) => continueMerge(options));
  ipcMainHandle('git.discardChanges', (_, options: Parameters<typeof discardChangesAction>[0]) => discardChangesAction(options));
  ipcMainHandle('git.gitStatus', (_, options: Parameters<typeof gitStatusAction>[0]) => gitStatusAction(options));
  ipcMainHandle('git.stageChanges', (_, options: Parameters<typeof stageChangesAction>[0]) => stageChangesAction(options));
  ipcMainHandle('git.unstageChanges', (_, options: Parameters<typeof unstageChangesAction>[0]) => unstageChangesAction(options));
  ipcMainHandle('git.diffFileLoader', (_, options: Parameters<typeof diffFileLoader>[0]) => diffFileLoader(options));
  ipcMainHandle('git.completeSignInToGitHub', (_, options: Parameters<typeof completeSignInToGitHub>[0]) => completeSignInToGitHub(options));
  ipcMainHandle('git.initSignInToGitHub', () => initSignInToGitHub());
  ipcMainHandle('git.signOutOfGitHub', () => signOutOfGitHub());
  ipcMainHandle('git.completeSignInToGitLab', (_, options: Parameters<typeof completeSignInToGitLab>[0]) => completeSignInToGitLab(options));
  ipcMainHandle('git.initSignInToGitLab', () => initSignInToGitLab());
  ipcMainHandle('git.signOutOfGitLab', () => signOutOfGitLab());
};
