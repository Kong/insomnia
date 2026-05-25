import { useCallback, useMemo } from 'react';
import { href, matchPath, useLocation, useSearchParams } from 'react-router';

import type {
  GrpcRequest,
  McpRequest,
  MockRoute,
  MockServer,
  Project,
  Request,
  RequestGroup,
  SocketIORequest,
  UnitTest,
  UnitTestSuite,
  WebSocketRequest,
  Workspace,
} from '~/insomnia-data';
import { models, services } from '~/insomnia-data';

export type NavigationResource =
  | undefined
  | Project
  | Workspace
  | RequestGroup
  | Request
  | GrpcRequest
  | WebSocketRequest
  | SocketIORequest
  | McpRequest
  | MockServer
  | MockRoute
  | UnitTest
  | UnitTestSuite;

const NAVIGATION_ROUTES = [
  {
    id: 'request-group',
    path: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request-group/:requestGroupId',
    getResourceId: params => params.requestGroupId,
    getResource: (resourceId: string) => services.requestGroup.getById(resourceId),
  },
  {
    id: 'request',
    path: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request/:requestId',
    getResourceId: params => params.requestId,
    getResource: (resourceId: string) => services.helpers.getRequestById(resourceId),
  },
  {
    id: 'runner',
    path: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/runner',
    getResourceId: (params, searchParams) => searchParams.get('folder') || params.workspaceId,
    getResource: (resourceId: string) =>
      models.requestGroup.isRequestGroupId(resourceId)
        ? services.requestGroup.getById(resourceId)
        : services.workspace.getById(resourceId),
  },
  {
    id: 'mock-route',
    path: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/mock-server/mock-route/:mockRouteId',
    getResourceId: params => params.mockRouteId,
    getResource: (resourceId: string) => services.mockRoute.getById(resourceId),
  },
  {
    id: 'unit-test-suite',
    path: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/test/test-suite/:testSuiteId',
    end: false,
    getResourceId: params => params.testSuiteId,
    getResource: (resourceId: string) => services.unitTestSuite.getById(resourceId),
  },
  {
    id: 'unit-test',
    path: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/test',
    getResourceId: params => params.workspaceId,
    getResource: (resourceId: string) => services.workspace.getById(resourceId),
  },
  {
    id: 'workspace:mcp',
    path: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/mcp',
    getResourceId: params => params.workspaceId,
    getResource: (resourceId: string) => services.workspace.getById(resourceId),
  },
  {
    id: 'workspace:mock-server',
    path: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/mock-server',
    getResourceId: params => params.workspaceId,
    getResource: (resourceId: string) => services.workspace.getById(resourceId),
  },
  {
    id: 'workspace:environment',
    path: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/environment',
    getResourceId: params => params.workspaceId,
    getResource: (resourceId: string) => services.workspace.getById(resourceId),
  },
  {
    id: 'workspace:design',
    path: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/spec',
    getResourceId: params => params.workspaceId,
    getResource: (resourceId: string) => services.workspace.getById(resourceId),
  },
  {
    id: 'workspace:collection',
    path: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug',
    getResourceId: params => params.workspaceId,
    getResource: (resourceId: string) => services.workspace.getById(resourceId),
  },
  {
    id: 'project',
    path: '/organization/:organizationId/project/:projectId',
    getResourceId: params => params.projectId,
    getResource: (resourceId: string) => services.project.get(resourceId),
  },
  {
    id: 'project:index',
    path: '/organization/:organizationId/project',
  },
] as const satisfies {
  id: string;
  path: Parameters<typeof href>[0];
  end?: boolean;
  getResourceId?: (params: Record<string, string | undefined>, searchParams: URLSearchParams) => string | undefined;
  getResource?: (resourceId: string) => Promise<NavigationResource>;
}[];

type NavigationRoute = (typeof NAVIGATION_ROUTES)[number];
type NavigationRouteId = NavigationRoute['id'];

export interface InsomniaNavigationRouteInfo {
  routeId: NavigationRouteId;
  organizationId: string;
  projectId?: string;
  workspaceId?: string;
  resourceId?: string;
  searchParams: URLSearchParams;
}

export interface NavigationResources {
  project?: Project;
  workspace?: Workspace;
  resource?: NavigationResource;
}

const buildSearchString = (searchParams?: URLSearchParams) => {
  const search = searchParams?.toString() || '';
  return search ? `?${search}` : '';
};

const getRoute = (routeId: NavigationRoute['id']) => {
  const route = NAVIGATION_ROUTES.find(route => route.id === routeId);

  if (!route) {
    return NAVIGATION_ROUTES[NAVIGATION_ROUTES.length - 1]; // Default to project:index route
  }

  return route;
};

const getMatchedRoute = (pathname: string, searchParams: URLSearchParams) => {
  for (const route of NAVIGATION_ROUTES) {
    const match = matchPath({ path: route.path, end: 'end' in route ? route.end : true }, pathname);
    if (!match) {
      continue;
    }

    const resourceId = 'getResourceId' in route ? route.getResourceId(match.params, searchParams) : undefined;

    return {
      route,
      params: match.params,
      resourceId,
    };
  }
  return null;
};

