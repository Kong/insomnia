import { useCallback, useEffect } from 'react';
import { matchPath, useLocation } from 'react-router-dom';

import type { GrpcRequest } from '../../models/grpc-request';
import type { MockRoute } from '../../models/mock-route';
import type { Project } from '../../models/project';
import type { Request } from '../../models/request';
import type { RequestGroup } from '../../models/request-group';
import type { UnitTestSuite } from '../../models/unit-test-suite';
import type { WebSocketRequest } from '../../models/websocket-request';
import type { Workspace } from '../../models/workspace';
import { type BaseTab, TabEnum } from '../components/tabs/tab';
import { TAB_ROUTER_PATH } from '../components/tabs/tabList';
import { formatMethodName, getRequestMethodShortHand } from '../components/tags/method-tag';
import { useInsomniaTabContext } from '../context/app/insomnia-tab-context';

interface InsomniaTabProps {
  organizationId: string;
  projectId: string;
  workspaceId: string;
  activeProject: Project;
  activeWorkspace: Workspace;
  activeRequest?: Request | GrpcRequest | WebSocketRequest;
  activeRequestGroup?: RequestGroup;
  activeMockRoute?: MockRoute;
  unitTestSuite?: UnitTestSuite;
}

export const useInsomniaTab = ({
  organizationId,
  projectId,
  workspaceId,
  activeProject,
  activeWorkspace,
  activeRequest,
  activeRequestGroup,
  activeMockRoute,
  unitTestSuite,
}: InsomniaTabProps) => {

  const { appTabsRef, addTab, changeActiveTab } = useInsomniaTabContext();
  const location = useLocation();

  const generateTabUrl = useCallback((type: TabEnum) => {
    if (type === TabEnum.Request) {
      return `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${activeRequest?._id}`;
    }

    if (type === TabEnum.Folder) {
      return `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request-group/${activeRequestGroup?._id}`;
    }

    if (type === TabEnum.Collection) {
      return `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug?doNotSkipToActiveRequest=true`;
    }

    if (type === TabEnum.Env) {
      return `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/environment`;
    }

    if (type === TabEnum.Runner) {
      return `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/runner${location.search}`;
    }

    if (type === TabEnum.Mock) {
      return `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/mock-server`;
    }

    if (type === TabEnum.MockRoute) {
      return `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/mock-server/mock-route/${activeMockRoute?._id}`;
    }

    if (type === TabEnum.Document) {
      return `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/spec`;
    }

    if (type === TabEnum.TEST) {
      return `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test`;
    }

    if (type === TabEnum.TESTSUITE) {
      return `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuite?._id}`;
    }
    return '';
  }, [activeMockRoute?._id, activeRequest?._id, activeRequestGroup?._id, location.search, organizationId, projectId, unitTestSuite?._id, workspaceId]);

  const getTabType = (pathname: string) => {
    for (const type in TAB_ROUTER_PATH) {
      const ifMatch = matchPath({
        path: TAB_ROUTER_PATH[type as TabEnum],
        end: true,
      }, pathname);
      if (ifMatch) {
        return type as TabEnum;
      }
    }

    return null;
  };

  const getCurrentTab = useCallback((type: TabEnum | null) => {
    if (!type) {
      return undefined;
    }
    const currentOrgTabs = appTabsRef?.current?.[organizationId];
    if (type === TabEnum.Request) {
      return currentOrgTabs?.tabList.find(tab => tab.id === activeRequest?._id);
    }

    if (type === TabEnum.Folder) {
      return currentOrgTabs?.tabList.find(tab => tab.id === activeRequestGroup?._id);
    }

    if (type === TabEnum.Runner) {
      // collection runner tab id is prefixed with 'runner_'
      return currentOrgTabs?.tabList.find(tab => tab.id === `runner_${workspaceId}`);
    }

    if (type === TabEnum.MockRoute) {
      return currentOrgTabs?.tabList.find(tab => tab.id === activeMockRoute?._id);
    }

    if (type === TabEnum.TESTSUITE) {
      return currentOrgTabs?.tabList.find(tab => tab.id === unitTestSuite?._id);
    }

    if ([TabEnum.Collection, TabEnum.Document, TabEnum.Env, TabEnum.Mock, TabEnum.TEST].includes(type)) {
      return currentOrgTabs?.tabList.find(tab => tab.id === workspaceId);
    }
    return undefined;
  }, [activeMockRoute?._id, activeRequest?._id, activeRequestGroup?._id, appTabsRef, organizationId, unitTestSuite?._id, workspaceId]);

  const getTabId = useCallback((type: TabEnum | null): string => {
    if (!type) {
      return '';
    }
    if (type === TabEnum.Request) {
      return activeRequest?._id || '';
    }

    if (type === TabEnum.Folder) {
      return activeRequestGroup?._id || '';
    }

    if (type === TabEnum.Runner) {
      return `runner_${workspaceId}`;
    }

    if (type === TabEnum.MockRoute) {
      return activeMockRoute?._id || '';
    }

    if (type === TabEnum.TESTSUITE) {
      return unitTestSuite?._id || '';
    }

    if ([TabEnum.Collection, TabEnum.Document, TabEnum.Env, TabEnum.Mock, TabEnum.TEST].includes(type)) {
      return workspaceId;
    }

    return '';
  }, [activeMockRoute?._id, activeRequest?._id, activeRequestGroup?._id, unitTestSuite?._id, workspaceId]);

  const packTabInfo = useCallback((type: TabEnum): BaseTab | undefined => {
    if (!type) {
      return undefined;
    }
    if (type === TabEnum.Request) {
      return {
        type,
        name: activeRequest?.name || 'New Request',
        url: generateTabUrl(type),
        organizationId: organizationId,
        projectId: projectId,
        workspaceId: workspaceId,
        id: getTabId(type),
        projectName: activeProject.name,
        workspaceName: activeWorkspace.name,
        tag: getRequestMethodShortHand(activeRequest),
        method: (activeRequest as Request)?.method || '',
      };
    }

    if (type === TabEnum.Folder) {
      return {
        type,
        name: activeRequestGroup?.name || 'My Folder',
        url: generateTabUrl(type),
        organizationId: organizationId,
        projectId: projectId,
        workspaceId: workspaceId,
        id: getTabId(type),
        projectName: activeProject.name,
        workspaceName: activeWorkspace.name,
      };
    }

    if ([TabEnum.Collection, TabEnum.Document, TabEnum.Env, TabEnum.Mock, TabEnum.TEST].includes(type)) {
      return {
        type,
        name: activeWorkspace.name,
        url: generateTabUrl(type),
        organizationId: organizationId,
        projectId: projectId,
        workspaceId: workspaceId,
        id: getTabId(type),
        projectName: activeProject.name,
        workspaceName: activeWorkspace.name,
      };
    }

    if (type === TabEnum.Runner) {
      return {
        type,
        name: 'Runner',
        url: generateTabUrl(type),
        organizationId: organizationId,
        projectId: projectId,
        workspaceId: workspaceId,
        id: getTabId(type),
        projectName: activeProject.name,
        workspaceName: activeWorkspace.name,
      };
    }

    if (type === TabEnum.MockRoute) {
      return {
        type,
        name: activeMockRoute?.name || 'Untitled mock route',
        url: generateTabUrl(type),
        organizationId: organizationId,
        projectId: projectId,
        workspaceId: workspaceId,
        id: getTabId(type),
        tag: formatMethodName(activeMockRoute?.method || ''),
        projectName: activeProject.name,
        workspaceName: activeWorkspace.name,
        method: activeMockRoute?.method || '',
      };
    }

    if (type === TabEnum.TESTSUITE) {
      return {
        type,
        name: unitTestSuite?.name || 'Untitled test suite',
        url: generateTabUrl(type),
        organizationId: organizationId,
        projectId: projectId,
        workspaceId: workspaceId,
        id: getTabId(type),
        projectName: activeProject.name,
        workspaceName: activeWorkspace.name,
      };
    }

    return;
  }, [activeMockRoute?.method, activeMockRoute?.name, activeProject.name, activeRequest, activeRequestGroup?.name, activeWorkspace.name, generateTabUrl, getTabId, organizationId, projectId, unitTestSuite?.name, workspaceId]);

  useEffect(() => {
    const type = getTabType(location.pathname);
    const currentTab = getCurrentTab(type);
    if (!currentTab && type) {
      const tabInfo = packTabInfo(type);
      if (tabInfo) {
        addTab(tabInfo);
        return;
      }
    }

    // keep active tab in sync with the current route
    if (currentTab) {
      const currentActiveTabId = appTabsRef?.current?.[organizationId]?.activeTabId;
      if (currentActiveTabId !== currentTab.id) {
        changeActiveTab(currentTab.id);
      }
    }
  }, [addTab, appTabsRef, changeActiveTab, getCurrentTab, location.pathname, location.search, organizationId, packTabInfo]);
};
