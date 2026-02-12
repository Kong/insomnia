import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  DropIndicator,
  GridList,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  type Selection,
  useDragAndDrop,
} from 'react-aria-components';
import { useParams } from 'react-router';

import { isGrpcRequest } from '~/models/grpc-request';
import { isSocketIORequest } from '~/models/socket-io-request';
import { isWebSocketRequest } from '~/models/websocket-request';
import { useRequestNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.new';
import { useInsomniaTab } from '~/ui/hooks/use-insomnia-tab';

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
import { useDocBodyKeyboardShortcuts } from '../keydown-binder';
import { AddRequestToCollectionModal } from '../modals/add-request-to-collection-modal';
import { formatMethodName, getRequestMethodShortHand } from '../tags/method-tag';
import { type BaseTab, InsomniaTab } from './tab';

export interface OrganizationTabs {
  tabList: BaseTab[];
  activeTabId?: string;
}

export const enum TAB_CONTEXT_MENU_COMMAND {
  CLOSE_ALL = 'Close All',
  CLOSE_OTHERS = 'Close Other Tabs',
}

export const OrganizationTabList = ({ showActiveStatus = true, currentPage = '' }) => {
  const [showAddRequestModal, setShowAddRequestModal] = useState(false);
  const [isOverFlow, setIsOverFlow] = useState(false);
  const [leftScrollDisable, setLeftScrollDisable] = useState(false);
  const [rightScrollDisable, setRightScrollDisable] = useState(false);

  const newRequestFetcher = useRequestNewActionFetcher();
  const { organizationId, projectId } = useParams();

  useInsomniaTab({ organizationId: organizationId || '' });

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
    goToNextTab,
    goToPreviousTab,
    reopenClosedTab,
  } = useInsomniaTabContext();

  const { tabList, activeTabId } = currentOrgTabs;

  // Register keyboard shortcuts for tab navigation
  useDocBodyKeyboardShortcuts({
    tab_nextTab: event => {
      event.preventDefault();
      goToNextTab?.();
    },
    tab_previousTab: event => {
      event.preventDefault();
      goToPreviousTab?.();
    },
    tab_reopenClosedTab: event => {
      event.preventDefault();
      reopenClosedTab?.();
    },
  });

  const handleSelectionChange = (keys: Selection) => {
    if (keys !== 'all') {
      const key = [...keys.values()]?.[0] as string;
      changeActiveTab(key, { navigate: true });
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
      models.socketIORequest.type,
    ];
    return list.includes(docType);
  };

  const handleDelete = useCallback(
    (docId: string, docType: string) => {
      if (docType === models.project.type) {
        // delete all tabs of this project
        closeAllTabsUnderProject?.(docId, { removeFromClosedTabs: true });
      } else if (docType === models.workspace.type) {
        // delete all tabs of this workspace
        closeAllTabsUnderWorkspace?.(docId, { removeFromClosedTabs: true });
      } else if (docType === models.requestGroup.type) {
        // when delete a folder, we need also delete the corresponding folder runner tab(if exists)
        batchCloseTabs?.([docId, `runner_${docId}`], { removeFromClosedTabs: true });
      } else {
        // delete tab by id
        closeTabById(docId, { removeFromClosedTabs: true });
      }
    },
    [batchCloseTabs, closeAllTabsUnderProject, closeAllTabsUnderWorkspace, closeTabById],
  );

  const handleUpdate = useCallback(
    async (doc: models.BaseModel, patches: Partial<models.BaseModel>[] = []) => {
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
        if (
          doc.type === models.request.type ||
          doc.type === models.grpcRequest.type ||
          doc.type === models.webSocketRequest.type
        ) {
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
          if (isRequest(doc) || isWebSocketRequest(doc) || isGrpcRequest(doc) || isSocketIORequest(doc)) {
            updateTabById?.(doc._id, {
              workspaceId: workspace._id,
              workspaceName: workspace.name,
              url: `/organization/${organizationId}/project/${projectId}/workspace/${workspace._id}/debug/request/${doc._id}`,
            });
          } else if (isRequestGroup(doc)) {
            const folderEntities = await database.getWithDescendants(doc, [
              models.request.type,
              models.grpcRequest.type,
              models.webSocketRequest.type,
              models.socketIORequest.type,
              models.requestGroup.type,
            ]);
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
    },
    [organizationId, projectId, updateProjectName, updateTabById, updateWorkspaceName, batchUpdateTabs],
  );

  useEffect(() => {
    // sync tabList with database
    const unsubscribe = window.main.on('db.changes', async (_, changes: ChangeBufferEvent[]) => {
      for (const change of changes) {
        const [changeType, doc, patches] = change;

        if (needHandleChange(changeType, doc.type)) {
          if (changeType === 'remove') {
            handleDelete(doc._id, doc.type);
          } else if (changeType === 'update') {
            handleUpdate(doc, patches);
          }
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [handleDelete, handleUpdate]);

  const addRequest = () => {
    const currentTab = tabList.find(tab => tab.id === activeTabId);
    if (currentTab) {
      const { organizationId, projectId, workspaceId } = currentTab;
      newRequestFetcher.submit({
        organizationId,
        projectId,
        workspaceId,
        requestType: 'HTTP',
        parentId: workspaceId,
      });
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
        case TAB_CONTEXT_MENU_COMMAND.CLOSE_ALL: {
          closeAllTabs?.();
          break;
        }
        case TAB_CONTEXT_MENU_COMMAND.CLOSE_OTHERS: {
          closeOtherTabs?.(extra?.currentTabId);
          break;
        }
        default: {
          break;
        }
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
        moveBefore?.(e.target.key.toString(), moveKey);
      } else if (e.target.dropPosition === 'after') {
        moveAfter?.(e.target.key.toString(), moveKey);
      }
    },
    renderDropIndicator(target) {
      return (
        <DropIndicator target={target} className="border-none! outline-1 outline-(--color-surprise) outline-solid" />
      );
    },
  });

  if (!tabList.length) return null;

  return (
    <div className="box-content flex bg-(--color-bg)" style={{ height: `${INSOMNIA_TAB_HEIGHT + 1}px` }}>
      <Button
        onPress={scrollLeft}
        isDisabled={leftScrollDisable}
        className={`${leftScrollDisable && 'cursor-not-allowed'} border-b border-solid border-(--hl-sm)`}
      >
        <Icon icon="chevron-left" className={`w-[30px] ${isOverFlow ? 'block' : 'hidden'}`} />
      </Button>
      <div
        className="hide-scrollbars max-w-[calc(100%-40px)] overflow-x-scroll"
        ref={tabListWrapperRef}
        onScroll={handleScroll}
      >
        <GridList
          aria-label="Insomnia Tabs"
          onSelectionChange={handleSelectionChange}
          selectedKeys={showActiveStatus && activeTabId ? [activeTabId] : []}
          disallowEmptySelection
          selectionMode="single"
          selectionBehavior="replace"
          className="flex h-[41px] w-fit"
          dragAndDropHooks={dragAndDropHooks}
          items={tabList}
          ref={tabListInnerRef}
        >
          {item => <InsomniaTab tab={item} />}
        </GridList>
      </div>
      <Button
        onPress={scrollRight}
        isDisabled={rightScrollDisable}
        className={`${rightScrollDisable && 'cursor-not-allowed'} border-b border-solid border-(--hl-sm)`}
      >
        <Icon icon="chevron-right" className={`w-[30px] ${isOverFlow ? 'block' : 'hidden'}`} />
      </Button>
      <div className="flex shrink-0 grow items-center justify-start border-b border-solid border-(--hl-sm)">
        <MenuTrigger>
          <Button
            aria-label="Tab Plus"
            className="mx-[10px] h-[20px] w-[20px] text-center hover:bg-(--hl-xs) data-pressed:bg-(--hl-sm)"
          >
            <Icon icon="plus" className="cursor-pointer" />
          </Button>
          <Popover>
            <Menu className="max-h-[85vh] max-w-lg overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden">
              {currentPage === 'debug' && (
                <MenuItem
                  className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-disabled:cursor-not-allowed aria-disabled:opacity-30 aria-selected:font-bold"
                  onAction={addRequest}
                >
                  Add request to current collection
                </MenuItem>
              )}
              <MenuItem
                className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-disabled:cursor-not-allowed aria-disabled:opacity-30 aria-selected:font-bold"
                onAction={addRequestToCollection}
              >
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