const getRouteIdForResource = (resource: NavigationResource): NavigationRoute['id'] => {
  if (!resource) return 'project:index';
  if (models.project.isProject(resource)) return 'project';
  if (models.mockServer.isMockServer(resource)) return 'workspace:mock-server';
  if (models.request.isRequest(resource)) return 'request';
  if (models.grpcRequest.isGrpcRequest(resource)) return 'request';
  if (models.webSocketRequest.isWebSocketRequest(resource)) return 'request';
  if (models.socketIORequest.isSocketIORequest(resource)) return 'request';
  if (models.mcpRequest.isMcpRequest(resource)) return 'request';
  if (models.requestGroup.isRequestGroup(resource)) return 'request-group';
  if (models.mockRoute.isMockRoute(resource)) return 'mock-route';
  if (models.unitTest.isUnitTest(resource)) return 'unit-test';
  if (models.unitTestSuite.isUnitTestSuite(resource)) return 'unit-test-suite';
  if (models.workspace.isWorkspace(resource)) {
    if (models.workspace.isDesign(resource)) return 'workspace:design';
    if (models.workspace.isEnvironment(resource)) return 'workspace:environment';
    if (models.workspace.isMockServer(resource)) return 'workspace:mock-server';
    if (models.workspace.isMcp(resource)) return 'workspace:mcp';
    return 'workspace:collection';
  }

  return 'workspace:collection';
};

export function buildResourceUrl({
  organizationId,
  projectId,
  workspaceId,
  resource,
  searchParams,
}: {
  organizationId: string;
  projectId?: string;
  workspaceId?: string;
  resource: NavigationResource;
  searchParams?: URLSearchParams;
}) {
  const routeId = getRouteIdForResource(resource);
  const route = getRoute(routeId);
  let url = '';

  switch (routeId) {
    case 'project:index': {
      url = href(route.path, {
        organizationId,
      });
      break;
    }
    case 'project': {
      if (!projectId && !resource) {
        return '';
      }

      url = href(route.path, {
        organizationId,
        projectId: projectId || resource!._id,
      });
      break;
    }
    case 'workspace:collection':
    case 'workspace:design':
    case 'workspace:environment':
    case 'workspace:mock-server':
    case 'workspace:mcp': {
      const resolvedWorkspaceId =
        workspaceId ||
        (resource && models.workspace.isWorkspace(resource)
          ? resource._id
          : resource && models.mockServer.isMockServer(resource)
            ? resource.parentId
            : undefined);

      if (!projectId || !resolvedWorkspaceId) {
        return '';
      }

      url = href(route.path, {
        organizationId,
        projectId,
        workspaceId: resolvedWorkspaceId,
      });
      break;
    }
    case 'request-group': {
      if (!projectId || !workspaceId || !resource) {
        return '';
      }

      url = href(route.path, {
        organizationId,
        projectId,
        workspaceId,
        requestGroupId: resource!._id,
      });
      break;
    }
    case 'request': {
      if (!projectId || !workspaceId || !resource) {
        return '';
      }

      url = href(route.path, {
        organizationId,
        projectId,
        workspaceId,
        requestId: resource!._id,
      });
      break;
    }
    case 'mock-route': {
      if (!projectId || !workspaceId || !resource) {
        return '';
      }

      url = href(route.path, {
        organizationId,
        projectId,
        workspaceId,
        mockRouteId: resource!._id,
      });
      break;
    }
    case 'unit-test-suite': {
      if (!projectId || !workspaceId || !resource) {
        return '';
      }

      url = href(route.path, {
        organizationId,
        projectId,
        workspaceId,
        testSuiteId: resource!._id,
      });
      break;
    }
    default: {
      return '';
    }
  }

  return `${url}${buildSearchString(searchParams)}`;
}

export const extractNavigationRouteFromUrl = (pathname: string, searchParams: URLSearchParams) => {
  const matchedRoute = getMatchedRoute(pathname, searchParams);
  if (!matchedRoute) {
    return null;
  }

  const { params, resourceId, route } = matchedRoute;
  if (!params.organizationId) {
    return null;
  }

  return {
    routeId: route.id,
    organizationId: params.organizationId,
    projectId: params.projectId,
    workspaceId: params.workspaceId,
    resourceId,
    searchParams,
  } satisfies InsomniaNavigationRouteInfo;
};

const getRouteResource = async (routeInfo: InsomniaNavigationRouteInfo): Promise<NavigationResource> => {
  const route = getRoute(routeInfo.routeId);
  return 'getResource' in route ? await route.getResource(routeInfo.resourceId!) : undefined;
};

export const getNavigationResources = async (
  routeInfo?: InsomniaNavigationRouteInfo | null,
): Promise<NavigationResources> => {
  if (!routeInfo) return {};
  return {
    project: routeInfo.projectId ? await services.project.get(routeInfo.projectId) : undefined,
    workspace: routeInfo.workspaceId ? await services.workspace.getById(routeInfo.workspaceId) : undefined,
    resource: routeInfo.resourceId ? await getRouteResource(routeInfo) : undefined,
  };
};

export const useInsomniaNavigation = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const routeInfo = useMemo(
    () => extractNavigationRouteFromUrl(location.pathname, searchParams),
    [location.pathname, searchParams],
  );
  const getNavigationResourcesFromRoute = useCallback(() => getNavigationResources(routeInfo), [routeInfo]);

  return {
    routeInfo,
    getNavigationResources: getNavigationResourcesFromRoute,
  };
};
