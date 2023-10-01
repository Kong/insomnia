import { fromUrl } from 'hosted-git-info';
import { Errors } from 'isomorphic-git';
import path from 'path';
import { ActionFunction, LoaderFunction, redirect } from 'react-router-dom';
import YAML from 'yaml';

import { ACTIVITY_SPEC } from '../../common/constants';
import { database } from '../../common/database';
import * as models from '../../models';
import { isApiSpec } from '../../models/api-spec';
import { GitRepository } from '../../models/git-repository';
import { createGitRepository } from '../../models/helpers/git-repository-operations';
import {
  isWorkspace,
  Workspace,
  WorkspaceScopeKeys,
} from '../../models/workspace';
import { fsClient } from '../../sync/git/fs-client';
import { gitRollback } from '../../sync/git/git-rollback';
import GitVCS, {
  GIT_CLONE_DIR,
  GIT_INSOMNIA_DIR,
  GIT_INSOMNIA_DIR_NAME,
  GIT_INTERNAL_DIR,
  GitLogEntry,
} from '../../sync/git/git-vcs';
import { MemClient } from '../../sync/git/mem-client';
import { NeDBClient } from '../../sync/git/ne-db-client';
import parseGitPath from '../../sync/git/parse-git-path';
import { routableFSClient } from '../../sync/git/routable-fs-client';
import { shallowClone } from '../../sync/git/shallow-clone';
import {
  getOauth2FormatName,
} from '../../sync/git/utils';
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

