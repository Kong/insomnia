import { ActionFunction, LoaderFunction, redirect } from 'react-router-dom';

import { database, Operation } from '../../common/database';
import { isNotNullOrUndefined } from '../../common/misc';
import * as models from '../../models';
import { canSync } from '../../models';
import { ApiSpec } from '../../models/api-spec';
import { Environment } from '../../models/environment';
import { GrpcRequest } from '../../models/grpc-request';
import { MockRoute } from '../../models/mock-route';
import { MockServer } from '../../models/mock-server';
import { Request } from '../../models/request';
import { RequestGroup } from '../../models/request-group';
import { UnitTest } from '../../models/unit-test';
import { UnitTestSuite } from '../../models/unit-test-suite';
import { WebSocketRequest } from '../../models/websocket-request';
import { Workspace } from '../../models/workspace';
import {
  BackendProject,
  Snapshot,
  Status,
  StatusCandidate,
} from '../../sync/types';
import { VCSInstance } from '../../sync/vcs/insomnia-sync';
import { pullBackendProject } from '../../sync/vcs/pull-backend-project';
import { invariant } from '../../utils/invariant';

async function getSyncItems({ workspaceId }: { workspaceId: string }) {
  const syncItemsList: (
    | Workspace
    | Environment
    | ApiSpec
    | Request
    | WebSocketRequest
    | GrpcRequest
    | RequestGroup
    | UnitTestSuite
    | UnitTest
    | MockServer
    | MockRoute
  )[] = [];
  const activeWorkspace = await models.workspace.getById(workspaceId);
  invariant(activeWorkspace, 'Workspace could not be found');

  // first recursion to get all the folders ids in order to use nedb search by an array
  const flattenFoldersIntoList = async (id: string): Promise<string[]> => {
    const parentIds: string[] = [id];
    const folderIds = (await models.requestGroup.findByParentId(id)).map(
      r => r._id
    );
    if (folderIds.length) {
      await Promise.all(
        folderIds.map(async folderIds =>
          parentIds.push(...(await flattenFoldersIntoList(folderIds)))
        )
      );
    }
    return parentIds;
  };
  const listOfParentIds = await flattenFoldersIntoList(activeWorkspace._id);
  const activeApiSpec = await models.apiSpec.getByParentId(workspaceId);
  const reqs = await database.find(models.request.type, {
    parentId: { $in: listOfParentIds },
  });
  const reqGroups = await database.find(models.requestGroup.type, {
    parentId: { $in: listOfParentIds },
  });
  const grpcReqs = (await database.find(models.grpcRequest.type, {
    parentId: { $in: listOfParentIds },
  })) as GrpcRequest[];
  const wsReqs = await database.find(models.webSocketRequest.type, {
    parentId: { $in: listOfParentIds },
  });
  const allRequests = [...reqs, ...reqGroups, ...grpcReqs, ...wsReqs] as (
    | Request
    | RequestGroup
    | GrpcRequest
    | WebSocketRequest
  )[];
  const testSuites = await models.unitTestSuite.findByParentId(workspaceId);
  const tests = await database.find<UnitTest>(models.unitTest.type, {
    parentId: { $in: testSuites.map(t => t._id) },
  });

  const mockServer = await models.mockServer.getByParentId(workspaceId);
  if (mockServer) {
    syncItemsList.push(mockServer);
    const mockRoutes = await database.find<MockRoute>(models.mockRoute.type, {
      parentId: mockServer._id,
    });
    mockRoutes.map(m => syncItemsList.push(m));
  }

  const baseEnvironment = await models.environment.getByParentId(workspaceId);
  invariant(baseEnvironment, 'Base environment not found');

  const subEnvironments = (
    await models.environment.findByParentId(baseEnvironment._id)
  ).sort((e1, e2) => e1.metaSortKey - e2.metaSortKey);
  allRequests.map(r => syncItemsList.push(r));
  tests.map(t => syncItemsList.push(t));
  testSuites.map(t => syncItemsList.push(t));
  syncItemsList.push(activeWorkspace);
  syncItemsList.push(baseEnvironment);
  subEnvironments.forEach(e => syncItemsList.push(e));
  if (activeApiSpec) {
    syncItemsList.push(activeApiSpec);
  }

  const syncItems: StatusCandidate[] = syncItemsList
    .filter(canSync)
    .map(i => ({
      key: i._id,
      name: i.name || '',
      document: i,
    }));

  return {
    syncItems,
  };
}

