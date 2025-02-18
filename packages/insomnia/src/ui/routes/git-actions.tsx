import { fromUrl } from 'hosted-git-info';
import { type ActionFunction, type LoaderFunction, type LoaderFunctionArgs, redirect } from 'react-router-dom';

import { gitCredentials } from '../../models';
import type { GitRepository } from '../../models/git-repository';
import {
  WorkspaceScopeKeys,
} from '../../models/workspace';
import {
  type GitLogEntry,
} from '../../sync/git/git-vcs';
import type { MergeConflict } from '../../sync/types';
import { invariant } from '../../utils/invariant';

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
  const { projectId, workspaceId } = params;
  invariant(typeof projectId === 'string', 'Project Id is required');
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');

  return window.main.git.loadGitRepository({ projectId, workspaceId });
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
  const { projectId, workspaceId } = params;
  invariant(typeof projectId === 'string', 'Project Id is required');
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');

  return window.main.git.getGitBranches({ projectId, workspaceId });
};

export interface GitFetchLoaderData {
  errors: string[];
}

export const gitFetchAction: ActionFunction = async ({
  params,
}): Promise<GitFetchLoaderData> => {
  const { projectId, workspaceId } = params;
  invariant(typeof projectId === 'string', 'Project Id is required');
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');

  return window.main.git.gitFetchAction({ projectId, workspaceId });
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
  const { projectId, workspaceId } = params;
  invariant(typeof projectId === 'string', 'Project Id is required');
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');

  return window.main.git.gitLogLoader({ projectId, workspaceId });
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
  const { projectId, workspaceId } = params;
  invariant(typeof projectId === 'string', 'Project Id is required');
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');
  return window.main.git.gitChangesLoader({ projectId, workspaceId });
};

export interface GitCanPushLoaderData {
  canPush: boolean;
}

export const canPushLoader: LoaderFunction = async ({ params }): Promise<GitCanPushLoaderData> => {
  const { projectId, workspaceId } = params;
  invariant(typeof projectId === 'string', 'Project Id is required');
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');

  return window.main.git.canPushLoader({ projectId, workspaceId });
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

  invariant(typeof organizationId === 'string', 'OrganizationId is required.');
  invariant(typeof projectId === 'string', 'ProjectId is required.');

  const formData = await request.formData();
  const data = Object.fromEntries(formData.entries()) as {
    authorEmail: string;
    authorName: string;
    token: string;
    uri: string;
    username: string;
    oauth2format: string;
  };

  const result = await window.main.git.cloneGitRepo({
    organizationId,
    projectId,
    ...data,
  });

  if (result.errors) {
    return {
      errors: result.errors,
    };
  }

  if (result.existingWorkspace) {
    return redirect(`/organization/${result.existingWorkspace.organizationId}/project/${result.existingWorkspace.projectId}/workspace/${result.existingWorkspace.workspaceId}/debug`);
  }

  // Redirect to debug for collection scope initial clone
  if (result.scope === WorkspaceScopeKeys.collection) {
    return redirect(
      `/organization/${organizationId}/project/${projectId}/workspace/${result.workspaceId}/debug`
    );
  }
  return redirect(
    `/organization/${organizationId}/project/${projectId}/workspace/${result.workspaceId}/spec`
  );
};

export const updateGitRepoAction: ActionFunction = async ({
  request,
  params,
}) => {
  const { projectId, workspaceId } = params;
  invariant(projectId, 'Project ID is required');
  invariant(workspaceId, 'Workspace ID is required');

  const formData = await request.formData();

  const data = Object.fromEntries(formData.entries()) as {
    authorEmail: string;
    authorName: string;
    token: string;
    uri: string;
    username: string;
    oauth2format: string;
  };

  return window.main.git.updateGitRepo({
    projectId,
    workspaceId,
    ...data,
  });
};

export const resetGitRepoAction: ActionFunction = async ({ params }) => {
  const { projectId, workspaceId } = params;
  invariant(projectId, 'Project ID is required');
  invariant(workspaceId, 'Workspace ID is required');

  return window.main.git.resetGitRepo({ projectId, workspaceId });
};

export interface CommitToGitRepoResult {
  errors?: string[];
  gitRepository?: GitRepository;
}

export const commitToGitRepoAction: ActionFunction = async ({
  request,
  params,
}): Promise<CommitToGitRepoResult> => {
  const { projectId, workspaceId } = params;
  invariant(projectId, 'Project ID is required');
  invariant(workspaceId, 'Workspace ID is required');
  const formData = await request.formData();
  const message = formData.get('message');
  invariant(typeof message === 'string', 'Message is required');

  return window.main.git.commitToGitRepo({ projectId, workspaceId, message });
};

export const commitAndPushToGitRepoAction: ActionFunction = async ({
  request,
  params,
}): Promise<CommitToGitRepoResult> => {
  const { projectId, workspaceId } = params;
  invariant(projectId, 'Project ID is required');
  invariant(workspaceId, 'Workspace ID is required');

  const formData = await request.formData();
  const message = formData.get('message');
  invariant(typeof message === 'string', 'Message is required');

  return window.main.git.commitAndPushToGitRepo({
    projectId,
    workspaceId,
    message,
  });
};

export interface CreateNewGitBranchResult {
  errors?: string[];
}

export const createNewGitBranchAction: ActionFunction = async ({
  request,
  params,
}): Promise<CreateNewGitBranchResult> => {
  const { projectId, workspaceId } = params;
  invariant(projectId, 'Project ID is required');
  invariant(workspaceId, 'Workspace ID is required');

  const formData = await request.formData();
  const branch = formData.get('branch');
  invariant(typeof branch === 'string', 'Branch is required');

  return window.main.git.createNewGitBranch({
    branch,
    projectId,
    workspaceId,
  });
};

