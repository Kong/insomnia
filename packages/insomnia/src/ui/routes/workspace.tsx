import React from 'react';
import { LoaderFunction, Outlet, useLoaderData } from 'react-router-dom';

import { database } from '../../common/database';
import * as models from '../../models';
import { BaseModel } from '../../models';
import { ApiSpec } from '../../models/api-spec';
import { CaCertificate } from '../../models/ca-certificate';
import { ClientCertificate } from '../../models/client-certificate';
import { CookieJar } from '../../models/cookie-jar';
import { Environment } from '../../models/environment';
import { GitRepository } from '../../models/git-repository';
import { GrpcRequest, isGrpcRequest } from '../../models/grpc-request';
import { sortProjects } from '../../models/helpers/project';
import { DEFAULT_ORGANIZATION_ID } from '../../models/organization';
import { isRemoteProject, Project } from '../../models/project';
import { isRequest, Request } from '../../models/request';
import { isRequestGroup, RequestGroup } from '../../models/request-group';
import { isWebSocketRequest, WebSocketRequest } from '../../models/websocket-request';
import { Workspace } from '../../models/workspace';
import { WorkspaceMeta } from '../../models/workspace-meta';
import { invariant } from '../../utils/invariant';
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
  requestTree: Child[];
  grpcRequests: GrpcRequest[];
}
export interface Child {
  doc: Request | GrpcRequest | WebSocketRequest | RequestGroup;
  children: Child[];
  collapsed: boolean;
  hidden: boolean;
  pinned: boolean;
}
type RequestCollection = RequestGroup & {
  children: (Request | WebSocketRequest | GrpcRequest | (RequestGroup & RequestCollection))[];
};
export const workspaceLoader: LoaderFunction = async ({
  params,
}): Promise<WorkspaceLoaderData> => {
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

  const baseEnvironment = await models.environment.getByParentId(workspaceId);
  invariant(baseEnvironment, 'Base environment not found');

  const subEnvironments = (await models.environment.findByParentId(baseEnvironment._id))
    .sort((e1, e2) => e1.metaSortKey - e2.metaSortKey);

  const activeEnvironment = subEnvironments.find(({ _id }) => activeWorkspaceMeta.activeEnvironmentId === _id) || baseEnvironment;

  const activeCookieJar = await models.cookieJar.getOrCreateForParentId(workspaceId);
  invariant(activeCookieJar, 'Cookie jar not found');

  const activeApiSpec = await models.apiSpec.getByParentId(workspaceId);
  const clientCertificates = await models.clientCertificate.findByParentId(workspaceId);

  const allProjects = await models.project.all();

  const organizationProjects =
    organizationId === DEFAULT_ORGANIZATION_ID
      ? allProjects.filter(proj => !isRemoteProject(proj))
      : [activeProject];

  const projects = sortProjects(organizationProjects);
  const requestMetas = await models.requestMeta.all();
  const grpcRequestMetas = await models.grpcRequestMeta.all();
  const metas = [...requestMetas, ...grpcRequestMetas];
  const folderMetas = (await models.requestGroupMeta.all());
  const grpcRequestList: GrpcRequest[] = [];
  const recurse = async ({ parentId }: { parentId: string }): Promise<Child[]> => {
    const folders = await models.requestGroup.findByParentId(parentId);
    const requests = await models.request.findByParentId(parentId);
    const webSocketRequests = await models.webSocketRequest.findByParentId(parentId);
    const grpcRequests = await models.grpcRequest.findByParentId(parentId);
    // TODO: remove this state hack when the grpc responses go somewhere else
    grpcRequests.map(r => grpcRequestList.push(r));

    const childrenWithChildren = await Promise.all([...folders, ...requests, ...webSocketRequests, ...grpcRequests].map(async doc => ({
      doc,
      pinned: metas.find(m => m.parentId === doc._id)?.pinned || false,
      collapsed: folderMetas.find(m => m.parentId === doc._id)?.collapsed || false,
      hidden: false,
      children: await recurse({ parentId: doc._id }),
    })));
    return childrenWithChildren;
  };
  const requestTree = await recurse({ parentId: activeWorkspace._id });

  const grpcRequests = grpcRequestList;
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
    requestTree,
    grpcRequests,
  };
};

const WorkspaceRoute = () => {
  const workspaceData = useLoaderData() as WorkspaceLoaderData;
  const branch = workspaceData.activeWorkspaceMeta.cachedGitRepositoryBranch;
  return <Outlet key={branch} />;
};

export default WorkspaceRoute;