export const pullRemoteCollectionAction: ActionFunction = async ({
  request,
  params,
}) => {
  const { organizationId, projectId } = params;
  invariant(typeof projectId === 'string', 'Project Id is required');
  invariant(typeof organizationId === 'string', 'Organization Id is required');
  const formData = await request.formData();

  const backendProjectId = formData.get('backendProjectId');
  invariant(typeof backendProjectId === 'string', 'Collection Id is required');
  const remoteId = formData.get('remoteId');
  invariant(typeof remoteId === 'string', 'Remote Id is required');

  const vcs = VCSInstance();
  const remoteBackendProjects = await vcs.remoteBackendProjects({
    teamId: organizationId,
    teamProjectId: remoteId,
  });

  const backendProject = remoteBackendProjects.find(
    p => p.id === backendProjectId
  );

  invariant(backendProject, 'Backend project not found');

  const project = await models.project.getById(projectId);

  invariant(project?.remoteId, 'Project is not a remote project');

  // Clone old VCS so we don't mess anything up while working on other backend projects
  const newVCS = vcs.newInstance();
  // Remove all backend projects for workspace first
  await newVCS.removeBackendProjectsForRoot(backendProject.rootDocumentId);

  const { workspaceId } = await pullBackendProject({
    vcs: newVCS,
    backendProject,
    remoteProject: project,
  });

  return redirect(
    `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug`
  );
};

export interface RemoteCollectionsLoaderData {
  backendProjectsToPull: BackendProject[];
}

export const remoteLoader: LoaderFunction = async ({
  params,
}): Promise<RemoteCollectionsLoaderData> => {
  const { organizationId, projectId } = params;
  invariant(typeof organizationId === 'string', 'Organization Id is required');
  invariant(typeof projectId === 'string', 'Project Id is required');

  try {
    const project = await models.project.getById(projectId);
    invariant(project, 'Project not found');

    const remoteId = project.remoteId;
    invariant(remoteId, 'Project is not a remote project');
    const vcs = VCSInstance();

    const allPulledBackendProjectsForRemoteId = (
      await vcs.localBackendProjects()
    ).filter(p => p.id === remoteId);
    // Remote backend projects are fetched from the backend since they are not stored locally
    const allFetchedRemoteBackendProjectsForRemoteId =
      await vcs.remoteBackendProjects({
        teamId: organizationId,
        teamProjectId: remoteId,
      });

    // Get all workspaces that are connected to backend projects and under the current project
    const workspacesWithBackendProjects = await database.find<Workspace>(
      models.workspace.type,
      {
        _id: {
          $in: [
            ...allPulledBackendProjectsForRemoteId,
            ...allFetchedRemoteBackendProjectsForRemoteId,
          ].map(p => p.rootDocumentId),
        },
        parentId: project._id,
      }
    );

    // Get the list of remote backend projects that we need to pull
    const backendProjectsToPull =
      allFetchedRemoteBackendProjectsForRemoteId.filter(
        p =>
          !workspacesWithBackendProjects.find(w => w._id === p.rootDocumentId)
      );

    return {
      backendProjectsToPull,
    };
  } catch (e) {
    console.warn('Failed to load backend projects', e);
  }

  return {
    backendProjectsToPull: [],
  };
};

interface SyncData {
  localBranches: string[];
  remoteBranches: string[];
  currentBranch: string;
  history: Snapshot[];
  historyCount: number;
  status: Status;
  syncItems: StatusCandidate[];
  compare: {
    ahead: number;
    behind: number;
  };
  remoteBackendProjects: BackendProject[];
}

const remoteBranchesCache: Record<string, string[]> = {};
const remoteCompareCache: Record<string, { ahead: number; behind: number }> =
  {};
const remoteBackendProjectsCache: Record<string, BackendProject[]> = {};

