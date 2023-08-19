import { ServiceError, StatusObject } from '@grpc/grpc-js';
import React, { FC, Fragment, useEffect, useState } from 'react';
import {
  Button,
  DropIndicator,
  GridList,
  Input,
  Item,
  ListBox,
  Menu,
  MenuTrigger,
  Popover,
  SearchField,
  Select,
  SelectValue,
  useDragAndDrop,
} from 'react-aria-components';
import {
  LoaderFunction,
  redirect,
  useFetcher,
  useNavigate,
  useParams,
  useRouteLoaderData,
  useSearchParams,
} from 'react-router-dom';
import { useListData } from 'react-stately';

import { SORT_ORDERS, SortOrder, sortOrderName } from '../../common/constants';
import { ChangeBufferEvent, database as db } from '../../common/database';
import { generateId } from '../../common/misc';
import type { GrpcMethodInfo } from '../../main/ipc/grpc';
import * as models from '../../models';
import { isGrpcRequest, isGrpcRequestId } from '../../models/grpc-request';
import { getByParentId as getGrpcRequestMetaByParentId } from '../../models/grpc-request-meta';
import {
  isEventStreamRequest,
  isRequest,
  isRequestId,
} from '../../models/request';
import { isRequestGroup } from '../../models/request-group';
import { getByParentId as getRequestMetaByParentId } from '../../models/request-meta';
import {
  isWebSocketRequest,
  isWebSocketRequestId,
} from '../../models/websocket-request';
import { invariant } from '../../utils/invariant';
import { WorkspaceSyncDropdown } from '../components/dropdowns/workspace-sync-dropdown';
import { ErrorBoundary } from '../components/error-boundary';
import { Icon } from '../components/icon';
import { useDocBodyKeyboardShortcuts } from '../components/keydown-binder';
import { showModal, showPrompt } from '../components/modals';
import { AskModal } from '../components/modals/ask-modal';
import { CookiesModal } from '../components/modals/cookies-modal';
import { GenerateCodeModal } from '../components/modals/generate-code-modal';
import { PromptModal } from '../components/modals/prompt-modal';
import { RequestSettingsModal } from '../components/modals/request-settings-modal';
import { WorkspaceEnvironmentsEditModal } from '../components/modals/workspace-environments-edit-modal';
import { GrpcRequestPane } from '../components/panes/grpc-request-pane';
import { GrpcResponsePane } from '../components/panes/grpc-response-pane';
import { PlaceholderRequestPane } from '../components/panes/placeholder-request-pane';
import { RequestPane } from '../components/panes/request-pane';
import { ResponsePane } from '../components/panes/response-pane';
import { SidebarLayout } from '../components/sidebar-layout';
import { formatMethodName } from '../components/tags/method-tag';
import { RealtimeResponsePane } from '../components/websockets/realtime-response-pane';
import { WebSocketRequestPane } from '../components/websockets/websocket-request-pane';
import {
  CreateRequestType,
  useRequestGroupMetaPatcher,
  useRequestMetaPatcher,
} from '../hooks/use-request';
import {
  GrpcRequestLoaderData,
  RequestLoaderData,
  WebSocketRequestLoaderData,
} from './request';
import { RootLoaderData } from './root';
import { WorkspaceLoaderData } from './workspace';

export interface GrpcMessage {
  id: string;
  text: string;
  created: number;
}

export interface GrpcRequestState {
  requestId: string;
  running: boolean;
  requestMessages: GrpcMessage[];
  responseMessages: GrpcMessage[];
  status?: StatusObject;
  error?: ServiceError;
  methods: GrpcMethodInfo[];
}