export const gitRepoAction: ActionFunction = async ({
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
        branch: await GitVCS.getBranch(),
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
    const otherDatClient = fsClient(path.join(baseDir, 'other'));

    // The routable FS client directs isomorphic-git to read/write from the database or from the correct directory on the file system while performing git operations.
    const routableFS = routableFSClient(otherDatClient, {
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
      branch: await GitVCS.getBranch(),
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

  const branches = await GitVCS.listBranches();

  const remoteBranches = await GitVCS.fetchRemoteBranches();

  return {
    branches,
    remoteBranches,
  };
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
    console.log(e);
    return {
      log: [],
    };
  }
};

export interface GitChangesLoaderData {
  changes: GitChange[];
  branch: string;
  statusNames: Record<string, string>;
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

  invariant(repoId, 'Workspace is not linked to a git repository');

  const gitRepository = await models.gitRepository.getById(repoId);

  invariant(gitRepository, 'Git Repository not found');

  const branch = await GitVCS.getBranch();
  try {
    const { changes, statusNames } = await getGitChanges(GitVCS, workspace);

    return {
      branch,
      changes,
      statusNames,
    };
  } catch (e) {
    console.log(e);
    return {
      branch,
      changes: [],
      statusNames: {},
    };
  }
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

  const fsClient = MemClient.createClient();

  const providerName = getOauth2FormatName(repoSettingsPatch.credentials);
  try {
    await shallowClone({
      fsClient,
      gitRepository: repoSettingsPatch as GitRepository,
    });
  } catch (err) {
    console.error(err);

    if (err instanceof Errors.HttpError) {
      return {
        errors: [`${err.message}, ${err.data.response}`],
      };
    }

      return {
        errors: [err.message],
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
  if (!(await containsInsomniaWorkspaceDir(fsClient))) {
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
    const workspaces = await fsClient.promises.readdir(workspaceBase);

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
    const workspaceJson = await fsClient.promises.readFile(workspacePath);
    const workspace = YAML.parse(workspaceJson.toString());
    scope = (workspace.scope === WorkspaceScopeKeys.collection) ? WorkspaceScopeKeys.collection : WorkspaceScopeKeys.design;
    // Check if the workspace already exists
    const existingWorkspace = await models.workspace.getById(workspace._id);

    if (existingWorkspace) {
      return redirect(`/organization/${existingWorkspace.parentId}/project/${existingWorkspace.parentId}/workspace/${existingWorkspace._id}/debug`);
    }

    // Loop over all model folders in root
    for (const modelType of await fsClient.promises.readdir(GIT_INSOMNIA_DIR)) {
      const modelDir = path.join(GIT_INSOMNIA_DIR, modelType);

      // Loop over all documents in model folder and save them
      for (const docFileName of await fsClient.promises.readdir(modelDir)) {
        const docPath = path.join(modelDir, docFileName);
        const docYaml = await fsClient.promises.readFile(docPath);
        const doc: models.BaseModel = YAML.parse(docYaml.toString());
        if (isWorkspace(doc)) {
          doc.parentId = project._id;
          doc.scope = scope;
          const workspace = await database.upsert(doc);
          workspaceId = workspace._id;
        } else {
          await database.upsert(doc);
        }
      }
    }

    // Store GitRepository settings and set it as active
    await createGitRepository(workspace._id, repoSettingsPatch);
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

  const stagedChangesPaths = [...formData.getAll('paths')] as string[];
  const allModified = Boolean(formData.get('allModified'));
  const allUnversioned = Boolean(formData.get('allUnversioned'));

  try {
    const { changes } = await getGitChanges(GitVCS, workspace);

    const changesToCommit = changes.filter(change => {
      if (allModified && !change.added) {
        return true;
      } else if (allUnversioned && change.added) {
        return true;
      }
      return stagedChangesPaths.includes(change.path);
    });

    for (const item of changesToCommit) {
      item.status.includes('deleted')
        ? await GitVCS.remove(item.path)
        : await GitVCS.add(item.path);
    }

    await GitVCS.commit(message);

    const providerName = getOauth2FormatName(repo?.credentials);
    window.main.trackSegmentEvent({
      event: SegmentEvent.vcsAction, properties: {
        ...vcsSegmentEventProperties('git', 'commit'),
        providerName,
      },
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : 'Error while committing changes';
    return { errors: [message] };
  }

  return {};
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

  return {};
};

export interface MergeGitBranchResult {
  errors?: string[];
}

export const mergeGitBranchAction: ActionFunction = async ({
  request,
  params,
}): Promise<MergeGitBranchResult> => {
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
    await GitVCS.merge(branch);
    // Apparently merge doesn't update the working dir so need to checkout too
    const bufferId = await database.bufferChanges();

    await GitVCS.checkout(branch);
    window.main.trackSegmentEvent({
      event: SegmentEvent.vcsAction, properties: {
        ...vcsSegmentEventProperties('git', 'checkout_branch'),
        providerName,
      },
    });
    await database.flushChanges(bufferId, true);
    window.main.trackSegmentEvent({
      event: SegmentEvent.vcsAction, properties: {
        ...vcsSegmentEventProperties('git', 'merge_branch'),
        providerName,
      },
    });
  } catch (err) {
    if (err instanceof Errors.HttpError) {
      return {
        errors: [`${err.message}, ${err.data.response}`],
      };
    }
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return { errors: [errorMessage] };
  }

  return {};
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

export interface PullFromGitRemoteResult {
  errors?: string[];
}

export const pullFromGitRemoteAction: ActionFunction = async ({
  params,
}): Promise<PullFromGitRemoteResult> => {
  const { workspaceId } = params;
  invariant(workspaceId, 'Workspace ID is required');
  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);

  const repoId = workspaceMeta?.gitRepositoryId;

  invariant(repoId, 'Workspace is not linked to a git repository');

  const gitRepository = await models.gitRepository.getById(repoId);

  invariant(gitRepository, 'Git Repository not found');

  const bufferId = await database.bufferChanges();

  const providerName = getOauth2FormatName(gitRepository.credentials);

  try {
    await GitVCS.fetch({
      singleBranch: true,
      depth: 1,
      credentials: gitRepository?.credentials,
    });
  } catch (e) {
    console.warn('Error fetching from remote', e);
  }

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
      return { errors: [`${err.message}, ${err.data.response}`] };
    }
    const errorMessage = err instanceof Error ? err.message : 'Unknown Error';
    window.main.trackSegmentEvent({
      event:
        SegmentEvent.vcsAction, properties:
        vcsSegmentEventProperties('git', 'pull', errorMessage),
    });

    return {
      errors: [`${errorMessage}`],
    };
  }

  await database.flushChanges(bufferId);

  return {};
};

export interface GitChange {
  path: string;
  type: string;
  status: string;
  staged: boolean;
  added: boolean;
  editable: boolean;
}

async function getGitVCSPaths(vcs: typeof GitVCS) {
  const gitFS = vcs.getFs();

  const fs = 'promises' in gitFS ? gitFS.promises : gitFS;

  const fsPaths: string[] = [];
  for (const type of await fs.readdir(GIT_INSOMNIA_DIR)) {
    const typeDir = path.join(GIT_INSOMNIA_DIR, type);
    for (const name of await fs.readdir(typeDir)) {
      // NOTE: git paths don't start with '/' so we're omitting
      //  it here too.
      const gitPath = path.join(GIT_INSOMNIA_DIR_NAME, type, name);
      fsPaths.push(path.join(gitPath));
    }
  }
  // To get all possible paths, we need to combine the paths already in Git
  // with the paths on the FS. This is required to cover the case where a
  // file can be deleted from FS or from Git.
  const gitPaths = await vcs.listFiles();
  const uniquePaths = new Set([...fsPaths, ...gitPaths]);
  return Array.from(uniquePaths).sort();
}

async function getGitChanges(vcs: typeof GitVCS, workspace: Workspace) {
  // Cache status names
  const docs = await database.withDescendants(workspace);
  const allPaths = await getGitVCSPaths(vcs);
  const statusNames: Record<string, string> = {};
  for (const doc of docs) {
    const name = (isApiSpec(doc) && doc.fileName) || doc.name || '';
    statusNames[path.join(GIT_INSOMNIA_DIR_NAME, doc.type, `${doc._id}.json`)] =
      name;
    statusNames[path.join(GIT_INSOMNIA_DIR_NAME, doc.type, `${doc._id}.yml`)] =
      name;
  }
  // Create status items
  const items: Record<string, GitChange> = {};
  const log = (await vcs.log({ depth: 1 })) || [];

  for (const gitPath of allPaths) {
    const status = await vcs.status(gitPath);
    if (status === 'unmodified') {
      continue;
    }
    if (!statusNames[gitPath] && log.length > 0) {
      const docYML = await vcs.readObjFromTree(log[0].commit.tree, gitPath);
      if (docYML) {
        try {
          statusNames[gitPath] = YAML.parse(docYML.toString()).name || '';
        } catch (err) {}
      }
    }
    // We know that type is in the path; extract it. If the model is not found, set to Unknown.
    let { type } = parseGitPath(gitPath);

    if (type && !models.types().includes(type as any)) {
      type = 'Unknown';
    }
    const added = status.includes('added');
    let staged = !added;
    let editable = true;
    // We want to enforce that workspace changes are always committed because otherwise
    // others won't be able to clone from it. We also make fundamental migrations to the
    // scope property which need to be committed.
    // So here we're preventing people from un-staging the workspace.
    if (type === models.workspace.type) {
      editable = false;
      staged = true;
    }
    items[gitPath] = {
      type: type as any,
      staged,
      editable,
      status,
      added,
      path: gitPath,
    };
  }

  return {
    changes: Object.values(items),
    statusNames,
  };
}

export interface GitRollbackChangesResult {
  errors?: string[];
}

export const gitRollbackChangesAction: ActionFunction = async ({
  params,
  request,
}): Promise<GitRollbackChangesResult> => {
  const { workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');

  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);

  const repoId = workspaceMeta?.gitRepositoryId;

  invariant(repoId, 'Workspace is not linked to a git repository');

  const gitRepository = await models.gitRepository.getById(repoId);

  invariant(gitRepository, 'Git Repository not found');

  const formData = await request.formData();

  const paths = [...formData.getAll('paths')] as string[];
  const changeType = formData.get('changeType') as string;
  try {
    const { changes } = await getGitChanges(GitVCS, workspace);

    const files = changes
      .filter(i =>
        changeType === 'modified'
          ? !i.status.includes('added')
          : i.status.includes('added')
      )
      // only rollback if editable
      .filter(i => i.editable)
      // only rollback if in selected path or for all paths
      .filter(i => paths.length === 0 || paths.includes(i.path))
      .map(i => ({
        filePath: i.path,
        status: i.status,
      }));

    await gitRollback(GitVCS, files);
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
    const { changes } = await getGitChanges(GitVCS, workspace);
    const localChanges = changes.filter(i => i.editable).length;

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