export const syncDataAction: ActionFunction = async ({ params }) => {
  const { projectId, workspaceId } = params;
  invariant(typeof projectId === 'string', 'Project Id is required');
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');
  try {
    const project = await models.project.getById(projectId);
    invariant(project, 'Project not found');
    invariant(project.remoteId, 'Project is not remote');
    const vcs = VCSInstance();
    const remoteBranches = (await vcs.getRemoteBranches()).sort();
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
    const errorMessage =
      e instanceof Error ? e.message : 'Unknown error while syncing data.';
    delete remoteBranchesCache[workspaceId];
    delete remoteCompareCache[workspaceId];
    delete remoteBackendProjectsCache[workspaceId];
    return {
      error: errorMessage,
    };
  }
};

export type SyncDataLoaderData =
  | SyncData
  | {
      error: string;
    };

export const syncDataLoader: LoaderFunction = async ({
  params,
}): Promise<SyncDataLoaderData> => {
  try {
    const { projectId, workspaceId } = params;
    invariant(typeof projectId === 'string', 'Project Id is required');
    invariant(typeof workspaceId === 'string', 'Workspace Id is required');

    const project = await models.project.getById(projectId);
    invariant(project, 'Project not found');
    invariant(project.remoteId, 'Project is not remote');
    const vcs = VCSInstance();
    const { syncItems } = await getSyncItems({ workspaceId });
    const localBranches = (await vcs.getBranches()).sort();
    const remoteBranches = (
      remoteBranchesCache[workspaceId] || (await vcs.getRemoteBranches())
    ).sort();
    const currentBranch = await vcs.getBranch();
    const history = (await vcs.getHistory()).sort((a, b) =>
      b.created > a.created ? 1 : -1
    );
    const historyCount = await vcs.getHistoryCount();
    const status = await vcs.status(syncItems);
    const compare =
      remoteCompareCache[workspaceId] || (await vcs.compareRemoteBranch());
    const remoteBackendProjects =
      remoteBackendProjectsCache[workspaceId] ||
      (await vcs.remoteBackendProjects({
        teamId: project.parentId,
        teamProjectId: project.remoteId,
      }));

    remoteBranchesCache[workspaceId] = remoteBranches;
    remoteCompareCache[workspaceId] = compare;
    remoteBackendProjectsCache[workspaceId] = remoteBackendProjects;

    return {
      syncItems,
      localBranches,
      remoteBranches,
      currentBranch,
      history,
      historyCount,
      status,
      compare,
      remoteBackendProjects,
    };
  } catch (e) {
    const errorMessage =
      e instanceof Error ? e.message : 'Unknown error while loading sync data.';
    return {
      error: errorMessage,
    };
  }
};

export const checkoutBranchAction: ActionFunction = async ({
  request,
  params,
}) => {
  const { organizationId, projectId, workspaceId } = params;
  invariant(typeof organizationId === 'string', 'Organization Id is required');
  invariant(typeof projectId === 'string', 'Project Id is required');
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');
  const formData = await request.formData();
  const branch = formData.get('branch');
  invariant(typeof branch === 'string', 'Branch is required');
  const vcs = VCSInstance();
  const { syncItems } = await getSyncItems({ workspaceId });
  try {
    const delta = await vcs.checkout(syncItems, branch);
    await database.batchModifyDocs(delta as Operation);
    delete remoteCompareCache[workspaceId];
  } catch (err) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : 'Unknown error while checking out branch.';
    return {
      error: errorMessage,
    };
  }

  return redirect(
    `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug`
  );
};

export const mergeBranchAction: ActionFunction = async ({
  request,
  params,
}) => {
  const { workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');
  const formData = await request.formData();
  const branch = formData.get('branch');
  invariant(typeof branch === 'string', 'Branch is required');
  const vcs = VCSInstance();
  const { syncItems } = await getSyncItems({ workspaceId });
  const delta = await vcs.merge(syncItems, branch);
  try {
    await database.batchModifyDocs(delta as Operation);
    delete remoteCompareCache[workspaceId];
  } catch (err) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : 'Unknown error while merging branch.';
    return {
      error: errorMessage,
    };
  }

  return null;
};

