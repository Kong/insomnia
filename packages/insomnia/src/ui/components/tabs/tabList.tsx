import _ from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import { Button, GridList, Menu, MenuItem, MenuTrigger, Popover, type Selection } from 'react-aria-components';
import { useFetcher, useNavigate } from 'react-router-dom';

import { type ChangeBufferEvent, type ChangeType, database } from '../../../common/database';
import * as models from '../../../models/index';
import type { MockRoute } from '../../../models/mock-route';
import type { Request } from '../../../models/request';
import { INSOMNIA_TAB_HEIGHT } from '../../constant';
import { useInsomniaTabContext } from '../../context/app/insomnia-tab-context';
import { type Size, useResizeObserver } from '../../hooks/use-resize-observer';
import { Icon } from '../icon';
import { AddRequestToCollectionModal } from '../modals/add-request-to-collection-modal';
import { formatMethodName, getRequestMethodShortHand } from '../tags/method-tag';
import { type BaseTab, InsomniaTab, TabEnum } from './tab';

export interface OrganizationTabs {
  tabList: BaseTab[];
  activeTabId?: string;
}

export const enum TAB_CONTEXT_MENU_COMMAND {
  CLOSE_ALL = 'Close all',
  CLOSE_OTHERS = 'Close others',
}

export const TAB_ROUTER_PATH: Record<TabEnum, string> = {
  [TabEnum.Collection]: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug',
  [TabEnum.Folder]: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request-group/:requestGroupId',
  [TabEnum.Request]: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request/:requestId',
  [TabEnum.Env]: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/environment',
  [TabEnum.Mock]: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/mock-server',
  [TabEnum.Runner]: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/runner',
  [TabEnum.Document]: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/spec',
  [TabEnum.MockRoute]: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/mock-server/mock-route/:mockRouteId',
  [TabEnum.TEST]: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/test',
  [TabEnum.TESTSUITE]: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/test/test-suite/*',
};

export const OrganizationTabList = ({ showActiveStatus = true, currentPage = '' }) => {
  const { currentOrgTabs } = useInsomniaTabContext();
  const { tabList, activeTabId } = currentOrgTabs;
  const navigate = useNavigate();

  const [showAddRequestModal, setShowAddRequestModal] = useState(false);
  const [isOverFlow, setIsOverFlow] = useState(false);
  const [leftScrollDisable, setLeftScrollDisable] = useState(false);
  const [rightScrollDisable, setRightScrollDisable] = useState(false);

  const requestFetcher = useFetcher();

  const {
    changeActiveTab,
    closeTabById,
    closeAllTabsUnderWorkspace,
    closeAllTabsUnderProject,
    updateTabById,
    updateProjectName,
    updateWorkspaceName,
    closeAllTabs,
    closeOtherTabs,
  } = useInsomniaTabContext();

  const handleSelectionChange = (keys: Selection) => {
    if (keys !== 'all') {
      const key = [...keys.values()]?.[0] as string;
      const tab = tabList.find(tab => tab.id === key);
      tab?.url && navigate(tab?.url);
      changeActiveTab(key);
    }
  };

  const needHandleChange = (changeType: ChangeType, docType: string) => {
    // only handle update and delete
    if (changeType !== 'update' && changeType !== 'remove') {
      return false;
    }
    // only handle the following types
    const list = [
      models.request.type,
      models.grpcRequest.type,
      models.webSocketRequest.type,
      models.requestGroup.type,
      models.unitTestSuite.type,
      models.workspace.type,
      models.environment.type,
      models.mockRoute.type,
      models.project.type,
    ];
    return list.includes(docType);
  };

  const handleDelete = useCallback((docId: string, docType: string) => {
    if (docType === models.project.type) {
      // delete all tabs of this project
      closeAllTabsUnderProject?.(docId);
    }
    if (docType === models.workspace.type) {
      // delete all tabs of this workspace
      closeAllTabsUnderWorkspace?.(docId);
    } else {
      // delete tab by id
      closeTabById(docId);
    }
  }, [closeAllTabsUnderProject, closeAllTabsUnderWorkspace, closeTabById]);

  const handleUpdate = useCallback((doc: models.BaseModel) => {
    // currently have 2 types of update, rename and change request method
    if (doc.type === models.request.type || doc.type === models.grpcRequest.type || doc.type === models.webSocketRequest.type) {
      const tag = getRequestMethodShortHand(doc as Request);
      const method = (doc as Request).method;
      updateTabById?.(doc._id, doc.name, method, tag);
    } else if (doc.type === models.mockRoute.type) {
      const method = (doc as MockRoute).method;
      const tag = formatMethodName(method);
      updateTabById?.(doc._id, doc.name, method, tag);
    } else if (doc.type === models.project.type) {
      // update project name(for tooltip)
      updateProjectName?.(doc._id, doc.name);
    } else if (doc.type === models.workspace.type) {
      // update workspace name(for tooltip) & update name for workspace tab
      updateWorkspaceName?.(doc._id, doc.name);
    } else {
      updateTabById?.(doc._id, doc.name);
    }
  }, [updateProjectName, updateTabById, updateWorkspaceName]);

  useEffect(() => {
    // sync tabList with database
    const callback = async (changes: ChangeBufferEvent[]) => {
      for (const change of changes) {
        const changeType = change[0];
        const doc = change[1];
        if (needHandleChange(changeType, doc.type)) {
          if (changeType === 'remove') {
            handleDelete(doc._id, doc.type);
          } else if (changeType === 'update') {
            handleUpdate(doc);
          }
        }
      }
    };
    database.onChange(callback);

    return () => {
      database.offChange(callback);
    };
  }, [handleDelete, handleUpdate]);

  const addRequest = () => {
    const currentTab = tabList.find(tab => tab.id === activeTabId);
    if (currentTab) {
      const { organizationId, projectId, workspaceId } = currentTab;
      requestFetcher.submit(
        { requestType: 'HTTP', parentId: workspaceId },
        {
          action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/new`,
          method: 'post',
          encType: 'application/json',
        },
      );
    }
  };

  const addRequestToCollection = () => {
    setShowAddRequestModal(true);
  };

  const tabListInnerRef = React.useRef<HTMLDivElement>(null);
  const tabListWrapperRef = React.useRef<HTMLDivElement>(null);

  const onResize = () => {
    const innerWidth = tabListInnerRef.current?.clientWidth;
    const wrapperWidth = tabListWrapperRef.current?.clientWidth;
    if (innerWidth && wrapperWidth && innerWidth > wrapperWidth) {
      setIsOverFlow(true);
    } else {
      setIsOverFlow(false);
    }
  };

  const debouncedOnResize = _.debounce<(size: Size) => void>(onResize, 500);

  useResizeObserver(tabListWrapperRef, debouncedOnResize);

  const scrollLeft = () => {
    if (!tabListWrapperRef.current) {
      return;
    }
    tabListWrapperRef.current.scrollLeft -= 150;
  };

  const scrollRight = () => {
    if (!tabListWrapperRef.current) {
      return;
    }
    tabListWrapperRef.current.scrollLeft += 150;
  };

  useEffect(() => {
    const unsubscribe = window.main.on('contextMenuCommand', (_, { key, label, extra }) => {
      if (key !== 'insomniaTab') {
        return;
      }
      switch (label) {
        case TAB_CONTEXT_MENU_COMMAND.CLOSE_ALL:
          closeAllTabs?.();
          break;
        case TAB_CONTEXT_MENU_COMMAND.CLOSE_OTHERS:
          closeOtherTabs?.(extra?.currentTabId);
          break;
        default:
          break;
      }
    });

    return () => {
      unsubscribe();
    };
  }, [closeAllTabs, closeOtherTabs]);

  const calculateScrollButtonStatus = (target: HTMLDivElement) => {
    const { scrollLeft, scrollWidth, clientWidth } = target;
    if (scrollLeft === 0) {
      setLeftScrollDisable(true);
    } else {
      setLeftScrollDisable(false);
    }

    if (scrollLeft + clientWidth >= scrollWidth - 1) {
      setRightScrollDisable(true);
    } else {
      setRightScrollDisable(false);
    }
  };

  const handleScroll = (e: React.UIEvent) => {
    calculateScrollButtonStatus(e.target as HTMLDivElement);
  };

  useEffect(() => {
    if (isOverFlow && tabListWrapperRef?.current) {
      calculateScrollButtonStatus(tabListWrapperRef?.current);
    }
  }, [isOverFlow]);

  if (!tabList.length) {
    return null;
  };

  return (
    <div className="flex box-content border-b border-solid border-[--hl-sm] bg-[--color-bg]" style={{ height: `${INSOMNIA_TAB_HEIGHT}px` }} >
      <Button onPress={scrollLeft} isDisabled={leftScrollDisable} className={`${leftScrollDisable && 'cursor-not-allowed'}`}>
        <Icon icon="chevron-left" className={`w-[30px] ${isOverFlow ? 'block' : 'hidden'}`} />
      </Button>
      <div className='max-w-[calc(100%-40px)] overflow-x-scroll hide-scrollbars scroll-smooth' ref={tabListWrapperRef} onScroll={handleScroll}>
        <GridList
          aria-label="Insomnia Tabs"
          onSelectionChange={handleSelectionChange}
          selectedKeys={showActiveStatus && activeTabId ? [activeTabId] : []}
          disallowEmptySelection
          selectionMode="single"
          selectionBehavior='replace'
          className="flex h-[41px] w-fit"
          // Use +1 height to mask the wrapper border, and let the custom element in InsomniaTab act as the fake border.（we need different border for active tab）
          style={{ height: `${INSOMNIA_TAB_HEIGHT + 1}px` }}
          items={tabList}
          ref={tabListInnerRef}
        >
          {item => <InsomniaTab tab={item} />}
        </GridList>
      </div>
      <Button onPress={scrollRight} isDisabled={rightScrollDisable} className={`${rightScrollDisable && 'cursor-not-allowed'}`} >
        <Icon icon="chevron-right" className={`w-[30px] ${isOverFlow ? 'block' : 'hidden'}`} />
      </Button>
      <div className='flex items-center w-[40px] justify-center flex-shrink-0'>
        <MenuTrigger>
          <Button aria-label="Menu">
            <Icon icon="plus" className='cursor-pointer' />
          </Button>
          <Popover>
            <Menu className='border max-w-lg select-none text-sm border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none'>
              {currentPage === 'debug' && (
                <MenuItem className="aria-disabled:opacity-30 aria-disabled:cursor-not-allowed flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors" onAction={addRequest}>
                  add request to current collection
                </MenuItem>
              )}
              <MenuItem className="aria-disabled:opacity-30 aria-disabled:cursor-not-allowed flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors" onAction={addRequestToCollection}>
                add request to other collection
              </MenuItem>
            </Menu>
          </Popover>
        </MenuTrigger>
      </div>
      {showAddRequestModal && <AddRequestToCollectionModal onHide={() => setShowAddRequestModal(false)} />}
    </div>
  );
};
