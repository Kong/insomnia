import { href } from 'react-router';

import { services } from '~/insomnia-data';
import { getSyncItems, remoteBackendProjectsCache, remoteBranchesCache, remoteCompareCache } from '~/ui/sync-utils';
import { invariant } from '~/utils/invariant';
import { createFetcherLoadHook, createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.sync-data';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { projectId, workspaceId } = params;
  try {
    const project = await services.project.get(projectId);
    invariant(project, 'Project not found');
    invariant(project.remoteId, 'Project is not remote');
    const { syncItems } = await getSyncItems({ workspaceId });
    const localBranches = (await window.main.sync.getBranchNames()).sort();
    const currentBranch = await window.main.sync.getCurrentBranchName();
    const history = (await window.main.sync.getHistory()).sort((a, b) => (b.created > a.created ? 1 : -1));
    const historyCount = await window.main.sync.getHistoryCount();
    const status = await window.main.sync.status(syncItems);

    let remoteBranches: string[] = [];
    let compare = { ahead: 0, behind: 0 };
    try {
      remoteBranches = (remoteBranchesCache[workspaceId] || (await window.main.sync.getRemoteBranchNames())).sort();
      compare = remoteCompareCache[workspaceId] || (await window.main.sync.compareRemoteBranch());
      const remoteBackendProjects =
        remoteBackendProjectsCache[project.remoteId] ||
        (await window.main.sync.remoteBackendProjects({
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
      await services.workspaceMeta.updateByParentId(workspaceId, {
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
  const project = await services.project.get(projectId);
  invariant(project, 'Project not found');
  invariant(project.remoteId, 'Project is not remote');

  try {
    const remoteBranches = (await window.main.sync.getRemoteBranchNames()).sort();
    const compare = await window.main.sync.compareRemoteBranch();
    const remoteBackendProjects = await window.main.sync.remoteBackendProjects({
      teamId: project.parentId,
      teamProjectId: project.remoteId,
    });

    // Cache remote branches
    remoteBranchesCache[workspaceId] = remoteBranches;
    remoteCompareCache[workspaceId] = compare;
    remoteBackendProjectsCache[project.remoteId] = remoteBackendProjects;

    return {
      remoteBranches,
      compare,
      remoteBackendProjects,
    };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error while syncing data.';
    delete remoteBranchesCache[workspaceId];
    delete remoteCompareCache[workspaceId];
    delete remoteBackendProjectsCache[project.remoteId];
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