export const createBranchAction: ActionFunction = async ({
  request,
  params,
}) => {
  const { workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');
  const formData = await request.formData();
  const branchName = formData.get('branchName');
  invariant(typeof branchName === 'string', 'Branch is required');
  const { syncItems } = await getSyncItems({ workspaceId });
  try {
    const vcs = VCSInstance();
    await vcs.fork(branchName);
    // Checkout new branch
    const delta = await vcs.checkout(syncItems, branchName);
    await database.batchModifyDocs(delta as Operation);
    delete remoteCompareCache[workspaceId];
  } catch (err) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : 'Unknown error while merging branch.';
    return {
      error: errorMessage,
    };
  }

  return null;
};

export const deleteBranchAction: ActionFunction = async ({
  params,
  request,
}) => {
  const { organizationId, projectId, workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');
  const formData = await request.formData();
  const branch = formData.get('branch');
  invariant(typeof branch === 'string', 'Branch is required');

  try {
    const vcs = VCSInstance();
    await vcs.removeRemoteBranch(branch);
    try {
      await vcs.removeBranch(branch);
    } catch (err) {
      // Branch doesn't exist locally, ignore
    }

    delete remoteBranchesCache[workspaceId];
  } catch (err) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : 'Unknown error while merging branch.';
    return {
      error: errorMessage,
    };
  }

  return redirect(
    `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug`
  );
};

export const pullFromRemoteAction: ActionFunction = async ({ params }) => {
  const { organizationId, projectId, workspaceId } = params;
  invariant(typeof projectId === 'string', 'Project Id is required');
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');
  const project = await models.project.getById(projectId);
  invariant(project, 'Project not found');
  const { syncItems } = await getSyncItems({ workspaceId });
  try {
    invariant(project.remoteId, 'Project is not remote');
    const vcs = VCSInstance();
    const delta = await vcs.pull({
      candidates: syncItems,
      teamId: project.parentId,
      teamProjectId: project.remoteId,
    });

    await database.batchModifyDocs(delta as unknown as Operation);
    delete remoteCompareCache[workspaceId];
  } catch (err) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : 'Unknown error while pulling from remote.';
    return {
      error: errorMessage,
    };
  }

  return redirect(
    `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug`
  );
};

export const fetchRemoteBranchAction: ActionFunction = async ({
  request,
  params,
}) => {
  const { projectId, workspaceId } = params;
  invariant(typeof projectId === 'string', 'Project Id is required');
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');
  const project = await models.project.getById(projectId);
  invariant(project, 'Project not found');

  const formData = await request.formData();
  const branch = formData.get('branch');
  invariant(typeof branch === 'string', 'Branch is required');
  const vcs = VCSInstance();
  const currentBranch = await vcs.getBranch();

  try {
    invariant(project.remoteId, 'Project is not remote');
    await vcs.checkout([], branch);
    const delta = (await vcs.pull({
      candidates: [],
      teamId: project.parentId,
      teamProjectId: project.remoteId,
    })) as unknown as Operation;
    // vcs.pull sometimes results in a delta with parentId: null, causing workspaces to be orphaned, this is a hack to restore those parentIds until we have a chance to redesign vcs
    await database.batchModifyDocs({
      remove: delta.remove,
      upsert: delta.upsert?.map(doc => ({
        ...doc,
        ...(!doc.parentId && doc.type === models.workspace.type
          ? { parentId: projectId }
          : {}),
      })),
    });
  } catch (err) {
    await vcs.checkout([], currentBranch);
    const errorMessage =
      err instanceof Error
        ? err.message
        : 'Unknown error while fetching remote branch.';
    return {
      error: errorMessage,
    };
  }

  return null;
};

export const pushToRemoteAction: ActionFunction = async ({ params }) => {
  const { projectId, workspaceId } = params;
  invariant(typeof projectId === 'string', 'Project Id is required');
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');

  const project = await models.project.getById(projectId);
  invariant(project, 'Project not found');
  invariant(project.remoteId, 'Project is not remote');

  try {
    const vcs = VCSInstance();
    await vcs.push({
      teamId: project.parentId,
      teamProjectId: project.remoteId,
    });
    delete remoteCompareCache[workspaceId];
  } catch (err) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : 'Unknown error while pushing to remote.';
    return {
      error: errorMessage,
    };
  }

  return null;
};

