import { useCallback, useEffect } from 'react';
import { matchPath, useLocation, useSearchParams } from 'react-router-dom';

import type { GrpcRequest } from '../../models/grpc-request';
import type { MockRoute } from '../../models/mock-route';
import type { Project } from '../../models/project';
import type { Request } from '../../models/request';
import type { RequestGroup } from '../../models/request-group';
import type { UnitTestSuite } from '../../models/unit-test-suite';
import type { WebSocketRequest } from '../../models/websocket-request';
import type { Workspace } from '../../models/workspace';
import { type BaseTab, type TabType } from '../components/tabs/tab';
import { TAB_ROUTER_PATH } from '../components/tabs/tab-list';
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
  const [searchParams] = useSearchParams();

  const generateTabUrl = useCallback((type: TabType) => {
    if (type === 'request') {
      return `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${activeRequest?._id}`;
    }

    if (type === 'folder') {
      return `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request-group/${activeRequestGroup?._id}`;
    }

    if (type === 'collection') {
      return `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug?doNotSkipToActiveRequest=true`;
    }

    if (type === 'environment') {
      return `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/environment`;
    }

    if (type === 'runner') {
      return `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/runner${location.search}`;
    }

    if (type === 'mockServer') {
      return `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/mock-server`;
    }

    if (type === 'mockRoute') {
      return `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/mock-server/mock-route/${activeMockRoute?._id}`;
    }

    if (type === 'document') {
      return `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/spec`;
    }

    if (type === 'test') {
      return `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test`;
    }

    if (type === 'testSuite') {
      return `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuite?._id}`;
    }
    return '';
  }, [activeMockRoute?._id, activeRequest?._id, activeRequestGroup?._id, location.search, organizationId, projectId, unitTestSuite?._id, workspaceId]);

  const getTabType = (pathname: string): TabType | null => {
    for (const type in TAB_ROUTER_PATH) {
      const ifMatch = matchPath({
        path: TAB_ROUTER_PATH[type as TabType],
        end: true,
      }, pathname);
      if (ifMatch) {
        return type as TabType;
      }
    }

    return null;
  };

  const getRunnerTabId = useCallback(() => {
    const folderId = searchParams.get('folder');
    if (folderId) {
      return `runner_${folderId}`;
    }
    return `runner_${workspaceId}`;
  }, [searchParams, workspaceId]);

  const getCurrentTab = useCallback((type: TabType | null) => {
    if (!type) {
      return undefined;
    }
    const currentOrgTabs = appTabsRef?.current?.[organizationId];
    if (type === 'request') {
      return currentOrgTabs?.tabList.find(tab => tab.id === activeRequest?._id);
    }

    if (type === 'folder') {
      return currentOrgTabs?.tabList.find(tab => tab.id === activeRequestGroup?._id);
    }

    if (type === 'runner') {
      // collection runner tab id is prefixed with 'runner_'
      const runnerTabId = getRunnerTabId();
      return currentOrgTabs?.tabList.find(tab => tab.id === runnerTabId);
    }

    if (type === 'mockRoute') {
      return currentOrgTabs?.tabList.find(tab => tab.id === activeMockRoute?._id);
    }

    if (type === 'testSuite') {
      return currentOrgTabs?.tabList.find(tab => tab.id === unitTestSuite?._id);
    }

    const collectionTabTypes: TabType[] = ['collection', 'document', 'environment', 'mockServer', 'test'];
    if (collectionTabTypes.includes(type)) {
      return currentOrgTabs?.tabList.find(tab => tab.id === workspaceId);
    }
    return undefined;
  }, [activeMockRoute?._id, activeRequest?._id, activeRequestGroup?._id, appTabsRef, getRunnerTabId, organizationId, unitTestSuite?._id, workspaceId]);

  const getTabId = useCallback((type: TabType | null): string => {
    if (!type) {
      return '';
    }
    if (type === 'request') {
      return activeRequest?._id || '';
    }

    if (type === 'folder') {
      return activeRequestGroup?._id || '';
    }

    if (type === 'runner') {
      const runnerTabId = getRunnerTabId();
      return runnerTabId;
    }

    if (type === 'mockRoute') {
      return activeMockRoute?._id || '';
    }

    if (type === 'testSuite') {
      return unitTestSuite?._id || '';
    }
    const collectionTabTypes: TabType[] = ['collection', 'document', 'environment', 'mockServer', 'test'];
    if (collectionTabTypes.includes(type)) {
      return workspaceId;
    }

    return '';
  }, [activeMockRoute?._id, activeRequest?._id, activeRequestGroup?._id, getRunnerTabId, unitTestSuite?._id, workspaceId]);

  const packTabInfo = useCallback((type: TabType): BaseTab | undefined => {
    if (!type) {
      return undefined;
    }
    if (type === 'request') {
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

    if (type === 'folder') {
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

    const collectionTabTypes: TabType[] = ['collection', 'document', 'environment', 'mockServer', 'test'];
    if (collectionTabTypes.includes(type)) {
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

    if (type === 'runner') {
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

    if (type === 'mockRoute') {
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

    if (type === 'testSuite') {
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
  }, [addTab, appTabsRef, changeActiveTab, getCurrentTab, location.pathname, organizationId, packTabInfo]);
};
