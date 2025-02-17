import React, { createContext, type FC, type PropsWithChildren, useCallback, useContext, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLocalStorage } from 'react-use';

import type { BaseTab } from '../../components/tabs/tab';
import type { OrganizationTabs } from '../../components/tabs/tab-list';
import uiEventBus from '../../eventBus';

interface UpdateInsomniaTabParams {
  organizationId: string;
  tabList: OrganizationTabs['tabList'];
  activeTabId?: string;
}

interface ContextProps {
  currentOrgTabs: OrganizationTabs;
  appTabsRef?: React.MutableRefObject<InsomniaTabs | undefined>;
  closeTabById: (id: string) => void;
  addTab: (tab: BaseTab) => void;
  changeActiveTab: (id: string) => void;
  closeAllTabsUnderWorkspace?: (workspaceId: string) => void;
  closeAllTabsUnderProject?: (projectId: string) => void;
  batchCloseTabs?: (ids: string[]) => void;
  updateProjectName?: (projectId: string, name: string) => void;
  updateWorkspaceName?: (projectId: string, name: string) => void;
  updateTabById?: (tabId: string, patches: Partial<BaseTab>) => void;
  batchUpdateTabs?: (updates: { id: string; fields: Partial<BaseTab> }[]) => void;
  closeAllTabs?: () => void;
  closeOtherTabs?: (id: string) => void;
  moveBefore?: (targetId: string, movingId: string) => void;
  moveAfter?: (targetId: string, movingId: string) => void;
}

const InsomniaTabContext = createContext<ContextProps>({
  currentOrgTabs: {
    tabList: [],
    activeTabId: '',
  },
  closeTabById: () => { },
  addTab: () => { },
  changeActiveTab: () => { },
});

interface InsomniaTabs {
  [orgId: string]: OrganizationTabs;
};

