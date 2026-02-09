import { useCallback, useEffect, useMemo } from 'react';
import { href, matchPath, useLocation, useNavigate, useSearchParams } from 'react-router';

import { mcpRequest } from '~/models';
import { type GrpcRequest, isGrpcRequest } from '~/models/grpc-request';
import { isMcpRequest, type McpRequest } from '~/models/mcp-request';
import { isMockRoute, type MockRoute } from '~/models/mock-route';
import type { MockServer } from '~/models/mock-server';
import type { Organization } from '~/models/organization';
import type { Project } from '~/models/project';
import { isRequest, type Request } from '~/models/request';
import { isRequestGroup, type RequestGroup } from '~/models/request-group';
import { isSocketIORequest, type SocketIORequest } from '~/models/socket-io-request';
import { isUnitTestSuite, type UnitTestSuite } from '~/models/unit-test-suite';
import { isWebSocketRequest, type WebSocketRequest } from '~/models/websocket-request';
import {
  isCollection,
  isDesign,
  isEnvironment,
  isMockServer,
  isWorkspace,
  type Workspace,
  WorkspaceScopeKeys,
} from '~/models/workspace';
import { formatMethodName, getRequestMethodShortHand } from '~/ui/components/tags/method-tag';
import { showResourceNotFoundToast } from '~/ui/components/toast-notification';

import { useDocBodyKeyboardShortcuts } from '../components/keydown-binder';
import type { BaseTab, TabType } from '../components/tabs/tab';
import { useInsomniaTabContext } from '../context/app/insomnia-tab-context';

interface InsomniaTabProps {
  organizationId: string;
}

export type TabResource =
  | Request
  | GrpcRequest
  | WebSocketRequest
  | SocketIORequest
  | McpRequest
  | RequestGroup
  | MockServer
  | MockRoute
  | Workspace
  | UnitTestSuite;

interface AddTabParams {
  resource: TabResource;
  organizationId: string;
  projectId: string;
  workspaceId?: string;
  projectName: string;
  workspaceName: string;
  searchParams?: URLSearchParams;
}

// Utility function to infer tab type from resource
function inferTabType(resource: TabResource, workspaceScope?: Workspace['scope']): TabType {
  if (
    isRequest(resource) ||
    isGrpcRequest(resource) ||
    isWebSocketRequest(resource) ||
    isSocketIORequest(resource) ||
    isMcpRequest(resource)
  ) {
    return 'request';
  }
  if (isRequestGroup(resource)) {
    return 'folder';
  }
  if (isMockRoute(resource)) {
    return 'mockRoute';
  }
  if (isUnitTestSuite(resource)) {
    return 'testSuite';
  }
  if (isWorkspace(resource)) {
    const scope = workspaceScope ?? resource.scope;
    if (isDesign(resource) || scope === WorkspaceScopeKeys.design) {
      return 'document';
    }
    if (isMockServer(resource) || scope === WorkspaceScopeKeys.mockServer) {
      return 'mockServer';
    }
    if (isEnvironment(resource) || scope === WorkspaceScopeKeys.environment) {
      return 'environment';
    }
    if (isCollection(resource) || scope === WorkspaceScopeKeys.collection) {
      return 'collection';
    }
    return 'collection';
  }
  return 'collection';
}

export const TAB_ROUTER_PATH = {
  collection: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug',
  folder: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request-group/:requestGroupId',
  request: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request/:requestId',
  environment: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/environment',
  mockServer: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/mock-server',
  runner: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/runner',
  document: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/spec',
  mockRoute:
    '/organization/:organizationId/project/:projectId/workspace/:workspaceId/mock-server/mock-route/:mockRouteId',
  test: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/test',
  testSuite: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/test/test-suite/:testSuiteId',
} as const;

const TAB_ROUTE_MATCH_END: Partial<Record<TabType, boolean>> = {
  testSuite: false,
};

const buildSearchString = (searchParams?: URLSearchParams | Record<string, string>) => {
  if (!searchParams) {
    return '';
  }
  const params =
    searchParams instanceof URLSearchParams ? new URLSearchParams(searchParams) : new URLSearchParams(searchParams);
  const search = params.toString();
  return search ? `?${search}` : '';
};

const buildRunnerSearchParams = (folderId?: string, searchParams?: URLSearchParams | Record<string, string>) => {
  const params = searchParams instanceof URLSearchParams ? new URLSearchParams(searchParams) : new URLSearchParams();
  if (searchParams && !(searchParams instanceof URLSearchParams)) {
    Object.entries(searchParams).forEach(([key, value]) => {
      params.set(key, value);
    });
  }
  if (folderId !== undefined) {
    params.set('folder', folderId);
  }
  return params;
};