const INITIAL_GRPC_REQUEST_STATE = {
  running: false,
  requestMessages: [],
  responseMessages: [],
  status: undefined,
  error: undefined,
  methods: [],
};
export const loader: LoaderFunction = async ({ params }) => {
  if (!params.requestId) {
    const { projectId, workspaceId, organizationId } = params;
    invariant(workspaceId, 'Workspace ID is required');
    invariant(projectId, 'Project ID is required');
    const activeWorkspace = await models.workspace.getById(workspaceId);
    invariant(activeWorkspace, 'Workspace not found');
    const activeWorkspaceMeta =
      await models.workspaceMeta.getOrCreateByParentId(workspaceId);
    invariant(activeWorkspaceMeta, 'Workspace meta not found');
    const activeRequestId = activeWorkspaceMeta.activeRequestId;
    const activeRequest = activeRequestId ? await models.request.getById(activeRequestId) : null;
    if (activeRequest) {
      return redirect(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${activeRequestId}`);
    }
  }
  return null;
};

export const Debug: FC = () => {
  const {
    activeWorkspace,
    activeEnvironment,
    grpcRequests,
    subEnvironments,
    baseEnvironment,
    collection,
  } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  const requestData = useRouteLoaderData('request/:requestId') as
    | RequestLoaderData
    | GrpcRequestLoaderData
    | WebSocketRequestLoaderData
    | undefined;
  const { activeRequest } = requestData || {};
  const requestFetcher = useFetcher();
  const { organizationId, projectId, workspaceId, requestId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
    requestId: string;
  };
  const [grpcStates, setGrpcStates] = useState<GrpcRequestState[]>(
    grpcRequests.map(r => ({
      requestId: r._id,
      ...INITIAL_GRPC_REQUEST_STATE,
    })),
  );
  const [isCookieModalOpen, setIsCookieModalOpen] = useState(false);
  const [isRequestSettingsModalOpen, setIsRequestSettingsModalOpen] =
    useState(false);
  const [isEnvironmentModalOpen, setEnvironmentModalOpen] = useState(false);

  const patchRequestMeta = useRequestMetaPatcher();
  useEffect(() => {
    db.onChange(async (changes: ChangeBufferEvent[]) => {
      for (const change of changes) {
        const [event, doc] = change;
        if (isGrpcRequest(doc) && event === 'insert') {
          setGrpcStates(grpcStates => [
            ...grpcStates,
            { requestId: doc._id, ...INITIAL_GRPC_REQUEST_STATE },
          ]);
        }
      }
    });
  }, []);

  const { settings } = useRouteLoaderData('root') as RootLoaderData;
  // const { sidebarFilter } = activeWorkspaceMeta;
  const [runningRequests, setRunningRequests] = useState<
    Record<string, boolean>
  >({});
  const setLoading = (isLoading: boolean) => {
    invariant(requestId, 'No active request');
    if (Boolean(runningRequests?.[requestId]) !== isLoading) {
      setRunningRequests({
        ...runningRequests,
        [requestId]: isLoading ? true : false,
      });
    }
  };

  const grpcState = grpcStates.find(s => s.requestId === requestId);
  const setGrpcState = (newState: GrpcRequestState) =>
    setGrpcStates(state =>
      state.map(s => (s.requestId === requestId ? newState : s)),
    );
  const reloadRequests = (requestIds: string[]) => {
    setGrpcStates(state =>
      state.map(s =>
        requestIds.includes(s.requestId) ? { ...s, methods: [] } : s,
      ),
    );
  };
  useEffect(
    () =>
      window.main.on('grpc.start', (_, id) => {
        setGrpcStates(state =>
          state.map(s => (s.requestId === id ? { ...s, running: true } : s)),
        );
      }),
    [],
  );
  useEffect(
    () =>
      window.main.on('grpc.end', (_, id) => {
        setGrpcStates(state =>
          state.map(s => (s.requestId === id ? { ...s, running: false } : s)),
        );
      }),
    [],
  );
  useEffect(
    () =>
      window.main.on('grpc.data', (_, id, value) => {
        setGrpcStates(state =>
          state.map(s =>
            s.requestId === id
              ? {
                  ...s,
                  responseMessages: [
                    ...s.responseMessages,
                    {
                      id: generateId(),
                      text: JSON.stringify(value),
                      created: Date.now(),
                    },
                  ],
                }
              : s,
          ),
        );
      }),
    [],
  );
  useEffect(
    () =>
      window.main.on('grpc.error', (_, id, error) => {
        setGrpcStates(state =>
          state.map(s => (s.requestId === id ? { ...s, error } : s)),
        );
      }),
    [],
  );
  useEffect(
    () =>
      window.main.on('grpc.status', (_, id, status) => {
        setGrpcStates(state =>
          state.map(s => (s.requestId === id ? { ...s, status } : s)),
        );
      }),
    [],
  );

  useDocBodyKeyboardShortcuts({
    request_togglePin: async () => {
      if (requestId) {
        const meta = isGrpcRequestId(requestId)
          ? await getGrpcRequestMetaByParentId(requestId)
          : await getRequestMetaByParentId(requestId);
        patchRequestMeta(requestId, { pinned: !meta?.pinned });
      }
    },
    request_showSettings: () => {
      if (activeRequest) {
        setIsRequestSettingsModalOpen(true);
      }
    },
    request_showDelete: () => {
      if (activeRequest) {
        showModal(AskModal, {
          title: 'Delete Request?',
          message: `Really delete ${activeRequest.name}?`,
          onDone: async (confirmed: boolean) => {
            if (confirmed) {
              requestFetcher.submit(
                { id: requestId },
                {
                  action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/delete`,
                  method: 'post',
                },
              );
            }
          },
        });
      }
    },
    request_showDuplicate: () => {
      if (activeRequest) {
        showModal(PromptModal, {
          title: 'Duplicate Request',
          defaultValue: activeRequest.name,
          submitName: 'Create',
          label: 'New Name',
          selectText: true,
          onComplete: async (name: string) => {
            requestFetcher.submit(
              { name },
              {
                action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${requestId}/duplicate`,
                method: 'post',
                encType: 'application/json',
              },
            );
          },
        });
      }
    },
    request_createHTTP: async () => {
      const parentId = activeRequest
        ? activeRequest.parentId
        : activeWorkspace._id;
      requestFetcher.submit(
        { requestType: 'HTTP', parentId },
        {
          action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/new`,
          method: 'post',
          encType: 'application/json',
        },
      );
    },
    request_showCreateFolder: () => {
      const parentId = activeRequest ? activeRequest.parentId : workspaceId;
      showPrompt({
        title: 'New Folder',
        defaultValue: 'My Folder',
        submitName: 'Create',
        label: 'Name',
        selectText: true,
        onComplete: name =>
          requestFetcher.submit(
            { parentId, name },
            {
              action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request-group/new`,
              method: 'post',
            },
          ),
      });
    },
    // TODO: fix these
    request_showRecent: () => {},
    request_quickSwitch: () => {},
    environment_showEditor: () => setEnvironmentModalOpen(true),
    showCookiesEditor: () => setIsCookieModalOpen(true),
    request_showGenerateCodeEditor: () => {
      if (activeRequest && isRequest(activeRequest)) {
        showModal(GenerateCodeModal, { request: activeRequest });
      }
    },
  });
  // Close all websocket connections when the active environment changes
  useEffect(() => {
    return () => {
      window.main.webSocket.closeAll();
      window.main.grpc.closeAll();
    };
  }, [activeEnvironment?._id]);
  const isRealtimeRequest =
    activeRequest &&
    (isWebSocketRequest(activeRequest) || isEventStreamRequest(activeRequest));

  const setActiveEnvironmentFetcher = useFetcher();
  const [searchParams, setSearchParams] = useSearchParams();

  const sortOrder = searchParams.get('sortOrder') as SortOrder || 'type-manual';
  const { hotKeyRegistry } = settings;

  const createRequest = (requestType: CreateRequestType) =>
    requestFetcher.submit(
      { requestType, parentId: workspaceId, clipboardText: window.clipboard.readText() },
      {
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/new`,
        method: 'post',
        encType: 'application/json',
      },
    );

  const groupMetaPatcher = useRequestGroupMetaPatcher();
  const reorderFetcher = useFetcher();
  console.log({ collection });

  const navigate = useNavigate();

  const collectionDragAndDrop = useDragAndDrop({
    getItems: keys =>
      [...keys].map(key => ({ 'text/plain': key.toString() })),
    onReorder(event) {
      const id = event.keys.values().next().value.toString();
      const targetId = event.target.key.toString();

      const targetIndex = collection.findIndex(r => r.doc._id === targetId);
      let metaSortKey = 0;

      if (event.target.dropPosition === 'before') {
        const beforeTarget = collection[targetIndex - 1];
        const afterTarget = collection[targetIndex];

        if (beforeTarget) {
          const afterKey = afterTarget?.doc.metaSortKey;
          const beforeKey =
            beforeTarget?.doc.metaSortKey && beforeTarget.level === afterTarget.level
              ? beforeTarget?.doc.metaSortKey
              : afterKey + 100;

          metaSortKey = afterKey - (afterKey - beforeKey) / 2;
        } else {
          metaSortKey = afterTarget.doc.metaSortKey + 100;
        }
      } else {
        const beforeTarget = collection[targetIndex];
        const afterTarget = collection[targetIndex + 1];

        if (afterTarget) {
          let beforeKey = beforeTarget?.doc.metaSortKey;
          let afterKey =
            afterTarget?.doc.metaSortKey && afterTarget.level === beforeTarget.level
              ? afterTarget.doc.metaSortKey
              : beforeKey - 100;

          if (afterTarget.level > beforeTarget.level) {
            beforeKey = afterTarget.doc.metaSortKey - 200;
            afterKey = afterTarget.doc.metaSortKey - 100;
          }

          metaSortKey = afterKey - (afterKey - beforeKey) / 2;
        } else {
          metaSortKey = beforeTarget.doc.metaSortKey - 100;
        }
      }

      reorderFetcher.submit(
        {
          targetId,
          id,
          dropPosition: event.target.dropPosition,
          metaSortKey,
        },
        {
          action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/reorder`,
          method: 'POST',
          encType: 'application/json',
        },
      );
    },
    renderDropIndicator(target) {
      return (
        <DropIndicator
          target={target}
          className="outline-[--color-surprise] outline-1 outline"
        />
      );
    },
  });

  const createNewItemList = useListData({
    initialItems: [
      {
        id: 'HTTP',
        name: 'HTTP Request',
        icon: 'plus-circle',
        hint: hotKeyRegistry.request_createHTTP,
        action: () => createRequest('HTTP'),
      },
      {
        id: 'Event Stream',
        name: 'Event Stream Request',
        icon: 'plus-circle',
        action: () => createRequest('Event Stream'),
      },
      {
        id: 'GraphQL Request',
        name: 'GraphQL Request',
        icon: 'plus-circle',
        action: () => createRequest('GraphQL'),
      },
      {
        id: 'gRPC Request',
        name: 'gRPC Request',
        icon: 'plus-circle',
        action: () => createRequest('gRPC'),
      },
      {
        id: 'WebSocket Request',
        name: 'WebSocket Request',
        icon: 'plus-circle',
        action: () => createRequest('WebSocket'),
      },
      {
        id: 'From Curl',
        name: 'From Curl',
        icon: 'plus-circle',
        value: () => createRequest('From Curl'),
      },
      {
        id: 'New Folder',
        name: 'New Folder',
        icon: 'folder',
        action: () =>
          showPrompt({
            title: 'New Folder',
            defaultValue: 'My Folder',
            submitName: 'Create',
            label: 'Name',
            selectText: true,
            onComplete: name =>
              requestFetcher.submit(
                { parentId: workspaceId, name },
                {
                  action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request-group/new`,
                  method: 'post',
                },
              ),
          }),
      },
    ],
  });

  return (
      <SidebarLayout
      className="new-sidebar"
        renderPageSidebar={
          <div className="flex flex-1 flex-col gap-2 overflow-hidden">
            <div className="flex items-center gap-2 justify-between px-[--padding-sm] pt-[--padding-sm]">
              <Select
                aria-label="Select an environment"
                onSelectionChange={environmentId => {
                  setActiveEnvironmentFetcher.submit(
                    {
                      environmentId,
                    },
                    {
                      method: 'post',
                      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/environment/set-active`,
                    },
                  );
                }}
                selectedKey={activeEnvironment._id}
                items={[baseEnvironment, ...subEnvironments].map(e => ({
                  ...e,
                  id: e._id,
                }))}
              >
                <Button className="px-4 py-1 flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
                  <SelectValue className="flex items-center justify-center gap-2">
                    {({ isPlaceholder, selectedItem }) => {
                      if (
                        isPlaceholder ||
                        selectedItem._id === baseEnvironment._id
                      ) {
                        return <Fragment>No environment</Fragment>;
                      }

                      return (
                        <Fragment>
                          <Icon
                            icon="circle"
                            style={{
                              color: selectedItem.color,
                            }}
                          />
                          {selectedItem.name}
                        </Fragment>
                      );
                    }}
                  </SelectValue>
                </Button>
                <Popover className="min-w-max">
                  <ListBox
                    key={activeEnvironment._id}
                    className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
                  >
                    {item => (
                      <Item
                        id={item._id}
                        key={item._id}
                        className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
                        aria-label={item.name}
                        textValue={item.name}
                        value={item}
                      >
                        {({ isSelected }) => (
                          <Fragment>
                            <Icon
                              icon="circle"
                              style={{
                                color: item.color,
                              }}
                            />
                            <span>{item.name}</span>
                            {isSelected && (
                              <Icon
                                icon="check"
                                className="text-[--color-success] justify-self-end"
                              />
                            )}
                          </Fragment>
                        )}
                      </Item>
                    )}
                  </ListBox>
                </Popover>
              </Select>
              <Button
                onPress={() => setIsCookieModalOpen(true)}
                className="px-4 py-1 flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
              >
                <Icon icon="cookie-bite" />
                Cookies
              </Button>
            </div>

            <div className="flex justify-between gap-1 px-[--padding-sm]">
              <SearchField
                aria-label="Collection filter"
                className="group relative flex-1"
              >
                <Input
                  placeholder="Filter"
                  className="py-1 w-full pl-2 pr-7 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors"
                />
                <div className='flex items-center px-2 absolute right-0 top-0 h-full'>
                  <Button className="flex group-data-[empty]:hidden items-center justify-center aspect-square w-5 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
                  <Icon icon="close" />
                </Button>
                </div>
              </SearchField>
              <Select
                aria-label="Select an environment"
                className="h-full aspect-square"
                selectedKey={sortOrder}
                onSelectionChange={order => setSearchParams({ sortOrder: order.toString() })}
                items={SORT_ORDERS.map(order => {
                  return {
                    id: order,
                    name: sortOrderName[order],
                  };
                })}
              >
                <Button
                  aria-label="Show environments"
                  className="flex flex-shrink-0 items-center justify-center aspect-square h-full aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                >
                  <Icon icon="sort" />
                </Button>
                <Popover className="min-w-max">
                  <ListBox className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none">
                    {item => (
                      <Item
                        id={item.id}
                        key={item.id}
                        className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
                        aria-label={item.name}
                        textValue={item.name}
                        value={item}
                      >
                        {({ isSelected }) => (
                          <Fragment>
                            <span>{item.name}</span>
                            {isSelected && (
                              <Icon
                                icon="check"
                                className="text-[--color-success] justify-self-end"
                              />
                            )}
                          </Fragment>
                        )}
                      </Item>
                    )}
                  </ListBox>
                </Popover>
              </Select>

              <MenuTrigger>
                <Button
                  aria-label="Create in collection"
                  className="flex items-center justify-center h-full aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                >
                  <Icon icon="plus-circle" />
                </Button>
                <Popover className="min-w-max">
                  <Menu
                    aria-label="Create a new request"
                    selectionMode="single"
                    onAction={key => createNewItemList.getItem(key).action()}
                    items={createNewItemList.items}
                    className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
                  >
                    {item => (
                      <Item
                        key={item.id}
                        id={item.id}
                        className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
                        aria-label={item.name}
                      >
                        <Icon icon={item.icon} />
                        <span>{item.name}</span>
                      </Item>
                    )}
                  </Menu>
                </Popover>
              </MenuTrigger>
            </div>

            <GridList
              className="flex-1 overflow-y-auto"
              items={collection.filter(item => !item.hidden)}
              aria-label="Request Collection"
              disallowEmptySelection
              dragAndDropHooks={collectionDragAndDrop.dragAndDropHooks}
              selectedKeys={[requestId]}
              selectionMode="single"
              onSelectionChange={keys => {
                if (keys !== 'all') {
                  const value = keys.values().next().value;
                  console.log(value);
                  const item = collection.find(item => item.doc._id === value);
                  if (item && isRequestGroup(item.doc)) {
                    groupMetaPatcher(value, { collapsed: !item.collapsed });
                  } else {
                    navigate(
                      `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${value}`,
                    );
                  }
                }
              }}
            >
              {item => {
                return (
                  <Item
                    key={item.doc._id}
                    id={item.doc._id}
                    className="group outline-none select-none"
                  >
                    <div
                      className="flex select-none outline-none group-aria-selected:text-[--color-font] relative group-hover:bg-[--hl-xs] group-focus:bg-[--hl-sm] transition-colors gap-2 px-4 items-center h-[--line-height-xs] w-full overflow-hidden text-[--hl]"
                      style={{
                        paddingLeft: `${item.level + 1}rem`,
                      }}
                    >
                      <span className="group-aria-selected:bg-[--color-surprise] transition-colors top-0 left-0 absolute h-full w-[2px] bg-transparent" />
                      {isRequest(item.doc) && (
                        <span className="w-10 flex-shrink-0 flex text-[0.65rem] rounded-sm border border-solid border-[--hl-sm] items-center justify-center">
                          {formatMethodName(item.doc.method)}
                        </span>
                      )}
                      {isRequestGroup(item.doc) && (
                        <Icon
                          className="w-6"
                          icon={item.collapsed ? 'folder' : 'folder-open'}
                        />
                      )}
                      <span className="truncate">{item.doc.name}</span>
                      <span className="flex-1" />
                    </div>
                  </Item>
                );
              }}
            </GridList>
            <WorkspaceSyncDropdown />

            {isEnvironmentModalOpen && (
              <WorkspaceEnvironmentsEditModal
                onHide={() => setEnvironmentModalOpen(false)}
              />
            )}
            {isCookieModalOpen && (
              <CookiesModal onHide={() => setIsCookieModalOpen(false)} />
            )}
          </div>
        }
        renderPaneOne={
          workspaceId ? (
            <ErrorBoundary showAlert>
              {isGrpcRequestId(requestId) && grpcState && (
                <GrpcRequestPane
                  grpcState={grpcState}
                  setGrpcState={setGrpcState}
                  reloadRequests={reloadRequests}
                />
              )}
              {isWebSocketRequestId(requestId) && (
                <WebSocketRequestPane environment={activeEnvironment} />
              )}
              {isRequestId(requestId) && (
                <RequestPane
                  environmentId={activeEnvironment ? activeEnvironment._id : ''}
                  settings={settings}
                  setLoading={setLoading}
                />
              )}
              {!requestId && <PlaceholderRequestPane />}
              {isRequestSettingsModalOpen && activeRequest && (
                <RequestSettingsModal
                  request={activeRequest}
                  onHide={() => setIsRequestSettingsModalOpen(false)}
                />
              )}
            </ErrorBoundary>
          ) : null
        }
        renderPaneTwo={
          <ErrorBoundary showAlert>
            {activeRequest && isGrpcRequest(activeRequest) && grpcState && (
              <GrpcResponsePane grpcState={grpcState} />
            )}
            {isRealtimeRequest && (
              <RealtimeResponsePane requestId={activeRequest._id} />
            )}
            {activeRequest &&
              isRequest(activeRequest) &&
              !isRealtimeRequest && (
                <ResponsePane runningRequests={runningRequests} />
              )}
          </ErrorBoundary>
        }
    />
  );
};

export default Debug;
