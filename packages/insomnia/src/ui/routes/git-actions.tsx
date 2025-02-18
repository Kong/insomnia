import { fromUrl } from 'hosted-git-info';
import { Errors } from 'isomorphic-git';
import path from 'path';
import { type ActionFunction, type LoaderFunction, redirect } from 'react-router-dom';
import YAML from 'yaml';

import { ACTIVITY_SPEC } from '../../common/constants';
import { database } from '../../common/database';
import * as models from '../../models';
import type { GitRepository } from '../../models/git-repository';
import { createGitRepository } from '../../models/helpers/git-repository-operations';
import {
  WorkspaceScopeKeys,
} from '../../models/workspace';
import { fsClient } from '../../sync/git/fs-client';
import GitVCS, {
  GIT_CLONE_DIR,
  GIT_INSOMNIA_DIR,
  GIT_INSOMNIA_DIR_NAME,
  GIT_INTERNAL_DIR,
  type GitLogEntry,
} from '../../sync/git/git-vcs';
import { MemClient } from '../../sync/git/mem-client';
import { NeDBClient } from '../../sync/git/ne-db-client';
import { routableFSClient } from '../../sync/git/routable-fs-client';
import { shallowClone } from '../../sync/git/shallow-clone';
import {
  getOauth2FormatName,
} from '../../sync/git/utils';
import type { MergeConflict } from '../../sync/types';
import { invariant } from '../../utils/invariant';
import {
  SegmentEvent,
  vcsSegmentEventProperties,
} from '../analytics';

// Loaders
export type GitRepoLoaderData =
  | {
      branch: string;
      branches: string[];
      gitRepository: GitRepository | null;
    }
  | {
      errors: string[];
    };

export const gitRepoLoader: ActionFunction = async ({
  params,
}): Promise<GitRepoLoaderData> => {
  try {
    const { workspaceId, projectId } = params;
    invariant(typeof workspaceId === 'string', 'Workspace Id is required');
    invariant(typeof projectId === 'string', 'Project Id is required');

    const workspace = await models.workspace.getById(workspaceId);
    invariant(workspace, 'Workspace not found');
    const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);
    invariant(workspaceMeta, 'Workspace meta not found');
    if (!workspaceMeta.gitRepositoryId) {
      return {
        errors: ['Workspace is not linked to a git repository'],
      };
    }

    const gitRepository = await models.gitRepository.getById(
      workspaceMeta.gitRepositoryId
    );
    invariant(gitRepository, 'Git Repository not found');

    if (GitVCS.isInitializedForRepo(gitRepository._id)) {
      return {
        branch: await GitVCS.getCurrentBranch(),
        branches: await GitVCS.listBranches(),
        gitRepository: gitRepository,
      };
    }

    const baseDir = path.join(
      process.env['INSOMNIA_DATA_PATH'] || window.app.getPath('userData'),
      `version-control/git/${gitRepository._id}`
    );

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

    // Init VCS
    const { credentials, uri } = gitRepository;
    if (gitRepository.needsFullClone) {
      await GitVCS.initFromClone({
        repoId: gitRepository._id,
        url: uri,
        gitCredentials: credentials,
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
        gitCredentials: credentials,
      });
    }

    // Configure basic info
    const { author, uri: gitUri } = gitRepository;
    await GitVCS.setAuthor(author.name, author.email);
    await GitVCS.addRemote(gitUri);

    return {
      branch: await GitVCS.getCurrentBranch(),
      branches: await GitVCS.listBranches(),
      gitRepository: gitRepository,
    };
  } catch (e) {
    console.error(e);
    const errorMessage =
      e instanceof Error ? e.message : 'Error while fetching git repository.';
    return {
      errors: [errorMessage],
    };
  }
};

export type GitBranchesLoaderData =
  | {
      branches: string[];
      remoteBranches: string[];
    }
  | {
      errors: string[];
    };

