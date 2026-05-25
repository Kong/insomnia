import { describe, expect, it } from 'vitest';

import type { InsomniaNavigationRouteInfo, NavigationResource } from './use-insomnia-navigation';
import { buildResourceUrl, extractNavigationRouteFromUrl } from './use-insomnia-navigation';

interface NavigationCase {
  title: string;
  resource: NavigationResource;
  route: Omit<InsomniaNavigationRouteInfo, 'searchParams'> & {
    pathname: string;
  };
}

const navigationCases = [
  {
    title: 'project routes',
    resource: {
      _id: 'proj_1',
      type: 'Project',
    },
    route: {
      pathname: '/organization/org_1/project/proj_1',
      routeId: 'project',
      resourceId: 'proj_1',
      organizationId: 'org_1',
      projectId: 'proj_1',
      workspaceId: undefined,
    },
  },
  {
    title: 'mock server routes',
    resource: {
      _id: 'mock_1',
      parentId: 'wrk_1',
      type: 'MockServer',
    },
    route: {
      pathname: '/organization/org_1/project/proj_1/workspace/wrk_1/mock-server',
      routeId: 'workspace:mock-server',
      resourceId: 'wrk_1',
      organizationId: 'org_1',
      projectId: 'proj_1',
      workspaceId: 'wrk_1',
    },
  },
  {
    title: 'mcp workspace routes',
    resource: {
      _id: 'wrk_1',
      type: 'Workspace',
      scope: 'mcp',
    },
    route: {
      pathname: '/organization/org_1/project/proj_1/workspace/wrk_1/mcp',
      routeId: 'workspace:mcp',
      resourceId: 'wrk_1',
      organizationId: 'org_1',
      projectId: 'proj_1',
      workspaceId: 'wrk_1',
    },
  },
  {
    title: 'grpc request routes',
    resource: {
      _id: 'greq_1',
      type: 'GrpcRequest',
    },
    route: {
      pathname: '/organization/org_1/project/proj_1/workspace/wrk_1/debug/request/greq_1',
      routeId: 'request',
      resourceId: 'greq_1',
      organizationId: 'org_1',
      projectId: 'proj_1',
      workspaceId: 'wrk_1',
    },
  },
  {
    title: 'unit test suite routes',
    resource: {
      _id: 'uts_1',
      type: 'UnitTestSuite',
    },
    route: {
      pathname: '/organization/org_1/project/proj_1/workspace/wrk_1/test/test-suite/uts_1',
      routeId: 'unit-test-suite',
      resourceId: 'uts_1',
      organizationId: 'org_1',
      projectId: 'proj_1',
      workspaceId: 'wrk_1',
    },
  },
  {
    title: 'project index routes',
    resource: undefined,
    route: {
      pathname: '/organization/org_1/project',
      routeId: 'project:index',
      organizationId: 'org_1',
      projectId: undefined,
      workspaceId: undefined,
      resourceId: undefined,
    },
  },
] as NavigationCase[];

const attachSearchParams = (
  routeInfo: Omit<InsomniaNavigationRouteInfo, 'searchParams'>,
  searchParams: URLSearchParams,
): InsomniaNavigationRouteInfo => ({
  ...routeInfo,
  searchParams,
});

const buildInputFromCase = ({ resource, route }: NavigationCase) => ({
  organizationId: route.organizationId,
  projectId: route.projectId,
  workspaceId: route.workspaceId,
  resource,
});

describe('extractNavigationRouteFromUrl', () => {
  it.each(navigationCases)('parses $title', ({ route }) => {
    const searchParams = new URLSearchParams();
    const { pathname, ...routeInfo } = route;

    expect(extractNavigationRouteFromUrl(pathname, searchParams)).toEqual(attachSearchParams(routeInfo, searchParams));
  });
});

describe('buildResourceUrl', () => {
  it.each(navigationCases)('builds $title', testCase => {
    expect(buildResourceUrl(buildInputFromCase(testCase))).toBe(testCase.route.pathname);
  });
});
