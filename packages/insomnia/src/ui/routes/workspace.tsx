import React from 'react';
import { LoaderFunction, Outlet, useLoaderData } from 'react-router-dom';

import { SortOrder } from '../../common/constants';
import { fuzzyMatchAll } from '../../common/misc';
import { sortMethodMap } from '../../common/sorting';
import * as models from '../../models';
import { canSync } from '../../models';
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
import { Request } from '../../models/request';
import { isRequestGroup, RequestGroup } from '../../models/request-group';
import {
  WebSocketRequest,
} from '../../models/websocket-request';
import { Workspace } from '../../models/workspace';
import { WorkspaceMeta } from '../../models/workspace-meta';
import { StatusCandidate } from '../../sync/types';
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
  requestTree: Child[];
  grpcRequests: GrpcRequest[];
  syncItems: StatusCandidate[];
  collection: Collection;
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

  const subEnvironments = (
    await models.environment.findByParentId(baseEnvironment._id)
  ).sort((e1, e2) => e1.metaSortKey - e2.metaSortKey);

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
  const grpcRequestList: GrpcRequest[] = [];
  const syncItemsList: (
    | Workspace
    | Environment
    | ApiSpec
    | Request
    | WebSocketRequest
    | GrpcRequest
    | RequestGroup
  )[] = [];
  syncItemsList.push(activeWorkspace);
  syncItemsList.push(baseEnvironment);
  subEnvironments.forEach(e => syncItemsList.push(e));
  if (activeApiSpec) {
    syncItemsList.push(activeApiSpec);
  }

  const searchParams = new URL(request.url).searchParams;
  const filter = searchParams.get('filter');
  const sortOrder = searchParams.get('sortOrder') as SortOrder;
  const sortFunction = sortMethodMap[sortOrder] || sortMethodMap['type-manual'];

  const getCollectionTree = async ({
    parentId,
    level,
    parentIsCollapsed,
    ancestors,
  }: {
      parentId: string; level: number; parentIsCollapsed: boolean; ancestors: string[];
  }): Promise<Child[]> => {
    const folders = await models.requestGroup.findByParentId(parentId);
    const requests = await models.request.findByParentId(parentId);
    const webSocketRequests = await models.webSocketRequest.findByParentId(
      parentId,
    );
    const grpcRequests = await models.grpcRequest.findByParentId(parentId);
    // TODO: remove this state hack when the grpc responses go somewhere else
    grpcRequests.map(r => grpcRequestList.push(r));
    folders.map(f => syncItemsList.push(f));
    requests.map(r => syncItemsList.push(r));
    webSocketRequests.map(r => syncItemsList.push(r));
    grpcRequests.map(r => syncItemsList.push(r));

    const childrenWithChildren: Child[] = await Promise.all(
      [...folders, ...requests, ...webSocketRequests, ...grpcRequests]
        .sort(sortFunction)
        .map(async (doc): Promise<Child> => {
          const isFiltered = (filter?: string) => {
            if (filter) {
              const matches = fuzzyMatchAll(filter, [
                doc.name,
                doc.description,
                ...(isRequestGroup(doc) ? [] : [doc.url]),
              ]);

              return Boolean(
                !matches ||
                  (matches && !matches.indexes) ||
                  (matches && matches.indexes.length < 1)
              );
            }

            return false;
          };

          const matchesFilter = isFiltered(filter?.toString());

          const hidden = parentIsCollapsed || matchesFilter;

          const pinned =
            !isRequestGroup(doc) && isGrpcRequest(doc)
              ? (await models.grpcRequestMeta.getOrCreateByParentId(doc._id))
                  .pinned
              : (await models.requestMeta.getOrCreateByParentId(doc._id))
                  .pinned;
          const collapsed = filter
            ? false
            : parentIsCollapsed ||
              (isRequestGroup(doc) &&
                (await models.requestGroupMeta.getByParentId(doc._id))
                  ?.collapsed) ||
              false;

          const docAncestors = [...ancestors, parentId];

          return {
            doc,
            pinned,
            collapsed,
            hidden,
            level,
            ancestors: docAncestors,
            children: await getCollectionTree({ parentId: doc._id, level: level + 1, parentIsCollapsed: collapsed, ancestors: docAncestors }),
          };
        }),
    );

    return childrenWithChildren;
  };

  const requestTree = await getCollectionTree({
    parentId: activeWorkspace._id,
    level: 0,
    parentIsCollapsed: false,
    ancestors: [],
  });

  const syncItems: StatusCandidate[] = syncItemsList
    .filter(canSync)
    .map(i => ({
      key: i._id,
      name: i.name || '',
      document: i,
    }));
  const grpcRequests = grpcRequestList;

  function flattenTree() {
    const collection: Collection = [];
    const tree = requestTree;

    const build = (node: Child) => {
      if (isRequestGroup(node.doc)) {
        collection.push(node);
        node.children.forEach(child => build(child));
      } else {
        collection.push(node);
      }
    };
    tree.forEach(node => build(node));

    return collection;
  }

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
    syncItems,
    collection: flattenTree(),
  };
};

const WorkspaceRoute = () => {
  const workspaceData = useLoaderData() as WorkspaceLoaderData;
  const branch = workspaceData.activeWorkspaceMeta.cachedGitRepositoryBranch;
  return <Outlet key={branch} />;
};

export default WorkspaceRoute;
