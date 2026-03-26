import type { Organization } from 'insomnia-api';
import { useCallback, useEffect, useMemo } from 'react';
import { href, matchPath, useLocation, useNavigate, useSearchParams } from 'react-router';

import { database } from '~/common/database';
import type {
  GrpcRequest,
  McpRequest,
  MockRoute,
  MockServer,
  Project,
  SocketIORequest,
  UnitTestSuite,
  WebSocketRequest,
  Workspace,
} from '~/insomnia-data';
import { models, services } from '~/insomnia-data';
import * as requestOperations from '~/models/helpers/request-operations';
import { isRequest, type Request } from '~/models/request';
import { isRequestGroup, type RequestGroup } from '~/models/request-group';
import { formatMethodName, getRequestMethodShortHand } from '~/ui/components/tags/method-tag';
import { showResourceNotFoundToast } from '~/ui/components/toast-notification';

import { useDocBodyKeyboardShortcuts } from '../components/keydown-binder';
import type { BaseTab, TabType } from '../components/tabs/tab';
import { useInsomniaTabContext } from '../context/app/insomnia-tab-context';

interface InsomniaTabProps {
  organizationId: string;
}

type TabResource =
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
  workspaceId: string;
  projectName: string;
  workspaceName: string;
  searchParams?: URLSearchParams;
}

// Utility function to infer tab type from resource
function inferTabType(resource: TabResource): TabType | null {
  if (
    isRequest(resource) ||
    models.grpcRequest.isGrpcRequest(resource) ||
    models.webSocketRequest.isWebSocketRequest(resource) ||
    models.socketIORequest.isSocketIORequest(resource) ||
    models.mcpRequest.isMcpRequest(resource)
  ) {
    return 'request';
  }
  if (isRequestGroup(resource)) {
    return 'folder';
  }
  if (models.mockRoute.isMockRoute(resource)) {
    return 'mockRoute';
  }
  if (models.unitTestSuite.isUnitTestSuite(resource)) {
    return 'testSuite';
  }
  if (models.workspace.isWorkspace(resource)) {
    if (models.workspace.isDesign(resource)) {
      return 'document';
    }
    if (models.workspace.isMockServer(resource)) {
      return 'mockServer';
    }
    if (models.workspace.isEnvironment(resource)) {
      return 'environment';
    }
    return 'collection';
  }
  return null;
}

export const TAB_ROUTER_PATH = {
  folder: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request-group/:requestGroupId',
  request: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request/:requestId',
  environment: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/environment',
  mockServer: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/mock-server',
  runner: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/runner',
  document: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/spec',
  mockRoute:
    '/organization/:organizationId/project/:projectId/workspace/:workspaceId/mock-server/mock-route/:mockRouteId',
  testSuite: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/test/test-suite/:testSuiteId',
  test: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/test',
  collection: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug',
} as const;

const TAB_ROUTE_MATCH_END: Partial<Record<TabType, boolean>> = {
  testSuite: false,
};

const buildSearchString = (searchParams: URLSearchParams) => {
  const search = searchParams.toString();
  return search ? `?${search}` : '';
};

// Build tab URL based on type and params
const buildTabUrl = (
  type: TabType,
  {
    organizationId,
    projectId,
    workspaceId,
    resourceId,
    searchParams,
    withTab,
  }: {
    organizationId: string;
    projectId: string;
    workspaceId: string;
    resourceId: string;
    searchParams?: URLSearchParams;
    withTab?: boolean;
  },
): string => {
  const url = (() => {
    switch (type) {
      case 'request': {
        return href(TAB_ROUTER_PATH.request, {
          organizationId,
          projectId,
          workspaceId,
          requestId: resourceId,
        });
      }
      case 'folder': {
        return href(TAB_ROUTER_PATH.folder, {
          organizationId,
          projectId,
          workspaceId,
          requestGroupId: resourceId,
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
          mockRouteId: resourceId,
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
          testSuiteId: resourceId,
        });
      }
      case 'runner': {
        return href(TAB_ROUTER_PATH.runner, { organizationId, projectId, workspaceId });
      }
      default: {
        return href(TAB_ROUTER_PATH.collection, { organizationId, projectId, workspaceId });
      }
    }
  })();

  const newSearchParams = new URLSearchParams(searchParams);
  // Ensure we do not skip to active request when opening a permanent collection tab
  if (type === 'collection' && withTab) {
    newSearchParams.set('doNotSkipToActiveRequest', 'true');
  }

  const search = buildSearchString(newSearchParams);
  return `${url}${search}`;
};

