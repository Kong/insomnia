import React, { useCallback, useEffect, useState } from 'react';
import { Button, DropIndicator, GridList, Menu, MenuItem, MenuTrigger, Popover, type Selection, useDragAndDrop } from 'react-aria-components';
import { useFetcher, useParams } from 'react-router-dom';

import { type ChangeBufferEvent, type ChangeType, database } from '../../../common/database';
import { debounce } from '../../../common/misc';
import * as models from '../../../models/index';
import type { MockRoute } from '../../../models/mock-route';
import { isRequest, type Request } from '../../../models/request';
import { isRequestGroup } from '../../../models/request-group';
import { INSOMNIA_TAB_HEIGHT } from '../../constant';
import { useInsomniaTabContext } from '../../context/app/insomnia-tab-context';
import { type Size, useResizeObserver } from '../../hooks/use-resize-observer';
import { Icon } from '../icon';
import { AddRequestToCollectionModal } from '../modals/add-request-to-collection-modal';
import { formatMethodName, getRequestMethodShortHand } from '../tags/method-tag';
import { type BaseTab, InsomniaTab, type TabType } from './tab';

export interface OrganizationTabs {
  tabList: BaseTab[];
  activeTabId?: string;
}

export const enum TAB_CONTEXT_MENU_COMMAND {
  CLOSE_ALL = 'Close all',
  CLOSE_OTHERS = 'Close others',
}