const buildTabUrl = (
  type: TabType,
  {
    organizationId,
    projectId,
    workspaceId,
    resourceId,
    searchParams,
  }: {
    organizationId: string;
    projectId: string;
    workspaceId: string;
    resourceId?: string;
    searchParams?: URLSearchParams;
  },
): string => {
  const url = (() => {
    switch (type) {
      case 'request': {
        return href(TAB_ROUTER_PATH.request, {
          organizationId,
          projectId,
          workspaceId,
          requestId: resourceId || '',
        });
      }
      case 'folder': {
        return href(TAB_ROUTER_PATH.folder, {
          organizationId,
          projectId,
          workspaceId,
          requestGroupId: resourceId || '',
        });
      }
      case 'collection': {
        return href(TAB_ROUTER_PATH.collection, { organizationId, projectId, workspaceId });
      }
      case 'document': {
        return href(TAB_ROUTER_PATH.document, { organizationId, projectId, workspaceId });
      }
      case 'environment': {
        return href(TAB_ROUTER_PATH.environment, { organizationId, projectId, workspaceId });
      }
      case 'mockServer': {
        return href(TAB_ROUTER_PATH.mockServer, { organizationId, projectId, workspaceId });
      }
      case 'mockRoute': {
        return href(TAB_ROUTER_PATH.mockRoute, {
          organizationId,
          projectId,
          workspaceId,
          mockRouteId: resourceId || '',
        });
      }
      case 'test': {
        return href(TAB_ROUTER_PATH.test, { organizationId, projectId, workspaceId });
      }
      case 'testSuite': {
        return href(TAB_ROUTER_PATH.testSuite, {
          organizationId,
          projectId,
          workspaceId,
          testSuiteId: resourceId || '',
        });
      }
      case 'runner': {
        const baseUrl = href(TAB_ROUTER_PATH.runner, { organizationId, projectId, workspaceId });
        const search = buildSearchString(searchParams);
        return `${baseUrl}${search}`;
      }
      default: {
        return href(TAB_ROUTER_PATH.collection, { organizationId, projectId, workspaceId });
      }
    }
  })();

  if (type === 'collection') {
    searchParams = searchParams || new URLSearchParams();
    searchParams.set('doNotSkipToActiveRequest', 'true');
  }

  const search = buildSearchString(searchParams);
  return `${url}${search}`;
};

const buildRunnerTabId = (workspaceId: string, folderId?: string) => {
  return folderId ? `runner_${folderId}` : `runner_${workspaceId}`;
};

export const buildRunnerTab = (params: {
  organizationId: string;
  projectId: string;
  workspaceId: string;
  projectName: string;
  workspaceName: string;
  folderId?: string;
  searchParams?: URLSearchParams | Record<string, string>;
}): BaseTab => {
  const { organizationId, projectId, workspaceId, projectName, workspaceName, folderId, searchParams } = params;
  const runnerSearchParams = buildRunnerSearchParams(folderId, searchParams);
  const url = buildTabUrl('runner', { organizationId, projectId, workspaceId, searchParams: runnerSearchParams });
  return {
    type: 'runner',
    id: buildRunnerTabId(workspaceId, runnerSearchParams.get('folder') || undefined),
    name: 'Runner',
    url,
    organizationId,
    projectId,
    workspaceId,
    projectName,
    workspaceName,
  };
};

export const buildTabFromResource = async (params: AddTabParams): Promise<BaseTab | null> => {
  const { resource, organizationId, projectId, workspaceId, projectName, workspaceName, searchParams } = params;
  const effectiveWorkspaceId = workspaceId ?? resource._id;
  const type = inferTabType(resource);
  const url = buildTabUrl(type, {
    organizationId,
    projectId,
    workspaceId: effectiveWorkspaceId,
    resourceId: resource._id,
    searchParams,
  });

  const baseTab: BaseTab = {
    type,
    id: resource._id,
    name: resource.name,
    url,
    organizationId,
    projectId,
    workspaceId: effectiveWorkspaceId,
    projectName,
    workspaceName,
  };

  if (isWorkspace(resource) && resource.scope === 'mcp') {
    const mcpRequestData = await mcpRequest.getByParentId(resource._id);

    if (!mcpRequestData) {
      showResourceNotFoundToast(`MCP Request not found for workspace: ${resource._id}`);
      return null;
    }

    baseTab.id = mcpRequestData._id;
    baseTab.type = 'request';
    baseTab.tag = 'mcp';
    baseTab.url = buildTabUrl('request', {
      organizationId,
      projectId,
      workspaceId: effectiveWorkspaceId,
      resourceId: mcpRequestData._id,
    });
  }

  if (isRequest(resource) || isGrpcRequest(resource) || isWebSocketRequest(resource) || isSocketIORequest(resource)) {
    baseTab.tag = getRequestMethodShortHand(resource);
    baseTab.method = (resource as Request).method || '';
  }

  if (isMockRoute(resource)) {
    baseTab.tag = formatMethodName(resource.method);
    baseTab.method = resource.method;
  }

  return baseTab;
};

