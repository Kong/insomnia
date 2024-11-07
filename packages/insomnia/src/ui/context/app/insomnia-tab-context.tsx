import React, { createContext, type FC, type PropsWithChildren, useCallback, useContext, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLocalStorage } from 'react-use';

import type { BaseTab } from '../../components/tabs/tab';
import type { OrganizationTabs } from '../../components/tabs/tabList';

interface UpdateInsomniaTabParams {
  organizationId: string;
  tabList: OrganizationTabs['tabList'];
  activeTabId?: string;
}

interface ContextProps {
  currentOrgTabs: OrganizationTabs;
  appTabsRef?: React.MutableRefObject<InsomniaTabs | undefined>;
  deleteTabById: (id: string) => void;
  addTab: (tab: BaseTab) => void;
  changeActiveTab: (id: string) => void;
  deleteAllTabsUnderWorkspace?: (workspaceId: string) => void;
  deleteAllTabsUnderProject?: (projectId: string) => void;
  updateProjectName?: (projectId: string, name: string) => void;
  updateWorkspaceName?: (projectId: string, name: string) => void;
  updateTabById?: (tabId: string, name: string, method?: string, tag?: string) => void;
}

const InsomniaTabContext = createContext<ContextProps>({
  currentOrgTabs: {
    tabList: [],
    activeTabId: '',
  },
  deleteTabById: () => { },
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
    console.log('addTab');
    const currentTabs = appTabsRef?.current?.[organizationId] || { tabList: [], activeTabId: '' };

    updateInsomniaTabs({
      organizationId,
      tabList: [...currentTabs.tabList, tab],
      activeTabId: tab.id,
    });
  }, [organizationId, updateInsomniaTabs]);

  const deleteTabById = useCallback((id: string) => {
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
      return;
    }

    const index = currentTabs.tabList.findIndex(tab => tab.id === id);
    if (index === -1) {
      return;
    }
    const newTabList = currentTabs.tabList.filter(tab => tab.id !== id);
    if (currentTabs.activeTabId === id) {
      navigate(newTabList[index - 1 < 0 ? 0 : index - 1]?.url || '');
    }
    updateInsomniaTabs({
      organizationId,
      tabList: newTabList,
      activeTabId: currentTabs.activeTabId === id ? newTabList[index - 1 < 0 ? 0 : index - 1]?.id : currentTabs.activeTabId as string,
    });
  }, [navigate, organizationId, projectId, updateInsomniaTabs]);

  const deleteAllTabsUnderWorkspace = useCallback((workspaceId: string) => {
    const currentTabs = appTabsRef?.current?.[organizationId];
    if (!currentTabs) {
      return;
    }
    const newTabList = currentTabs.tabList.filter(tab => tab.workspaceId !== workspaceId);

    updateInsomniaTabs({
      organizationId,
      tabList: newTabList,
      activeTabId: '',
    });
  }, [organizationId, updateInsomniaTabs]);

  const deleteAllTabsUnderProject = useCallback((projectId: string) => {
    const currentTabs = appTabsRef?.current?.[organizationId];
    if (!currentTabs) {
      return;
    }
    const newTabList = currentTabs.tabList.filter(tab => tab.projectId !== projectId);

    updateInsomniaTabs({
      organizationId,
      tabList: newTabList,
      activeTabId: '',
    });
  }, [organizationId, updateInsomniaTabs]);

  const updateTabById = useCallback((tabId: string, name: string, method: string = '', tag: string = '') => {
    const currentTabs = appTabsRef?.current?.[organizationId];
    if (!currentTabs) {
      return;
    }
    const newTabList = currentTabs.tabList.map(tab => {
      if (tab.id === tabId) {
        return {
          ...tab,
          name,
          tag,
          method,
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
    updateInsomniaTabs({
      organizationId,
      tabList: currentTabs.tabList,
      activeTabId: id,
    });
  }, [organizationId, updateInsomniaTabs]);

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

  return (
    <InsomniaTabContext.Provider
      value={{
        currentOrgTabs: appTabs?.[organizationId] || { tabList: [], activeTabId: '' },
        deleteTabById,
        deleteAllTabsUnderWorkspace,
        deleteAllTabsUnderProject,
        addTab,
        updateTabById,
        changeActiveTab,
        updateProjectName,
        updateWorkspaceName,
        appTabsRef,
      }}
    >
      {children}
    </InsomniaTabContext.Provider>
  );
};

export const useInsomniaTabContext = () => useContext(InsomniaTabContext);
