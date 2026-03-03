import type { IconName } from '@fortawesome/fontawesome-svg-core';
import type { ServiceError, StatusObject } from '@grpc/grpc-js';
import { useVirtualizer } from '@tanstack/react-virtual';
import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Breadcrumb,
  Breadcrumbs,
  Button,
  Collection,
  DropIndicator,
  GridList,
  GridListItem,
  Header,
  Input,
  ListBox,
  ListBoxItem,
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  Popover,
  SearchField,
  Select,
  ToggleButton,
  Tooltip,
  TooltipTrigger,
  useDragAndDrop,
} from 'react-aria-components';
import { type ImperativePanelGroupHandle, Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import {
  href,
  NavLink,
  redirect,
  Route as RouteComponent,
  Routes,
  useFetchers,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router';
import { useLocalStorage } from 'react-use';

import { DEFAULT_SIDEBAR_SIZE, getProductName, SORT_ORDERS, type SortOrder, sortOrderName } from '~/common/constants';
import { type ChangeBufferEvent } from '~/common/database';
import { generateId, isNotNullOrUndefined } from '~/common/misc';
import type { PlatformKeyCombinations } from '~/common/settings';
import type { GrpcMethodInfo } from '~/main/ipc/grpc';
import * as models from '~/models';
import type { Environment } from '~/models/environment';
import { type GrpcRequest, isGrpcRequest, isGrpcRequestId } from '~/models/grpc-request';
import { getByParentId as getGrpcRequestMetaByParentId } from '~/models/grpc-request-meta';
import { isScratchpadOrganizationId } from '~/models/organization';
import type { Project } from '~/models/project';
import {
  isEventStreamRequest,
  isGraphqlSubscriptionRequest,
  isRequest,
  isRequestId,
  type Request,
} from '~/models/request';
import { isRequestGroup, isRequestGroupId, type RequestGroup } from '~/models/request-group';
import { getByParentId as getRequestMetaByParentId } from '~/models/request-meta';
import { isSocketIORequest, isSocketIORequestId, type SocketIORequest } from '~/models/socket-io-request';
import { isWebSocketRequest, isWebSocketRequestId, type WebSocketRequest } from '~/models/websocket-request';
import { isDesign, type Workspace } from '~/models/workspace';
import { useRootLoaderData } from '~/root';
import {
  type Child,
  useWorkspaceLoaderData,
} from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { useDebugReorderActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.reorder';
import { useRequestLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import { useRequestDuplicateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.duplicate';
import { useRequestDeleteActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.delete';
import { useRequestNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.new';
import { useRequestGroupNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.new';
import Runner from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.runner';
import Tutorial, {
  scratchPadTutorialList,
} from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.tutorial.$panel';
import { useToggleExpandAllActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.toggle-expand-all';
import { SegmentEvent } from '~/ui/analytics';
import { DropdownHint } from '~/ui/components/base/dropdown/dropdown-hint';
import { DocumentTab } from '~/ui/components/document-tab';
import { RequestActionsDropdown } from '~/ui/components/dropdowns/request-actions-dropdown';
import { RequestGroupActionsDropdown } from '~/ui/components/dropdowns/request-group-actions-dropdown';
import { WorkspaceDropdown } from '~/ui/components/dropdowns/workspace-dropdown';
import { WorkspaceSyncDropdown } from '~/ui/components/dropdowns/workspace-sync-dropdown';
import { EditableInput } from '~/ui/components/editable-input';
import { EnvironmentPicker } from '~/ui/components/environment-picker';
import { ErrorBoundary } from '~/ui/components/error-boundary';
import { Icon } from '~/ui/components/icon';
import { useDocBodyKeyboardShortcuts } from '~/ui/components/keydown-binder';
import { McpPane } from '~/ui/components/mcp/mcp-pane';
import { showModal } from '~/ui/components/modals';
import { AskModal } from '~/ui/components/modals/ask-modal';
import { CookiesModal } from '~/ui/components/modals/cookies-modal';
import { ErrorModal } from '~/ui/components/modals/error-modal';
import { GenerateCodeModal } from '~/ui/components/modals/generate-code-modal';
import { ImportModal } from '~/ui/components/modals/import-modal/import-modal';
import { PasteCurlModal } from '~/ui/components/modals/paste-curl-modal';
import { PromptModal } from '~/ui/components/modals/prompt-modal';
import { RequestSettingsModal } from '~/ui/components/modals/request-settings-modal';
import { CertificatesModal } from '~/ui/components/modals/workspace-certificates-modal';
import { WorkspaceEnvironmentsEditModal } from '~/ui/components/modals/workspace-environments-edit-modal';
import { GrpcRequestPane } from '~/ui/components/panes/grpc-request-pane';
import { GrpcResponsePane } from '~/ui/components/panes/grpc-response-pane';
import { PlaceholderRequestPane } from '~/ui/components/panes/placeholder-request-pane';
import { RequestGroupPane } from '~/ui/components/panes/request-group-pane';
import { RequestPane } from '~/ui/components/panes/request-pane';
import { ResponsePane } from '~/ui/components/panes/response-pane';
import { SocketIORequestPane } from '~/ui/components/socket-io/request-pane';
import { OrganizationTabList } from '~/ui/components/tabs/tab-list';
import { getMethodShortHand } from '~/ui/components/tags/method-tag';
import { showResourceNotFoundToast } from '~/ui/components/toast-notification';
import { RealtimeResponsePane } from '~/ui/components/websockets/realtime-response-pane';
import { WebSocketRequestPane } from '~/ui/components/websockets/websocket-request-pane';
import { INSOMNIA_TAB_HEIGHT } from '~/ui/constant';
import { useExecutionState } from '~/ui/hooks/use-execution-state';
import { useFilteredRequests } from '~/ui/hooks/use-filtered-requests';
import { useTabNavigate } from '~/ui/hooks/use-insomnia-tab';
import { useReadyState } from '~/ui/hooks/use-ready-state';
import {
  type CreateRequestType,
  useRequestGroupMetaPatcher,
  useRequestGroupPatcher,
  useRequestMetaPatcher,
  useRequestPatcher,
} from '~/ui/hooks/use-request';
import { isPrimaryClickModifier } from '~/ui/utils';
import { scrollElementIntoView } from '~/utils';
import { getGrpcConnectionErrorDetails, isGrpcConnectionError } from '~/utils/grpc';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug';

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

export async function clientLoader({ params, request }: Route.ClientLoaderArgs) {
  if (!params.requestId && !params.requestGroupId) {
    const { projectId, workspaceId, organizationId } = params;

    const activeProject = await models.project.getById(projectId);
    if (!activeProject) {
      showResourceNotFoundToast(`Project not found: ${projectId}`);
      throw redirect(href('/organization/:organizationId/project', { organizationId }));
    }

    const activeWorkspace = await models.workspace.getById(workspaceId);
    if (!activeWorkspace) {
      showResourceNotFoundToast(`Workspace not found: ${workspaceId}`);
      throw redirect(href('/organization/:organizationId/project/:projectId', { organizationId, projectId }));
    }

    const activeWorkspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspaceId);
    const activeRequestId = activeWorkspaceMeta.activeRequestId;
    const activeRequest = activeRequestId ? await models.request.getById(activeRequestId) : null;
    // TODO(george): we should remove this after enabling the sidebar for the runner
    const startOfQuery = request.url.indexOf('?');
    const urlWithoutQuery = startOfQuery > 0 ? request.url.slice(0, startOfQuery) : request.url;
    const isDisplayingRunner = urlWithoutQuery.includes('/runner');
    const doNotSkipToActiveRequest = request.url.includes('doNotSkipToActiveRequest=true');
    if (activeRequest && !isDisplayingRunner && !doNotSkipToActiveRequest) {
      return redirect(
        `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${activeRequestId}`,
      );
    }
  }
  return null;
}

const WebSocketSpinner = ({ requestId }: { requestId: string }) => {
  const readyState = useReadyState({ requestId, protocol: 'webSocket' });
  return readyState ? (
    <div
      className="mr-(--padding-sm) h-2.5 w-2.5 shrink-0 rounded-full bg-(--color-success)"
      data-testid="WebSocketSpinner__Connected"
    />
  ) : null;
};

const SocketIOSpinner = ({ requestId }: { requestId: string }) => {
  const readyState = useReadyState({ requestId, protocol: 'socketIO' });
  return readyState ? (
    <div
      className="mr-(--padding-sm) h-2.5 w-2.5 shrink-0 rounded-full bg-(--color-success)"
      data-testid="SocketIOSpinner__Connected"
    />
  ) : null;
};

const EventStreamSpinner = ({ requestId }: { requestId: string }) => {
  const readyState = useReadyState({ requestId, protocol: 'curl' });
  return readyState ? (
    <div
      className="mr-(--padding-sm) h-2.5 w-2.5 shrink-0 rounded-full bg-(--color-success)"
      data-testid="EventStreamSpinner__Connected"
    />
  ) : null;
};

const getRequestNameOrFallback = (
  doc: Request | RequestGroup | GrpcRequest | WebSocketRequest | SocketIORequest,
): string => {
  return !isRequestGroup(doc) ? doc.name || doc.url || 'Untitled request' : doc.name || 'Untitled folder';
};

const RequestTiming = ({ requestId }: { requestId: string }) => {
  const { isExecuting } = useExecutionState({ requestId });
  return isExecuting ? (
    <div
      className="mr-(--padding-sm) h-2.5 w-2.5 shrink-0 rounded-full bg-(--color-success)"
      data-testid="WebSocketSpinner__Connected"
    />
  ) : null;
};

const DebugEntry = () => {
  const { activeWorkspace } = useWorkspaceLoaderData()!;

  if (activeWorkspace.scope === 'mcp') {
    // MCP request under mcp workspace has different layout so we need to render a different component
    return <McpPane />;
  }
  return <Debug />;
};

const Debug = () => {
  const {
    activeWorkspace,
    activeProject,
    activeEnvironment,
    activeCookieJar,
    caCertificate,
    clientCertificates,
    grpcRequests,
    collection: _collection,
  } = useWorkspaceLoaderData()!;

  const requestData = useRequestLoaderData();
  const { activeRequest } = requestData || {};

  const deleteRequestFetcher = useRequestDeleteActionFetcher();
  const duplicateRequestFetcher = useRequestDuplicateActionFetcher();
  const createRequestFetcher = useRequestNewActionFetcher();
  const createRequestGroupFetcher = useRequestGroupNewActionFetcher();

  const [isPasteCurlModalOpen, setPasteCurlModalOpen] = useState(false);
  const [pastedCurl, setPastedCurl] = useState('');

  const { organizationId, projectId, workspaceId, requestId, requestGroupId, panel } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
    requestId?: string;
    requestGroupId?: string;
    panel?: string;
  };

  const [filter, setFilter] = useLocalStorage<string>(`${workspaceId}:collection-list-filter`);
  const collection = useFilteredRequests(_collection, filter ?? '');

  const [grpcStates, setGrpcStates] = useState<GrpcRequestState[]>(
    grpcRequests.map(r => ({
      requestId: r._id,
      ...INITIAL_GRPC_REQUEST_STATE,
    })),
  );
  const [isCookieModalOpen, setIsCookieModalOpen] = useState(false);
  const [isRequestSettingsModalOpen, setIsRequestSettingsModalOpen] = useState(false);
  const [isEnvironmentModalOpen, setEnvironmentModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isEnvironmentPickerOpen, setIsEnvironmentPickerOpen] = useState(false);
  const [isCertificatesModalOpen, setCertificatesModalOpen] = useState(false);

  const patchRequest = useRequestPatcher();
  const patchGroup = useRequestGroupPatcher();
  const patchRequestMeta = useRequestMetaPatcher();
  useEffect(() => {
    const unsubscribe = window.main.on('db.changes', async (_, changes: ChangeBufferEvent[]) => {
      for (const change of changes) {
        const [event, doc] = change;
        if (isGrpcRequest(doc) && event === 'insert') {
          setGrpcStates(grpcStates => [...grpcStates, { requestId: doc._id, ...INITIAL_GRPC_REQUEST_STATE }]);
        }
      }
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const { settings } = useRootLoaderData()!;

  const grpcState = grpcStates.find(s => s.requestId === requestId);
  const setGrpcState = (newState: GrpcRequestState) =>
    setGrpcStates(state => state.map(s => (s.requestId === requestId ? newState : s)));
  const reloadRequests = (requestIds: string[]) => {
    setGrpcStates(state => state.map(s => (requestIds.includes(s.requestId) ? { ...s, methods: [] } : s)));
  };
  useEffect(
    () =>
      window.main.on('grpc.start', (_, id) => {
        setGrpcStates(state => state.map(s => (s.requestId === id ? { ...s, running: true } : s)));
      }),
    [],
  );
  useEffect(
    () =>
      window.main.on('grpc.end', (_, id) => {
        setGrpcStates(state => state.map(s => (s.requestId === id ? { ...s, running: false } : s)));
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
        if (isGrpcConnectionError(error)) {
          showModal(ErrorModal, { error, ...getGrpcConnectionErrorDetails(error) });
        }
        setGrpcStates(state => state.map(s => (s.requestId === id ? { ...s, error } : s)));
      }),
    [],
  );
  useEffect(
    () =>
      window.main.on('grpc.status', (_, id, status) => {
        setGrpcStates(state => state.map(s => (s.requestId === id ? { ...s, status } : s)));
      }),
    [],
  );

  const sidebarPanelRef = useRef<ImperativePanelGroupHandle>(null);

  function toggleSidebar() {
    const layout = sidebarPanelRef.current?.getLayout();

    if (!layout) {
      return;
    }

    layout[0] = layout && layout[0] > 0 ? 0 : DEFAULT_SIDEBAR_SIZE;

    sidebarPanelRef.current?.setLayout(layout);
  }

  useEffect(() => {
    const unsubscribe = window.main.on('toggle-sidebar', toggleSidebar);

    return unsubscribe;
  }, []);

  useDocBodyKeyboardShortcuts({
    sidebar_toggle: toggleSidebar,
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
      if (activeRequest && requestId) {
        showModal(AskModal, {
          title: 'Delete Request?',
          message: `Really delete ${activeRequest.name}?`,
          color: 'danger',
          onDone: async (confirmed: boolean) => {
            if (confirmed) {
              deleteRequestFetcher.submit({
                organizationId,
                projectId,
                workspaceId,
                id: requestId,
              });
            }
          },
        });
      }
    },
    request_showDuplicate: () => {
      if (activeRequest && requestId) {
        showModal(PromptModal, {
          title: 'Duplicate Request',
          defaultValue: activeRequest.name,
          submitName: 'Create',
          label: 'New Name',
          selectText: true,
          onComplete: async (name: string) => {
            duplicateRequestFetcher.submit({
              organizationId,
              projectId,
              requestId,
              workspaceId,
              name,
            });
          },
        });
      }
    },
    request_createHTTP: async () => {
      const parentId = activeRequest ? activeRequest.parentId : activeWorkspace._id;
      createRequestFetcher.submit({
        organizationId,
        projectId,
        workspaceId,
        requestType: 'HTTP',
        parentId,
      });
    },
    request_showCreateFolder: () => {
      const parentId = activeRequest ? activeRequest.parentId : workspaceId;
      showModal(PromptModal, {
        title: 'New Folder',
        defaultValue: 'My Folder',
        submitName: 'Create',
        label: 'Name',
        selectText: true,
        onComplete: name =>
          createRequestGroupFetcher.submit({
            organizationId,
            projectId,
            workspaceId,
            parentId,
            name,
          }),
      });
    },
    environment_showEditor: () => setEnvironmentModalOpen(true),
    environment_showSwitchMenu: () => setIsEnvironmentPickerOpen(true),
    showCookiesEditor: () => setIsCookieModalOpen(true),
    request_showGenerateCodeEditor: () => {
      if (activeRequest && isRequest(activeRequest)) {
        showModal(GenerateCodeModal, { request: activeRequest });
      }
    },
    request_openInNewTab: () => {
      if (activeRequest && requestId) {
        tabNavigate(
          {
            organization: organizationId,
            project: activeProject,
            workspace: activeWorkspace,
            item: activeRequest,
          },
          {
            withTab: true,
            shouldNavigate: true,
          },
        );
      }
    },
  });

  const isRealtimeRequest =
    activeRequest &&
    (isWebSocketRequest(activeRequest) ||
      isEventStreamRequest(activeRequest) ||
      isGraphqlSubscriptionRequest(activeRequest) ||
      isSocketIORequest(activeRequest));

  const [searchParams, setSearchParams] = useSearchParams();

  const sortOrder = (searchParams.get('sortOrder') as SortOrder) || 'type-manual';
  const { hotKeyRegistry } = settings;

  const createRequest = ({
    requestType,
    parentId,
    req,
  }: {
    requestType: CreateRequestType;
    parentId: string;
    req?: Partial<Request>;
  }) =>
    createRequestFetcher.submit({
      organizationId,
      projectId,
      workspaceId,
      requestType,
      parentId,
      req,
    });

  const reorderFetcher = useDebugReorderActionFetcher();

  const collectionDragAndDrop = useDragAndDrop({
    getItems: keys => [...keys].map(key => ({ 'text/plain': key.toString() })),
    onReorder(event) {
      const [firstKey] = event.keys.values();
      const id = firstKey.toString();
      const targetId = event.target.key.toString();

      const dropItem = collection.find(r => r.doc._id === id);
      const targetItem = collection.find(r => r.doc._id === targetId);

      if (!dropItem || !targetItem) {
        return;
      }

      // If the item we move is a folder we cannot move it inside it's ancestor folders so we must check the ancestry
      const isMovingFolderInsideItsChildren =
        isRequestGroup(dropItem.doc) && targetItem.ancestors?.includes(dropItem.doc._id);
      if (isMovingFolderInsideItsChildren) {
        return;
      }

      let metaSortKey = 0;
      // If the target is a folder and we insert after it we want to add that item to the folder
      const isMovingItemInsideFolder = isRequestGroup(targetItem.doc) && event.target.dropPosition === 'after';
      if (isMovingItemInsideFolder) {
        // there is no item before we move the item to the beginning
        // If there are children find the first child key and use a lower one
        // otherwise use whatever
        const children = collection.filter(r => r.doc.parentId === targetId);

        if (children.length > 0) {
          const firstChild = children[0];
          const firstChildKey = firstChild?.doc.metaSortKey;

          const keyBeforeFirstChildKey = firstChildKey - 100;

          metaSortKey = keyBeforeFirstChildKey;
        } else {
          // Doesn't matter what key we give since it's the first item in the folder
          // This is how we construct the default metaSortKey in the database so sorting will be loosely time based
          const defaultMetaSortKey = -1 * Date.now();
          metaSortKey = defaultMetaSortKey;
        }
      } else {
        // Everything is going to be moving the item besides the other items
        const targetSiblingsCollections = collection.filter(r => r.doc.parentId === targetItem.doc.parentId);
        const targetIndexInSiblingsCollection = targetSiblingsCollections.findIndex(r => r.doc._id === targetId);
        if (event.target.dropPosition === 'after') {
          const beforeItem = targetItem;
          const afterItem = targetSiblingsCollections[targetIndexInSiblingsCollection + 1];

          metaSortKey =
            beforeItem && afterItem
              ? beforeItem.doc.metaSortKey - (beforeItem.doc.metaSortKey - afterItem.doc.metaSortKey) / 2
              : beforeItem.doc.metaSortKey + 100;
        } else {
          const beforeItem = targetSiblingsCollections[targetIndexInSiblingsCollection - 1];
          const afterItem = targetItem;

          metaSortKey =
            beforeItem && afterItem
              ? afterItem.doc.metaSortKey - (afterItem.doc.metaSortKey - beforeItem.doc.metaSortKey) / 2
              : afterItem.doc.metaSortKey - 100;
        }
      }

      if (metaSortKey) {
        reorderFetcher.submit({
          organizationId,
          projectId,
          workspaceId,
          params: {
            targetId,
            id,
            dropPosition: event.target.dropPosition,
            metaSortKey,
          },
        });
      }
    },
    renderDropIndicator(target) {
      if (target.type === 'item') {
        const item = virtualizer.getVirtualItems().find(i => i.key === target.key);
        if (item) {
          return (
            <DropIndicator
              target={target}
              className="absolute top-0 left-0 z-10 w-full outline-1 outline-(--color-surprise) outline-solid"
              style={{
                transform: `translateY(${target.dropPosition === 'before' ? item?.start : item.end}px)`,
              }}
            />
          );
        }
      }

      return (
        <DropIndicator
          target={target}
          className="absolute top-0 left-0 outline-1 outline-(--color-surprise) outline-solid"
        />
      );
    },
  });

  const createInCollectionActionList: {
    name: string;
    id: string;
    icon: IconName;
    items: {
      id: string;
      name: string;
      icon: IconName;
      hint?: PlatformKeyCombinations;
      action: () => void;
    }[];
  }[] = [
    {
      name: 'Create',
      id: 'create',
      icon: 'plus',
      items: [
        {
          id: 'New Folder',
          name: 'New Folder',
          icon: 'folder',
          hint: hotKeyRegistry.request_showCreateFolder,
          action: () =>
            showModal(PromptModal, {
              title: 'New Folder',
              defaultValue: 'My Folder',
              submitName: 'Create',
              label: 'Name',
              selectText: true,
              onComplete: name =>
                createRequestGroupFetcher.submit({
                  organizationId,
                  projectId,
                  workspaceId,
                  parentId: workspaceId,
                  name,
                }),
            }),
        },
        {
          id: 'HTTP',
          name: 'HTTP Request',
          icon: 'plus-circle',
          hint: hotKeyRegistry.request_createHTTP,
          action: () =>
            createRequest({
              requestType: 'HTTP',
              parentId: workspaceId,
            }),
        },
        {
          id: 'Event Stream',
          name: 'Event Stream Request (SSE)',
          icon: 'plus-circle',
          action: () =>
            createRequest({
              requestType: 'Event Stream',
              parentId: workspaceId,
            }),
        },
        {
          id: 'GraphQL Request',
          name: 'GraphQL Request',
          icon: 'plus-circle',
          action: () =>
            createRequest({
              requestType: 'GraphQL',
              parentId: workspaceId,
            }),
        },
        {
          id: 'gRPC Request',
          name: 'gRPC Request',
          icon: 'plus-circle',
          action: () =>
            createRequest({
              requestType: 'gRPC',
              parentId: workspaceId,
            }),
        },
        {
          id: 'WebSocket Request',
          name: 'WebSocket Request',
          icon: 'plus-circle',
          action: () =>
            createRequest({
              requestType: 'WebSocket',
              parentId: workspaceId,
            }),
        },
        {
          id: 'Socket.IO Request',
          name: 'Socket.IO Request',
          icon: 'plus-circle',
          action: () =>
            createRequest({
              requestType: 'SocketIO',
              parentId: workspaceId,
            }),
        },
      ],
    },
    {
      name: 'Import',
      id: 'import',
      icon: 'file-import',
      items: [
        {
          id: 'From Curl',
          name: 'From Curl',
          icon: 'terminal',
          action: () => setPasteCurlModalOpen(true),
        },
        {
          id: 'from-file',
          name: 'From File',
          icon: 'file-import',
          action: () => setIsImportModalOpen(true),
        },
      ],
    },
  ];

  // const allCollapsed = collection.every(item => item.hidden);
  const [allExpanded, setAllExpanded] = useState(false);

  const toggleExpandAllFetcher = useToggleExpandAllActionFetcher();

  const visibleCollection = collection.filter(item => !item.hidden);

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer<HTMLDivElement, Element>({
    getScrollElement: () => parentRef.current,
    count: visibleCollection.length,
    estimateSize: React.useCallback(() => 32, []),
    overscan: 30,
    getItemKey: index => visibleCollection[index].doc._id,
  });

  const [direction, setDirection] = useState<'horizontal' | 'vertical'>(
    settings.forceVerticalLayout ? 'vertical' : 'horizontal',
  );
  useEffect(() => {
    if (settings.forceVerticalLayout) {
      setDirection('vertical');
      return () => {};
    }
    // Listen on media query changes
    const mediaQuery = window.matchMedia('(max-width: 880px)');
    setDirection(mediaQuery.matches ? 'vertical' : 'horizontal');

    const handleChange = (e: MediaQueryListEvent) => {
      setDirection(e.matches ? 'vertical' : 'horizontal');
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [settings.forceVerticalLayout, direction]);

  const tabNavigate = useTabNavigate();

  return (
    <PanelGroup
      ref={sidebarPanelRef}
      autoSaveId="insomnia-sidebar"
      id="wrapper"
      className="new-sidebar h-full w-full text-(--color-font)"
      direction="horizontal"
    >
      <Panel id="sidebar" className="sidebar theme--sidebar" maxSize={40} minSize={10} collapsible>
        <div className="flex flex-1 flex-col divide-y divide-solid divide-(--hl-md) overflow-hidden">
          <div className="flex flex-col items-start divide-y divide-solid divide-(--hl-md)">
            <div className={`flex w-full h-[${INSOMNIA_TAB_HEIGHT}px]`}>
              <Breadcrumbs className="m-0 flex h-full w-full list-none items-center gap-2 px-(--padding-sm) font-bold">
                <Breadcrumb className="flex h-full items-center gap-2 text-(--color-font) outline-hidden select-none data-focused:outline-hidden">
                  <NavLink
                    data-testid="project"
                    className="flex aspect-square h-7 shrink-0 items-center justify-center gap-2 rounded-xs px-1 py-1 text-sm text-(--color-font) ring-1 ring-transparent outline-hidden transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) data-focused:outline-hidden"
                    to={`/organization/${organizationId}/project/${activeProject._id}`}
                  >
                    <Icon className="text-xs" icon="chevron-left" />
                  </NavLink>
                  <span aria-hidden role="separator" className="h-4 text-(--hl-lg) outline-1 outline-solid" />
                </Breadcrumb>
                <Breadcrumb className="flex h-full items-center gap-2 truncate text-(--color-font) outline-hidden select-none data-focused:outline-hidden">
                  <WorkspaceDropdown />
                </Breadcrumb>
                <Breadcrumb className="mr-2.5 ml-auto flex h-full items-center gap-2 justify-self-end truncate text-sm text-(--color-font) outline-hidden select-none data-focused:outline-hidden">
                  <NavLink
                    data-testid="run-collection-btn-quick"
                    className="flex h-7 shrink-0 items-center justify-center gap-2 rounded-xs px-2 py-1 text-sm text-(--color-font) ring-1 ring-transparent outline-hidden transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) aria-[current]:hidden data-focused:outline-hidden"
                    to={`/organization/${organizationId}/project/${activeWorkspace.parentId}/workspace/${activeWorkspace._id}/debug/runner?folder=`}
                  >
                    <Icon icon="play" />
                    <span className="truncate">Run</span>
                  </NavLink>
                </Breadcrumb>
              </Breadcrumbs>
            </div>
            {isDesign(activeWorkspace) && (
              <DocumentTab organizationId={organizationId} projectId={projectId} workspaceId={workspaceId} />
            )}
            <div className="flex w-full flex-col items-start gap-2 p-(--padding-sm)">
              <div className="flex w-full items-center justify-between gap-2">
                <EnvironmentPicker
                  isOpen={isEnvironmentPickerOpen}
                  onOpenChange={isOpen => {
                    setIsEnvironmentPickerOpen(isOpen);
                    if (isOpen) {
                      window.main.trackSegmentEvent({
                        event: SegmentEvent.requestEnvironmentClicked,
                      });
                    }
                  }}
                  onOpenEnvironmentSettingsModal={() => setEnvironmentModalOpen(true)}
                />
              </div>
              <Button
                onPress={() => {
                  window.main.trackSegmentEvent({
                    event: SegmentEvent.requestAddCookiesClicked,
                  });
                  setIsCookieModalOpen(true);
                }}
                className="flex max-w-full flex-1 items-center justify-center gap-2 truncate rounded-xs px-4 py-1 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
              >
                <Icon icon="cookie-bite" className="w-5 shrink-0" />
                <span className="truncate">
                  {activeCookieJar.cookies.length === 0 ? 'Add' : 'Manage'} Cookies{' '}
                  {activeCookieJar.cookies.length > 0 ? `(${activeCookieJar.cookies.length})` : ''}
                </span>
              </Button>
              <Button
                onPress={() => {
                  window.main.trackSegmentEvent({
                    event: SegmentEvent.requestAddCertificatesClicked,
                  });
                  setCertificatesModalOpen(true);
                }}
                className="flex max-w-full flex-1 items-center justify-center gap-2 truncate rounded-xs px-4 py-1 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
              >
                <Icon icon="file-contract" className="w-5 shrink-0" />
                <span className="truncate">
                  {clientCertificates.length === 0 || caCertificate ? 'Add' : 'Manage'} Certificates{' '}
                  {[...clientCertificates, caCertificate].filter(cert => !cert?.disabled).filter(isNotNullOrUndefined)
                    .length > 0
                    ? `(${[...clientCertificates, caCertificate].filter(cert => !cert?.disabled).filter(isNotNullOrUndefined).length})`
                    : ''}
                </span>
              </Button>
            </div>
          </div>
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex justify-between gap-1 p-(--padding-sm)">
              <SearchField
                aria-label="Request filter"
                className="group relative flex-1"
                value={filter ?? ''}
                onChange={value => {
                  setFilter(value);

                  if (value.trim() !== '') {
                    window.main.trackSegmentEvent({
                      event: SegmentEvent.filterCreatedRequests,
                    });
                  }
                }}
              >
                <Input
                  placeholder="Filter"
                  className="w-full rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) py-1 pr-7 pl-2 text-(--color-font) transition-colors focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
                />
                <div className="absolute top-0 right-0 flex h-full items-center px-2">
                  <Button className="flex aspect-square w-5 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all group-data-empty:hidden hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)">
                    <Icon icon="close" />
                  </Button>
                </div>
              </SearchField>
              <Select
                aria-label="Sort order"
                className="aspect-square h-full"
                selectedKey={sortOrder}
                onSelectionChange={order => {
                  if (order) {
                    window.main.trackSegmentEvent({
                      event: SegmentEvent.requestListSortClicked,
                    });
                    setSearchParams({
                      ...Object.fromEntries(searchParams.entries()),
                      sortOrder: order.toString(),
                    });
                  }
                }}
              >
                <Button
                  aria-label="Select sort order"
                  className="flex aspect-square h-full shrink-0 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                >
                  <Icon icon="sort" />
                </Button>
                <Popover className="flex min-w-max flex-col overflow-y-hidden">
                  <ListBox
                    items={SORT_ORDERS.map(order => {
                      return {
                        id: order,
                        name: sortOrderName[order],
                      };
                    })}
                    className="min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
                  >
                    {item => (
                      <ListBoxItem
                        id={item.id}
                        key={item.id}
                        className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
                        aria-label={item.name}
                        textValue={item.name}
                        value={item}
                      >
                        {({ isSelected }) => (
                          <Fragment>
                            <span>{item.name}</span>
                            {isSelected && <Icon icon="check" className="justify-self-end text-(--color-success)" />}
                          </Fragment>
                        )}
                      </ListBoxItem>
                    )}
                  </ListBox>
                </Popover>
              </Select>

              <TooltipTrigger>
                <ToggleButton
                  aria-label="Expand All/Collapse all"
                  defaultSelected={allExpanded}
                  onChange={() => {
                    setAllExpanded(!allExpanded);
                    window.main.trackSegmentEvent({
                      event: SegmentEvent.requestListExpandCollapseClicked,
                    });
                    toggleExpandAllFetcher.submit({
                      organizationId,
                      projectId,
                      workspaceId,
                      toggle: allExpanded ? 'collapse-all' : 'expand-all',
                    });
                  }}
                  className="flex aspect-square h-full items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset"
                >
                  {({ isSelected }) => (
                    <Icon
                      icon={isSelected ? 'down-left-and-up-right-to-center' : 'up-right-and-down-left-from-center'}
                    />
                  )}
                </ToggleButton>
                <Tooltip
                  offset={8}
                  className="max-h-[85vh] max-w-xs overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) px-4 py-2 text-sm text-(--color-font) shadow-lg select-none focus:outline-hidden"
                >
                  <span>{allExpanded ? 'Collapse all' : 'Expand all'}</span>
                </Tooltip>
              </TooltipTrigger>

              <MenuTrigger>
                <Button
                  aria-label="Create in collection"
                  className="flex aspect-square h-full items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                >
                  <Icon icon="plus-circle" />
                </Button>
                <Popover className="flex min-w-max flex-col overflow-y-hidden">
                  <Menu
                    aria-label="Create a new request"
                    selectionMode="single"
                    onAction={key =>
                      createInCollectionActionList
                        .find(i => i.items.find(a => a.id === key))
                        ?.items.find(a => a.id === key)
                        ?.action()
                    }
                    items={createInCollectionActionList}
                    className="min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
                  >
                    {section => (
                      <MenuSection className="flex flex-1 flex-col">
                        <Header className="flex items-center gap-2 py-1 pl-2 text-xs text-(--hl) uppercase">
                          <Icon icon={section.icon} /> <span>{section.name}</span>
                        </Header>
                        <Collection items={section.items}>
                          {item => (
                            <MenuItem
                              key={item.id}
                              id={item.id}
                              className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
                              aria-label={item.name}
                            >
                              <Icon icon={item.icon} />
                              <span>{item.name}</span>
                              {item.hint && <DropdownHint keyBindings={item.hint} />}
                            </MenuItem>
                          )}
                        </Collection>
                      </MenuSection>
                    )}
                  </Menu>
                </Popover>
              </MenuTrigger>
            </div>

            <GridList
              id="sidebar-pinned-request-gridlist"
              className="max-h-[50%] overflow-y-auto border-t border-b border-solid border-(--hl-sm) py-(--padding-sm) data-empty:border-none data-empty:py-0"
              items={collection.filter(item => item.pinned)}
              aria-label="Pinned Requests"
              disallowEmptySelection
              selectedKeys={requestId ? [requestId] : []}
              selectionMode="single"
            >
              {item => {
                return (
                  <GridListItem
                    key={item.doc._id}
                    id={item.doc._id}
                    className="group outline-hidden select-none"
                    textValue={item.doc.name}
                    data-testid={item.doc.name}
                    onAuxClick={e => {
                      if (e.button === 1) {
                        e.preventDefault();
                        tabNavigate(
                          {
                            organization: organizationId,
                            project: activeProject,
                            workspace: activeWorkspace,
                            item: item.doc,
                          },
                          { withTab: true, shouldNavigate: true, searchParams },
                        );
                      }
                    }}
                    onPress={e => {
                      tabNavigate(
                        {
                          organization: organizationId,
                          project: activeProject,
                          workspace: activeWorkspace,
                          item: item.doc,
                        },
                        { withTab: isPrimaryClickModifier(e), shouldNavigate: true, searchParams },
                      );
                    }}
                  >
                    <div className="relative flex h-(--line-height-xs) w-full items-center gap-2 overflow-hidden px-4 text-(--hl) outline-hidden transition-colors select-none group-hover:bg-(--hl-xs) group-focus:bg-(--hl-sm) group-aria-selected:text-(--color-font)">
                      <span className="absolute top-0 left-0 h-full w-[2px] bg-transparent transition-colors group-aria-selected:bg-(--color-surprise)" />
                      {isRequest(item.doc) && (
                        <span
                          className={`flex w-10 shrink-0 items-center justify-center rounded-xs border border-solid border-(--hl-sm) text-[0.65rem] ${
                            {
                              GET: 'bg-[rgba(var(--color-surprise-rgb),0.5)] text-(--color-font-surprise)',
                              POST: 'bg-[rgba(var(--color-success-rgb),0.5)] text-(--color-font-success)',
                              HEAD: 'bg-[rgba(var(--color-info-rgb),0.5)] text-(--color-font-info)',
                              OPTIONS: 'bg-[rgba(var(--color-info-rgb),0.5)] text-(--color-font-info)',
                              DELETE: 'bg-[rgba(var(--color-danger-rgb),0.5)] text-(--color-font-danger)',
                              PUT: 'bg-[rgba(var(--color-warning-rgb),0.5)] text-(--color-font-warning)',
                              PATCH: 'bg-[rgba(var(--color-notice-rgb),0.5)] text-(--color-font-notice)',
                            }[item.doc.method] || 'bg-(--hl-md) text-(--color-font)'
                          }`}
                        >
                          {getMethodShortHand(item.doc)}
                        </span>
                      )}
                      {isWebSocketRequest(item.doc) && (
                        <span className="flex w-10 shrink-0 items-center justify-center rounded-xs border border-solid border-(--hl-sm) bg-[rgba(var(--color-notice-rgb),0.5)] text-[0.65rem] text-(--color-font-notice)">
                          WS
                        </span>
                      )}
                      {isSocketIORequest(item.doc) && (
                        <span className="flex w-10 shrink-0 items-center justify-center rounded-xs border border-solid border-(--hl-sm) bg-[rgba(var(--color-notice-rgb),0.5)] text-[0.65rem] text-(--color-font-notice)">
                          IO
                        </span>
                      )}
                      {isGrpcRequest(item.doc) && (
                        <span className="flex w-10 shrink-0 items-center justify-center rounded-xs border border-solid border-(--hl-sm) bg-[rgba(var(--color-info-rgb),0.5)] text-[0.65rem] text-(--color-font-info)">
                          gRPC
                        </span>
                      )}
                      <EditableInput
                        value={getRequestNameOrFallback(item.doc)}
                        name="request name"
                        ariaLabel="request name"
                        className="flex-1 px-1"
                        onSubmit={newName => {
                          if (isRequestGroup(item.doc)) {
                            patchGroup(item.doc._id, { name: newName });
                          } else {
                            patchRequest(item.doc._id, { name: newName });
                          }
                        }}
                      />
                      {item.pinned && (
                        <Icon
                          className="text-(--font-size-sm)"
                          icon="thumb-tack"
                          onDoubleClick={() => patchRequestMeta(item.doc._id, { pinned: !item.pinned })}
                        />
                      )}
                    </div>
                  </GridListItem>
                );
              }}
            </GridList>

            <div className="flex-1 overflow-y-auto" ref={parentRef}>
              <GridList
                id="sidebar-request-gridlist"
                style={{ height: virtualizer.getTotalSize() }}
                items={virtualizer.getVirtualItems()}
                className="relative"
                aria-label="Request Collection"
                key={sortOrder}
                dragAndDropHooks={sortOrder === 'type-manual' ? collectionDragAndDrop.dragAndDropHooks : undefined}
              >
                {virtualItem => {
                  const item = visibleCollection[virtualItem.index];
                  let label = item.doc.name;
                  if (isRequest(item.doc)) {
                    label = `${getMethodShortHand(item.doc)} ${label}`;
                  } else if (isWebSocketRequest(item.doc)) {
                    label = `WS ${label}`;
                  } else if (isGrpcRequest(item.doc)) {
                    label = `gRPC ${label}`;
                  }

                  return (
                    <CollectionGridListItem
                      {...{
                        label,
                        item,
                        style: {
                          height: `${virtualItem.size}`,
                          transform: `translateY(${virtualItem.start}px)`,
                        },
                        organizationId,
                        projectId,
                        workspaceId,
                        searchParams,
                        patchGroup,
                        patchRequest,
                        activeEnvironment,
                        activeProject,
                        activeWorkspace,
                      }}
                    />
                  );
                }}
              </GridList>
            </div>
          </div>

          {isScratchpadOrganizationId(organizationId) && <ScratchPadTutorialPanel />}

          <WorkspaceSyncDropdown />
          {isEnvironmentModalOpen && <WorkspaceEnvironmentsEditModal onClose={() => setEnvironmentModalOpen(false)} />}
          {isImportModalOpen && (
            <ImportModal
              onHide={() => setIsImportModalOpen(false)}
              from={{ type: 'file' }}
              projectName={activeProject.name ?? getProductName()}
              workspaceName={activeWorkspace.name}
              organizationId={organizationId}
              defaultProjectId={projectId}
              defaultWorkspaceId={workspaceId}
            />
          )}
          {isCookieModalOpen && <CookiesModal setIsOpen={setIsCookieModalOpen} />}
          {isCertificatesModalOpen && <CertificatesModal onClose={() => setCertificatesModalOpen(false)} />}
          {isPasteCurlModalOpen && (
            <PasteCurlModal
              onImport={req => {
                createRequest({
                  requestType: 'From Curl',
                  parentId: workspaceId,
                  req,
                });
              }}
              defaultValue={pastedCurl}
              onHide={() => setPasteCurlModalOpen(false)}
            />
          )}
        </div>
      </Panel>
      <PanelResizeHandle className="h-full w-px bg-(--hl-md)" />
      <Panel className="flex flex-col">
        {/* Hide tabs when it's on the tutorial panel */}
        {!panel && <OrganizationTabList currentPage="debug" />}
        <PanelGroup autoSaveId="insomnia-panels" id="insomnia-panels" direction={direction}>
          <Routes>
            <RouteComponent
              path="*"
              element={
                <>
                  <Panel id="pane-one" order={1} minSize={10} className="pane-one theme--pane">
                    {workspaceId ? (
                      <ErrorBoundary showAlert>
                        {isRequestGroupId(requestGroupId) && <RequestGroupPane settings={settings} />}
                        {isGrpcRequestId(requestId) && grpcState && (
                          <GrpcRequestPane
                            key={grpcState.requestId}
                            grpcState={grpcState}
                            setGrpcState={setGrpcState}
                            reloadRequests={reloadRequests}
                          />
                        )}
                        {isWebSocketRequestId(requestId) && <WebSocketRequestPane environment={activeEnvironment} />}
                        {isSocketIORequestId(requestId) && <SocketIORequestPane environment={activeEnvironment} />}
                        {isRequestId(requestId) && (
                          <RequestPane
                            environmentId={activeEnvironment ? activeEnvironment._id : ''}
                            settings={settings}
                            onPaste={text => {
                              setPastedCurl(text);
                              setPasteCurlModalOpen(true);
                            }}
                          />
                        )}
                        {Boolean(!requestId && !requestGroupId) && <PlaceholderRequestPane />}
                        {isRequestSettingsModalOpen && activeRequest && (
                          <RequestSettingsModal
                            request={activeRequest}
                            onHide={() => setIsRequestSettingsModalOpen(false)}
                          />
                        )}
                      </ErrorBoundary>
                    ) : null}
                  </Panel>
                  {activeRequest ? (
                    <>
                      <PanelResizeHandle
                        className={direction === 'horizontal' ? 'h-full w-px bg-(--hl-md)' : 'h-px w-full bg-(--hl-md)'}
                      />
                      <Panel id="pane-two" order={2} minSize={10} className="pane-two theme--pane">
                        <ErrorBoundary showAlert>
                          {activeRequest && isGrpcRequest(activeRequest) && grpcState && (
                            <GrpcResponsePane grpcState={grpcState} />
                          )}
                          {isRealtimeRequest && <RealtimeResponsePane requestId={activeRequest._id} />}
                          {activeRequest && isRequest(activeRequest) && !isRealtimeRequest && (
                            <ResponsePane activeRequestId={activeRequest._id} />
                          )}
                        </ErrorBoundary>
                      </Panel>
                    </>
                  ) : null}
                </>
              }
            />
            <RouteComponent path="runner" element={<Runner />} />
            <RouteComponent path="tutorial/:panel" element={<Tutorial />} />
          </Routes>
        </PanelGroup>
      </Panel>
    </PanelGroup>
  );
};

export default DebugEntry;

const ScratchPadTutorialPanel = () => {
  const [signUpTipDismissedState, setSignUpTipDismissedState] = useLocalStorage<{
    dismissed: boolean;
    dismissedAt: number;
  }>('scratchpad-sign-up-tip-dismissed', { dismissed: false, dismissedAt: 0 });

  const [currentTime] = useState(() => Date.now());

  const handleDismiss = () => {
    setSignUpTipDismissedState({ dismissed: true, dismissedAt: Date.now() });
  };

  const {
    organizationId,
    projectId,
    workspaceId,
    panel = 'all',
  } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
    panel?: string;
  };

  const navigate = useNavigate();
  const handleSignUp = () => {
    navigate(href('/auth/login'));
  };

  const shouldShowSignUpTip = useMemo(() => {
    if (!signUpTipDismissedState || !signUpTipDismissedState.dismissed) {
      return true;
    }

    const twoWeeksInMs = 14 * 24 * 60 * 60 * 1000;

    return currentTime - signUpTipDismissedState.dismissedAt >= twoWeeksInMs;
  }, [signUpTipDismissedState, currentTime]);

  return (
    <>
      {shouldShowSignUpTip ? (
        <div className="m-2 rounded-lg border! border-solid border-(--hl-sm) bg-(--color-bg) p-4">
          <div className="flex flex-col items-start justify-between">
            <div className="flex w-full justify-between">
              <h3 className="mb-2 text-lg font-semibold text-(--color-font)">Unlock full features</h3>
              <Button
                onPress={handleDismiss}
                className="ml-4 flex h-6 w-6 items-center justify-center rounded-xs text-(--color-font-secondary) transition-colors hover:bg-(--hl-xs) hover:text-(--color-font) focus:outline-hidden"
                aria-label="Dismiss tutorial"
              >
                <Icon icon="times" className="h-3 w-3" />
              </Button>
            </div>
            <p className="mb-4 text-sm text-(--color-font-secondary)">
              Create multiple collections, design APIs, MCP clients, manage projects, and collaborate with your team.
            </p>
            <Button
              onPress={handleSignUp}
              className="rounded-md bg-(--color-surprise) px-4 py-2 text-sm font-medium text-white transition-colors"
            >
              Sign up for free
            </Button>
          </div>
        </div>
      ) : null}

      <GridList
        aria-label="Scope filter"
        items={scratchPadTutorialList}
        className="shrink-0 overflow-y-auto py-(--padding-sm) data-empty:py-0"
        disallowEmptySelection
        selectedKeys={[panel]}
        selectionMode="single"
        onSelectionChange={keys => {
          if (keys !== 'all') {
            const selected = Array.from(keys.values())[0].toString();
            navigate(
              `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/tutorial/${selected}`,
            );
          }
        }}
      >
        {item => {
          return (
            <GridListItem textValue={item.title} className="group outline-hidden select-none">
              <div className="relative flex h-12 w-full items-center gap-2 overflow-hidden px-4 text-(--hl) outline-hidden transition-colors select-none group-hover:bg-(--hl-xs) group-focus:bg-(--hl-sm) group-aria-selected:bg-(--hl-sm) group-aria-selected:text-(--color-font)">
                <span className="flex h-6 w-6 items-center justify-center">
                  <Icon icon={item.icon} className="w-6" />
                </span>

                <span className="truncate">{item.title}</span>
              </div>
            </GridListItem>
          );
        }}
      </GridList>
    </>
  );
};

const CollectionGridListItem = ({
  label,
  item,
  style,
  organizationId,
  projectId,
  workspaceId,
  searchParams,
  patchGroup,
  patchRequest,
  activeEnvironment,
  activeProject,
  activeWorkspace,
}: {
  label: string;
  item: Child;
  style: React.CSSProperties;
  organizationId: string;
  projectId: string;
  workspaceId: string;
  searchParams: URLSearchParams;
  patchGroup: (requestGroupId: string, patch: Partial<RequestGroup>) => void;
  patchRequest: (requestId: string, patch: Partial<GrpcRequest> | Partial<Request> | Partial<WebSocketRequest>) => void;
  activeEnvironment: Environment;
  activeProject: Project;
  activeWorkspace: Workspace;
}): React.ReactNode => {
  const [isEditable, setIsEditable] = useState(false);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const patchRequestMeta = useRequestMetaPatcher();

  const tabNavigate = useTabNavigate();
  const groupMetaPatcher = useRequestGroupMetaPatcher();

  const action = isRequestGroup(item.doc)
    ? `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request-group/${item.doc._id}/update`
    : `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${item.doc._id}/update`;

  const patchFetcher = useFetchers().find(f => f.formAction === action);

  const name =
    patchFetcher?.json &&
    typeof patchFetcher.json === 'object' &&
    'name' in patchFetcher.json &&
    typeof patchFetcher.json.name === 'string'
      ? patchFetcher.json.name
      : item.doc.name;

  const params = useParams() as { requestId?: string; requestGroupId?: string };

  const isSelected = item.doc._id === params.requestId || item.doc._id === params.requestGroupId;

  const scrollIntoView = useCallback(
    (node: HTMLDivElement) => {
      if (isSelected && node) {
        scrollElementIntoView(node, { behavior: 'instant' });
      }
    },
    [isSelected],
  );

  return (
    <GridListItem
      id={item.doc._id}
      className={`group absolute top-0 left-0 w-full outline-hidden select-none ${isRequestGroup(item.doc) ? 'data-drop-target:bg-(--hl-md)' : 'border-solid data-drop-target:border-b data-drop-target:border-(--color-surprise)'}`}
      textValue={label}
      data-testid={item.doc.name}
      style={style}
      onAction={() => {}}
      onAuxClick={e => {
        if (e.button === 1) {
          e.preventDefault();
          tabNavigate(
            {
              organization: organizationId,
              project: activeProject,
              workspace: activeWorkspace,
              item: item.doc,
            },
            { withTab: true, shouldNavigate: true, searchParams },
          );
        }
      }}
      onPress={e => {
        const id = item.doc._id;
        // Toggle collapse if it's a request group
        if (isRequestGroupId(id)) {
          groupMetaPatcher(id, { collapsed: !item.collapsed });
        }

        tabNavigate(
          {
            organization: organizationId,
            project: activeProject,
            workspace: activeWorkspace,
            item: item.doc,
          },
          {
            withTab: isPrimaryClickModifier(e),
            shouldNavigate: true,
            searchParams,
          },
        );
      }}
      ref={triggerRef}
    >
      <div
        ref={scrollIntoView}
        onContextMenu={e => {
          e.preventDefault();
          setIsContextMenuOpen(true);
        }}
        onDoubleClick={() => setIsEditable(true)}
        data-selected={isSelected}
        className="relative flex h-(--line-height-xs) w-full items-center gap-2 overflow-hidden pr-2 pl-4 text-(--hl) outline-hidden transition-colors select-none group-hover:bg-(--hl-xs) group-focus:bg-(--hl-sm) data-[selected=true]:text-(--color-font)"
        style={{
          paddingLeft: `${item.level + 1}rem`,
        }}
      >
        <span
          data-selected={isSelected}
          className="absolute top-0 left-0 h-full w-[2px] bg-transparent transition-colors data-[selected=true]:bg-(--color-surprise)"
        />
        <Button slot="drag" className="hidden" />
        {isRequest(item.doc) && (
          <span
            aria-hidden
            role="presentation"
            className={`flex w-10 shrink-0 items-center justify-center rounded-xs border border-solid border-(--hl-sm) text-[0.65rem] ${
              {
                GET: 'bg-[rgba(var(--color-surprise-rgb),0.5)] text-(--color-font-surprise)',
                POST: 'bg-[rgba(var(--color-success-rgb),0.5)] text-(--color-font-success)',
                HEAD: 'bg-[rgba(var(--color-info-rgb),0.5)] text-(--color-font-info)',
                OPTIONS: 'bg-[rgba(var(--color-info-rgb),0.5)] text-(--color-font-info)',
                DELETE: 'bg-[rgba(var(--color-danger-rgb),0.5)] text-(--color-font-danger)',
                PUT: 'bg-[rgba(var(--color-warning-rgb),0.5)] text-(--color-font-warning)',
                PATCH: 'bg-[rgba(var(--color-notice-rgb),0.5)] text-(--color-font-notice)',
              }[item.doc.method] || 'bg-(--hl-md) text-(--color-font)'
            }`}
          >
            {getMethodShortHand(item.doc)}
          </span>
        )}
        {isWebSocketRequest(item.doc) && (
          <span
            aria-hidden
            role="presentation"
            className="flex w-10 shrink-0 items-center justify-center rounded-xs border border-solid border-(--hl-sm) bg-[rgba(var(--color-notice-rgb),0.5)] text-[0.65rem] text-(--color-font-notice)"
          >
            WS
          </span>
        )}
        {isSocketIORequest(item.doc) && (
          <span
            aria-hidden
            role="presentation"
            className="flex w-10 shrink-0 items-center justify-center rounded-xs border border-solid border-(--hl-sm) bg-[rgba(var(--color-notice-rgb),0.5)] text-[0.65rem] text-(--color-font-notice)"
          >
            IO
          </span>
        )}
        {isGrpcRequest(item.doc) && (
          <span
            aria-hidden
            role="presentation"
            className="flex w-10 shrink-0 items-center justify-center rounded-xs border border-solid border-(--hl-sm) bg-[rgba(var(--color-info-rgb),0.5)] text-[0.65rem] text-(--color-font-info)"
          >
            gRPC
          </span>
        )}
        {isRequestGroup(item.doc) && (
          <span>
            <Icon className="w-6 shrink-0" icon={item.collapsed ? 'folder' : 'folder-open'} />
          </span>
        )}
        <EditableInput
          editable={isEditable}
          onEditableChange={setIsEditable}
          value={getRequestNameOrFallback({ ...item.doc, name })}
          name="request name"
          ariaLabel={label}
          className="flex-1 hover:bg-transparent!"
          onSubmit={newName => {
            if (isRequestGroup(item.doc)) {
              patchGroup(item.doc._id, { name: newName });
            } else {
              patchRequest(item.doc._id, { name: newName });
            }
          }}
        />
        {isWebSocketRequest(item.doc) && <WebSocketSpinner requestId={item.doc._id} />}
        {isSocketIORequest(item.doc) && <SocketIOSpinner requestId={item.doc._id} />}
        {isGraphqlSubscriptionRequest(item.doc) && <WebSocketSpinner requestId={item.doc._id} />}
        {isRequest(item.doc) && <RequestTiming requestId={item.doc._id} />}
        {isEventStreamRequest(item.doc) && <EventStreamSpinner requestId={item.doc._id} />}
        {item.pinned && (
          <Icon
            className="text-(--font-size-sm)"
            icon="thumb-tack"
            onDoubleClick={() => patchRequestMeta(item.doc._id, { pinned: !item.pinned })}
          />
        )}
        {isRequestGroup(item.doc) ? (
          <RequestGroupActionsDropdown
            requestGroup={item.doc}
            onRename={() => setIsEditable(true)}
            isOpen={isContextMenuOpen}
            onOpenChange={setIsContextMenuOpen}
            triggerRef={triggerRef}
          />
        ) : (
          <RequestActionsDropdown
            activeEnvironment={activeEnvironment}
            request={item.doc}
            onRename={() => setIsEditable(true)}
            isPinned={item.pinned}
            isOpen={isContextMenuOpen}
            onOpenChange={setIsContextMenuOpen}
            triggerRef={triggerRef}
          />
        )}
      </div>
    </GridListItem>
  );
};
