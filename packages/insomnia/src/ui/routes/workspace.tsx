import React from 'react';
import { LoaderFunction, Outlet, useLoaderData } from 'react-router-dom';

import { SortOrder } from '../../common/constants';
import { database } from '../../common/database';
import { sortMethodMap } from '../../common/sorting';
import * as models from '../../models';
import { canSync } from '../../models';
import { ApiSpec } from '../../models/api-spec';
import { CaCertificate } from '../../models/ca-certificate';
import { ClientCertificate } from '../../models/client-certificate';
import { CookieJar } from '../../models/cookie-jar';
import { Environment } from '../../models/environment';
import { GitRepository } from '../../models/git-repository';
import { GrpcRequest } from '../../models/grpc-request';
import { sortProjects } from '../../models/helpers/project';
import { DEFAULT_ORGANIZATION_ID } from '../../models/organization';
import { isRemoteProject, Project } from '../../models/project';
import { Request } from '../../models/request';
import { isRequestGroup, RequestGroup } from '../../models/request-group';
import {
  WebSocketRequest,
} from '../../models/websocket-request';
import { Workspace } from '../../models/workspace';
import { WorkspaceMeta } from '../../models/workspace-meta';
import { StatusCandidate } from '../../sync/types';
import { prepareSidebarEntities } from '../../utils/create-sidebar';
import { invariant } from '../../utils/invariant';

type Collection = Child[];

export interface WorkspaceLoaderData {
  activeWorkspace: Workspace;
  activeWorkspaceMeta: WorkspaceMeta;
  activeProject: Project;
  gitRepository: GitRepository | null;
  activeEnvironment: Environment;
  activeCookieJar: CookieJar;
  baseEnvironment: Environment;
  subEnvironments: Environment[];
  activeApiSpec: ApiSpec | null;
  clientCertificates: ClientCertificate[];
  caCertificate: CaCertificate | null;
  projects: Project[];
  grpcRequests: GrpcRequest[];
  syncItems: StatusCandidate[];
}
export interface Child {
  doc: Request | GrpcRequest | WebSocketRequest | RequestGroup;
  children: Child[];
  collapsed: boolean;
  hidden: boolean;
  pinned: boolean;
  level: number;
  ancestors?: string[];
}

export const workspaceLoader: LoaderFunction = async ({
  request,
  params,
}): Promise<WorkspaceLoaderData> => {
  console.time('workspaceLoader');
  const { projectId, workspaceId, organizationId } = params;
  invariant(workspaceId, 'Workspace ID is required');
  invariant(projectId, 'Project ID is required');

  const activeWorkspace = await models.workspace.getById(workspaceId);
  invariant(activeWorkspace, 'Workspace not found');

  // I don't know what to say man, this is just how it is
  await models.environment.getOrCreateForParentId(workspaceId);
  await models.cookieJar.getOrCreateForParentId(workspaceId);

  const activeProject = await models.project.getById(projectId);
  invariant(activeProject, 'Project not found');

  const activeWorkspaceMeta = await models.workspaceMeta.getOrCreateByParentId(
    workspaceId,
  );
  invariant(activeWorkspaceMeta, 'Workspace meta not found');
  const gitRepository = await models.gitRepository.getById(
    activeWorkspaceMeta.gitRepositoryId || '',
  );
  console.time('workspaceLoader2 env');
  const baseEnvironment = await database.getWhere<Environment>(
    models.environment.type, { parentId: workspaceId },
  );
  invariant(baseEnvironment, 'Base environment not found');
  console.timeEnd('workspaceLoader2 env');

  console.time('workspaceLoader2 sub envs');
  const subEnvironments = await database.find<Environment>(
    models.environment.type, { parentId: baseEnvironment._id }, { metaSortKey: 1 },
  );
  console.timeEnd('workspaceLoader2 sub envs');

  const activeEnvironment =
    subEnvironments.find(
      ({ _id }) => activeWorkspaceMeta.activeEnvironmentId === _id,
    ) || baseEnvironment;

  const activeCookieJar = await models.cookieJar.getOrCreateForParentId(
    workspaceId,
  );
  invariant(activeCookieJar, 'Cookie jar not found');

  const activeApiSpec = await models.apiSpec.getByParentId(workspaceId);
  const clientCertificates = await models.clientCertificate.findByParentId(
    workspaceId,
  );
  const allProjects = await models.project.all();

  const organizationProjects =
    organizationId === DEFAULT_ORGANIZATION_ID
      ? allProjects.filter(proj => !isRemoteProject(proj))
      : [activeProject];

  const projects = sortProjects(organizationProjects);
  // const syncItemsList: (
  //   | Workspace
  //   | Environment
  //   | ApiSpec
  //   | Request
  //   | WebSocketRequest
  //   | GrpcRequest
  //   | RequestGroup
  // )[] = [];
  // todo: fix this
  // const searchParams = new URL(request.url).searchParams;
  // const filter = searchParams.get('filter');
  // const sortOrder = searchParams.get('sortOrder') as SortOrder;
  // const sortFunction = sortMethodMap[sortOrder] || sortMethodMap['type-manual'];

  // todo move sync items list to its own context?
  // const reqs = await database.find(models.request.type, { parentId: { $in: listOfParentIds } });
  // const reqGroups = await database.find(models.requestGroup.type, { parentId: { $in: listOfParentIds } });
  // const grpcReqs = await database.find(models.grpcRequest.type, { parentId: { $in: listOfParentIds } }) as GrpcRequest[];
  // const wsReqs = await database.find(models.webSocketRequest.type, { parentId: { $in: listOfParentIds } });
  // const allRequests = [...reqs, ...reqGroups, ...grpcReqs, ...wsReqs] as (Request | RequestGroup | GrpcRequest | WebSocketRequest)[];

  // team sync needs an up to date list of eveything in the workspace to detect changes
  // TODO: move this to somewhere more approriate
  // allRequests.map(r => syncItemsList.push(r));
  // syncItemsList.push(activeWorkspace);
  // syncItemsList.push(baseEnvironment);
  // subEnvironments.forEach(e => syncItemsList.push(e));
  // if (activeApiSpec) {
  //   syncItemsList.push(activeApiSpec);
  // }

  // const syncItems: StatusCandidate[] = syncItemsList
  //   .filter(canSync)
  //   .map(i => ({
  //     key: i._id,
  //     name: i.name || '',
  //     document: i,
  //   }));

  console.timeEnd('workspaceLoader');
  return {
    activeWorkspace,
    activeProject,
    gitRepository,
    activeWorkspaceMeta,
    activeCookieJar,
    activeEnvironment,
    subEnvironments,
    baseEnvironment,
    activeApiSpec,
    clientCertificates,
    caCertificate: await models.caCertificate.findByParentId(workspaceId),
    projects,
    // TODO: remove this state hack when the grpc responses go somewhere else
    grpcRequests: [],
    syncItems: [],
  };
};

const WorkspaceRoute = () => {
  const workspaceData = useLoaderData() as WorkspaceLoaderData;
  const branch = workspaceData.activeWorkspaceMeta.cachedGitRepositoryBranch;
  return <Outlet key={branch} />;
};

export default WorkspaceRoute;
