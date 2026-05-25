import type { Organization } from 'insomnia-api';
import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';

import type { Project, Request, Workspace } from '~/insomnia-data';
import { models, services } from '~/insomnia-data';
import { formatMethodName, getRequestMethodShortHand } from '~/ui/components/tags/method-tag';
import { showResourceNotFoundToast } from '~/ui/components/toast-notification';

import { useDocBodyKeyboardShortcuts } from '../components/keydown-binder';
import type { BaseTab, TabType } from '../components/tabs/tab';
import { useInsomniaTabContext } from '../context/app/insomnia-tab-context';
import {
  buildResourceUrl,
  type InsomniaNavigationRouteInfo,
  type NavigationResource,
  type NavigationResources,
  useInsomniaNavigation,
} from './use-insomnia-navigation';

const { isRequest } = models.request;
const { isRequestGroup } = models.requestGroup;

interface InsomniaTabProps {
  organizationId: string;
}

type TabResource = Exclude<NavigationResource, Project | undefined>;

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
export const buildRunnerTabId = (workspaceId: string, folderId?: string | null) => {
  return folderId ? `runner_${folderId}` : `runner_${workspaceId}`;
};

// Note: runner tab is a special case that doesn't directly correspond to a single resource
const buildRunnerTab = ({
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
  const nextSearchParams = new URLSearchParams(searchParams);
  if (folderId) {
    nextSearchParams.set('folder', folderId);
  }
  const url = `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/runner${
    nextSearchParams.toString() ? `?${nextSearchParams.toString()}` : ''
  }`;
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

const buildTabUrlFromResource = ({
  resource,
  organizationId,
  projectId,
  workspaceId,
  searchParams,
  withTab,
}: {
  resource: TabResource;
  organizationId: string;
  projectId: string;
  workspaceId: string;
  searchParams?: URLSearchParams;
  withTab?: boolean;
}) => {
  const type = inferTabType(resource);
  if (!type) {
    return '';
  }

  const nextSearchParams = new URLSearchParams(searchParams);
  if (type === 'collection' && withTab) {
    nextSearchParams.set('doNotSkipToActiveRequest', 'true');
  }

  return buildResourceUrl({
    organizationId,
    projectId,
    workspaceId,
    resource,
    searchParams: nextSearchParams,
  });
};

const buildTabFromResource = async (params: AddTabParams, withTab?: boolean): Promise<BaseTab | null> => {
  const { resource, organizationId, projectId, workspaceId, projectName, workspaceName, searchParams } = params;
  const effectiveWorkspaceId = workspaceId ?? resource._id;
  const type = inferTabType(resource);

  if (!type) return null;

  const url = buildTabUrlFromResource({
    resource,
    organizationId,
    projectId,
    workspaceId: effectiveWorkspaceId,
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
    baseTab.url = buildTabUrlFromResource({
      resource: mcpRequestData,
      organizationId,
      projectId,
      workspaceId: effectiveWorkspaceId,
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

const buildTabFromNavigation = async (
  routeInfo: InsomniaNavigationRouteInfo,
  getNavigationResources: () => Promise<NavigationResources>,
): Promise<BaseTab | null> => {
  const { project, workspace, resource } = await getNavigationResources();

  if (!project || !workspace || !resource || models.project.isProject(resource)) {
    return null;
  }

  if (routeInfo.routeId === 'runner') {
    return buildRunnerTab({
      organizationId: routeInfo.organizationId,
      projectId: project._id,
      workspaceId: workspace._id,
      projectName: project.name,
      workspaceName: workspace.name,
      folderId: routeInfo.searchParams.get('folder'),
    });
  }

  return await buildTabFromResource({
    resource,
    organizationId: routeInfo.organizationId,
    projectId: project._id,
    workspaceId: workspace._id,
    projectName: project.name,
    workspaceName: workspace.name,
  });
};

const getNavigationTabId = async (routeInfo?: InsomniaNavigationRouteInfo | null) => {
  if (!routeInfo || !routeInfo.workspaceId || !routeInfo.resourceId) {
    return null;
  }

  return routeInfo.routeId === 'runner'
    ? buildRunnerTabId(routeInfo.workspaceId, routeInfo.searchParams.get('folder'))
    : routeInfo.resourceId;
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

export const useInsomniaTab = ({ organizationId }: InsomniaTabProps) => {
  const { appTabsRef, changeActiveTab, closeTabById, addTemporaryTab } = useInsomniaTabContext();
  const { routeInfo, getNavigationResources } = useInsomniaNavigation();

  // Sync active tab with current route (only activates existing tabs, or creates/updates temporary tab if no match)
  useEffect(() => {
    const currentOrgTab = appTabsRef?.current?.[organizationId];
    const currentTabList = currentOrgTab?.tabList;
    const currentActiveTabId = currentOrgTab?.activeTabId;

    (async () => {
      const routeTabId = await getNavigationTabId(routeInfo);
      const matchingTab = (routeTabId && currentTabList?.find(tab => tab.id === routeTabId)) || null;

      if (!matchingTab && routeInfo) {
        const newTemporaryTab = await buildTabFromNavigation(routeInfo, getNavigationResources);

        if (newTemporaryTab) {
          addTemporaryTab(newTemporaryTab, { setActive: true });
          return;
        }
      }

      if (currentActiveTabId !== matchingTab?.id) {
        changeActiveTab(matchingTab?.id ?? '');
      }
    })();
  }, [addTemporaryTab, appTabsRef, changeActiveTab, getNavigationResources, organizationId, routeInfo]);

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