export const gitBranchesLoader: LoaderFunction = async ({
  params,
}): Promise<GitBranchesLoaderData> => {
  const { workspaceId, projectId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');
  invariant(typeof projectId === 'string', 'Project Id is required');

  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');
  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);
  invariant(workspaceMeta, 'Workspace meta not found');
  if (!workspaceMeta.gitRepositoryId) {
    return {
      errors: ['Workspace is not linked to a git repository'],
    };
  }

  const gitRepository = await models.gitRepository.getById(
    workspaceMeta.gitRepositoryId
  );
  invariant(gitRepository, 'Git Repository not found');

  try {
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

export interface GitFetchLoaderData {
      errors: string[];
    }

export const gitFetchAction: ActionFunction = async ({
  params,
}): Promise<GitFetchLoaderData> => {
  const { workspaceId, projectId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');
  invariant(typeof projectId === 'string', 'Project Id is required');

  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');
  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);
  invariant(workspaceMeta, 'Workspace meta not found');
  if (!workspaceMeta.gitRepositoryId) {
    return {
      errors: ['Workspace is not linked to a git repository'],
    };
  }

  const gitRepository = await models.gitRepository.getById(
    workspaceMeta.gitRepositoryId
  );
  invariant(gitRepository, 'Git Repository not found');

  try {
    await GitVCS.fetch({
      singleBranch: true,
      depth: 1,
      credentials: gitRepository.credentials,
    });
  } catch (e) {
    console.error(e);
    return {
      errors: ['Failed to fetch from remote'],
    };
  }

  return {
    errors: [],
  };
};

export type GitLogLoaderData =
  | {
      log: GitLogEntry[];
    }
  | {
      errors: string[];
    };

export const gitLogLoader: LoaderFunction = async ({
  params,
}): Promise<GitLogLoaderData> => {
  const { workspaceId, projectId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');
  invariant(typeof projectId === 'string', 'Project Id is required');

  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');
  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);
  invariant(workspaceMeta, 'Workspace meta not found');
  if (!workspaceMeta.gitRepositoryId) {
    return {
      errors: ['Workspace is not linked to a git repository'],
    };
  }

  const gitRepository = await models.gitRepository.getById(
    workspaceMeta.gitRepositoryId
  );
  invariant(gitRepository, 'Git Repository not found');
  try {
    const log = await GitVCS.log({ depth: 35 });

    return {
      log,
    };
  } catch (e) {
    console.error(e);
    return {
      log: [],
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
}

export const gitChangesLoader: LoaderFunction = async ({
  params,
}): Promise<GitChangesLoaderData> => {
  const { workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');

  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);

  const repoId = workspaceMeta?.gitRepositoryId;

  if (!repoId) {
    return {
      branch: '',
      changes: {
        staged: [],
        unstaged: [],
      },
    };
  }

  const gitRepository = await models.gitRepository.getById(repoId);

  invariant(gitRepository, 'Git Repository not found');

  const branch = await GitVCS.getCurrentBranch();
  try {
    const { changes, hasUncommittedChanges } = await getGitChanges(GitVCS);

    // update workspace meta with git sync data, use for show uncommit changes on collection card
    models.workspaceMeta.updateByParentId(workspaceId, {
      hasUncommittedChanges,
    });
    return {
      branch,
      changes,
    };
  } catch (e) {
    console.error(e);
    return {
      branch,
      changes: {
        staged: [],
        unstaged: [],
      },
    };
  }
};

export interface GitCanPushLoaderData {
  canPush: boolean;
}

export const canPushLoader: LoaderFunction = async ({ params }): Promise<GitCanPushLoaderData> => {
  const { workspaceId } = params;
  invariant(workspaceId, 'Workspace ID is required');

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);

  const repoId = workspaceMeta?.gitRepositoryId;

  if (!repoId) {
    return {
      canPush: false,
    };
  }

  const gitRepository = await models.gitRepository.getById(repoId);

  invariant(gitRepository, 'Git Repository not found');
  let canPush = false;
  try {
    canPush = await GitVCS.canPush(gitRepository.credentials);
    // update workspace meta with git sync data, use for show unpushed changes on collection card
    models.workspaceMeta.updateByParentId(workspaceId, {
      hasUnpushedChanges: canPush,
    });
  } catch (err) { }

  return { canPush };
};

// Actions
type CloneGitActionResult =
  | Response
  | {
      errors?: string[];
    };

export function parseGitToHttpsURL(s: string) {
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

export const cloneGitRepoAction: ActionFunction = async ({
  request,
  params,
}): Promise<CloneGitActionResult> => {
  const { organizationId, projectId } = params;

  invariant(typeof projectId === 'string', 'ProjectId is required.');
  const project = await models.project.getById(projectId);
  invariant(project, 'Project not found');

  const repoSettingsPatch: Partial<GitRepository> = {};
  const formData = await request.formData();

  // URI
  const uri = formData.get('uri');
  invariant(typeof uri === 'string', 'URI is required');
  repoSettingsPatch.uri = parseGitToHttpsURL(uri);
  // Author
  const authorName = formData.get('authorName');
  invariant(typeof authorName === 'string', 'Author name is required');
  const authorEmail = formData.get('authorEmail');
  invariant(typeof authorEmail === 'string', 'Author email is required');

  repoSettingsPatch.author = {
    name: authorName,
    email: authorEmail,
  };

  // Git Credentials
  const oauth2format = formData.get('oauth2format');
  if (oauth2format) {
    invariant(
      oauth2format === 'gitlab' || oauth2format === 'github',
      'OAuth2 format is required'
    );
    const token = formData.get('token');
    invariant(typeof token === 'string', 'Token is required');
    const username = formData.get('username');
    invariant(typeof username === 'string', 'Username is required');

    repoSettingsPatch.credentials = {
      username,
      token,
      oauth2format,
    };
  } else {
    const token = formData.get('token');
    invariant(typeof token === 'string', 'Token is required');
    const username = formData.get('username');
    invariant(typeof username === 'string', 'Username is required');

    repoSettingsPatch.credentials = {
      password: token,
      username,
    };
  }

  window.main.trackSegmentEvent({
    event: SegmentEvent.vcsSyncStart,
    properties: vcsSegmentEventProperties('git', 'clone'),
  });
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
      name: repoSettingsPatch.uri.split('/').pop(),
      scope: scope,
      parentId: project._id,
      description: `Insomnia Workspace for ${repoSettingsPatch.uri}}`,
    });
    await models.apiSpec.getOrCreateForParentId(workspace._id);
    window.main.trackSegmentEvent({
      event: SegmentEvent.vcsSyncComplete, properties: {
        ...vcsSegmentEventProperties('git', 'clone', 'no directory found'),
        providerName,
      },
    });

    workspaceId = workspace._id;

    // Store GitRepository settings and set it as active
    await createGitRepository(workspace._id, repoSettingsPatch);
  } else {
    // Clone all entities from the repository
    const workspaceBase = path.join(GIT_INSOMNIA_DIR, models.workspace.type);
    const workspaces = await inMemoryFsClient.promises.readdir(workspaceBase);

    if (workspaces.length === 0) {
      window.main.trackSegmentEvent({
        event: SegmentEvent.vcsSyncComplete, properties: {
          ...vcsSegmentEventProperties('git', 'clone', 'no workspaces found'),
          providerName,
        },
      });

      return {
        errors: ['No workspaces found in repository'],
      };
    }

    if (workspaces.length > 1) {
      window.main.trackSegmentEvent({
        event: SegmentEvent.vcsSyncComplete, properties: {
          ...vcsSegmentEventProperties(
            'git',
            'clone',
            'multiple workspaces found'
          ),
          providerName,
        },
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
      return redirect(`/organization/${organizationId}/project/${project._id}/workspace/${existingWorkspace._id}/debug`);
    }

    // Store GitRepository settings and set it as active
    const gitRepository = await models.gitRepository.create(repoSettingsPatch);
    const meta = await models.workspaceMeta.getOrCreateByParentId(workspaceId);
    await models.workspaceMeta.update(meta, {
      gitRepositoryId: gitRepository._id,
    });

    const baseDir = path.join(
      process.env['INSOMNIA_DATA_PATH'] || window.app.getPath('userData'),
      `version-control/git/${gitRepository._id}`
    );

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

    // Init VCS
    const { credentials, uri, author } = gitRepository;

    // Configure basic info

    if (gitRepository.needsFullClone) {
      await GitVCS.initFromClone({
        repoId: gitRepository._id,
        url: uri,
        gitCredentials: credentials,
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
        gitCredentials: credentials,
      });
    }

    await GitVCS.setAuthor(author.name, author.email);
    await GitVCS.addRemote(uri);
  }

  // Flush DB changes
  await database.flushChanges(bufferId);
  window.main.trackSegmentEvent({
    event: SegmentEvent.vcsSyncComplete, properties: {
      ...vcsSegmentEventProperties('git', 'clone'),
      providerName,
    },
  });

  invariant(workspaceId, 'Workspace ID is required');

  // Redirect to debug for collection scope initial clone
  if (scope === WorkspaceScopeKeys.collection) {
    return redirect(
      `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug`
    );
  }
  return redirect(
    `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/${ACTIVITY_SPEC}`
  );
};

export const updateGitRepoAction: ActionFunction = async ({
  request,
  params,
}) => {
  const { workspaceId } = params;
  invariant(workspaceId, 'Workspace ID is required');
  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);
  let gitRepositoryId = workspaceMeta?.gitRepositoryId;

  const repoSettingsPatch: Partial<GitRepository> = {};
  const formData = await request.formData();

  // URI
  const uri = formData.get('uri');
  invariant(typeof uri === 'string', 'URI is required');
  repoSettingsPatch.uri = parseGitToHttpsURL(uri);

  // Author
  const authorName = formData.get('authorName');
  invariant(typeof authorName === 'string', 'Author name is required');
  const authorEmail = formData.get('authorEmail');
  invariant(typeof authorEmail === 'string', 'Author email is required');

  repoSettingsPatch.author = {
    name: authorName,
    email: authorEmail,
  };

  // Git Credentials
  const oauth2format = formData.get('oauth2format');
  if (oauth2format) {
    invariant(
      oauth2format === 'gitlab' || oauth2format === 'github',
      'OAuth2 format is required'
    );
    const token = formData.get('token');
    invariant(typeof token === 'string', 'Token is required');
    const username = formData.get('username');
    invariant(typeof username === 'string', 'Username is required');

    repoSettingsPatch.credentials = {
      username,
      token,
      oauth2format,
    };
  } else {
    const token = formData.get('token');
    invariant(typeof token === 'string', 'Token is required');
    const username = formData.get('username');
    invariant(typeof username === 'string', 'Username is required');

    repoSettingsPatch.credentials = {
      password: token,
      username,
    };
  }

  if (gitRepositoryId) {
    const repo = await models.gitRepository.getById(gitRepositoryId);
    invariant(repo, 'GitRepository not found');
    await models.gitRepository.update(repo, repoSettingsPatch);
    gitRepositoryId = repo._id;
  } else {
    repoSettingsPatch.needsFullClone = true;
    const gitRepository = await models.gitRepository.create(repoSettingsPatch);
    gitRepositoryId = gitRepository._id;
  }

  await models.workspaceMeta.updateByParentId(workspaceId, {
    gitRepositoryId,
  });

  checkGitCanPush(workspaceId);
  checkGitChanges(workspaceId);

  return null;
};

export const resetGitRepoAction: ActionFunction = async ({ params }) => {
  const { workspaceId } = params;
  invariant(workspaceId, 'Workspace ID is required');

  const workspace = await models.workspace.getById(workspaceId);

  invariant(workspace, 'Workspace not found');

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);

  const repoId = workspaceMeta?.gitRepositoryId;

  invariant(repoId, 'Workspace is not linked to a git repository');

  const repo = await models.gitRepository.getById(repoId);

  invariant(repo, 'Git Repository not found');

  const flushId = await database.bufferChanges();
  if (workspaceMeta) {
    await models.workspaceMeta.update(workspaceMeta, {
      gitRepositoryId: null,
      cachedGitLastCommitTime: null,
      cachedGitRepositoryBranch: null,
      cachedGitLastAuthor: null,
      hasUncommittedChanges: false,
      hasUnpushedChanges: false,
    });
  }

  await models.gitRepository.remove(repo);
  await database.flushChanges(flushId);

  return null;
};

export interface CommitToGitRepoResult {
  errors?: string[];
}

export const commitToGitRepoAction: ActionFunction = async ({
  request,
  params,
}): Promise<CommitToGitRepoResult> => {
  const { workspaceId } = params;
  invariant(workspaceId, 'Workspace ID is required');

  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);

  const repoId = workspaceMeta?.gitRepositoryId;
  invariant(repoId, 'Workspace is not linked to a git repository');

  const repo = await models.gitRepository.getById(repoId);
  invariant(repo, 'Git Repository not found');

  const formData = await request.formData();

  const message = formData.get('message');
  invariant(typeof message === 'string', 'Commit message is required');

  try {
    await GitVCS.commit(message);

    const providerName = getOauth2FormatName(repo?.credentials);
    window.main.trackSegmentEvent({
      event: SegmentEvent.vcsAction, properties: {
        ...vcsSegmentEventProperties('git', 'commit'),
        providerName,
      },
    });

    checkGitCanPush(workspaceId);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : 'Error while committing changes';
    return { errors: [message] };
  }

  return {
    errors: [],
  };
};

