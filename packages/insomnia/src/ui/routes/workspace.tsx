import React from 'react';
import { LoaderFunction, Outlet } from 'react-router-dom';

import { SortOrder } from '../../common/constants';
import { database } from '../../common/database';
import { fuzzyMatchAll } from '../../common/misc';
import { sortMethodMap } from '../../common/sorting';
import * as models from '../../models';
import { ApiSpec } from '../../models/api-spec';
import { CaCertificate } from '../../models/ca-certificate';
import { ClientCertificate } from '../../models/client-certificate';
import { CookieJar } from '../../models/cookie-jar';
import { Environment } from '../../models/environment';
import { GitRepository } from '../../models/git-repository';
import { GrpcRequest } from '../../models/grpc-request';
import { GrpcRequestMeta } from '../../models/grpc-request-meta';
import { sortProjects } from '../../models/helpers/project';
import { MockServer } from '../../models/mock-server';
import { Project } from '../../models/project';
import { Request } from '../../models/request';
import { isRequestGroup, RequestGroup } from '../../models/request-group';
import { RequestGroupMeta } from '../../models/request-group-meta';
import { RequestMeta } from '../../models/request-meta';
import {
  WebSocketRequest,
} from '../../models/websocket-request';
import { Workspace } from '../../models/workspace';
import { WorkspaceMeta } from '../../models/workspace-meta';
import { pushSnapshotOnInitialize } from '../../sync/vcs/initialize-backend-project';
import { VCSInstance } from '../../sync/vcs/insomnia-sync';
import { invariant } from '../../utils/invariant';

export type Collection = Child[];

export interface WorkspaceLoaderData {
  workspaces: Workspace[];
  activeWorkspace: Workspace;
  activeWorkspaceMeta: WorkspaceMeta;
  activeProject: Project;
  gitRepository: GitRepository | null;
  activeEnvironment: Environment;
  activeCookieJar: CookieJar;
  baseEnvironment: Environment;
  subEnvironments: Environment[];
  activeApiSpec: ApiSpec | null;
  activeMockServer?: MockServer | null;
  clientCertificates: ClientCertificate[];
  caCertificate: CaCertificate | null;
  projects: Project[];
  requestTree: Child[];
  grpcRequests: GrpcRequest[];
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
  const { organizationId, projectId, workspaceId } = params;
  invariant(organizationId, 'Organization ID is required');
  invariant(projectId, 'Project ID is required');
  invariant(workspaceId, 'Workspace ID is required');

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
  const activeMockServer = await models.mockServer.getByParentId(workspaceId);
  const clientCertificates = await models.clientCertificate.findByParentId(
    workspaceId,
  );

  const organizationProjects = await database.find<Project>(models.project.type, {
    parentId: organizationId,
  }) || [];

  const projects = sortProjects(organizationProjects);

  const searchParams = new URL(request.url).searchParams;
  const filter = searchParams.get('filter');
  const sortOrder = searchParams.get('sortOrder') as SortOrder;
  const defaultSort = (a: Request | GrpcRequest | WebSocketRequest | RequestGroup, b: Request | GrpcRequest | WebSocketRequest | RequestGroup) => {
    if (a.metaSortKey === b.metaSortKey) {
      return a._id > b._id ? 1 : -1;
    }
    return a.metaSortKey < b.metaSortKey ? 1 : -1;
  };
  const sortFunction = sortMethodMap[sortOrder] || defaultSort;

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

  const reqs = await database.find(models.request.type, { parentId: { $in: listOfParentIds } });
  const reqGroups = await database.find(models.requestGroup.type, { parentId: { $in: listOfParentIds } });
  const grpcReqs = await database.find(models.grpcRequest.type, { parentId: { $in: listOfParentIds } }) as GrpcRequest[];
  const wsReqs = await database.find(models.webSocketRequest.type, { parentId: { $in: listOfParentIds } });
  const allRequests = [...reqs, ...reqGroups, ...grpcReqs, ...wsReqs] as (Request | RequestGroup | GrpcRequest | WebSocketRequest)[];

