import { useEffect } from 'react';
import { href, Outlet, useRouteLoaderData } from 'react-router';

import type { SortOrder } from '~/common/constants';
import { type ChangeBufferEvent, database } from '~/common/database';
import { sortMethodMap } from '~/common/sorting';
import * as models from '~/models';
import type { ApiSpec } from '~/models/api-spec';
import type { CaCertificate } from '~/models/ca-certificate';
import type { ClientCertificate } from '~/models/client-certificate';
import type { CookieJar } from '~/models/cookie-jar';
import type { Environment } from '~/models/environment';
import type { GitRepository } from '~/models/git-repository';
import type { GrpcRequest } from '~/models/grpc-request';
import type { GrpcRequestMeta } from '~/models/grpc-request-meta';
import { sortProjects } from '~/models/helpers/project';
import type { MockServer } from '~/models/mock-server';
import { isGitProject, type Project } from '~/models/project';
import type { Request } from '~/models/request';
import { isRequestGroup, type RequestGroup } from '~/models/request-group';
import type { RequestGroupMeta } from '~/models/request-group-meta';
import type { RequestMeta } from '~/models/request-meta';
import type { SocketIORequest } from '~/models/socket-io-request';
import type { WebSocketRequest } from '~/models/websocket-request';
import type { Workspace } from '~/models/workspace';
import type { WorkspaceMeta } from '~/models/workspace-meta';
import { pushSnapshotOnInitialize } from '~/sync/vcs/initialize-backend-project';
import { VCSInstance } from '~/sync/vcs/insomnia-sync';
import { invariant } from '~/utils/invariant';
import { createFetcherLoadHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId';

export type Collection = Child[];

export interface WorkspaceLoaderData {
  workspaces: Workspace[];
  activeWorkspace: Workspace;
  activeWorkspaceMeta: WorkspaceMeta;
  activeProject: Project;
  gitRepository: GitRepository | null;
  activeEnvironment: Environment;
  activeGlobalEnvironment?: Environment | null;
  activeCookieJar: CookieJar;
  baseEnvironment: Environment;
  subEnvironments: Environment[];
  globalBaseEnvironments: (Environment & { workspaceName: string })[];
  globalSubEnvironments: Environment[];
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
  doc: Request | GrpcRequest | WebSocketRequest | RequestGroup | SocketIORequest;
  children: Child[];
  collapsed: boolean;
  hidden: boolean;
  pinned: boolean;
  level: number;
  ancestors?: string[];
}

const dbCache = new Map();

export async function clientLoader({ request, params }: Route.ClientLoaderArgs) {
  const { organizationId, projectId, workspaceId } = params;

  const [activeWorkspace, activeProject] = await Promise.all([
    models.workspace.getById(workspaceId),
    models.project.getById(projectId),
  ]);

  invariant(activeWorkspace, 'Workspace not found');
  invariant(activeProject, 'Project not found');

  const [activeWorkspaceMeta, activeCookieJar, baseEnvironment, userSession] = await Promise.all([
    models.workspaceMeta.getOrCreateByParentId(workspaceId),
    models.cookieJar.getOrCreateForParentId(workspaceId),
    models.environment.getOrCreateForParentId(workspaceId),
    models.userSession.getOrCreate(),
  ]);

  invariant(activeWorkspaceMeta, 'Workspace meta not found');
  invariant(activeCookieJar, 'Cookie jar not found');
  invariant(baseEnvironment, 'Base environment not found');

  // first recursion to get all the folders ids in order to use nedb search by an array
  const flattenFoldersIntoList = async (id: string): Promise<string[]> => {
    const parentIds: string[] = [id];
    const folderIds = (await models.requestGroup.findByParentId(id)).map(r => r._id);
    if (folderIds.length) {
      await Promise.all(folderIds.map(async folderIds => parentIds.push(...(await flattenFoldersIntoList(folderIds)))));
    }
    return parentIds;
  };

  const getCollection = async () => {
    const searchParams = new URL(request.url).searchParams;
    const sortOrder = searchParams.get('sortOrder') as SortOrder;
    const sortFunction = sortMethodMap[sortOrder] || sortMethodMap['type-manual'];
    const listOfParentIds = await flattenFoldersIntoList(activeWorkspace._id);

    const [reqs, reqGroups, grpcReqs, wsReqs, socketIORequests, requestGroupMetas] = await Promise.all([
      database.find(models.request.type, { parentId: { $in: listOfParentIds } }),
      database.find(models.requestGroup.type, { parentId: { $in: listOfParentIds } }),
      database.find(models.grpcRequest.type, { parentId: { $in: listOfParentIds } }) as Promise<GrpcRequest[]>,
      database.find(models.webSocketRequest.type, { parentId: { $in: listOfParentIds } }),
      database.find(models.socketIORequest.type, { parentId: { $in: listOfParentIds } }),
      database.find(models.requestGroupMeta.type, { parentId: { $in: listOfParentIds } }) as Promise<
        RequestGroupMeta[]
      >,
    ]);

    const allRequests = [...reqs, ...reqGroups, ...grpcReqs, ...wsReqs, ...socketIORequests].map(r => {
      let cachedRequest = dbCache.get(r._id);
      if (!cachedRequest) {
        dbCache.set(r._id, r);
        cachedRequest = r;
      }
      return cachedRequest;
    }) as (Request | RequestGroup | GrpcRequest | WebSocketRequest | SocketIORequest)[];

    const [requestMetas, grpcRequestMetas] = await Promise.all([
      database.find(models.requestMeta.type, { parentId: { $in: reqs.map(r => r._id) } }),
      database.find(models.grpcRequestMeta.type, { parentId: { $in: grpcReqs.map(r => r._id) } }),
    ]);

    const grpcAndRequestMetas = [...requestMetas, ...grpcRequestMetas] as (RequestMeta | GrpcRequestMeta)[];

    // second recursion to build the tree
    const getCollectionTree = ({
      parentId,
      level,
      parentIsCollapsed,
      ancestors,
    }: {
      parentId: string;
      level: number;
      parentIsCollapsed: boolean;
      ancestors: string[];
    }): Child[] => {
      const levelReqs = allRequests.filter(r => r.parentId === parentId);

      // parentIsCollapsed is always false if filter is set.
      // so child.collapsed is always false and child.hidden is definitely determined by filter
      const childrenWithChildren: Child[] = levelReqs.sort(sortFunction).map((doc): Child => {
        const hidden = parentIsCollapsed;

        const pinned = (!isRequestGroup(doc) && grpcAndRequestMetas.find(m => m.parentId === doc._id)?.pinned) || false;
        const collapsed =
          parentIsCollapsed ||
          (isRequestGroup(doc) && requestGroupMetas.find(m => m.parentId === doc._id)?.collapsed) ||
          false;

        const docAncestors = [...ancestors, parentId];

        return {
          doc,
          pinned,
          collapsed,
          hidden,
          level,
          ancestors: docAncestors,
          children: getCollectionTree({
            parentId: doc._id,
            level: level + 1,
            parentIsCollapsed: collapsed,
            ancestors: docAncestors,
          }),
        };
      });

      return childrenWithChildren;
    };

    const requestTree = getCollectionTree({
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

    return { collection: flattenTree(), grpcReqs, requestTree };
  };

  const getEnvironments = async () => {
    const getSubEnvironments = async () =>
      (await models.environment.findByParentId(baseEnvironment._id)).sort((e1, e2) => e1.metaSortKey - e2.metaSortKey);

    const getActiveEnvironment = async () =>
      (await database.findOne<Environment>(models.environment.type, {
        _id: activeWorkspaceMeta.activeEnvironmentId,
      })) || baseEnvironment;

    const [subEnvironments, globalEnvironmentWorkspaces, activeGlobalEnvironment, activeEnvironment] =
      await Promise.all([
        getSubEnvironments(),
        database.find<Workspace>(models.workspace.type, {
          parentId: projectId,
          scope: 'environment',
        }),
        database.findOne<Environment>(models.environment.type, {
          _id: activeWorkspaceMeta.activeGlobalEnvironmentId,
        }),
        getActiveEnvironment(),
      ]);

    const globalBaseEnvironments = await database.find<Environment>(models.environment.type, {
      parentId: {
        $in: globalEnvironmentWorkspaces.map(w => w._id),
      },
    });

    const globalSubEnvironments = await database.find<Environment>(models.environment.type, {
      parentId: {
        $in: globalBaseEnvironments.map(e => e._id),
      },
    });

    const globalBaseEnvironmentsWithWorkspaceName = globalBaseEnvironments.map(e => {
      const workspace = globalEnvironmentWorkspaces.find(w => w._id === e.parentId);
      return {
        ...e,
        workspaceName: workspace?.name || '',
      };
    });

    return {
      subEnvironments,
      globalSubEnvironments,
      globalBaseEnvironmentsWithWorkspaceName,
      activeEnvironment,
      activeGlobalEnvironment,
    };
  };

  const getProjects = async () => {
    const organizationProjects =
      (await database.find<Project>(models.project.type, {
        parentId: organizationId,
      })) || [];
    return sortProjects(organizationProjects);
  };

  const getVCS = async () => {
    const gitRepositoryId = isGitProject(activeProject)
      ? activeProject.gitRepositoryId
      : activeWorkspaceMeta.gitRepositoryId;
    const gitRepository = await models.gitRepository.getById(gitRepositoryId || '');
    const isLoggedInIsCloudProjectAndIsNotGitRepo = userSession.id && activeProject.remoteId && !gitRepository;
    let vcsVersion = null;
    if (isLoggedInIsCloudProjectAndIsNotGitRepo) {
      try {
        const vcs = VCSInstance();
        await vcs.switchAndCreateBackendProjectIfNotExist(workspaceId, activeWorkspace.name);
        if (activeWorkspaceMeta.pushSnapshotOnInitialize) {
          await pushSnapshotOnInitialize({ vcs, workspace: activeWorkspace, project: activeProject });
        }
        vcsVersion = await vcs.getVersion();
      } catch (err) {
        console.warn('Failed to initialize VCS', err);
      }
    }
    return { gitRepository, vcsVersion };
  };

  const getMisc = async () => {
    const [activeApiSpec, activeMockServer, clientCertificates, caCertificate] = await Promise.all([
      models.apiSpec.getByParentId(workspaceId),
      models.mockServer.getByParentId(workspaceId),
      models.clientCertificate.findByParentId(workspaceId),
      models.caCertificate.findByParentId(workspaceId),
    ]);
    return { activeApiSpec, activeMockServer, clientCertificates, caCertificate };
  };

  const [
    { activeApiSpec, activeMockServer, clientCertificates, caCertificate },
    {
      activeEnvironment,
      activeGlobalEnvironment,
      subEnvironments,
      globalSubEnvironments,
      globalBaseEnvironmentsWithWorkspaceName,
    },
    { gitRepository, vcsVersion },
    { collection, grpcReqs, requestTree },
    projects,
    workspaces,
  ] = await Promise.all([
    getMisc(),
    getEnvironments(),
    getVCS(),
    getCollection(),
    getProjects(),
    models.workspace.findByParentId(projectId),
  ]);

  const nodesById = collection.reduce((o, n) => ((o[n.doc._id] = n), o), {} as Record<string, Child>);

  // If there is a filter then we need to show all the parents of the requests that are not hidden.
  collection.forEach(node => {
    const ancestors = node.ancestors || [];

    if (!node.hidden) {
      ancestors.forEach(ancestorId => {
        const ancestor = nodesById[ancestorId];

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
    activeGlobalEnvironment,
    subEnvironments,
    baseEnvironment,
    globalSubEnvironments,
    globalBaseEnvironments: globalBaseEnvironmentsWithWorkspaceName,
    activeApiSpec,
    activeMockServer,
    clientCertificates,
    caCertificate,
    projects,
    requestTree,
    // TODO: remove this state hack when the grpc responses go somewhere else
    grpcRequests: grpcReqs,
    collection,
    vcsVersion,
  };
}

export function useWorkspaceLoaderData() {
  return useRouteLoaderData<typeof clientLoader>(
    'routes/organization.$organizationId.project.$projectId.workspace.$workspaceId',
  );
}

export const useWorkspaceLoaderFetcher = createFetcherLoadHook(
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
      return load(
        href(`/organization/:organizationId/project/:projectId/workspace/:workspaceId`, {
          organizationId,
          projectId,
          workspaceId,
        }),
      );
    },
  clientLoader,
);

export const revalidateWorkspaceActiveRequest = async (requestId: string, workspaceId: string) => {
  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);
  if (workspaceMeta?.activeRequestId === requestId) {
    await models.workspaceMeta.update(workspaceMeta, { activeRequestId: null });
  }
};

export const revalidateWorkspaceActiveRequestByFolder = async (requestGroup: RequestGroup, workspaceId: string) => {
  const docs = await database.getWithDescendants(requestGroup, [
    models.request.type,
    models.grpcRequest.type,
    models.webSocketRequest.type,
    models.socketIORequest.type,
    models.requestGroup.type,
  ]);
  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);
  for (const doc of docs) {
    if (workspaceMeta?.activeRequestId === doc._id) {
      await models.workspaceMeta.update(workspaceMeta, { activeRequestId: null });
      return;
    }
  }
};

const Component = () => {
  useEffect(() => {
    return window.main.on('db.changes', (_, changes: ChangeBufferEvent[]) => {
      for (const change of changes) {
        const [event, doc, patches] = change;
        if (event === 'insert') {
          dbCache.set(doc._id, doc);
        } else if (event === 'remove') {
          dbCache.delete(doc._id);
        } else if (event === 'update') {
          dbCache.set(doc._id, Object.assign({}, doc, ...patches));
        }
      }
    });
  }, []);
  return <Outlet />;
};

export default Component;