export const TAB_ROUTER_PATH: Record<TabType, string> = {
  collection: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug',
  folder: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request-group/:requestGroupId',
  request: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request/:requestId',
  environment: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/environment',
  mockServer: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/mock-server',
  runner: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/runner',
  document: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/spec',
  mockRoute: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/mock-server/mock-route/:mockRouteId',
  test: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/test',
  testSuite: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/test/test-suite/*',
};

export const OrganizationTabList = ({ showActiveStatus = true, currentPage = '' }) => {

  const [showAddRequestModal, setShowAddRequestModal] = useState(false);
  const [isOverFlow, setIsOverFlow] = useState(false);
  const [leftScrollDisable, setLeftScrollDisable] = useState(false);
  const [rightScrollDisable, setRightScrollDisable] = useState(false);

  const requestFetcher = useFetcher();
  const { organizationId, projectId } = useParams();

  const {
    changeActiveTab,
    closeTabById,
    closeAllTabsUnderWorkspace,
    closeAllTabsUnderProject,
    batchCloseTabs,
    updateTabById,
    updateProjectName,
    updateWorkspaceName,
    closeAllTabs,
    closeOtherTabs,
    moveAfter,
    moveBefore,
    batchUpdateTabs,
    currentOrgTabs,
  } = useInsomniaTabContext();

  const { tabList, activeTabId } = currentOrgTabs;

  const handleSelectionChange = (keys: Selection) => {
    if (keys !== 'all') {
      const key = [...keys.values()]?.[0] as string;
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
    } else if (docType === models.requestGroup.type) {
      // when delete a folder, we need also delete the corresponding folder runner tab(if exists)
      batchCloseTabs?.([docId, `runner_${docId}`]);
    } else {
      // delete tab by id
      closeTabById(docId);
    }
  }, [batchCloseTabs, closeAllTabsUnderProject, closeAllTabsUnderWorkspace, closeTabById]);

  const handleUpdate = useCallback(async (doc: models.BaseModel, patches: Partial<models.BaseModel>[] = []) => {
    const patchObj: Record<string, any> = {};
    patches.forEach(patch => {
      Object.assign(patchObj, patch);
    });
    // only need to handle name, method, parentId change
    if (!patchObj.name && !patchObj.method && !patchObj.parentId) {
      return;
    }
    if (patchObj.name) {
      if (doc.type === models.project.type) {
        // update project name(for tooltip)
        updateProjectName?.(doc._id, doc.name);
      } else if (doc.type === models.workspace.type) {
        // update workspace name(for tooltip) & update name for workspace tab
        updateWorkspaceName?.(doc._id, doc.name);
      } else {
        updateTabById?.(doc._id, {
          name: doc.name,
        });
      }
    }

    if (patchObj.method) {
      if (doc.type === models.request.type || doc.type === models.grpcRequest.type || doc.type === models.webSocketRequest.type) {
        const tag = getRequestMethodShortHand(doc as Request);
        const method = (doc as Request).method;
        updateTabById?.(doc._id, {
          method,
          tag,
        });
      } else if (doc.type === models.mockRoute.type) {
        const method = (doc as MockRoute).method;
        const tag = formatMethodName(method);
        updateTabById?.(doc._id, {
          method,
          tag,
        });
      }
    }

    // move request or requestGroup to another collection
    if (patchObj.parentId && !patchObj.metaSortKey && (patchObj.parentId as string).startsWith('wrk_')) {
      const workspace = await models.workspace.getById(patchObj.parentId);
      if (workspace) {
        if (isRequest(doc)) {
          updateTabById?.(doc._id, {
            workspaceId: workspace._id,
            workspaceName: workspace.name,
            url: `/organization/${organizationId}/project/${projectId}/workspace/${workspace._id}/debug/request/${doc._id}`,
          });
        } else if (isRequestGroup(doc)) {
          const folderEntities = await database.withDescendants(doc, models.request.type, [models.request.type, models.requestGroup.type]);
          console.log('folderEntities:', folderEntities);
          const batchUpdates = [doc, ...folderEntities].map(entity => {
            return {
              id: entity._id,
              fields: {
                workspaceId: workspace._id,
                workspaceName: workspace.name,
                url: isRequestGroup(entity)
                  ? `/organization/${organizationId}/project/${projectId}/workspace/${workspace._id}/debug/request-group/${entity._id}`
                  : `/organization/${organizationId}/project/${projectId}/workspace/${workspace._id}/debug/request/${entity._id}`,
              },
            };
          });
          batchUpdateTabs?.(batchUpdates);
        }
      }
    }

  }, [organizationId, projectId, updateProjectName, updateTabById, updateWorkspaceName, batchUpdateTabs]);

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
            const patches = change[3];
            handleUpdate(doc, patches);
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

  const debouncedOnResize = debounce<(size: Size) => void>(onResize, 500);

  useResizeObserver(tabListWrapperRef, debouncedOnResize);

  const scrollLeft = () => {
    if (!tabListWrapperRef.current) {
      return;
    }
    tabListWrapperRef.current.style.scrollBehavior = 'smooth';
    tabListWrapperRef.current.scrollLeft -= 150;
    tabListWrapperRef.current.style.scrollBehavior = 'auto';
  };

  const scrollRight = () => {
    if (!tabListWrapperRef.current) {
      return;
    }
    tabListWrapperRef.current.style.scrollBehavior = 'smooth';
    tabListWrapperRef.current.scrollLeft += 150;
    tabListWrapperRef.current.style.scrollBehavior = 'auto';
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

  const { dragAndDropHooks } = useDragAndDrop({
    getItems: keys => [...keys].map(key => ({ 'text/plain': key.toString() })),
    onReorder: e => {
      const moveKey = Array.from(e.keys)[0].toString();
      if (e.target.dropPosition === 'before') {
        moveBefore?.(e.target.key.toString(), moveKey);;
      } else if (e.target.dropPosition === 'after') {
        moveAfter?.(e.target.key.toString(), moveKey);
      }
    },
    renderDropIndicator(target) {
      return (
        <DropIndicator
          target={target}
          className="outline-[--color-surprise] outline-1 outline !border-none"
        />
      );
    },
  });

  if (!tabList.length) {
    return null;
  };

  return (
    <div className="flex box-content bg-[--color-bg]" style={{ height: `${INSOMNIA_TAB_HEIGHT + 1}px` }} >
      <Button onPress={scrollLeft} isDisabled={leftScrollDisable} className={`${leftScrollDisable && 'cursor-not-allowed'} border-b border-solid border-[--hl-sm]`}>
        <Icon icon="chevron-left" className={`w-[30px] ${isOverFlow ? 'block' : 'hidden'}`} />
      </Button>
      <div className='max-w-[calc(100%-40px)] overflow-x-scroll hide-scrollbars' ref={tabListWrapperRef} onScroll={handleScroll}>
        <GridList
          aria-label="Insomnia Tabs"
          onSelectionChange={handleSelectionChange}
          selectedKeys={showActiveStatus && activeTabId ? [activeTabId] : []}
          disallowEmptySelection
          selectionMode="single"
          selectionBehavior='replace'
          className="flex h-[41px] w-fit"
          dragAndDropHooks={dragAndDropHooks}
          items={tabList}
          ref={tabListInnerRef}
        >
          {item => <InsomniaTab tab={item} />}
        </GridList>
      </div>
      <Button onPress={scrollRight} isDisabled={rightScrollDisable} className={`${rightScrollDisable && 'cursor-not-allowed'} border-b border-solid border-[--hl-sm]`} >
        <Icon icon="chevron-right" className={`w-[30px] ${isOverFlow ? 'block' : 'hidden'}`} />
      </Button>
      <div className='flex items-center justify-start flex-shrink-0 flex-grow border-b border-solid border-[--hl-sm]'>
        <MenuTrigger>
          <Button aria-label="Tab Plus" className="w-[40px] text-center">
            <Icon icon="plus" className='cursor-pointer' />
          </Button>
          <Popover>
            <Menu className='border max-w-lg select-none text-sm border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none'>
              {currentPage === 'debug' && (
                <MenuItem className="aria-disabled:opacity-30 aria-disabled:cursor-not-allowed flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors" onAction={addRequest}>
                  Add request to current collection
                </MenuItem>
              )}
              <MenuItem className="aria-disabled:opacity-30 aria-disabled:cursor-not-allowed flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors" onAction={addRequestToCollection}>
                Add request to other collection
              </MenuItem>
            </Menu>
          </Popover>
        </MenuTrigger>
      </div>
      {showAddRequestModal && <AddRequestToCollectionModal onHide={() => setShowAddRequestModal(false)} />}
    </div>
  );
};