export const InsomniaTabProvider: FC<PropsWithChildren> = ({ children }) => {
  const {
    organizationId,
    projectId,
  } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };

  const [appTabs, setAppTabs] = useLocalStorage<InsomniaTabs>('insomnia-tabs', {});

  // keep a ref of the appTabs to avoid the function recreated, which will cause the useEffect to run again and cannot delete a tab
  // file: packages/insomnia/src/ui/hooks/tab.ts
  const appTabsRef = useRef(appTabs);

  const navigate = useNavigate();

  const updateInsomniaTabs = useCallback(({ organizationId, tabList, activeTabId }: UpdateInsomniaTabParams) => {
    const newState = {
      ...appTabsRef.current,
      [organizationId]: {
        tabList,
        activeTabId,
      },
    };
    appTabsRef.current = newState;
    setAppTabs(newState);
  }, [setAppTabs]);

  const addTab = useCallback((tab: BaseTab) => {
    const currentTabs = appTabsRef?.current?.[organizationId] || { tabList: [], activeTabId: '' };

    updateInsomniaTabs({
      organizationId,
      tabList: [...currentTabs.tabList, tab],
      activeTabId: tab.id,
    });
  }, [organizationId, updateInsomniaTabs]);

  const closeTabById = useCallback((id: string) => {
    const currentTabs = appTabsRef?.current?.[organizationId];
    if (!currentTabs) {
      return;
    }

    // If the tab being deleted is the only tab and is active, navigate to the project dashboard
    if (currentTabs.activeTabId === id && currentTabs.tabList.length === 1) {
      navigate(`/organization/${organizationId}/project/${projectId}`);
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
    if (currentTabs.activeTabId === id) {
      const url = newTabList[Math.max(index - 1, 0)]?.url;
      navigate(url);
    }
    updateInsomniaTabs({
      organizationId,
      tabList: newTabList,
      activeTabId: currentTabs.activeTabId === id ? newTabList[Math.max(index - 1, 0)]?.id : currentTabs.activeTabId as string,
    });
    uiEventBus.emit('CLOSE_TAB', organizationId, [id]);
  }, [navigate, organizationId, projectId, updateInsomniaTabs]);

  const batchCloseTabs = useCallback((deleteIds: string[]) => {
    const currentTabs = appTabsRef?.current?.[organizationId];
    if (!currentTabs) {
      return;
    }

    if (currentTabs.tabList.every(tab => deleteIds.includes(tab.id))) {
      navigate(`/organization/${organizationId}/project/${projectId}`);
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
      activeTabId: deleteIds.includes(currentTabs.activeTabId || '') ? newTabList[Math.max(index - 1, 0)]?.id : currentTabs.activeTabId as string,
    });
    uiEventBus.emit('CLOSE_TAB', organizationId, deleteIds);
  }, [navigate, organizationId, projectId, updateInsomniaTabs]);

  const closeAllTabsUnderWorkspace = useCallback((workspaceId: string) => {
    const currentTabs = appTabsRef?.current?.[organizationId];
    if (!currentTabs) {
      return;
    }
    const closeIds = currentTabs.tabList.filter(tab => tab.workspaceId === workspaceId).map(tab => tab.id);
    const newTabList = currentTabs.tabList.filter(tab => tab.workspaceId !== workspaceId);

    updateInsomniaTabs({
      organizationId,
      tabList: newTabList,
      activeTabId: '',
    });
    uiEventBus.emit('CLOSE_TAB', organizationId, closeIds);
  }, [organizationId, updateInsomniaTabs]);

  const closeAllTabsUnderProject = useCallback((projectId: string) => {
    const currentTabs = appTabsRef?.current?.[organizationId];
    if (!currentTabs) {
      return;
    }
    const closeIds = currentTabs.tabList.filter(tab => tab.projectId === projectId).map(tab => tab.id);
    const newTabList = currentTabs.tabList.filter(tab => tab.projectId !== projectId);

    updateInsomniaTabs({
      organizationId,
      tabList: newTabList,
      activeTabId: '',
    });
    uiEventBus.emit('CLOSE_TAB', organizationId, closeIds);
  }, [organizationId, updateInsomniaTabs]);

  const closeAllTabs = useCallback(() => {
    navigate(`/organization/${organizationId}/project/${projectId}`);
    updateInsomniaTabs({
      organizationId,
      tabList: [],
      activeTabId: '',
    });
    uiEventBus.emit('CLOSE_TAB', organizationId, 'all');
  }, [navigate, organizationId, projectId, updateInsomniaTabs]);

  const closeOtherTabs = useCallback((id: string) => {
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
    updateInsomniaTabs({
      organizationId,
      tabList: [reservedTab],
      activeTabId: id,
    });
    const closeIds = currentTabs.tabList.filter(tab => tab.id !== id).map(tab => tab.id);
    uiEventBus.emit('CLOSE_TAB', organizationId, closeIds);
  }, [navigate, organizationId, updateInsomniaTabs]);

  const updateTabById = useCallback((tabId: string, patches: Partial<BaseTab>) => {
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
  }, [organizationId, updateInsomniaTabs]);

  const changeActiveTab = useCallback((id: string) => {
    const currentTabs = appTabsRef?.current?.[organizationId] || { tabList: [], activeTabId: '' };
    if (!currentTabs) {
      return;
    }
    const tab = currentTabs?.tabList.find(tab => tab.id === id);
    // keep the search params when navigate to another tab
    tab?.url && navigate(tab.url);
    updateInsomniaTabs({
      organizationId,
      tabList: currentTabs.tabList,
      activeTabId: id,
    });
  }, [navigate, organizationId, updateInsomniaTabs]);

  const updateProjectName = useCallback((projectId: string, name: string) => {
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
  }, [organizationId, updateInsomniaTabs]);

  const updateWorkspaceName = useCallback((workspaceId: string, name: string) => {
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
  }, [organizationId, updateInsomniaTabs]);

  const batchUpdateTabs = useCallback((updates: { id: string; fields: Partial<BaseTab> }[]) => {
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
  }, [organizationId, updateInsomniaTabs]);

  const moveBefore = useCallback((targetId: string, movingId: string) => {
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
  }, [organizationId, updateInsomniaTabs]);

  const moveAfter = useCallback((targetId: string, movingId: string) => {
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
  }, [organizationId, updateInsomniaTabs]);

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
      }}
    >
      {children}
    </InsomniaTabContext.Provider>
  );
};

export const useInsomniaTabContext = () => useContext(InsomniaTabContext);