export const buildRunnerTabId = (workspaceId: string, folderId?: string | null) => {
  return folderId ? `runner_${folderId}` : `runner_${workspaceId}`;
};

// Note: runner tab is a special case that doesn't directly correspond to a single resource
export const buildRunnerTab = ({
  organizationId,
  projectId,
  workspaceId,
  projectName,
  workspaceName,
  folderId,
  searchParams = new URLSearchParams(),
}: {
  organizationId: string;
  projectId: string;
  workspaceId: string;
  projectName: string;
  workspaceName: string;
  folderId?: string | null;
  searchParams?: URLSearchParams;
}): BaseTab => {
  if (folderId) {
    searchParams.set('folder', folderId);
  }
  const url = buildTabUrl('runner', {
    organizationId,
    projectId,
    workspaceId,
    resourceId: folderId || workspaceId,
    searchParams,
  });
  return {
    type: 'runner',
    id: buildRunnerTabId(workspaceId, folderId),
    name: 'Runner',
    url,
    organizationId,
    projectId,
    workspaceId,
    projectName,
    workspaceName,
  };
};

export const buildTabFromResource = async (params: AddTabParams, withTab?: boolean): Promise<BaseTab | null> => {
  const { resource, organizationId, projectId, workspaceId, projectName, workspaceName, searchParams } = params;
  const effectiveWorkspaceId = workspaceId ?? resource._id;
  const type = inferTabType(resource);

  if (!type) return null;

  const url = buildTabUrl(type, {
    organizationId,
    projectId,
    workspaceId: effectiveWorkspaceId,
    resourceId: resource._id,
    searchParams,
    withTab,
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

  if (models.workspace.isWorkspace(resource) && resource.scope === 'mcp') {
    const mcpRequestData = await services.mcpRequest.getByParentId(resource._id);

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

  if (
    isRequest(resource) ||
    models.grpcRequest.isGrpcRequest(resource) ||
    models.webSocketRequest.isWebSocketRequest(resource) ||
    models.socketIORequest.isSocketIORequest(resource)
  ) {
    baseTab.tag = getRequestMethodShortHand(resource);
    baseTab.method = (resource as Request).method || '';
  }

  if (models.mockRoute.isMockRoute(resource)) {
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
        withTab?: boolean;
        shouldNavigate?: boolean;
        asRunner?: boolean;
        searchParams?: URLSearchParams;
      },
    ) => {
      const { shouldNavigate = false, withTab = false, asRunner = false, searchParams } = options;
      const organizationId = typeof organization === 'string' ? organization : organization.id;

      const tab = asRunner
        ? buildRunnerTab({
            organizationId,
            projectId: project._id,
            workspaceId: workspace._id,
            projectName: project.name,
            workspaceName: workspace.name,
            folderId: item.type === 'RequestGroup' ? item._id : undefined,
            searchParams,
          })
        : await buildTabFromResource(
            {
              resource: item,
              organizationId,
              projectId: project._id,
              workspaceId: workspace._id,
              projectName: project.name,
              workspaceName: workspace.name,
              searchParams,
            },
            withTab,
          );
      if (!tab) return;

      if (withTab) {
        addTab(tab);
      }
      if (shouldNavigate) {
        navigate(tab.url);
      }
    },
    [addTab, navigate],
  );
  return tabNavigate;
};

// Determine tab type from current URL path
const getTabType = (pathname: string): TabType | null => {
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
};

const extractTabInfoFromUrl = (pathname: string, searchParams: URLSearchParams) => {
  const tabType = getTabType(pathname);
  if (!tabType) return null;

  const match = matchPath(
    {
      path: TAB_ROUTER_PATH[tabType],
      end: TAB_ROUTE_MATCH_END[tabType] ?? true,
    },
    pathname,
  );
  if (!match) return null;

  const { params } = match;
  if (!params.organizationId || !params.projectId || !params.workspaceId) return null;

  const id = (() => {
    switch (tabType) {
      case 'runner': {
        return buildRunnerTabId(params.workspaceId, searchParams.get('folder'));
      }
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
  })();
  if (!id) return null;

  return {
    id,
    organizationId: params.organizationId,
    projectId: params.projectId,
    workspaceId: params.workspaceId,
    tabType,
  };
};

// Build tab info from URL (used for temporary tabs when navigating to a route without an existing tab)
const buildTabFromUrl = async (pathname: string, searchParams: URLSearchParams): Promise<BaseTab | null> => {
  const tabInfo = extractTabInfoFromUrl(pathname, searchParams);
  if (!tabInfo) return null;

  const { id, tabType, organizationId, projectId, workspaceId } = tabInfo;

  const project = await database.findOne('Project', { _id: projectId });
  const workspace = await database.findOne('Workspace', { _id: workspaceId });
  if (!project || !workspace) return null;

  const resource = await (async () => {
    switch (tabType) {
      case 'request': {
        return await requestOperations.getById(id);
      }
      case 'folder': {
        return await database.findOne('RequestGroup', { _id: id });
      }
      case 'environment':
      case 'mockServer':
      case 'document':
      case 'collection':
      case 'test': {
        return await database.findOne('Workspace', { _id: id });
      }
      case 'runner': {
        return await database.findOne('Workspace', { _id: workspaceId });
      }
      case 'mockRoute': {
        return await database.findOne('MockRoute', { _id: id });
      }
      case 'testSuite': {
        return await database.findOne('UnitTestSuite', { _id: id });
      }
      default: {
        return null;
      }
    }
  })();
  if (!resource) return null;

  return tabType === 'runner'
    ? buildRunnerTab({
        organizationId,
        projectId,
        workspaceId,
        projectName: project.name,
        workspaceName: workspace.name,
        folderId: searchParams.get('folder'),
      })
    : await buildTabFromResource({
        resource: resource as TabResource,
        organizationId,
        projectId,
        workspaceId,
        projectName: project.name,
        workspaceName: workspace.name,
      });
};

/**
 * Hook to sync active tab status with the current route.
 */
export const useInsomniaTab = ({ organizationId }: InsomniaTabProps) => {
  const { appTabsRef, changeActiveTab, closeTabById, addTemporaryTab } = useInsomniaTabContext();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const tabInfoFromUrl = useMemo(
    () => extractTabInfoFromUrl(location.pathname, searchParams),
    [location.pathname, searchParams],
  );

  // Sync active tab with current route (only activates existing tabs, or creates/updates temporary tab if no match)
  useEffect(() => {
    const currentOrgTab = appTabsRef?.current?.[organizationId];
    const currentTabList = currentOrgTab?.tabList;
    const currentActiveTabId = currentOrgTab?.activeTabId;
    const matchingTab = (tabInfoFromUrl && currentTabList?.find(tab => tab.id === tabInfoFromUrl.id)) || null;

    (async () => {
      if (!matchingTab) {
        // If no existing tab for this route, create/update the temporary tab
        const newTemporaryTab = await buildTabFromUrl(location.pathname, searchParams);

        if (newTemporaryTab) {
          addTemporaryTab(newTemporaryTab, { setActive: true });
          return;
        }
      }

      if (currentActiveTabId !== matchingTab?.id) {
        // If there's an existing tab for this route, make it active
        changeActiveTab(matchingTab?.id ?? '');
      }
    })();
  }, [addTemporaryTab, appTabsRef, changeActiveTab, location.pathname, tabInfoFromUrl, organizationId, searchParams]);

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
