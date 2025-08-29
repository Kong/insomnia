import { database } from '~/common/database';
import { canSync } from '~/models';
import * as models from '~/models';
import type { ApiSpec } from '~/models/api-spec';
import type { Environment } from '~/models/environment';
import type { GrpcRequest } from '~/models/grpc-request';
import type { MockRoute } from '~/models/mock-route';
import type { MockServer } from '~/models/mock-server';
import type { Request } from '~/models/request';
import type { RequestGroup } from '~/models/request-group';
import type { SocketIORequest } from '~/models/socket-io-request';
import type { UnitTest } from '~/models/unit-test';
import type { UnitTestSuite } from '~/models/unit-test-suite';
import type { WebSocketRequest } from '~/models/websocket-request';
import type { Workspace } from '~/models/workspace';
import type { BackendProject, Compare, StatusCandidate } from '~/sync/types';
import { invariant } from '~/utils/invariant';

type PushPull = 'push' | 'pull';
type VCSAction =
  | PushPull
  | `force_${PushPull}`
  | 'create_branch'
  | 'merge_branch'
  | 'delete_branch'
  | 'checkout_branch'
  | 'commit'
  | 'stage_all'
  | 'stage'
  | 'unstage_all'
  | 'unstage'
  | 'rollback'
  | 'rollback_all'
  | 'update'
  | 'setup'
  | 'clone';

export function vcsSegmentEventProperties(type: 'remote', action: VCSAction, error?: string) {
  return { type, action, error };
}

export const remoteBranchesCache: Record<string, string[]> = {};
export const remoteCompareCache: Record<string, Compare> = {};
export const remoteBackendProjectsCache: Record<string, BackendProject[]> = {};

export async function getSyncItems({ workspaceId }: { workspaceId: string }) {
  const syncItemsList: (
    | Workspace
    | Environment
    | ApiSpec
    | Request
    | WebSocketRequest
    | SocketIORequest
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
    const folderIds = (await models.requestGroup.findByParentId(id)).map(r => r._id);
    if (folderIds.length) {
      await Promise.all(folderIds.map(async folderIds => parentIds.push(...(await flattenFoldersIntoList(folderIds)))));
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
  const socketIOReqs = await database.find(models.socketIORequest.type, {
    parentId: { $in: listOfParentIds },
  });
  const allRequests = [...reqs, ...reqGroups, ...grpcReqs, ...wsReqs, ...socketIOReqs] as (
    | Request
    | RequestGroup
    | GrpcRequest
    | WebSocketRequest
    | SocketIORequest
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

  const subEnvironments = (await models.environment.findByParentId(baseEnvironment._id)).sort(
    (e1, e2) => e1.metaSortKey - e2.metaSortKey,
  );
  allRequests.map(r => syncItemsList.push(r));
  tests.map(t => syncItemsList.push(t));
  testSuites.map(t => syncItemsList.push(t));
  syncItemsList.push(activeWorkspace);
  syncItemsList.push(baseEnvironment);
  subEnvironments.forEach(e => syncItemsList.push(e));
  if (activeApiSpec) {
    syncItemsList.push(activeApiSpec);
  }

  const syncItems: StatusCandidate[] = syncItemsList.filter(canSync).map(i => ({
    key: i._id,
    name: i.name || '',
    document: i,
  }));

  return {
    syncItems,
  };
}
