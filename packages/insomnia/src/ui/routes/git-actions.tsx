import { invariant } from '@remix-run/router';
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
import {
  getGitVCS,
  GIT_CLONE_DIR,
  GIT_INSOMNIA_DIR,
  GIT_INSOMNIA_DIR_NAME,
  GIT_INTERNAL_DIR,
  GitLogEntry,
  GitVCS,
  setGitVCS,
} from '../../sync/git/git-vcs';
import { MemClient } from '../../sync/git/mem-client';
import { NeDBClient } from '../../sync/git/ne-db-client';
import parseGitPath from '../../sync/git/parse-git-path';
import { routableFSClient } from '../../sync/git/routable-fs-client';
import { shallowClone } from '../../sync/git/shallow-clone';
import {
  addDotGit,
  getOauth2FormatName,
  translateSSHtoHTTP,
} from '../../sync/git/utils';
import { SegmentEvent, trackSegmentEvent, vcsSegmentEventProperties } from '../analytics';

// Loaders
export type GitRepoLoaderData = {
  branch: string;
  log: GitLogEntry[];
  branches: string[];
  remoteBranches: string[];
  gitRepository: GitRepository | null;
  changes: GitChange[];
  statusNames: Record<string, string>;
} | {
  errors: string[];
};

export const gitRepoLoader: LoaderFunction = async ({ params }): Promise<GitRepoLoaderData> => {
  try {
    const { workspaceId, projectId } = params;
    invariant(typeof workspaceId === 'string', 'Workspace Id is required');
    invariant(typeof projectId === 'string', 'Project Id is required');

    const workspace = await models.workspace.getById(workspaceId);
    invariant(workspace, 'Workspace not found');
    const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);
    if (!workspaceMeta?.gitRepositoryId) {
      return {
        errors: ['Workspace is not linked to a git repository'],
      };
    }

    const gitRepository = await models.gitRepository.getById(workspaceMeta?.gitRepositoryId);
    invariant(gitRepository, 'Git Repository not found');

    // Create FS client
    const baseDir = path.join(
      process.env['INSOMNIA_DATA_PATH'] || window.app.getPath('userData'),
      `version-control/git/${gitRepository._id}`,
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

    const vcs = new GitVCS();

    // Init VCS
    const { credentials, uri } = gitRepository;
    if (gitRepository.needsFullClone) {
      await vcs.initFromClone({
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
      await vcs.init({
        directory: GIT_CLONE_DIR,
        fs: routableFS,
        gitDirectory: GIT_INTERNAL_DIR,
      });
    }

    // Configure basic info
    const { author, uri: gitUri } = gitRepository;
    await vcs.setAuthor(author.name, author.email);
    await vcs.addRemote(gitUri);

    try {
      await vcs.fetch(false, 1, gitRepository?.credentials);
    } catch (e) {
      console.warn('Error fetching from remote');
    }

    setGitVCS(vcs);

    const { changes, statusNames } = await getGitChanges(vcs, workspace);

    return {
      branch: await vcs.getBranch(),
      log: await vcs.log() || [],
      branches: await vcs.listBranches(),
      remoteBranches: await vcs.listRemoteBranches(),
      gitRepository: gitRepository,
      changes,
      statusNames,
    };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Error while fetching git repository.';
    return {
      errors: [errorMessage],
    };
  }
};

export interface GitChangesLoaderData {
  changes: GitChange[];
  branch: string;
  statusNames: Record<string, string>;
}

export const gitChangesLoader: LoaderFunction = async ({ params }): Promise<GitChangesLoaderData> => {
  const { workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');

  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);

  const repoId = workspaceMeta?.gitRepositoryId;

  invariant(repoId, 'Workspace is not linked to a git repository');

  const gitRepository = await models.gitRepository.getById(repoId);

  invariant(gitRepository, 'Git Repository not found');

  const vcs = getGitVCS();

  const branch = await vcs.getBranch();

  const { changes, statusNames } = await getGitChanges(vcs, workspace);

  return {
    branch,
    changes,
    statusNames,
  };
};

// Actions
type CloneGitActionResult = Response | {
  errors?: string[];
};

export const cloneGitRepoAction: ActionFunction = async ({
  request,
  params,
}): Promise<CloneGitActionResult>  => {
  const { organizationId, projectId } = params;

  invariant(typeof projectId === 'string', 'ProjectId is required.');
  const project = await models.project.getById(projectId);
  invariant(project, 'Project not found');

  const repoSettingsPatch: Partial<GitRepository> = {};
  const formData = await request.formData();

  // URI
  const uri = formData.get('uri');
  invariant(typeof uri === 'string', 'URI is required');
  repoSettingsPatch.uri = uri;
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
    invariant(oauth2format === 'gitlab' || oauth2format === 'github', 'OAuth2 format is required');
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
    const password = formData.get('password');
    invariant(typeof password === 'string', 'Password is required');
    const token = formData.get('token');
    invariant(typeof token === 'string', 'Token is required');
    const username = formData.get('username');
    invariant(typeof username === 'string', 'Username is required');

    repoSettingsPatch.credentials = {
      password,
      username,
    };
  }

  trackSegmentEvent(
    SegmentEvent.vcsSyncStart,
    vcsSegmentEventProperties('git', 'clone')
  );
  repoSettingsPatch.needsFullClone = true;
  repoSettingsPatch.uri = translateSSHtoHTTP(repoSettingsPatch.uri || '');
  let fsClient = MemClient.createClient();

  const providerName = getOauth2FormatName(repoSettingsPatch.credentials);
  try {
    await shallowClone({
      fsClient,
      gitRepository: repoSettingsPatch as GitRepository,
    });
  } catch (originalUriError) {
    if (repoSettingsPatch.uri.endsWith('.git')) {
      trackSegmentEvent(SegmentEvent.vcsSyncComplete, {
        ...vcsSegmentEventProperties('git', 'clone', originalUriError.message),
        providerName,
      });

      return {
        errors: ['Error cloning repository'],
      };
    }

    const dotGitUri = addDotGit(repoSettingsPatch.uri);

    try {
      fsClient = MemClient.createClient();
      await shallowClone({
        fsClient,
        gitRepository: { ...repoSettingsPatch, uri: dotGitUri } as GitRepository,
      });
      // by this point the clone was successful, so update with this syntax
      repoSettingsPatch.uri = dotGitUri;
    } catch (dotGitError) {
      trackSegmentEvent(SegmentEvent.vcsSyncComplete, {
        ...vcsSegmentEventProperties('git', 'clone', dotGitError.message),
        providerName,
      });
      return {
        errors: ['Error Cloning Repository: failed to clone with and without `.git` suffix'],
      };
    }
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
  // If no workspace exists, user should be prompted to create a document
  if (!(await containsInsomniaWorkspaceDir(fsClient))) {
    trackSegmentEvent(SegmentEvent.vcsSyncComplete, {
      ...vcsSegmentEventProperties('git', 'clone', 'no directory found'),
      providerName,
    });
    return {
      errors: ['No insomnia directory found in repository'],
    };
  }

  const workspaceBase = path.join(GIT_INSOMNIA_DIR, models.workspace.type);
  const workspaces = await fsClient.promises.readdir(workspaceBase);

  if (workspaces.length === 0) {
    trackSegmentEvent(SegmentEvent.vcsSyncComplete, {
      ...vcsSegmentEventProperties('git', 'clone', 'no workspaces found'),
      providerName,
    });

    return {
      errors: ['No workspaces found in repository'],
    };
  }

  if (workspaces.length > 1) {
    trackSegmentEvent(SegmentEvent.vcsSyncComplete, {
      ...vcsSegmentEventProperties('git', 'clone', 'multiple workspaces found'),
      providerName,
    });

    return {
      errors: ['Multiple workspaces found in repository. Expected one.'],
    };
  }

  // Only one workspace
  const workspacePath = path.join(workspaceBase, workspaces[0]);
  const workspaceJson = await fsClient.promises.readFile(workspacePath);
  const workspace = YAML.parse(workspaceJson.toString());
  // Check if the workspace already exists
  const existingWorkspace = await models.workspace.getById(workspace._id);

  if (existingWorkspace) {
    trackSegmentEvent(SegmentEvent.vcsSyncComplete, {
      ...vcsSegmentEventProperties('git', 'clone', 'workspace already exists'),
      providerName,
    });
    return {
      errors: [`Workspace ${existingWorkspace.name} already exists. Please delete it before cloning.`],
    };
  }

  // Stop the DB from pushing updates to the UI temporarily
  const bufferId = await database.bufferChanges();

  // Loop over all model folders in root
  for (const modelType of await fsClient.promises.readdir(GIT_INSOMNIA_DIR)) {
    const modelDir = path.join(GIT_INSOMNIA_DIR, modelType);

    // Loop over all documents in model folder and save them
    for (const docFileName of await fsClient.promises.readdir(modelDir)) {
      const docPath = path.join(modelDir, docFileName);
      const docYaml = await fsClient.promises.readFile(docPath);
      const doc: models.BaseModel = YAML.parse(docYaml.toString());
      if (isWorkspace(doc)) {
        // @ts-expect-error parentId can be string or null for a workspace
        doc.parentId = project?._id || null;
        doc.scope = WorkspaceScopeKeys.design;
      }
      await database.upsert(doc);
    }
  }

  // Store GitRepository settings and set it as active
  await createGitRepository(workspace._id, repoSettingsPatch);

  // Flush DB changes
  await database.flushChanges(bufferId);
  trackSegmentEvent(SegmentEvent.vcsSyncComplete, {
    ...vcsSegmentEventProperties('git', 'clone'),
    providerName,
  });

  return redirect(`/organization/${organizationId}/project/${projectId}/workspace/${workspace._id}/${ACTIVITY_SPEC}`);
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
  repoSettingsPatch.uri = uri;
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
    invariant(oauth2format === 'gitlab' || oauth2format === 'github', 'OAuth2 format is required');
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
    const password = formData.get('password');
    invariant(typeof password === 'string', 'Password is required');
    const token = formData.get('token');
    invariant(typeof token === 'string', 'Token is required');
    const username = formData.get('username');
    invariant(typeof username === 'string', 'Username is required');

    repoSettingsPatch.credentials = {
      password,
      username,
    };
  }

  if (gitRepositoryId) {
    const repo = await models.gitRepository.getById(gitRepositoryId);
    invariant(repo, 'GitRepository not found');
    await models.gitRepository.update(repo, repoSettingsPatch);
    gitRepositoryId = repo._id;
  } else {
    const gitRepository = await models.gitRepository.create(repoSettingsPatch);
    gitRepositoryId = gitRepository._id;
  }

  await models.workspaceMeta.updateByParentId(workspaceId, {
    gitRepositoryId,
  });
};

export const resetGitRepoAction: ActionFunction = async ({
  params,
}) => {
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

  const vcs = getGitVCS();

  try {
    const { changes } = await getGitChanges(vcs, workspace);

    const changesToCommit = changes.filter(change => {
      if (allModified && !change.added) {
        return true;
      } else if (allUnversioned && change.added) {
        return true;
      }
      return stagedChangesPaths.includes(change.path);
    });

    for (const item of changesToCommit) {
      item.status.includes('deleted') ? await vcs.remove(item.path) : await vcs.add(item.path);
    }

    await vcs.commit(message);

    const providerName = getOauth2FormatName(repo?.credentials);
    trackSegmentEvent(SegmentEvent.vcsAction, { ...vcsSegmentEventProperties('git', 'commit'), providerName });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error while commiting changes';
    return { errors: [message] };
  }

  return {};
};

export interface CreateNewGitBranchResult {
 errors?: string[];
}

export const createNewGitBranchAction: ActionFunction = async ({ request, params }): Promise<CreateNewGitBranchResult> => {
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

  const vcs = getGitVCS();

  try {
    const providerName = getOauth2FormatName(repo?.credentials);
    await vcs.checkout(branch);
    trackSegmentEvent(SegmentEvent.vcsAction, { ...vcsSegmentEventProperties('git', 'create_branch'), providerName });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Something went wrong while creating a new branch';
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

  const vcs = getGitVCS();

  try {
    await vcs.checkout(branch);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : err;
    return {
      errors: [errorMessage],
    };
  }

  return {};
};

export interface MergeGitBranchResult {
  errors?: string[];
}

export const mergeGitBranchAction: ActionFunction = async ({ request, params }): Promise<MergeGitBranchResult> => {
  const { workspaceId } = params;
  invariant(workspaceId, 'Workspace ID is required');

  const workspace = await models.workspace.getById(workspaceId);

  invariant(workspace, 'Workspace not found');

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);

  const repoId = workspaceMeta?.gitRepositoryId;

  invariant(repoId, 'Workspace is not linked to a git repository');

  const repo = await models.gitRepository.getById(repoId);
  invariant(repo, 'Git Repository not found');

  const vcs = getGitVCS();

  const formData = await request.formData();
  const branch = formData.get('branch');
  invariant(typeof branch === 'string', 'Branch name is required');

  try {
    const providerName = getOauth2FormatName(repo?.credentials);
    await vcs.merge(branch);
    // Apparently merge doesn't update the working dir so need to checkout too
    const bufferId = await database.bufferChanges();

    await vcs.checkout(branch);
    trackSegmentEvent(SegmentEvent.vcsAction, { ...vcsSegmentEventProperties('git', 'checkout_branch'), providerName });
    await database.flushChanges(bufferId, true);
    trackSegmentEvent(SegmentEvent.vcsAction, { ...vcsSegmentEventProperties('git', 'merge_branch'), providerName });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return  { errors: [errorMessage] };
  }

  return {};
};

export interface DeleteGitBranchResult {
  errors?: string[];
}

export const deleteGitBranchAction: ActionFunction = async ({ request, params }): Promise<DeleteGitBranchResult> => {
  const { workspaceId } = params;
  invariant(workspaceId, 'Workspace ID is required');

  const workspace = await models.workspace.getById(workspaceId);

  invariant(workspace, 'Workspace not found');

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);

  const repoId = workspaceMeta?.gitRepositoryId;

  invariant(repoId, 'Workspace is not linked to a git repository');

  const repo = await models.gitRepository.getById(repoId);
  invariant(repo, 'Git Repository not found');

  const vcs = getGitVCS();

  const formData = await request.formData();

  const branch = formData.get('branch');
  invariant(typeof branch === 'string', 'Branch name is required');

  try {
    const providerName = getOauth2FormatName(repo?.credentials);
    await vcs.deleteBranch(branch);
    trackSegmentEvent(SegmentEvent.vcsAction, { ...vcsSegmentEventProperties('git', 'delete_branch'), providerName });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return  { errors: [errorMessage] };
  }

  return {};
};

