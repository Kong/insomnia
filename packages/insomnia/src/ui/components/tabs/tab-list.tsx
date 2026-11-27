import type { BaseModel, MockRoute, Request } from 'insomnia-data';
import { models, services } from 'insomnia-data';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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

import { useRequestNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.new';
import { useGitFileIssues } from '~/ui/hooks/use-git-file-issues';
import { useInsomniaTab } from '~/ui/hooks/use-insomnia-tab';

import { type ChangeBufferEvent, type ChangeType, database } from '../../../common/database';
import { debounce } from '../../../common/misc';
import { useInsomniaTabContext } from '../../context/app/insomnia-tab-context';
import { type Size, useResizeObserver } from '../../hooks/use-resize-observer';
import { Icon } from '../icon';
import { useDocBodyKeyboardShortcuts } from '../keydown-binder';
import { AddRequestToCollectionModal } from '../modals/add-request-to-collection-modal';
import { formatMethodName, getRequestMethodShortHand } from '../tags/method-tag';
import {
  getExampleDeleteFallbackUrl,
  getRequestDeleteFallbackUrl,
  isRequestLikeDocType,
} from './request-delete-fallback';
import { InsomniaTab, TAB_CONTEXT_MENU_COMMAND } from './tab';

const { isRequest } = models.request;
const { isRequestGroup } = models.requestGroup;

export const OrganizationTabList = ({ showActiveStatus = true, currentPage = '' }) => {
  const [showAddRequestModal, setShowAddRequestModal] = useState(false);
  const [isOverFlow, setIsOverFlow] = useState(false);
  const [leftScrollDisable, setLeftScrollDisable] = useState(false);
  const [rightScrollDisable, setRightScrollDisable] = useState(false);

  const newRequestFetcher = useRequestNewActionFetcher();
  const { organizationId, projectId } = useParams();
  const gitFileIssues = useGitFileIssues();

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
  const issuesByWorkspaceId = gitFileIssues.issuesByWorkspaceId;

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
      models.example.type,
      models.project.type,
      models.socketIORequest.type,
    ];
    return list.includes(docType);
  };

  // Kept in sync with `tabList` via the effect below so `handleDelete` can read
  // the current tab list without depending on it directly. `tabList` changes on
  // every tab open/close/activate, and `handleDelete` is itself a dependency of
  // the `db.changes` subscription effect further down — if `handleDelete`'s
  // identity changed with `tabList`, that effect would unsubscribe/resubscribe
  // on every tab change instead of only when the database service handlers change.
  const tabListRef = React.useRef(tabList);
  useEffect(() => {
    tabListRef.current = tabList;
  }, [tabList]);

  const handleDelete = useCallback(
    // `removedDocs` carries every document removed in the same change batch, so
    // a cascade (a request delete also removes its examples) can be told apart
    // from a single delete.
    (doc: BaseModel, removedDocs?: Map<string, BaseModel>) => {
      const { _id: docId, type: docType, parentId } = doc;
      if (docType === models.project.type) {
        // delete all tabs of this project
        closeAllTabsUnderProject?.(docId, { removeFromClosedTabs: true });
      } else if (docType === models.workspace.type) {
        // delete all tabs of this workspace
        closeAllTabsUnderWorkspace?.(docId, { removeFromClosedTabs: true });
      } else if (docType === models.requestGroup.type) {
        // when delete a folder, we need also delete the corresponding folder runner tab(if exists)
        batchCloseTabs?.([docId, `runner_${docId}`], { removeFromClosedTabs: true });
      } else if (docType === models.example.type) {
        const closingTab = tabListRef.current.find(tab => tab.id === docId);
        const removedParent = parentId ? removedDocs?.get(parentId) : undefined;
        const fallbackUrl = getExampleDeleteFallbackUrl({
          parentId,
          // A request delete removes its examples too; landing on that request
          // would show a "Request not found" error.
          removedParentRequestParentId:
            removedParent && models.request.isRequest(removedParent) ? removedParent.parentId : undefined,
          closingTab,
          organizationId,
          projectId,
        });
        closeTabById(docId, { removeFromClosedTabs: true, fallbackUrl });
      } else if (isRequestLikeDocType(docType)) {
        const closingTab = tabListRef.current.find(tab => tab.id === docId);
        const fallbackUrl = getRequestDeleteFallbackUrl({ parentId, closingTab, organizationId, projectId });
        closeTabById(docId, { removeFromClosedTabs: true, fallbackUrl });
      } else {
        // delete tab by id
        closeTabById(docId, { removeFromClosedTabs: true });
      }
    },
    [batchCloseTabs, closeAllTabsUnderProject, closeAllTabsUnderWorkspace, closeTabById, organizationId, projectId],
  );

  // Requests whose example tabs were already hidden this session, so a run of
  // body edits does not re-query the examples on every keystroke.
  const examplesHiddenForRequestRef = useRef(new Set<string>());

  // A request that stops being able to host examples must not leave a way back
  // into them. The read path (`workspace-data.ts`) and the sidebar already hide
  // them; open tabs and their closed-tab history entries are the third place a
  // way back could exist, so close those too. The local documents stay put.
  const hideExampleTabsForRequest = useCallback(
    async (request: Request) => {
      if (models.example.canHostExamples(request)) {
        // Hostable again: a later switch-off has to run the cleanup again.
        examplesHiddenForRequestRef.current.delete(request._id);
        return;
      }
      if (examplesHiddenForRequestRef.current.has(request._id)) {
        return;
      }
      examplesHiddenForRequestRef.current.add(request._id);
      // Only the ids are needed: do not pull whole example documents (bodies can
      // be up to 1 MB each) over IPC just to close their tabs. The second field
      // matters — NeDB reads an `_id`-only projection as an omit list and hands
      // back the whole document.
      const examples = await database.find(
        models.example.type,
        { parentId: request._id },
        undefined,
        undefined,
        { _id: 1, parentId: 1 },
      );
      if (examples.length === 0) {
        return;
      }
      const exampleIds = new Set(examples.map(example => example._id));
      const closingTab = tabListRef.current.find(tab => exampleIds.has(tab.id));
      const fallbackUrl = getExampleDeleteFallbackUrl({
        parentId: request._id,
        closingTab,
        organizationId,
        projectId,
      });
      // Every example id, not only the open ones: this also clears the
      // closed-tab history entries that would offer a way back.
      batchCloseTabs?.(examples.map(example => example._id), { removeFromClosedTabs: true, fallbackUrl });
    },
    [batchCloseTabs, organizationId, projectId],
  );

  const handleUpdate = useCallback(
    async (doc: BaseModel, patches: Partial<BaseModel>[] = []) => {
      const patchObj: Record<string, any> = {};
      patches.forEach(patch => {
        Object.assign(patchObj, patch);
      });
      // Any edit can leave the request unable to host examples (the body type,
      // an Accept header), and the check runs on the post-change document, so it
      // is evaluated for every request update rather than for a list of fields
      // that has to be kept in sync with the model.
      if (models.request.isRequest(doc)) {
        await hideExampleTabsForRequest(doc);
      }
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
        const workspace = await services.workspace.getById(patchObj.parentId);
        if (workspace) {
          const exampleUrl = (requestId: string, exampleId: string) =>
            `/organization/${organizationId}/project/${projectId}/workspace/${workspace._id}/debug/request/${requestId}/example/${exampleId}`;
          if (
            isRequest(doc) ||
            models.grpcRequest.isGrpcRequest(doc) ||
            models.webSocketRequest.isWebSocketRequest(doc) ||
            models.socketIORequest.isSocketIORequest(doc)
          ) {
            updateTabById?.(doc._id, {
              workspaceId: workspace._id,
              workspaceName: workspace.name,
              url: `/organization/${organizationId}/project/${projectId}/workspace/${workspace._id}/debug/request/${doc._id}`,
            });
            if (isRequest(doc)) {
              // The example tabs carry the parent request's location, so they
              // move with it.
              const openExampleIds = new Set(tabListRef.current.map(tab => tab.id));
              const examples = await database.find(
                models.example.type,
                { parentId: doc._id },
                undefined,
                undefined,
                { _id: 1, parentId: 1 },
              );
              for (const example of examples) {
                if (openExampleIds.has(example._id)) {
                  updateTabById?.(example._id, {
                    workspaceId: workspace._id,
                    workspaceName: workspace.name,
                    url: exampleUrl(doc._id, example._id),
                  });
                }
              }
            }
          } else if (isRequestGroup(doc)) {
            const folderEntities = await database.getWithDescendants(doc, [
              models.request.type,
              models.grpcRequest.type,
              models.webSocketRequest.type,
              models.socketIORequest.type,
              models.requestGroup.type,
              models.example.type,
            ]);
            const batchUpdates = [doc, ...folderEntities].map(entity => {
              return {
                id: entity._id,
                fields: {
                  workspaceId: workspace._id,
                  workspaceName: workspace.name,
                  url: isRequestGroup(entity)
                    ? `/organization/${organizationId}/project/${projectId}/workspace/${workspace._id}/debug/request-group/${entity._id}`
                    : models.example.isExample(entity)
                      ? exampleUrl(entity.parentId, entity._id)
                      : `/organization/${organizationId}/project/${projectId}/workspace/${workspace._id}/debug/request/${entity._id}`,
                },
              };
            });
            batchUpdateTabs?.(batchUpdates);
          }
        }
      }
    },
    [
      hideExampleTabsForRequest,
      organizationId,
      projectId,
      updateProjectName,
      updateTabById,
      updateWorkspaceName,
      batchUpdateTabs,
    ],
  );

  useEffect(() => {
    // sync tabList with database
    const unsubscribe = window.main.on('db.changes', async (_, changes: ChangeBufferEvent[]) => {
      const removedDocs = new Map(
        changes.flatMap(([changeType, doc]) => (changeType === 'remove' ? [[doc._id, doc] as const] : [])),
      );
      for (const change of changes) {
        const [changeType, doc, patches] = change;

        if (needHandleChange(changeType, doc.type)) {
          if (changeType === 'remove') {
            handleDelete(doc, removedDocs);
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
        metrics: {
          source: 'tab-list',
        },
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
    <div className="box-content flex h-(--line-height-sm) bg-(--color-bg)">
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
          className="flex h-(--line-height-sm) w-fit"
          dragAndDropHooks={dragAndDropHooks}
          items={tabList}
          dependencies={[issuesByWorkspaceId]}
          ref={tabListInnerRef}
        >
          {item => <InsomniaTab tab={item} fileIssue={issuesByWorkspaceId[item.workspaceId]} />}
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