export interface CheckoutGitBranchResult {
  errors?: string[];
}
export const checkoutGitBranchAction: ActionFunction = async ({
  request,
  params,
}): Promise<CheckoutGitBranchResult> => {
  const { projectId, workspaceId } = params;
  invariant(projectId, 'Project ID is required');
  invariant(workspaceId, 'Workspace ID is required');

  const formData = await request.formData();
  const branch = formData.get('branch');
  invariant(typeof branch === 'string', 'Branch is required');

  return window.main.git.checkoutGitBranch({
    branch,
    projectId,
    workspaceId,
  });
};

export const mergeGitBranch = async ({
  theirsBranch,
  projectId,
  workspaceId,
  allowUncommittedChangesBeforeMerge = false,
}: {
    projectId: string;
    workspaceId: string;
    theirsBranch: string;
    allowUncommittedChangesBeforeMerge?: boolean;
}) => {
  await window.main.git.mergeGitBranch({
    projectId,
    workspaceId,
    theirsBranch,
    allowUncommittedChangesBeforeMerge,
  });
};

export interface DeleteGitBranchResult {
  errors?: string[];
}

export const deleteGitBranchAction: ActionFunction = async ({
  request,
  params,
}): Promise<DeleteGitBranchResult> => {
  const { projectId, workspaceId } = params;
  invariant(typeof projectId === 'string', 'Project Id is required');
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');

  const formData = await request.formData();
  const branch = formData.get('branch');
  invariant(typeof branch === 'string', 'Branch is required');

  return window.main.git.deleteGitBranch({
    branch,
    projectId,
    workspaceId,
  });
};

export interface PushToGitRemoteResult {
  errors?: string[];
  gitRepository?: GitRepository;
}

export const pushToGitRemoteAction: ActionFunction = async ({
  request,
  params,
}): Promise<PushToGitRemoteResult> => {
  const { projectId, workspaceId } = params;
  invariant(typeof projectId === 'string', 'Project Id is required');
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');

  const formData = await request.formData();

  return window.main.git.pushToGitRemote({
    projectId,
    workspaceId,
    force: formData.get('force') === 'true',
  });
};

export async function pullFromGitRemote({ projectId, workspaceId }: {
  projectId: string;
  workspaceId: string;
}) {
  return window.main.git.pullFromGitRemote({ projectId, workspaceId });
};

export async function continueMerge(
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
) {
  return window.main.git.continueMerge({
    projectId,
    workspaceId,
    handledMergeConflicts,
    commitMessage,
    commitParent,
  });
};

export interface GitChange {
  path: string;
  type: string;
  status: string;
  staged: boolean;
  added: boolean;
  editable: boolean;
}

export const discardChangesAction: ActionFunction = async ({
  params,
  request,
}): Promise<{
  errors?: string[];
}> => {
  const { projectId, workspaceId } = params;
  invariant(typeof projectId === 'string', 'Project Id is required');
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');

  const { paths } = await request.json() as { paths: string[] };

  return window.main.git.discardChanges({ projectId, workspaceId, paths });
};

export interface GitStatusResult {
  status: {
    localChanges: number;
  };
}

export const gitStatusAction: ActionFunction = async ({
  params,
}): Promise<GitStatusResult> => {
  const { projectId, workspaceId } = params;
  invariant(typeof projectId === 'string', 'Project Id is required');
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');

  return window.main.git.gitStatus({ projectId, workspaceId });
};

export async function checkGitChanges({ params }: LoaderFunctionArgs) {
  const { projectId, workspaceId } = params;
  invariant(typeof projectId === 'string', 'Project Id is required');
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');

  return window.main.git.gitChangesLoader({ projectId, workspaceId });
};

export async function checkGitCanPush({ params }: LoaderFunctionArgs) {
  const { projectId, workspaceId } = params;
  invariant(typeof projectId === 'string', 'Project Id is required');
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');

  return window.main.git.canPushLoader({ projectId, workspaceId });
};

export const stageChangesAction: ActionFunction = async ({
  request,
  params,
}): Promise<{
  errors?: string[];
}> => {
  const { projectId, workspaceId } = params;
  invariant(typeof projectId === 'string', 'Project Id is required');
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');
  const { paths } = await request.json() as { paths: string[] };

  return window.main.git.stageChanges({ projectId, workspaceId, paths });
};

export const unstageChangesAction: ActionFunction = async ({
  request,
  params,
}): Promise<{
  errors?: string[];
}> => {
  const { projectId, workspaceId } = params;
  invariant(typeof projectId === 'string', 'Project Id is required');
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');
  const { paths } = await request.json() as { paths: string[] };

  return window.main.git.unstageChanges({ projectId, workspaceId, paths });
};

export type GitDiffResult = {
  name: string;
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
  const { projectId, workspaceId } = params;
  invariant(typeof projectId === 'string', 'Project Id is required');
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');
  const urlParams = new URLSearchParams(request.url.split('?')[1]);

  const filepath = urlParams.get('filepath');
  invariant(filepath, 'Filepath is required');

  const staged = urlParams.get('staged') === 'true';

  return window.main.git.diffFileLoader({ projectId, workspaceId, filepath, staged });
};

export const loadGitHubCredentials: LoaderFunction = async () => {
  const credentials = await gitCredentials.getByProvider('github');

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
  const credentials = await gitCredentials.getByProvider('gitlab');

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
  const credentials = await gitCredentials.all();

  return credentials;
};
