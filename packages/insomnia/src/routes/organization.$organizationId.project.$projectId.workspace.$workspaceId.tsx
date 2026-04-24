import { href, Outlet, redirect, useRouteLoaderData } from 'react-router';

import type { SortOrder } from '~/common/constants';
import { database } from '~/common/database';
import { sortMethodMap } from '~/common/sorting';
import type {
  ApiSpec,
  CaCertificate,
  ClientCertificate,
  CookieJar,
  Environment,
  GitRepository,
  GrpcRequest,
  GrpcRequestMeta,
  MockServer,
  Project,
  Request,
  RequestGroup,
  RequestGroupMeta,
  RequestMeta,
  SocketIORequest,
  SocketIORequestMeta,
  WebSocketRequest,
  WebSocketRequestMeta,
  Workspace,
  WorkspaceMeta,
} from '~/insomnia-data';
import { services } from '~/insomnia-data';
import * as models from '~/models';
import { sortProjects } from '~/models/helpers/project';
import { pushSnapshotOnInitialize } from '~/sync/vcs/initialize-backend-project';
import { VCSInstance } from '~/sync/vcs/insomnia-sync';
import { showResourceNotFoundToast } from '~/ui/components/toast-notification';
import { createFetcherLoadHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId';

const { isRequestGroup } = models.requestGroup;

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

export async function clientLoader({ params, request }: Route.ClientLoaderArgs) {
  const { organizationId, projectId, workspaceId } = params;

  const activeProject = await services.project.getById(projectId);
  if (!activeProject) {
    showResourceNotFoundToast(`Project not found: ${projectId}`);
    throw redirect(href('/organization/:organizationId/project', { organizationId }));
  }

  const activeWorkspace = await services.workspace.getById(workspaceId);
  if (!activeWorkspace) {
    showResourceNotFoundToast(`Workspace not found: ${workspaceId}`);
    throw redirect(href('/organization/:organizationId/project/:projectId', { organizationId, projectId }));
  }

  const activeWorkspaceMeta = await services.workspaceMeta.getOrCreateByParentId(workspaceId);

  const gitRepositoryId = models.project.isGitProject(activeProject)
    ? activeProject.gitRepositoryId
    : activeWorkspaceMeta.gitRepositoryId;
  const gitRepository = await services.gitRepository.getById(gitRepositoryId || '');

  const baseEnvironment = await services.environment.getOrCreateForParentId(workspaceId);

  const subEnvironments = (await services.environment.findByParentId(baseEnvironment._id)).sort(
    (e1, e2) => e1.metaSortKey - e2.metaSortKey,
  );

  const globalEnvironmentWorkspaces = await database.find<Workspace>(models.workspace.type, {
    parentId: projectId,
    scope: 'environment',
  });

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

  const activeEnvironment =
    (await database.findOne<Environment>(models.environment.type, {
      _id: activeWorkspaceMeta.activeEnvironmentId,
    })) || baseEnvironment;

  const activeGlobalEnvironment = await database.findOne<Environment>(models.environment.type, {
    _id: activeWorkspaceMeta.activeGlobalEnvironmentId,
  });

  const activeCookieJar = await services.cookieJar.getOrCreateForParentId(workspaceId);

  const activeApiSpec = await services.apiSpec.getByParentId(workspaceId);
  const clientCertificates = await services.clientCertificate.findByParentId(workspaceId);
  const activeMockServer = await services.mockServer.getByParentId(workspaceId);

  const organizationProjects =
    (await database.find<Project>(models.project.type, {
      parentId: organizationId,
    })) || [];

  const projects = sortProjects(organizationProjects);

  const searchParams = new URL(request.url).searchParams;
  const sortOrder = searchParams.get('sortOrder') as SortOrder;
  const sortFunction = sortMethodMap[sortOrder] || sortMethodMap['type-manual'];

  // first recursion to get all the folders ids in order to use nedb search by an array
  const flattenFoldersIntoList = async (id: string): Promise<string[]> => {
    const parentIds: string[] = [id];
    const folderIds = (await services.requestGroup.findByParentId(id)).map(r => r._id);
    if (folderIds.length) {
      await Promise.all(folderIds.map(async folderIds => parentIds.push(...(await flattenFoldersIntoList(folderIds)))));
    }
    return parentIds;
  };
  const listOfParentIds = await flattenFoldersIntoList(activeWorkspace._id);

  const reqs = await database.find(models.request.type, { parentId: { $in: listOfParentIds } });
  const reqGroups = await database.find(models.requestGroup.type, { parentId: { $in: listOfParentIds } });
  const grpcReqs = (await database.find(models.grpcRequest.type, {
    parentId: { $in: listOfParentIds },
  })) as GrpcRequest[];
  const wsReqs = await database.find(models.webSocketRequest.type, { parentId: { $in: listOfParentIds } });
  const socketIORequests = await database.find(models.socketIORequest.type, { parentId: { $in: listOfParentIds } });
  const allRequests = [...reqs, ...reqGroups, ...grpcReqs, ...wsReqs, ...socketIORequests] as (
    | Request
    | RequestGroup
    | GrpcRequest
    | WebSocketRequest
    | SocketIORequest
  )[];

  const requestMetas = await database.find(models.requestMeta.type, { parentId: { $in: reqs.map(r => r._id) } });
  const grpcRequestMetas = await database.find(models.grpcRequestMeta.type, {
    parentId: { $in: grpcReqs.map(r => r._id) },
  });
  const webSocketRequestMetas = await database.find(models.webSocketRequestMeta.type, {
    parentId: { $in: wsReqs.map(r => r._id) },
  });
  const socketIORequestMetas = await database.find(models.socketIORequestMeta.type, {
    parentId: { $in: socketIORequests.map(r => r._id) },
  });
  const allRequestMetas = [...requestMetas, ...grpcRequestMetas, ...webSocketRequestMetas, ...socketIORequestMetas] as (
    | RequestMeta
    | GrpcRequestMeta
    | WebSocketRequestMeta
    | SocketIORequestMeta
  )[];
  const requestGroupMetas = (await database.find(models.requestGroupMeta.type, {
    parentId: { $in: listOfParentIds },
  })) as RequestGroupMeta[];
  // second recursion to build the tree
  const getCollectionTree = async ({
    parentId,
    level,
    parentIsCollapsed,
    ancestors,
  }: {
    parentId: string;
    level: number;
    parentIsCollapsed: boolean;
    ancestors: string[];
  }): Promise<Child[]> => {
    const levelReqs = allRequests.filter(r => r.parentId === parentId);

    // parentIsCollapsed is always false if filter is set.
    // so child.collapsed is always false and child.hidden is definitely determined by filter
    const childrenWithChildren: Child[] = await Promise.all(
      levelReqs.sort(sortFunction).map(async (doc): Promise<Child> => {
        const hidden = parentIsCollapsed;

        const pinned = (!isRequestGroup(doc) && allRequestMetas.find(m => m.parentId === doc._id)?.pinned) || false;
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

  const userSession = await services.userSession.getOrCreate();
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

  const workspaces = await services.workspace.findByParentId(projectId);

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
    activeGlobalEnvironment,
    subEnvironments,
    baseEnvironment,
    globalSubEnvironments,
    globalBaseEnvironments: globalBaseEnvironmentsWithWorkspaceName,
    activeApiSpec,
    activeMockServer,
    clientCertificates,
    caCertificate: await services.caCertificate.getByParentId(workspaceId),
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
  const workspaceMeta = await services.workspaceMeta.getByParentId(workspaceId);
  if (workspaceMeta?.activeRequestId === requestId) {
    await services.workspaceMeta.update(workspaceMeta, { activeRequestId: null });
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
  const workspaceMeta = await services.workspaceMeta.getByParentId(workspaceId);
  for (const doc of docs) {
    if (workspaceMeta?.activeRequestId === doc._id) {
      await services.workspaceMeta.update(workspaceMeta, { activeRequestId: null });
      return;
    }
  }
};

const Component = () => {
  return (
    <div className="h-full w-full overflow-hidden" data-testid="workspace-page">
      <Outlet />
    </div>
  );
};

export default Component;