  const requestMetas = await database.find(models.requestMeta.type, { parentId: { $in: reqs.map(r => r._id) } });
  const grpcRequestMetas = await database.find(models.grpcRequestMeta.type, { parentId: { $in: grpcReqs.map(r => r._id) } });
  const grpcAndRequestMetas = [...requestMetas, ...grpcRequestMetas] as (RequestMeta | GrpcRequestMeta)[];
  const requestGroupMetas = await database.find(models.requestGroupMeta.type, { parentId: { $in: listOfParentIds } }) as RequestGroupMeta[];
  // second recursion to build the tree
  const getCollectionTree = async ({
    parentId,
    level,
    parentIsCollapsed,
    ancestors,
  }: {
      parentId: string; level: number; parentIsCollapsed: boolean; ancestors: string[];
  }): Promise<Child[]> => {
    const levelReqs = allRequests.filter(r => r.parentId === parentId);

    const childrenWithChildren: Child[] = await Promise.all(levelReqs
        .sort(sortFunction)
        .map(async (doc): Promise<Child> => {
          const isMatched = (filter: string): boolean =>
            Boolean(fuzzyMatchAll(
              filter,
              [
                doc.name,
                doc.description,
                ...(isRequestGroup(doc) ? [] : [doc.url]),
              ],
              { splitSpace: false, loose: true }
            )?.indexes);
          const shouldHide = Boolean(filter && !isMatched(filter));
          const hidden = parentIsCollapsed || shouldHide;

          const pinned =
            !isRequestGroup(doc) && grpcAndRequestMetas.find(m => m.parentId === doc._id)?.pinned || false;
          const collapsed = filter
            ? false
            : parentIsCollapsed ||
              (isRequestGroup(doc) &&
              requestGroupMetas.find(m => m.parentId === doc._id)?.collapsed) ||
              false;

          const docAncestors = [...ancestors, parentId];

          return {
            doc,
            pinned,
            collapsed,
            hidden,
            level,
            ancestors: docAncestors,
            children: await getCollectionTree({
              parentId: doc._id,
              level: level + 1,
              parentIsCollapsed: collapsed,
              ancestors: docAncestors,
            }),
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

  const user = await models.user.getOrCreate();
  if (user.id && !gitRepository) {
    try {
      const vcs = VCSInstance();
      await vcs.switchAndCreateBackendProjectIfNotExist(workspaceId, activeWorkspace.name);
      if (activeWorkspaceMeta.pushSnapshotOnInitialize) {
        await pushSnapshotOnInitialize({ vcs, workspace: activeWorkspace, project: activeProject });
      }
    } catch (err) {
      console.warn('Failed to initialize VCS', err);
    }
  }

  const workspaces = await models.workspace.findByParentId(projectId);

  const collection = flattenTree();

  // If there is a filter then we need to show all the parents of the requests that are not hidden.
  collection.forEach(node => {
    const ancestors = node.ancestors || [];

    if (!node.hidden) {
      ancestors.forEach(ancestorId => {
        const ancestor = collection.find(n => n.doc._id === ancestorId);

        if (ancestor) {
          ancestor.hidden = false;
        }
      });
    }
  });

  return {
    workspaces,
    activeWorkspace,
    activeProject,
    gitRepository,
    activeWorkspaceMeta,
    activeCookieJar,
    activeEnvironment,
    subEnvironments,
    baseEnvironment,
    activeApiSpec,
    activeMockServer,
    clientCertificates,
    caCertificate: await models.caCertificate.findByParentId(workspaceId),
    projects,
    requestTree,
    // TODO: remove this state hack when the grpc responses go somewhere else
    grpcRequests: grpcReqs,
    collection,
  };
};

const WorkspaceRoute = () => {
  return <Outlet />;
};

export default WorkspaceRoute;