export interface PushToGitRemoteResult {
  errors?: string[];
}

export const pushToGitRemoteAction: ActionFunction = async ({
  request,
  params,
}): Promise<PushToGitRemoteResult>  => {
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

  const vcs = getGitVCS();

  // Check if there is anything to push
  let canPush = false;
  try {
    canPush = await vcs.canPush(gitRepository.credentials);
  } catch (err) {
    return { errors: ['Error Pushing Repository'] };
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
    await vcs.push(gitRepository.credentials);
    trackSegmentEvent(SegmentEvent.vcsAction, { ...vcsSegmentEventProperties('git', force ? 'force_push' : 'push'), providerName });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown Error';

    trackSegmentEvent(SegmentEvent.vcsAction, { ...vcsSegmentEventProperties('git', 'push', errorMessage), providerName });

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

  const vcs = getGitVCS();

  const bufferId = await database.bufferChanges();

  const providerName = getOauth2FormatName(gitRepository.credentials);
  try {
    await vcs.pull(gitRepository.credentials);
    trackSegmentEvent(SegmentEvent.vcsAction, { ...vcsSegmentEventProperties('git', 'pull'), providerName });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown Error';
    trackSegmentEvent(SegmentEvent.vcsAction, vcsSegmentEventProperties('git', 'pull', errorMessage));

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

async function getGitVCSPaths(vcs: GitVCS) {
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

async function getGitChanges(vcs: GitVCS, workspace: Workspace) {
  // Cache status names
  const docs = await database.withDescendants(workspace);
  const allPaths = await getGitVCSPaths(vcs);
  const statusNames: Record<string, string> = {};
  for (const doc of docs) {
    const name = (isApiSpec(doc) && doc.fileName) || doc.name || '';
    statusNames[path.join(GIT_INSOMNIA_DIR_NAME, doc.type, `${doc._id}.json`)] = name;
    statusNames[path.join(GIT_INSOMNIA_DIR_NAME, doc.type, `${doc._id}.yml`)] = name;
  }
  // Create status items
  const items: Record<string, GitChange> = {};
  const log = (await vcs.log(1)) || [];
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

export const gitRollbackChangesAction: ActionFunction = async ({ params, request }): Promise<GitRollbackChangesResult> => {
  const { workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');

  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);

  const repoId = workspaceMeta?.gitRepositoryId;

  invariant(repoId, 'Workspace is not linked to a git repository');

  const gitRepository = await models.gitRepository.getById(repoId);

  invariant(gitRepository, 'Git Repository not found');

  const vcs = getGitVCS();

  const formData = await request.formData();

  const paths = [...formData.getAll('paths')] as string[];
  const changeType = formData.get('changeType') as string;
  try {
    const { changes } = await getGitChanges(vcs, workspace);

    const files = changes
      .filter(i => changeType === 'modified' ? !i.status.includes('added') : i.status.includes('added'))
      // only rollback if editable
      .filter(i => i.editable)
      // only rollback if in selected path or for all paths
      .filter(i => paths.length === 0 || paths.includes(i.path))
      .map(i => ({
        filePath: i.path,
        status: i.status,
      }));

    await gitRollback(vcs, files);
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Error while rolling back changes';
    return {
      errors: [errorMessage],
    };
  }

  return {};
};
