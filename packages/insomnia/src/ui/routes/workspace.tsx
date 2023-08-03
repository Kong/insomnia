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
  const requestsAndFolders = (await database.withDescendants(activeWorkspace)).filter(d => isRequest(d) || isWebSocketRequest(d) || isGrpcRequest(d) || isRequestGroup(d)) as (Request | WebSocketRequest | GrpcRequest)[];
  const requestMetas = await models.requestMeta.all();
  const grpcRequestMetas = await models.grpcRequestMeta.all();
  const metas = [...requestMetas, ...grpcRequestMetas].filter(m => requestsAndFolders.map(r => r._id).includes(m.parentId)).map(m => ({ parentId: m.parentId, pinned: m.pinned }));
  const folderMetas = (await models.requestGroupMeta.all()).filter(m => requestsAndFolders.map(r => r._id).includes(m.parentId)).map(m => ({ parentId: m.parentId, collapsed: m.collapsed }));
  function nextTreeNode(parentId: string): Child[] {
    return requestsAndFolders.filter(r => r.parentId === parentId)
      .filter((model: BaseModel) => isRequest(model) || isWebSocketRequest(model) || isGrpcRequest(model) || isRequestGroup(model))
      .sort((a: Child['doc'], b: Child['doc']): number => {
        // NOTE: legacy, make this better
        if (a.metaSortKey === b.metaSortKey) {
          return a._id > b._id ? -1 : 1; // ascending ids?
        } else {
          return a.metaSortKey < b.metaSortKey ? -1 : 1; // descending sort keys?
        }
      }).map((doc: Child['doc']) => ({
        doc,
        pinned: metas.find(m => m.parentId === doc._id)?.pinned || false,
        collapsed: folderMetas.find(m => m.parentId === doc._id)?.collapsed || false,
        hidden: false,
        children: isRequestGroup(doc) ? nextTreeNode(doc._id) : [],
      }));
  }
  const requestTree = nextTreeNode(activeWorkspace._id);
  const grpcRequests = requestsAndFolders.filter(r => isGrpcRequest(r));
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
