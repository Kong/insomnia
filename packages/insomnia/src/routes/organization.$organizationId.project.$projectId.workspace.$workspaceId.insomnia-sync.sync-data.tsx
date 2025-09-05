import { href } from 'react-router';

import * as models from '~/models';
import type { BackendProject, Compare } from '~/sync/types';
import { VCSInstance } from '~/sync/vcs/insomnia-sync';
import { getSyncItems } from '~/ui/sync-utils';
import { invariant } from '~/utils/invariant';
import { createFetcherLoadHook, createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.sync-data';

const remoteBranchesCache: Record<string, string[]> = {};
const remoteCompareCache: Record<string, Compare> = {};
const remoteBackendProjectsCache: Record<string, BackendProject[]> = {};

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { projectId, workspaceId } = params;
  try {
    const project = await models.project.getById(projectId);
    invariant(project, 'Project not found');
    invariant(project.remoteId, 'Project is not remote');
    const vcs = VCSInstance();
    const { syncItems } = await getSyncItems({ workspaceId });
    const localBranches = (await vcs.getBranchNames()).sort();
    const currentBranch = await vcs.getCurrentBranchName();
    const history = (await vcs.getHistory()).sort((a, b) => (b.created > a.created ? 1 : -1));
    const historyCount = await vcs.getHistoryCount();
    const status = await vcs.status(syncItems);

    let remoteBranches: string[] = [];
    let compare = { ahead: 0, behind: 0 };
    try {
      remoteBranches = (remoteBranchesCache[workspaceId] || (await vcs.getRemoteBranchNames())).sort();
      compare = remoteCompareCache[workspaceId] || (await vcs.compareRemoteBranch());
      const remoteBackendProjects =
        remoteBackendProjectsCache[workspaceId] ||
        (await vcs.remoteBackendProjects({
          teamId: project.parentId,
          teamProjectId: project.remoteId,
        }));
      remoteBranchesCache[workspaceId] = remoteBranches;
      remoteCompareCache[workspaceId] = compare;
      remoteBackendProjectsCache[workspaceId] = remoteBackendProjects;

      let hasUncommittedChanges = false;
      if (status?.unstaged && Object.keys(status.unstaged).length > 0) {
        hasUncommittedChanges = true;
      }
      if (status?.stage && Object.keys(status.stage).length > 0) {
        hasUncommittedChanges = true;
      }
      // update workspace meta with sync data, use for show unpushed changes on collection card
      models.workspaceMeta.updateByParentId(workspaceId, {
        hasUncommittedChanges,
        hasUnpushedChanges: compare?.ahead > 0,
      });
    } catch {}
    return {
      syncItems,
      localBranches,
      remoteBranches,
      currentBranch,
      history,
      historyCount,
      status,
      compare,
    };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error while loading sync data.';
    return {
      error: errorMessage,
    };
  }
}

export async function clientAction({ params }: Route.ClientActionArgs) {
  const { projectId, workspaceId } = params;

  try {
    const project = await models.project.getById(projectId);
    invariant(project, 'Project not found');
    invariant(project.remoteId, 'Project is not remote');
    const vcs = VCSInstance();
    const remoteBranches = (await vcs.getRemoteBranchNames()).sort();
    const compare = await vcs.compareRemoteBranch();
    const remoteBackendProjects = await vcs.remoteBackendProjects({
      teamId: project.parentId,
      teamProjectId: project.remoteId,
    });

    // Cache remote branches
    remoteBranchesCache[workspaceId] = remoteBranches;
    remoteCompareCache[workspaceId] = compare;
    remoteBackendProjectsCache[workspaceId] = remoteBackendProjects;

    return {
      remoteBranches,
      compare,
      remoteBackendProjects,
    };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error while syncing data.';
    delete remoteBranchesCache[workspaceId];
    delete remoteCompareCache[workspaceId];
    delete remoteBackendProjectsCache[workspaceId];
    return {
      error: errorMessage,
    };
  }
}

export const useInsomniaSyncDataLoaderFetcher = createFetcherLoadHook(
  load =>
    ({
      organizationId,
      projectId,
      workspaceId,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
    }) => {
      const url = href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/insomnia-sync/sync-data',
        {
          organizationId,
          projectId,
          workspaceId,
        },
      );

      return load(url);
    },
  clientLoader,
);

export const useInsomniaSyncDataActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
    }) => {
      const url = href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/insomnia-sync/sync-data',
        {
          organizationId,
          projectId,
          workspaceId,
        },
      );

      return submit(
        {},
        {
          action: url,
          method: 'POST',
        },
      );
    },
  clientAction,
);