export const rollbackChangesAction: ActionFunction = async ({ params }) => {
  const { organizationId, projectId, workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');
  try {
    const vcs = VCSInstance();
    const { syncItems } = await getSyncItems({ workspaceId });
    const delta = await vcs.rollbackToLatest(syncItems);
    await database.batchModifyDocs(delta as unknown as Operation);
    delete remoteCompareCache[workspaceId];
  } catch (err) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : 'Unknown error while rolling back changes.';
    return {
      error: errorMessage,
    };
  }

  return redirect(
    `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug`
  );
};

export const restoreChangesAction: ActionFunction = async ({
  request,
  params,
}) => {
  const { organizationId, projectId, workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');
  const formData = await request.formData();
  const id = formData.get('id');
  invariant(typeof id === 'string', 'Id is required');
  try {
    const vcs = VCSInstance();
    const { syncItems } = await getSyncItems({ workspaceId });
    const delta = await vcs.rollback(id, syncItems);
    await database.batchModifyDocs(delta as unknown as Operation);
    delete remoteCompareCache[workspaceId];
  } catch (err) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : 'Unknown error while restoring changes.';
    return {
      error: errorMessage,
    };
  }

  return redirect(
    `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug`
  );
};

export const stageChangesAction: ActionFunction = async ({
  request,
  params,
}) => {
  const { workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');
  const data = await request.json();
  const keys = data.keys;
  invariant(Array.isArray(keys), 'Keys is required');
  const { syncItems } = await getSyncItems({ workspaceId });
  const vcs = VCSInstance();
  const status = await vcs.status(syncItems);
  // Staging needs to happen since it creates blobs for the files
  const itemsToStage = keys
    .map(key => {
      if (typeof key === 'string') {
        const item = status.unstaged[key];
        return item;
      }

      return null;
    })
    .filter(isNotNullOrUndefined);

  await vcs.stage(itemsToStage);

  return null;
};

export const unstageChangesAction: ActionFunction = async ({
  request,
  params,
}) => {
  const { workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');
  const data = await request.json();
  const keys = data.keys;
  invariant(Array.isArray(keys), 'Keys is required');
  const { syncItems } = await getSyncItems({ workspaceId });
  const vcs = VCSInstance();
  const status = await vcs.status(syncItems);
  // Staging needs to happen since it creates blobs for the files
  const itemsToUnstage = keys
    .map(key => {
      if (typeof key === 'string') {
        const item = status.stage[key];
        return item;
      }

      return null;
    })
    .filter(isNotNullOrUndefined);

  await vcs.unstage(itemsToUnstage);

  return null;
};

export const createSnapshotAction: ActionFunction = async ({
  request,
  params,
}) => {
  const { workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');
  const formData = await request.formData();
  const message = formData.get('message');
  invariant(typeof message === 'string', 'Message is required');

  const vcs = VCSInstance();

  try {
    await vcs.takeSnapshot(message);
    delete remoteCompareCache[workspaceId];
  } catch (err) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : 'Unknown error while creating snapshot.';
    return {
      error: errorMessage,
    };
  }

  return null;
};

export const createSnapshotAndPushAction: ActionFunction = async ({
  request,
  params,
}) => {
  const { projectId, workspaceId } = params;
  invariant(typeof projectId === 'string', 'Project Id is required');
  invariant(typeof workspaceId === 'string', 'Workspace Id is required');

  const project = await models.project.getById(projectId);
  invariant(project, 'Project not found');
  invariant(project.remoteId, 'Project is not remote');
  const formData = await request.formData();
  const message = formData.get('message');
  invariant(typeof message === 'string', 'Message is required');
  const vcs = VCSInstance();

  try {
    await vcs.takeSnapshot(message);
    await vcs.push({
      teamId: project.parentId,
      teamProjectId: project.remoteId,
    });
    delete remoteCompareCache[workspaceId];
  } catch (err) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : 'Unknown error while creating snapshot.';
    return {
      error: errorMessage,
    };
  }

  return null;
};
