import { type ActionFunction, type LoaderFunction, redirect } from 'react-router-dom';

import * as models from '../../models';
import type { GitRepository } from '../../models/git-repository';
import type { WorkspaceScope } from '../../models/workspace';
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
  const { projectId } = params;
  invariant(typeof projectId === 'string', 'Project Id is required');

  return window.main.git.loadGitRepository({ projectId });
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
  const { projectId } = params;
  invariant(typeof projectId === 'string', 'Project Id is required');

  return window.main.git.getGitBranches({ projectId });
};

export interface GitFetchLoaderData {
  errors: string[];
}

export const gitFetchAction: ActionFunction = async ({
  params,
}): Promise<GitFetchLoaderData> => {
  const { projectId } = params;
  invariant(typeof projectId === 'string', 'Project Id is required');

  return window.main.git.gitFetchAction({ projectId });
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
  const { projectId } = params;
  invariant(typeof projectId === 'string', 'Project Id is required');

  return window.main.git.gitLogLoader({ projectId });
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
  const { projectId } = params;
  invariant(typeof projectId === 'string', 'Project Id is required');

  return window.main.git.gitChangesLoader({ projectId });
};

export interface GitCanPushLoaderData {
  canPush: boolean;
}

export const canPushLoader: LoaderFunction = async ({ params }): Promise<GitCanPushLoaderData> => {
  const { projectId } = params;
  invariant(typeof projectId === 'string', 'Project Id is required');

  return window.main.git.canPushLoader({ projectId });
};

// Actions
export type InitGitCloneResult = {
  files: {
    scope: WorkspaceScope;
    name: string;
    path: string;
  }[];
} | {
  errors: string[];
};

export const initGitCloneAction: ActionFunction = async ({ request, params }) => {
  const { organizationId } = params;
  invariant(organizationId, 'Organization ID is required');

  const formData = await request.formData();

  const data = Object.fromEntries(formData.entries()) as {
    authorEmail: string;
    authorName: string;
    token: string;
    uri: string;
    username: string;
    oauth2format: string;
  };

  const initCloneResult = await window.main.git.initGitRepoClone({
    organizationId,
    ...data,
  });

  if ('errors' in initCloneResult) {
    return { errors: initCloneResult.errors };
  }

  return {
    files: initCloneResult.files,
  };
};

type CloneGitActionResult =
  | Response
  | {
    errors?: string[];
  };
export const cloneGitRepoAction: ActionFunction = async ({
  request,
  params,
}): Promise<CloneGitActionResult> => {
  const { organizationId } = params;
  invariant(organizationId, 'Organization ID is required');

  const formData = await request.formData();

  const data = Object.fromEntries(formData.entries()) as {
    authorEmail: string;
    authorName: string;
    token: string;
    uri: string;
    username: string;
    oauth2format: string;
  };

  const { errors, projectId } = await window.main.git.cloneGitRepo({
    organizationId,
    ...data,
  });

  if (errors) {
    return { errors };
  }

  invariant(organizationId, 'Organization ID is required');
  invariant(projectId, 'Project ID is required');

  return redirect(`/organization/${organizationId}/project/${projectId}`);
};

export const updateGitRepoAction: ActionFunction = async ({
  request,
  params,
}) => {
  const { projectId } = params;
  invariant(projectId, 'Project ID is required');

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
    ...data,
  });
};

export const resetGitRepoAction: ActionFunction = async ({ params }) => {
  const { projectId } = params;
  invariant(projectId, 'Project ID is required');

  const project = await models.project.getById(projectId);
  invariant(project, 'Project not found');

  return window.main.git.resetGitRepo({ projectId });
};

export interface CommitToGitRepoResult {
  errors?: string[];
}

export const commitToGitRepoAction: ActionFunction = async ({
  request,
  params,
}): Promise<CommitToGitRepoResult> => {
  const { projectId } = params;
  invariant(projectId, 'Project ID is required');

  const formData = await request.formData();
  const message = formData.get('message');
  invariant(typeof message === 'string', 'Message is required');

  return window.main.git.commitToGitRepo({ projectId, message });
};