export const useTabNavigate = () => {
  const navigate = useNavigate();
  const { addTab } = useInsomniaTabContext();
  const tabNavigate = useCallback(
    async (
      {
        organization,
        project,
        workspace,
        item,
      }: {
        organization: Pick<Organization, 'id'> | string;
        project: Pick<Project, '_id' | 'name'>;
        workspace: Pick<Workspace, '_id' | 'name'>;
        item: TabResource;
      },
      options: {
        isRunner?: boolean;
        navigateTo?: boolean;
        withTab?: boolean;
        searchParams?: URLSearchParams;
      },
    ) => {
      const { navigateTo = false, withTab = false, isRunner = false, searchParams } = options;

      const tab = isRunner
        ? buildRunnerTab({
            organizationId: typeof organization === 'string' ? organization : organization.id,
            projectId: project._id,
            workspaceId: workspace._id,
            projectName: project.name,
            workspaceName: workspace.name,
            folderId: item.type === 'RequestGroup' ? item._id : undefined,
            searchParams,
          })
        : await buildTabFromResource({
            resource: item,
            organizationId: typeof organization === 'string' ? organization : organization.id,
            projectId: project._id,
            workspaceId: workspace._id,
            projectName: project.name,
            workspaceName: workspace.name,
            searchParams,
          });

      if (!tab) {
        return;
      }

      if (withTab) {
        addTab(tab, {
          setActive: navigateTo,
        });
      }

      if (navigateTo) {
        navigate(tab.url);
      }
    },
    [addTab, navigate],
  );
  return tabNavigate;
};

/**
 * Hook to sync active tab status with the current route.
 */
export const useInsomniaTab = ({ organizationId }: InsomniaTabProps) => {
  const { appTabsRef, changeActiveTab, closeTabById } = useInsomniaTabContext();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Determine tab type from current URL path
  const getTabType = useCallback((pathname: string): TabType | null => {
    const tabTypes = Object.keys(TAB_ROUTER_PATH) as TabType[];
    for (const type of tabTypes) {
      const ifMatch = matchPath(
        {
          path: TAB_ROUTER_PATH[type],
          end: TAB_ROUTE_MATCH_END[type] ?? true,
        },
        pathname,
      );
      if (ifMatch) {
        return type;
      }
    }
    return null;
  }, []);

  // Get runner tab ID (may include folder param)
  const getRunnerTabId = useCallback(
    (workspaceId: string) => {
      const folderId = searchParams.get('folder');
      if (folderId) {
        return buildRunnerTabId(workspaceId, folderId);
      }
      return buildRunnerTabId(workspaceId);
    },
    [searchParams],
  );
  const tabType = useMemo(() => getTabType(location.pathname), [getTabType, location.pathname]);

  const expectedTabId = useMemo(() => {
    if (!tabType) {
      return null;
    }

    const match = matchPath(
      {
        path: TAB_ROUTER_PATH[tabType],
        end: TAB_ROUTE_MATCH_END[tabType] ?? true,
      },
      location.pathname,
    );

    if (!match) {
      return null;
    }

    const { params } = match;

    if (tabType === 'runner') {
      if (!params.workspaceId) {
        return null;
      }
      return getRunnerTabId(params.workspaceId);
    }

    switch (tabType) {
      case 'collection':
      case 'environment':
      case 'mockServer':
      case 'test':
      case 'document': {
        return params.workspaceId;
      }
      case 'folder': {
        return params.requestGroupId;
      }
      case 'request': {
        return params.requestId;
      }
      case 'mockRoute': {
        return params.mockRouteId;
      }
      case 'testSuite': {
        return params.testSuiteId;
      }
      default: {
        return null;
      }
    }
  }, [getRunnerTabId, location.pathname, tabType]);

  const currentTabList = appTabsRef?.current?.[organizationId]?.tabList;

  const findMatchingTab = useCallback(() => {
    if (!currentTabList || !tabType || !expectedTabId) return null;

    return currentTabList.find(tab => tab.type === tabType && tab.id === expectedTabId) || null;
  }, [currentTabList, expectedTabId, tabType]);

  // Sync active tab with current route (only activates existing tabs, never creates)
  useEffect(() => {
    const matchingTab = findMatchingTab();

    console.log('[debug]', {
      matchingTab,
    });

    // If there's an existing tab for this route, make it active
    const currentActiveTabId = appTabsRef?.current?.[organizationId]?.activeTabId;
    if (currentActiveTabId !== matchingTab?.id) {
      changeActiveTab(matchingTab?.id ?? '', { navigate: false });
    }
    // If no matching tab, don't create one - tabs are only created via explicit actions
  }, [appTabsRef, changeActiveTab, findMatchingTab, organizationId]);

  // Keyboard shortcut to close current tab
  useDocBodyKeyboardShortcuts({
    close_tab: event => {
      event.preventDefault();
      const currentActiveTabId = appTabsRef?.current?.[organizationId]?.activeTabId;
      if (currentActiveTabId) {
        closeTabById(currentActiveTabId);
      }
    },
  });
};
