import React, { createContext, type FC, type PropsWithChildren, useCallback, useContext, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import * as reactUse from 'react-use';

import { isScratchpadOrganizationId } from '../../../models/organization';
import type { BaseTab } from '../../components/tabs/tab';
import type { OrganizationTabs } from '../../components/tabs/tab-list';
import uiEventBus from '../../event-bus';

interface UpdateInsomniaTabParams {
  organizationId: string;
  tabList: OrganizationTabs['tabList'];
  activeTabId?: string;
}

interface CloseTabOptions {
  removeFromClosedTabs?: boolean;
  navigateOnAllClose?: boolean;
}

interface ContextProps {
  currentOrgTabs: OrganizationTabs;
  appTabsRef?: React.MutableRefObject<InsomniaTabs | undefined>;
  closeTabById: (id: string, options?: CloseTabOptions) => void;
  addTab: (tab: BaseTab, options?: { setActive?: boolean }) => void;
  changeActiveTab: (id: string, options?: { navigate: boolean }) => void;
  closeAllTabsUnderWorkspace?: (workspaceId: string, options?: CloseTabOptions) => void;
  closeAllTabsUnderProject?: (projectId: string, options?: CloseTabOptions) => void;
  batchCloseTabs?: (ids: string[], options?: CloseTabOptions) => void;
  updateProjectName?: (projectId: string, name: string) => void;
  updateWorkspaceName?: (projectId: string, name: string) => void;
  updateTabById?: (tabId: string, patches: Partial<BaseTab>) => void;
  batchUpdateTabs?: (updates: { id: string; fields: Partial<BaseTab> }[]) => void;
  closeAllTabs?: (options?: CloseTabOptions) => void;
  closeOtherTabs?: (id: string, options?: CloseTabOptions) => void;
  moveBefore?: (targetId: string, movingId: string) => void;
  moveAfter?: (targetId: string, movingId: string) => void;
  goToNextTab?: () => void;
  goToPreviousTab?: () => void;
  reopenClosedTab?: () => void;
}

const InsomniaTabContext = createContext<ContextProps>({
  currentOrgTabs: {
    tabList: [],
    activeTabId: '',
  },
  closeTabById: () => {},
  addTab: () => {},
  changeActiveTab: () => {},
});

type InsomniaTabs = Record<string, OrganizationTabs & { tabHistory?: string[] }>;

export const InsomniaTabProvider: FC<PropsWithChildren> = ({ children }) => {
  const { organizationId, projectId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };

  const [appTabs, setAppTabs] = reactUse.useLocalStorage<InsomniaTabs>('insomnia-tabs', {});

  // keep a ref of the appTabs to avoid the function recreated, which will cause the useEffect to run again and cannot delete a tab
  // file: packages/insomnia/src/ui/hooks/tab.ts
  const appTabsRef = useRef(appTabs);

  // Track recently closed tabs for reopen functionality (per organization)
  const closedTabsRef = useRef<Record<string, BaseTab[]>>({});

  const navigate = useNavigate();

  const updateInsomniaTabs = useCallback(
    ({ organizationId, tabList, activeTabId }: UpdateInsomniaTabParams) => {
      const currentOrgTabs = appTabsRef.current?.[organizationId];
      const currentTabHistory = currentOrgTabs?.tabHistory || [];
      const currentActiveTabId = currentOrgTabs?.activeTabId;

      // Centralized tabHistory management:
      // 1. Remove any tab IDs that no longer exist in tabList
      // 2. Add previous activeTabId to history if switching to a different tab
      const tabIds = new Set(tabList.map(t => t.id));
      let newTabHistory = currentTabHistory.filter(id => tabIds.has(id));

      // If activeTabId changed, add the previous one to history
      if (currentActiveTabId && currentActiveTabId !== activeTabId && tabIds.has(currentActiveTabId)) {
        // Remove if already exists to avoid duplicates, then prepend
        newTabHistory = [currentActiveTabId, ...newTabHistory.filter(id => id !== currentActiveTabId)];
      }

      const newState = {
        ...appTabsRef.current,
        [organizationId]: {
          tabList,
          activeTabId,
          tabHistory: newTabHistory,
        },
      };
      appTabsRef.current = newState;
      setAppTabs(newState);
    },
    [setAppTabs],
  );

  const addTab = useCallback(
    (tab: BaseTab, options: { setActive?: boolean } = { setActive: true }) => {
      const currentTabs = appTabsRef?.current?.[organizationId] || { tabList: [], activeTabId: '' };
      const existingTabIndex = currentTabs.tabList.findIndex(t => t.id === tab.id);

      // If the tab is reopened via other means, remove it from closed tabs memory
      const currentClosedTabs = closedTabsRef.current[organizationId] || [];
      closedTabsRef.current[organizationId] = currentClosedTabs.filter(closedTab => closedTab.id !== tab.id);

      // If tab already exists, update its properties if needed
      if (existingTabIndex !== -1) {
        const existingTab = currentTabs.tabList[existingTabIndex];

        // Only allow temporary to change from true -> false (make permanent), never false -> true
        // This prevents a permanent tab from accidentally becoming temporary again
        const shouldUpdateTemporary = existingTab.temporary === true && tab.temporary === false;
        const shouldUpdateName = existingTab.name !== tab.name;
        const needsUpdate = shouldUpdateTemporary || shouldUpdateName;
        const needsActivate = options.setActive && currentTabs.activeTabId !== tab.id;

        if (needsUpdate || needsActivate) {
          const newTabList = needsUpdate
            ? currentTabs.tabList.map((t, i) =>
                i === existingTabIndex
                  ? {
                      ...t,
                      name: tab.name,
                      // Only update temporary if changing from true to false
                      temporary: shouldUpdateTemporary ? false : t.temporary,
                    }
                  : t,
              )
            : currentTabs.tabList;

          updateInsomniaTabs({
            organizationId,
            tabList: newTabList,
            activeTabId: needsActivate ? tab.id : currentTabs.activeTabId,
          });
        }
        return;
      }

      // Calculate new tabList for new tab
      let newTabList: BaseTab[];
      const temporaryIndex = currentTabs.tabList.findIndex(t => t.temporary);
      if (tab.temporary && temporaryIndex !== -1) {
        // Replace existing temporary tab
        newTabList = [...currentTabs.tabList];
        newTabList[temporaryIndex] = tab;
      } else {
        // No existing temporary tab or not a temporary tab, just append
        newTabList = [...currentTabs.tabList, tab];
      }

      // Calculate activeTabId
      const activeTabId = options.setActive ? tab.id : currentTabs.activeTabId;

      updateInsomniaTabs({
        organizationId,
        tabList: newTabList,
        activeTabId,
      });
    },
    [organizationId, updateInsomniaTabs],
  );

  const addClosedTabs = useCallback(
    (tabs: BaseTab[]) => {
      if (!tabs.length) return;

      const currentClosedTabs = closedTabsRef.current[organizationId] || [];
      const closingIds = new Set(tabs.map(tab => tab.id));
      const filteredTabs = currentClosedTabs.filter(tab => !closingIds.has(tab.id));
      closedTabsRef.current[organizationId] = [...filteredTabs, ...tabs];
    },
    [organizationId],
  );

  const removeClosedTabsByIds = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;

      const currentClosedTabs = closedTabsRef.current[organizationId] || [];
      const idSet = new Set(ids);
      closedTabsRef.current[organizationId] = currentClosedTabs.filter(tab => !idSet.has(tab.id));
    },
    [organizationId],
  );

  const closeTabById = useCallback(
    (id: string, options: CloseTabOptions = {}) => {
      if (options.removeFromClosedTabs) {
        removeClosedTabsByIds([id]);
      }

      const currentTabs = appTabsRef?.current?.[organizationId];
      if (!currentTabs) {
        return;
      }

      if (!options.removeFromClosedTabs) {
        const closingTab = currentTabs.tabList.find(tab => tab.id === id);
        if (closingTab) {
          addClosedTabs([closingTab]);
        }
      }

      // If the tab being deleted is the only tab and is active, navigate to the project dashboard
      if (currentTabs.activeTabId === id && currentTabs.tabList.length === 1) {
        if (!isScratchpadOrganizationId(organizationId)) {
          navigate(`/organization/${organizationId}/project/${projectId}`);
        }
        updateInsomniaTabs({
          organizationId,
          tabList: [],
          activeTabId: '',
        });
        uiEventBus.emit('CLOSE_TAB', organizationId, [id]);
        return;
      }

      const index = currentTabs.tabList.findIndex(tab => tab.id === id);
      if (index === -1) {
        return;
      }
      const newTabList = currentTabs.tabList.filter(tab => tab.id !== id);
      const tabHistory = currentTabs.tabHistory || [];

      if (currentTabs.activeTabId === id) {
        // Find the last active tab from history that still exists
        const lastActiveTabId = tabHistory.find(tabId => newTabList.some(tab => tab.id === tabId));
        const nextActiveTab = lastActiveTabId
          ? newTabList.find(tab => tab.id === lastActiveTabId)
          : newTabList[Math.max(index - 1, 0)];

        if (nextActiveTab?.url) {
          navigate(nextActiveTab.url);
        }

        updateInsomniaTabs({
          organizationId,
          tabList: newTabList,
          activeTabId: nextActiveTab?.id || '',
        });
      } else {
        updateInsomniaTabs({
          organizationId,
          tabList: newTabList,
          activeTabId: currentTabs.activeTabId as string,
        });
      }
      uiEventBus.emit('CLOSE_TAB', organizationId, [id]);
    },
    [addClosedTabs, navigate, organizationId, projectId, removeClosedTabsByIds, updateInsomniaTabs],
  );

  const batchCloseTabs = useCallback(
    (deleteIds: string[], options: CloseTabOptions = {}) => {
      if (options.removeFromClosedTabs) {
        removeClosedTabsByIds(deleteIds);
      }

      const currentTabs = appTabsRef?.current?.[organizationId];
      if (!currentTabs) {
        return;
      }

      if (!options.removeFromClosedTabs) {
        const closingTabs = currentTabs.tabList.filter(tab => deleteIds.includes(tab.id));
        addClosedTabs(closingTabs);
      }

      if (currentTabs.tabList.every(tab => deleteIds.includes(tab.id))) {
        if (options.navigateOnAllClose !== false && !isScratchpadOrganizationId(organizationId)) {
          navigate(`/organization/${organizationId}/project/${projectId}`);
        }
        updateInsomniaTabs({
          organizationId,
          tabList: [],
          activeTabId: '',
        });
        uiEventBus.emit('CLOSE_TAB', organizationId, 'all');
        return;
      }

      const index = currentTabs.tabList.findIndex(tab => deleteIds.includes(tab.id));
      const newTabList = currentTabs.tabList.filter(tab => !deleteIds.includes(tab.id));
      if (deleteIds.includes(currentTabs.activeTabId || '')) {
        const url = newTabList[Math.max(index - 1, 0)]?.url;
        navigate(url);
      }

      updateInsomniaTabs({
        organizationId,
        tabList: newTabList,
        activeTabId: deleteIds.includes(currentTabs.activeTabId || '')
          ? newTabList[Math.max(index - 1, 0)]?.id
          : (currentTabs.activeTabId as string),
      });
      uiEventBus.emit('CLOSE_TAB', organizationId, deleteIds);
    },
    [addClosedTabs, navigate, organizationId, projectId, removeClosedTabsByIds, updateInsomniaTabs],
  );

  const changeActiveTab = useCallback(
    (id: string, options = { navigate: true }) => {
      const currentTabs = appTabsRef?.current?.[organizationId] || { tabList: [], activeTabId: '' };
      if (!currentTabs) {
        return;
      }
      const tab = currentTabs?.tabList.find(tab => tab.id === id);
      if (options?.navigate && tab?.url) {
        navigate(tab.url);
      }

      updateInsomniaTabs({
        organizationId,
        tabList: currentTabs.tabList,
        activeTabId: id,
      });
    },
    [navigate, organizationId, updateInsomniaTabs],
  );

  const closeAllTabsUnderWorkspace = useCallback(
    (workspaceId: string, options: CloseTabOptions = {}) => {
      const currentTabs = appTabsRef?.current?.[organizationId];
      if (!currentTabs) {
        return;
      }
      const closeIds = currentTabs.tabList.filter(tab => tab.workspaceId === workspaceId).map(tab => tab.id);
      batchCloseTabs(closeIds, { ...options, navigateOnAllClose: false });
    },
    [batchCloseTabs, organizationId],
  );

  const closeAllTabsUnderProject = useCallback(
    (projectId: string, options: CloseTabOptions = {}) => {
      const currentTabs = appTabsRef?.current?.[organizationId];
      if (!currentTabs) {
        return;
      }
      const closeIds = currentTabs.tabList.filter(tab => tab.projectId === projectId).map(tab => tab.id);
      batchCloseTabs(closeIds, { ...options, navigateOnAllClose: false });
    },
    [batchCloseTabs, organizationId],
  );

  const closeAllTabs = useCallback(
    (options: CloseTabOptions = {}) => {
      const currentTabs = appTabsRef?.current?.[organizationId];
      const closeIds = currentTabs?.tabList.map(tab => tab.id) || [];
      batchCloseTabs(closeIds, options);
    },
    [batchCloseTabs, organizationId],
  );

  const closeOtherTabs = useCallback(
    (id: string, options: CloseTabOptions = {}) => {
      const currentTabs = appTabsRef?.current?.[organizationId];
      if (!currentTabs) {
        return;
      }
      const reservedTab = currentTabs.tabList.find(tab => tab.id === id);
      if (!reservedTab) {
        return;
      }

      if (currentTabs.activeTabId !== id) {
        navigate(reservedTab.url);
      }

      const closeIds = currentTabs.tabList.filter(tab => tab.id !== id).map(tab => tab.id);
      batchCloseTabs(closeIds, options);
      changeActiveTab(id, { navigate: false });
    },
    [batchCloseTabs, changeActiveTab, navigate, organizationId],
  );

  const updateTabById = useCallback(
    (tabId: string, patches: Partial<BaseTab>) => {
      const currentTabs = appTabsRef?.current?.[organizationId];
      if (!currentTabs) {
        return;
      }
      const newTabList = currentTabs.tabList.map(tab => {
        if (tab.id === tabId) {
          return {
            ...tab,
            ...patches,
          };
        }
        return tab;
      });
      updateInsomniaTabs({
        organizationId,
        tabList: newTabList,
        activeTabId: currentTabs.activeTabId || '',
      });
    },
    [organizationId, updateInsomniaTabs],
  );

  const updateProjectName = useCallback(
    (projectId: string, name: string) => {
      const currentTabs = appTabsRef?.current?.[organizationId];

      if (!currentTabs) {
        return;
      }
      const newTabList = currentTabs.tabList.map(tab => {
        if (tab.projectId === projectId) {
          return {
            ...tab,
            projectName: name,
          };
        }
        return tab;
      });
      updateInsomniaTabs({
        organizationId,
        tabList: newTabList,
        activeTabId: currentTabs.activeTabId || '',
      });
    },
    [organizationId, updateInsomniaTabs],
  );

  const updateWorkspaceName = useCallback(
    (workspaceId: string, name: string) => {
      const currentTabs = appTabsRef?.current?.[organizationId];
      if (!currentTabs) {
        return;
      }
      const newTabList = currentTabs.tabList.map(tab => {
        if (tab.workspaceId === workspaceId) {
          return {
            ...tab,
            workspaceName: name,
            name: tab.id === workspaceId ? name : tab.name,
          };
        }
        return tab;
      });
      updateInsomniaTabs({
        organizationId,
        tabList: newTabList,
        activeTabId: currentTabs.activeTabId || '',
      });
    },
    [organizationId, updateInsomniaTabs],
  );

  const batchUpdateTabs = useCallback(
    (updates: { id: string; fields: Partial<BaseTab> }[]) => {
      const currentTabs = appTabsRef?.current?.[organizationId];
      if (!currentTabs) {
        return;
      }

      const newTabList = currentTabs.tabList.map(tab => {
        const update = updates.find(update => update.id === tab.id);
        if (update) {
          return {
            ...tab,
            ...update.fields,
          };
        }
        return tab;
      });

      updateInsomniaTabs({
        organizationId,
        tabList: newTabList,
        activeTabId: currentTabs.activeTabId || '',
      });
    },
    [organizationId, updateInsomniaTabs],
  );

  const moveBefore = useCallback(
    (targetId: string, movingId: string) => {
      const currentTabs = appTabsRef?.current?.[organizationId];
      if (!currentTabs || targetId === movingId) {
        return;
      }

      const newTabList = [...currentTabs.tabList];
      const movingIndex = newTabList.findIndex(tab => tab.id === movingId);
      const [movingTab] = newTabList.splice(movingIndex, 1);
      const targetIndex = newTabList.findIndex(tab => tab.id === targetId);
      newTabList.splice(targetIndex, 0, movingTab);

      updateInsomniaTabs({
        organizationId,
        tabList: newTabList,
        activeTabId: currentTabs.activeTabId || '',
      });
    },
    [organizationId, updateInsomniaTabs],
  );

  const moveAfter = useCallback(
    (targetId: string, movingId: string) => {
      const currentTabs = appTabsRef?.current?.[organizationId];
      if (!currentTabs || targetId === movingId) {
        return;
      }

      const newTabList = [...currentTabs.tabList];
      const movingIndex = newTabList.findIndex(tab => tab.id === movingId);
      const [movingTab] = newTabList.splice(movingIndex, 1);
      const targetIndex = newTabList.findIndex(tab => tab.id === targetId);
      newTabList.splice(targetIndex + 1, 0, movingTab);

      updateInsomniaTabs({
        organizationId,
        tabList: newTabList,
        activeTabId: currentTabs.activeTabId || '',
      });
    },
    [organizationId, updateInsomniaTabs],
  );

  const goToNextTab = useCallback(() => {
    const currentTabs = appTabsRef?.current?.[organizationId];
    if (!currentTabs || currentTabs.tabList.length <= 1) {
      return;
    }

    const currentIndex = currentTabs.tabList.findIndex(tab => tab.id === currentTabs.activeTabId);

    // Wrap around to first tab if at the end, and it's safe when currentIndex is -1
    const nextIndex = (currentIndex + 1) % currentTabs.tabList.length;
    const nextTab = currentTabs.tabList[nextIndex];
    if (nextTab) {
      navigate(nextTab.url);
      updateInsomniaTabs({
        organizationId,
        tabList: currentTabs.tabList,
        activeTabId: nextTab.id,
      });
    }
  }, [navigate, organizationId, updateInsomniaTabs]);

  const goToPreviousTab = useCallback(() => {
    const currentTabs = appTabsRef?.current?.[organizationId];
    if (!currentTabs || currentTabs.tabList.length <= 1) {
      return;
    }

    const currentIndex = currentTabs.tabList.findIndex(tab => tab.id === currentTabs.activeTabId);

    // Wrap around to last tab if at the beginning, and it's safe when currentIndex is -1
    const prevIndex = (currentIndex - 1 + currentTabs.tabList.length) % currentTabs.tabList.length;
    const prevTab = currentTabs.tabList[prevIndex];
    if (prevTab) {
      navigate(prevTab.url);
      updateInsomniaTabs({
        organizationId,
        tabList: currentTabs.tabList,
        activeTabId: prevTab.id,
      });
    }
  }, [navigate, organizationId, updateInsomniaTabs]);

  const reopenClosedTab = useCallback(() => {
    const currentTabs = appTabsRef?.current?.[organizationId] || { tabList: [], activeTabId: '' };
    const existingIds = new Set(currentTabs.tabList.map(tab => tab.id));
    const currentClosedTabs = closedTabsRef.current[organizationId] || [];

    while (currentClosedTabs.length) {
      const closedTab = currentClosedTabs.pop();
      if (!closedTab) return;
      if (existingIds.has(closedTab.id)) continue;

      updateInsomniaTabs({
        organizationId,
        tabList: [...currentTabs.tabList, closedTab],
        activeTabId: closedTab.id,
      });
      navigate(closedTab.url);
      return;
    }
  }, [navigate, organizationId, updateInsomniaTabs]);

  return (
    <InsomniaTabContext.Provider
      value={{
        currentOrgTabs: appTabs?.[organizationId] || { tabList: [], activeTabId: '' },
        closeTabById,
        closeAllTabsUnderWorkspace,
        closeAllTabsUnderProject,
        closeAllTabs,
        closeOtherTabs,
        batchCloseTabs,
        addTab,
        updateTabById,
        changeActiveTab,
        updateProjectName,
        updateWorkspaceName,
        batchUpdateTabs,
        appTabsRef,
        moveBefore,
        moveAfter,
        goToNextTab,
        goToPreviousTab,
        reopenClosedTab,
      }}
    >
      {children}
    </InsomniaTabContext.Provider>
  );
};

export const useInsomniaTabContext = () => useContext(InsomniaTabContext);