export const commitAndPushToGitRepoAction: ActionFunction = async ({
  request,
  params,
}): Promise<CommitToGitRepoResult> => {
  const { projectId } = params;
  invariant(projectId, 'Project ID is required');

  const formData = await request.formData();
  const message = formData.get('message');
  invariant(typeof message === 'string', 'Message is required');

  return window.main.git.commitAndPushToGitRepo({
    projectId,
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
  const { projectId } = params;
  invariant(projectId, 'Project ID is required');
  const formData = await request.formData();
  const branch = formData.get('branch');
  invariant(typeof branch === 'string', 'Branch is required');

  return window.main.git.createNewGitBranch({
    branch,
    projectId,
  });
};

export interface CheckoutGitBranchResult {
  errors?: string[];
}
export const checkoutGitBranchAction: ActionFunction = async ({
  request,
  params,
}): Promise<CheckoutGitBranchResult> => {
  const { projectId } = params;
  invariant(projectId, 'Project ID is required');

  const formData = await request.formData();
  const branch = formData.get('branch');
  invariant(typeof branch === 'string', 'Branch is required');

  return window.main.git.checkoutGitBranch({
    branch,
    projectId,
  });
};

export const mergeGitBranch = async ({
  theirsBranch,
  projectId,
  allowUncommittedChangesBeforeMerge = false,
}: {
  theirsBranch: string;
  projectId: string;
  allowUncommittedChangesBeforeMerge?: boolean;
}) => {
  await window.main.git.mergeGitBranch({
    projectId,
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
  const { projectId } = params;
  invariant(projectId, 'Project ID is required');

  const formData = await request.formData();
  const branch = formData.get('branch');
  invariant(typeof branch === 'string', 'Branch is required');

  return window.main.git.deleteGitBranch({
    branch,
    projectId,
  });
};

export interface PushToGitRemoteResult {
  errors?: string[];
}

export const pushToGitRemoteAction: ActionFunction = async ({
  request,
  params,
}): Promise<PushToGitRemoteResult> => {
  const { projectId } = params;
  invariant(projectId, 'Project ID is required');

  const formData = await request.formData();

  return window.main.git.pushToGitRemote({
    projectId,
    force: formData.get('force') === 'true',
  });
};

export const pullFromGitRemote = async ({ projectId }: { projectId: string }) => {
  return window.main.git.pullFromGitRemote({ projectId });
};

export const continueMerge = async (
  {
    projectId,
    handledMergeConflicts,
    commitMessage,
    commitParent,
  }: {
    projectId: string;
    handledMergeConflicts: MergeConflict[];
    commitMessage: string;
    commitParent: string[];
  }
) => {
  return window.main.git.continueMerge({
    projectId,
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
  const { projectId } = params;
  invariant(projectId, 'Project ID is required');

  const { paths } = await request.json() as { paths: string[] };

  return window.main.git.discardChanges({ projectId, paths });
};

export interface GitStatusResult {
  status: {
    localChanges: number;
  };
}

export const gitStatusAction: ActionFunction = async ({ params }): Promise<GitStatusResult> => {
  const { projectId } = params;
  invariant(typeof projectId === 'string', 'Project Id is required');
  return window.main.git.gitStatus({ projectId });
};

export const checkGitChanges = async (projectId: string) => {
  return window.main.git.gitChangesLoader({ projectId });
};

export const checkGitCanPush = async (projectId: string) => {
  return window.main.git.canPushLoader({ projectId });
};

export const stageChangesAction: ActionFunction = async ({
  request,
  params,
}): Promise<{
  errors?: string[];
}> => {
  const { projectId } = params;
  invariant(projectId, 'Project ID is required');
  const { paths } = await request.json() as { paths: string[] };

  return window.main.git.stageChanges({ projectId, paths });
};

export const unstageChangesAction: ActionFunction = async ({
  request,
  params,
}): Promise<{
  errors?: string[];
}> => {
  const { projectId } = params;
  invariant(projectId, 'Project ID is required');
  const { paths } = await request.json() as { paths: string[] };

  return window.main.git.unstageChanges({ projectId, paths });
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
  const { projectId } = params;
  invariant(projectId, 'Project ID is required');
  const urlParams = new URLSearchParams(request.url.split('?')[1]);

  const filepath = urlParams.get('filepath');
  invariant(filepath, 'Filepath is required');

  const staged = urlParams.get('staged') === 'true';

  return window.main.git.diffFileLoader({ projectId, filepath, staged });
};
