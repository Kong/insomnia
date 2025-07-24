import { type ActionFunction, redirect } from 'react-router';

import type { WorkspaceScope } from '../../models/workspace';
import type { GitCredentials } from '../../sync/git/git-vcs';
import { invariant } from '../../utils/invariant';

export type InitGitCloneResult =
  | {
      files: {
        scope: WorkspaceScope;
        name: string;
        path: string;
      }[];
    }
  | {
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
export const cloneGitRepoAction: ActionFunction = async ({ request, params }): Promise<CloneGitActionResult> => {
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

export const fetchRemoteBranchesAction: ActionFunction = async ({ request }) => {
  const data = (await request.json()) as {
    uri: string;
    credentials: GitCredentials;
  };

  const { uri, credentials } = data;

  return window.main.git.fetchGitRemoteBranches({ uri, credentials });
};