export const commitAndPushToGitRepoAction: ActionFunction = async ({
  request,
  params,
}): Promise<CommitToGitRepoResult> => {
  const { workspaceId } = params;
  invariant(workspaceId, 'Workspace ID is required');

  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);

  const repoId = workspaceMeta?.gitRepositoryId;
  invariant(repoId, 'Workspace is not linked to a git repository');

  const repo = await models.gitRepository.getById(repoId);
  invariant(repo, 'Git Repository not found');

  const formData = await request.formData();

  const message = formData.get('message');
  invariant(typeof message === 'string', 'Commit message is required');

  try {
    await GitVCS.commit(message);

    const providerName = getOauth2FormatName(repo?.credentials);
    window.main.trackSegmentEvent({
      event: SegmentEvent.vcsAction, properties: {
        ...vcsSegmentEventProperties('git', 'commit'),
        providerName,
      },
    });

    checkGitCanPush(workspaceId);
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
    window.main.trackSegmentEvent({
      event: SegmentEvent.vcsAction, properties: {
        ...vcsSegmentEventProperties('git', 'push'),
        providerName,
      },
    });
    models.workspaceMeta.updateByParentId(workspaceId, {
      hasUnpushedChanges: false,
    });
  } catch (err: unknown) {
    if (err instanceof Errors.HttpError) {
      return {
        errors: [`${err.message}, ${err.data.response}`],
      };
    }
    const errorMessage = err instanceof Error ? err.message : 'Unknown Error';

    window.main.trackSegmentEvent({
      event: SegmentEvent.vcsAction, properties: {
        ...vcsSegmentEventProperties('git', 'push', errorMessage),
        providerName,
      },
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

export const createNewGitBranchAction: ActionFunction = async ({
  request,
  params,
}): Promise<CreateNewGitBranchResult> => {
  const { workspaceId } = params;
  invariant(workspaceId, 'Workspace ID is required');

  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);

  const repoId = workspaceMeta?.gitRepositoryId;
  invariant(repoId, 'Workspace is not linked to a git repository');

  const repo = await models.gitRepository.getById(repoId);
  invariant(repo, 'Git Repository not found');

  const formData = await request.formData();

  const branch = formData.get('branch');
  invariant(typeof branch === 'string', 'Branch name is required');

  try {
    const providerName = getOauth2FormatName(repo?.credentials);
    await GitVCS.checkout(branch);
    window.main.trackSegmentEvent({
      event: SegmentEvent.vcsAction, properties: {
        ...vcsSegmentEventProperties('git', 'create_branch'),
        providerName,
      },
    });
    checkGitCanPush(workspaceId);
    checkGitChanges(workspaceId);
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
export const checkoutGitBranchAction: ActionFunction = async ({
  request,
  params,
}): Promise<CheckoutGitBranchResult> => {
  const { workspaceId } = params;
  invariant(workspaceId, 'Workspace ID is required');

  const workspace = await models.workspace.getById(workspaceId);

  invariant(workspace, 'Workspace not found');

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);

  const repoId = workspaceMeta?.gitRepositoryId;

  invariant(repoId, 'Workspace is not linked to a git repository');

  const repo = await models.gitRepository.getById(repoId);
  invariant(repo, 'Git Repository not found');

  const formData = await request.formData();

  const branch = formData.get('branch');
  invariant(typeof branch === 'string', 'Branch name is required');

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

  if (workspaceMeta) {
    const log = (await GitVCS.log({ depth: 1 })) || [];

    const author = log[0] ? log[0].commit.author : null;
    const cachedGitLastCommitTime = author ? author.timestamp * 1000 : null;

    await models.workspaceMeta.update(workspaceMeta, {
      cachedGitLastCommitTime,
      cachedGitRepositoryBranch: branch,
      cachedGitLastAuthor: author?.name || null,
    });
  }

  await database.flushChanges(bufferId);

  checkGitCanPush(workspaceId);
  checkGitChanges(workspaceId);

  return {};
};

export const mergeGitBranch = async ({
  theirsBranch,
  workspaceId,
  allowUncommittedChangesBeforeMerge = false,
}: {
  theirsBranch: string;
  workspaceId: string;
  allowUncommittedChangesBeforeMerge?: boolean;
}) => {
  const {
    providerName,
  } = await getGitRepoInfo(workspaceId);
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
    window.main.trackSegmentEvent({
      event: SegmentEvent.vcsAction, properties: {
        ...vcsSegmentEventProperties('git', 'merge_branch'),
        providerName,
      },
    });
  } catch (err) {
    if (err instanceof Errors.HttpError) {
      err = new Error(`${err.message}, ${err.data.response}`);
    }
    const errorMessage = err instanceof Error ? err.message : 'Unknown Error';
    window.main.trackSegmentEvent({
      event:
        SegmentEvent.vcsAction, properties:
        vcsSegmentEventProperties('git', 'merge_branch', errorMessage),
    });

    throw err;
  }
  await database.flushChanges(bufferId, true);
};

export interface DeleteGitBranchResult {
  errors?: string[];
}

export const deleteGitBranchAction: ActionFunction = async ({
  request,
  params,
}): Promise<DeleteGitBranchResult> => {
  const { workspaceId } = params;
  invariant(workspaceId, 'Workspace ID is required');

  const workspace = await models.workspace.getById(workspaceId);

  invariant(workspace, 'Workspace not found');

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);

  const repoId = workspaceMeta?.gitRepositoryId;

  invariant(repoId, 'Workspace is not linked to a git repository');

  const repo = await models.gitRepository.getById(repoId);
  invariant(repo, 'Git Repository not found');

  const formData = await request.formData();

  const branch = formData.get('branch');
  invariant(typeof branch === 'string', 'Branch name is required');

  try {
    const providerName = getOauth2FormatName(repo?.credentials);
    await GitVCS.deleteBranch(branch);
    window.main.trackSegmentEvent({
      event: SegmentEvent.vcsAction, properties: {
        ...vcsSegmentEventProperties('git', 'delete_branch'),
        providerName,
      },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return { errors: [errorMessage] };
  }

  return {};
};

export interface PushToGitRemoteResult {
  errors?: string[];
}

export const pushToGitRemoteAction: ActionFunction = async ({
  request,
  params,
}): Promise<PushToGitRemoteResult> => {
  const { workspaceId } = params;
  invariant(workspaceId, 'Workspace ID is required');
  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  const formData = await request.formData();

  const force = Boolean(formData.get('force'));

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);

  const repoId = workspaceMeta?.gitRepositoryId;

  invariant(repoId, 'Workspace is not linked to a git repository');

  const gitRepository = await models.gitRepository.getById(repoId);

  invariant(gitRepository, 'Git Repository not found');

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

  const bufferId = await database.bufferChanges();
  const providerName = getOauth2FormatName(gitRepository.credentials);
  try {
    await GitVCS.push(gitRepository.credentials);
    window.main.trackSegmentEvent({
      event: SegmentEvent.vcsAction, properties: {
        ...vcsSegmentEventProperties('git', force ? 'force_push' : 'push'),
        providerName,
      },
    });
    models.workspaceMeta.updateByParentId(workspaceId, {
      hasUnpushedChanges: false,
    });
  } catch (err: unknown) {
    if (err instanceof Errors.HttpError) {
      return {
        errors: [`${err.message}, ${err.data.response}`],
      };
    }
    const errorMessage = err instanceof Error ? err.message : 'Unknown Error';

    window.main.trackSegmentEvent({
      event: SegmentEvent.vcsAction, properties: {
        ...vcsSegmentEventProperties('git', 'push', errorMessage),
        providerName,
      },
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

  return {};
};

async function getGitRepoInfo(workspaceId: string) {
  invariant(workspaceId, 'Workspace ID is required');
  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');
  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);
  const repoId = workspaceMeta?.gitRepositoryId;
  invariant(repoId, 'Workspace is not linked to a git repository');
  const gitRepository = await models.gitRepository.getById(repoId);
  invariant(gitRepository, 'Git Repository not found');
  const providerName = getOauth2FormatName(gitRepository.credentials);
  return {
    gitRepository,
    providerName,
  };
}

export const pullFromGitRemote = async (workspaceId: string) => {
  const {
    gitRepository,
    providerName,
  } = await getGitRepoInfo(workspaceId);

  const bufferId = await database.bufferChanges();

  try {
    await GitVCS.pull(gitRepository.credentials);
    window.main.trackSegmentEvent({
      event: SegmentEvent.vcsAction, properties: {
        ...vcsSegmentEventProperties('git', 'pull'),
        providerName,
      },
    });
  } catch (err: unknown) {
    if (err instanceof Errors.HttpError) {
      err = new Error(`${err.message}, ${err.data.response}`);
    }
    const errorMessage = err instanceof Error ? err.message : 'Unknown Error';
    window.main.trackSegmentEvent({
      event:
        SegmentEvent.vcsAction, properties:
        vcsSegmentEventProperties('git', 'pull', errorMessage),
    });

    throw err;
  }

  await database.flushChanges(bufferId);
};

export const continueMerge = async (
  {
    handledMergeConflicts,
    commitMessage,
    commitParent,
  }: {
    handledMergeConflicts: MergeConflict[];
      commitMessage: string;
      commitParent: string[];
  }
) => {
  const bufferId = await database.bufferChanges();

  await GitVCS.continueMerge({
    handledMergeConflicts,
    commitMessage,
    commitParent,
  });

  await database.flushChanges(bufferId);
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

export const discardChangesAction: ActionFunction = async ({
  params,
  request,
}): Promise<{
  errors?: string[];
}> => {
  const { workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');

  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);

  const repoId = workspaceMeta?.gitRepositoryId;

  invariant(repoId, 'Workspace is not linked to a git repository');

  const gitRepository = await models.gitRepository.getById(repoId);

  invariant(gitRepository, 'Git Repository not found');

  const { paths } = await request.json() as { paths: string[] };

  try {
    const { changes } = await getGitChanges(GitVCS);

    const files = changes.unstaged
      .filter(change => paths.includes(change.path));

    await GitVCS.discardChanges(files);

  } catch (e) {
    const errorMessage =
      e instanceof Error ? e.message : 'Error while rolling back changes';
    return {
      errors: [errorMessage],
    };
  }

  return {};
};

export interface GitStatusResult {
  status: {
    localChanges: number;
  };
}

export const gitStatusAction: ActionFunction = async ({
  params,
}): Promise<GitStatusResult> => {
  const { workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');

  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');
  try {
    const { hasUncommittedChanges, changes } = await getGitChanges(GitVCS);
    const localChanges = changes.staged.length + changes.unstaged.length;
    // update workspace meta with git sync data, use for show uncommit changes on collection card
    models.workspaceMeta.updateByParentId(workspaceId, {
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

export const checkGitChanges = async (workspaceId: string) => {
  try {
    const { hasUncommittedChanges } = await getGitChanges(GitVCS);
    // update workspace meta with git sync data, use for show uncommit changes on collection card
    models.workspaceMeta.updateByParentId(workspaceId, {
      hasUncommittedChanges,
    });
  } catch (e) {
  }
};

export const checkGitCanPush = async (workspaceId: string) => {
  try {
    let canPush = false;
    const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);

    const repoId = workspaceMeta?.gitRepositoryId;

    if (repoId) {
      const gitRepository = await models.gitRepository.getById(repoId);

      invariant(gitRepository, 'Git Repository not found');
      canPush = await GitVCS.canPush(gitRepository.credentials);
    }

    // update workspace meta with git sync data, use for show unpushed changes on collection card
    models.workspaceMeta.updateByParentId(workspaceId, {
      hasUnpushedChanges: canPush,
    });
  } catch (e) { }
};

export const stageChangesAction: ActionFunction = async ({
  request,
  params,
}): Promise<{
  errors?: string[];
}> => {
  const { workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');

  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);

  const repoId = workspaceMeta?.gitRepositoryId;

  invariant(repoId, 'Workspace is not linked to a git repository');

  const gitRepository = await models.gitRepository.getById(repoId);

  invariant(gitRepository, 'Git Repository not found');

  const { paths } = await request.json() as { paths: string[] };

  try {
    const { changes } = await getGitChanges(GitVCS);

    const files = changes.unstaged
      .filter(change => paths.includes(change.path));

    await GitVCS.stageChanges(files);
  } catch (e) {
    const errorMessage =
      e instanceof Error ? e.message : 'Error while staging changes';
    return {
      errors: [errorMessage],
    };
  }

  return {};
};

export const unstageChangesAction: ActionFunction = async ({
  request,
  params,
}): Promise<{
  errors?: string[];
}> => {
  const { workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');

  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);

  const repoId = workspaceMeta?.gitRepositoryId;

  invariant(repoId, 'Workspace is not linked to a git repository');

  const gitRepository = await models.gitRepository.getById(repoId);

  invariant(gitRepository, 'Git Repository not found');

  const { paths } = await request.json() as { paths: string[] };

  try {
    const { changes } = await getGitChanges(GitVCS);

    const files = changes.staged
      .filter(change => paths.includes(change.path));

    await GitVCS.unstageChanges(files);
  } catch (e) {
    const errorMessage =
      e instanceof Error ? e.message : 'Error while unstaging changes';
    return {
      errors: [errorMessage],
    };
  }

  return {};
};

export type GitDiffResult = {
  diff?: {
    before: string;
    after: string;
  };
} | {
  errors: string[];
};

export const diffFileLoader: LoaderFunction = async ({
  request,
  params,
}): Promise<GitDiffResult> => {
  const { workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');

  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);

  const repoId = workspaceMeta?.gitRepositoryId;

  invariant(repoId, 'Workspace is not linked to a git repository');

  const gitRepository = await models.gitRepository.getById(repoId);

  invariant(gitRepository, 'Git Repository not found');

  const urlParams = new URLSearchParams(request.url.split('?')[1]);

  const filepath = urlParams.get('filepath');
  invariant(filepath, 'Filepath is required');

  const staged = urlParams.get('staged') === 'true';

  try {
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

export const loadGitHubCredentials: LoaderFunction = async () => {
  const credentials = await models.gitCredentials.getByProvider('github');

  return credentials;
};

export const initSignInToGitHub: ActionFunction = async () => {
  await window.main.git.initSignInToGitHub();

  return null;
};

export const completeSignInToGitHub: ActionFunction = async ({ request }) => {
  const { code, state } = await request.json() as { code: string; state: string; path: string };
  await window.main.git.completeSignInToGitHub({
    code,
    state,
  });

  return null;
};

export const signOutOfGitHub: ActionFunction = async () => {
  await window.main.git.signOutOfGitHub();

  return null;
};

export const loadGitLabCredentials: LoaderFunction = async () => {
  const credentials = await models.gitCredentials.getByProvider('gitlab');

  return credentials;
};

export const initSignInToGitLab: ActionFunction = async () => {
  await window.main.git.initSignInToGitLab();

  return null;
};

export const completeSignInToGitLab: ActionFunction = async ({ request }) => {
  const { code, state } = await request.json() as { code: string; state: string; path: string };
  await window.main.git.completeSignInToGitLab({
    code,
    state,
  });

  return null;
};

export const signOutOfGitLab: ActionFunction = async () => {
  await window.main.git.signOutOfGitLab();

  return null;
};

export const loadGitCredentials: LoaderFunction = async () => {
  const credentials = await models.gitCredentials.all();

  return credentials;
};
