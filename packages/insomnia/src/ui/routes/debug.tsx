import { IconName } from '@fortawesome/fontawesome-svg-core';
import { ServiceError, StatusObject } from '@grpc/grpc-js';
import { useVirtualizer } from '@tanstack/react-virtual';
import React, { FC, Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  MenuTrigger,
  Popover,
  SearchField,
  Section,
  Select,
  ToggleButton,
  Tooltip,
  TooltipTrigger,
  useDragAndDrop,
} from 'react-aria-components';
import { ImperativePanelGroupHandle, Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import {
  LoaderFunction,
  NavLink,
  redirect,
  useFetcher,
  useNavigate,
  useParams,
  useRouteLoaderData,
  useSearchParams,
} from 'react-router-dom';

import { DEFAULT_SIDEBAR_SIZE, getProductName, SORT_ORDERS, SortOrder, sortOrderName } from '../../common/constants';
import { ChangeBufferEvent, database as db } from '../../common/database';
import { generateId } from '../../common/misc';
import { PlatformKeyCombinations } from '../../common/settings';
import type { GrpcMethodInfo } from '../../main/ipc/grpc';
import * as models from '../../models';
import { GrpcRequest, isGrpcRequest, isGrpcRequestId } from '../../models/grpc-request';
import { getByParentId as getGrpcRequestMetaByParentId } from '../../models/grpc-request-meta';
import {
  isEventStreamRequest,
  isRequest,
  isRequestId,
  Request,
} from '../../models/request';
import { isRequestGroup, isRequestGroupId, RequestGroup } from '../../models/request-group';
import { getByParentId as getRequestMetaByParentId } from '../../models/request-meta';
import {
  isWebSocketRequest,
  isWebSocketRequestId,
  WebSocketRequest,
} from '../../models/websocket-request';
import { invariant } from '../../utils/invariant';
import { DropdownHint } from '../components/base/dropdown/dropdown-hint';
import { RequestActionsDropdown } from '../components/dropdowns/request-actions-dropdown';
import { RequestGroupActionsDropdown } from '../components/dropdowns/request-group-actions-dropdown';
import { WorkspaceDropdown } from '../components/dropdowns/workspace-dropdown';
import { WorkspaceSyncDropdown } from '../components/dropdowns/workspace-sync-dropdown';
import { EditableInput } from '../components/editable-input';
import { EnvironmentPicker } from '../components/environment-picker';
import { ErrorBoundary } from '../components/error-boundary';
import { Icon } from '../components/icon';
import { useDocBodyKeyboardShortcuts } from '../components/keydown-binder';
import { showModal, showPrompt } from '../components/modals';
import { AskModal } from '../components/modals/ask-modal';
import { CookiesModal } from '../components/modals/cookies-modal';
import { GenerateCodeModal } from '../components/modals/generate-code-modal';
import { ImportModal } from '../components/modals/import-modal';
import { PasteCurlModal } from '../components/modals/paste-curl-modal';
import { PromptModal } from '../components/modals/prompt-modal';
import { RequestSettingsModal } from '../components/modals/request-settings-modal';
import { CertificatesModal } from '../components/modals/workspace-certificates-modal';
import { WorkspaceEnvironmentsEditModal } from '../components/modals/workspace-environments-edit-modal';
import { GrpcRequestPane } from '../components/panes/grpc-request-pane';
import { GrpcResponsePane } from '../components/panes/grpc-response-pane';
import { PlaceholderRequestPane } from '../components/panes/placeholder-request-pane';
import { RequestGroupPane } from '../components/panes/request-group-pane';
import { RequestPane } from '../components/panes/request-pane';
import { ResponsePane } from '../components/panes/response-pane';
import { getMethodShortHand } from '../components/tags/method-tag';
import { ConnectionCircle } from '../components/websockets/action-bar';
import { RealtimeResponsePane } from '../components/websockets/realtime-response-pane';
import { WebSocketRequestPane } from '../components/websockets/websocket-request-pane';
import { useExecutionState } from '../hooks/use-execution-state';
import { useReadyState } from '../hooks/use-ready-state';
import {
  CreateRequestType,
  useRequestGroupMetaPatcher,
  useRequestGroupPatcher,
  useRequestMetaPatcher,
  useRequestPatcher,
} from '../hooks/use-request';
import {
  GrpcRequestLoaderData,
  RequestLoaderData,
  WebSocketRequestLoaderData,
} from './request';
import { useRootLoaderData } from './root';
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
  if (!params.requestId && !params.requestGroupId) {
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

const WebSocketSpinner = ({ requestId }: { requestId: string }) => {
  const readyState = useReadyState({ requestId, protocol: 'webSocket' });
  return readyState ? <ConnectionCircle className='flex-shrink-0' data-testid="WebSocketSpinner__Connected" /> : null;
};

const EventStreamSpinner = ({ requestId }: { requestId: string }) => {
  const readyState = useReadyState({ requestId, protocol: 'curl' });
  return readyState ? <ConnectionCircle className='flex-shrink-0' data-testid="EventStreamSpinner__Connected" /> : null;
};

const getRequestNameOrFallback = (doc: Request | RequestGroup | GrpcRequest | WebSocketRequest): string => {
  return !isRequestGroup(doc) ? doc.name || doc.url || 'Untitled request' : doc.name || 'Untitled folder';
};

const RequestTiming = ({ requestId }: { requestId: string }) => {
  const { isExecuting } = useExecutionState({ requestId });
  return isExecuting ? <ConnectionCircle className='flex-shrink-0' data-testid="WebSocketSpinner__Connected" /> : null;
};

export const Debug: FC = () => {
  const {
    activeWorkspace,
    activeProject,
    activeEnvironment,
    activeCookieJar,
    caCertificate,
    clientCertificates,
    grpcRequests,
    collection,
  } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  const requestData = useRouteLoaderData('request/:requestId') as
    | RequestLoaderData
    | GrpcRequestLoaderData
    | WebSocketRequestLoaderData
    | undefined;
  const { activeRequest } = requestData || {};
  const requestFetcher = useFetcher();

  const [isPasteCurlModalOpen, setPasteCurlModalOpen] = useState(false);
  const [pastedCurl, setPastedCurl] = useState('');

  const { organizationId, projectId, workspaceId, requestId, requestGroupId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
    requestId?: string;
    requestGroupId?: string;
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
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isEnvironmentPickerOpen, setIsEnvironmentPickerOpen] = useState(false);
  const [isCertificatesModalOpen, setCertificatesModalOpen] = useState(false);

  const patchRequest = useRequestPatcher();
  const patchGroup = useRequestGroupPatcher();
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

  const { settings } = useRootLoaderData();

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

  const sidebarPanelRef = useRef<ImperativePanelGroupHandle>(null);

  function toggleSidebar() {
    const layout = sidebarPanelRef.current?.getLayout();

    if (!layout) {
      return;
    }

    if (layout && layout[0] > 0) {
      layout[0] = 0;
    } else {
      layout[0] = DEFAULT_SIDEBAR_SIZE;
    }

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
    environment_showEditor: () => setEnvironmentModalOpen(true),
    environment_showSwitchMenu: () => setIsEnvironmentPickerOpen(true),
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

  const [searchParams, setSearchParams] = useSearchParams();

  const sortOrder = searchParams.get('sortOrder') as SortOrder || 'type-manual';
  const { hotKeyRegistry } = settings;

  const createRequest = ({ requestType, parentId, req }: { requestType: CreateRequestType; parentId: string; req?: Partial<Request> }) =>
    requestFetcher.submit(JSON.stringify({ requestType, parentId, req }),
      {
        encType: 'application/json',
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/new`,
        method: 'post',
      });

  const groupMetaPatcher = useRequestGroupMetaPatcher();
  const reorderFetcher = useFetcher();

  const navigate = useNavigate();

  const collectionDragAndDrop = useDragAndDrop({
    getItems: keys =>
      [...keys].map(key => ({ 'text/plain': key.toString() })),
    onReorder(event) {
      const id = event.keys.values().next().value.toString();
      const targetId = event.target.key.toString();

      const dropItem = collection.find(r => r.doc._id === id);
      const targetItem = collection.find(r => r.doc._id === targetId);

      if (!dropItem || !targetItem) {
        return;
      }

      // If the item we move is a folder we cannot move it inside it's ancestor folders so we must check the ancestry
      const isMovingFolderInsideItsChildren = isRequestGroup(dropItem.doc) && targetItem.ancestors?.includes(dropItem.doc._id);
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

          if (beforeItem && afterItem) {
            metaSortKey = beforeItem.doc.metaSortKey - (beforeItem.doc.metaSortKey - afterItem.doc.metaSortKey) / 2;
          } else {
            metaSortKey = beforeItem.doc.metaSortKey + 100;
          }
        } else {
          const beforeItem = targetSiblingsCollections[targetIndexInSiblingsCollection - 1];
          const afterItem = targetItem;

          if (beforeItem && afterItem) {
            metaSortKey = afterItem.doc.metaSortKey - (afterItem.doc.metaSortKey - beforeItem.doc.metaSortKey) / 2;
          } else {
            metaSortKey = afterItem.doc.metaSortKey - 100;
          }
        }
      }

      if (metaSortKey) {
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
          }
        );
      }
    },
    renderDropIndicator(target) {
      if (target.type === 'item') {
        const item = virtualizer.getVirtualItems().find(i => i.key === target.key);
        if (item) {
          return (
            <DropIndicator
              target={target}
              className="absolute w-full z-10 outline-[--color-surprise] left-0 top-0 outline-1 outline"
              style={{
                transform: `translateY(${target.dropPosition === 'before' ? item?.start : item.end}px)`,
              }}
            />
          );
        }
      }

      return <DropIndicator
        target={target}
        className="absolute outline-[--color-surprise] left-0 top-0 outline-1 outline"
      />;
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
  }[] =
    [
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
            action: () => showPrompt({
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
                  }
                ),
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
          }],
      },
      {
        name: 'Import',
        id: 'import',
        icon: 'file-import',
        items: [{
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
        }],
      }];

  // const allCollapsed = collection.every(item => item.hidden);
  const [allExpanded, setAllExpanded] = useState(false);

  const toggleExpandAllFetcher = useFetcher();

  const visibleCollection = collection.filter(item => !item.hidden);

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer<HTMLDivElement, Element>({
    getScrollElement: () => parentRef.current,
    count: visibleCollection.length,
    estimateSize: React.useCallback(() => 32, []),
    overscan: 30,
    getItemKey: index => visibleCollection[index].doc._id,
  });

  const expandAllForRequestFetcher = useFetcher();

  useLayoutEffect(() => {
    if (expandAllForRequestFetcher.state !== 'idle' && expandAllForRequestFetcher.data && requestId) {
      setTimeout(() => {
        const activeIndex = collection.findIndex(item => item.doc._id === requestId);
        activeIndex && virtualizer.scrollToIndex(activeIndex);
      }, 100);
    }
  }, [collection, expandAllForRequestFetcher.data, expandAllForRequestFetcher.state, requestId, virtualizer]);

  const [direction, setDirection] = useState<'horizontal' | 'vertical'>(settings.forceVerticalLayout ? 'vertical' : 'horizontal');
  useEffect(() => {
    if (settings.forceVerticalLayout) {
      setDirection('vertical');
      return () => { };
    } else {
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
    }
  }, [settings.forceVerticalLayout, direction]);

  return (
    <PanelGroup ref={sidebarPanelRef} autoSaveId="insomnia-sidebar" id="wrapper" className='new-sidebar w-full h-full text-[--color-font]' direction='horizontal'>
      <Panel id="sidebar" className='sidebar theme--sidebar' maxSize={40} minSize={10} collapsible>
        <div className="flex flex-1 flex-col overflow-hidden divide-solid divide-y divide-[--hl-md]">
          <div className="flex flex-col items-start">
            <Breadcrumbs className='flex h-[--line-height-sm] list-none items-center m-0 gap-2 border-solid border-[--hl-md] border-b p-[--padding-sm] font-bold w-full'>
              <Breadcrumb className="flex select-none items-center gap-2 text-[--color-font] h-full outline-none data-[focused]:outline-none">
                <NavLink
                  data-testid="project"
                  className="px-1 py-1 aspect-square h-7 flex flex-shrink-0 outline-none data-[focused]:outline-none items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  to={`/organization/${organizationId}/project/${activeProject._id}`}
                >
                  <Icon className='text-xs' icon="chevron-left" />
                </NavLink>
                <span aria-hidden role="separator" className='text-[--hl-lg] h-4 outline outline-1' />
              </Breadcrumb>
              <Breadcrumb className="flex truncate select-none items-center gap-2 text-[--color-font] h-full outline-none data-[focused]:outline-none">
                <WorkspaceDropdown />
              </Breadcrumb>
            </Breadcrumbs>
            <div className='flex flex-col items-start gap-2 p-[--padding-sm] w-full'>
              <div className="flex w-full items-center gap-2 justify-between">
                <EnvironmentPicker
                  isOpen={isEnvironmentPickerOpen}
                  onOpenChange={setIsEnvironmentPickerOpen}
                  onOpenEnvironmentSettingsModal={() => setEnvironmentModalOpen(true)}
                />
              </div>
              <Button
                onPress={() => setIsCookieModalOpen(true)}
                className="px-4 py-1 max-w-full truncate flex-1 flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
              >
                <Icon icon="cookie-bite" className='w-5 flex-shrink-0' />
                <span className='truncate'>{activeCookieJar.cookies.length === 0 ? 'Add' : 'Manage'} Cookies</span>
              </Button>
              <Button
                onPress={() => setCertificatesModalOpen(true)}
                className="px-4 py-1 max-w-full truncate flex-1 flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
              >
                <Icon icon="file-contract" className='w-5 flex-shrink-0' />
                <span className='truncate'>{clientCertificates.length === 0 || caCertificate ? 'Add' : 'Manage'} Certificates</span>
              </Button>
            </div>
          </div>

          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex justify-between gap-1 p-[--padding-sm]">
              <SearchField
                aria-label="Request filter"
                className="group relative flex-1"
                defaultValue={searchParams.get('filter')?.toString() ?? ''}
                onChange={filter => {
                  setSearchParams({
                    ...Object.fromEntries(searchParams.entries()),
                    filter,
                  });
                }}
              >
                <Input
                  placeholder="Filter"
                  className="py-1 w-full pl-2 pr-7 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors"
                />
                <div className="flex items-center px-2 absolute right-0 top-0 h-full">
                  <Button className="flex group-data-[empty]:hidden items-center justify-center aspect-square w-5 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
                    <Icon icon="close" />
                  </Button>
                </div>
              </SearchField>
              <Select
                aria-label="Sort order"
                className="h-full aspect-square"
                selectedKey={sortOrder}
                onSelectionChange={order =>
                  setSearchParams({
                    ...Object.fromEntries(searchParams.entries()),
                    sortOrder: order.toString(),
                  })
                }
              >
                <Button
                  aria-label="Select sort order"
                  className="flex flex-shrink-0 items-center justify-center aspect-square h-full aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                >
                  <Icon icon="sort" />
                </Button>
                <Popover className="min-w-max">
                  <ListBox
                    items={SORT_ORDERS.map(order => {
                      return {
                        id: order,
                        name: sortOrderName[order],
                      };
                    })}
                    className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
                  >
                    {item => (
                      <ListBoxItem
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
                    toggleExpandAllFetcher.submit({
                      toggle: allExpanded ? 'collapse-all' : 'expand-all',
                    }, {
                      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/toggle-expand-all`,
                      method: 'POST',
                      encType: 'application/json',
                    });
                  }}
                  className="flex items-center justify-center h-full aspect-square rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                >
                  {({ isSelected }) => (
                    <Icon icon={isSelected ? 'down-left-and-up-right-to-center' : 'up-right-and-down-left-from-center'} />
                  )}
                </ToggleButton>
                <Tooltip
                  offset={8}
                  className="border select-none text-sm max-w-xs border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
                >
                  <span>{allExpanded ? 'Collapse all' : 'Expand all'}</span>
                </Tooltip>
              </TooltipTrigger>

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
                    onAction={key => createInCollectionActionList.find(i => i.items.find(a => a.id === key))?.items.find(a => a.id === key)?.action()}
                    items={createInCollectionActionList}
                    className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
                  >
                    {section => (
                      <Section className='flex-1 flex flex-col'>
                        <Header className='pl-2 py-1 flex items-center gap-2 text-[--hl] text-xs uppercase'>
                          <Icon icon={section.icon} /> <span>{section.name}</span>
                        </Header>
                        <Collection items={section.items}>
                          {item => (
                            <MenuItem
                              key={item.id}
                              id={item.id}
                              className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
                              aria-label={item.name}
                            >
                              <Icon icon={item.icon} />
                              <span>{item.name}</span>
                              {item.hint && (<DropdownHint keyBindings={item.hint} />)}
                            </MenuItem>
                          )}
                        </Collection>
                      </Section>
                    )}
                  </Menu>
                </Popover>
              </MenuTrigger>
            </div>

            <GridList
              id="sidebar-pinned-request-gridlist"
              className="overflow-y-auto border-b border-t data-[empty]:py-0 py-[--padding-sm] data-[empty]:border-none border-solid border-[--hl-sm]"
              items={collection.filter(item => item.pinned)}
              aria-label="Pinned Requests"
              disallowEmptySelection
              selectedKeys={requestId ? [requestId] : []}
              selectionMode="single"
              onSelectionChange={keys => {
                if (keys !== 'all') {
                  const value = keys.values().next().value;
                  navigate(
                    `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${value}?${searchParams.toString()}`
                  );
                }
              }}
            >
              {item => {

                return (
                  <GridListItem
                    key={item.doc._id}
                    id={item.doc._id}
                    className="group outline-none select-none"
                    textValue={item.doc.name}
                    data-testid={item.doc.name}
                  >
                    <div
                      className="flex select-none outline-none group-aria-selected:text-[--color-font] relative group-hover:bg-[--hl-xs] group-focus:bg-[--hl-sm] transition-colors gap-2 px-4 items-center h-[--line-height-xs] w-full overflow-hidden text-[--hl]"
                    >
                      <span className="group-aria-selected:bg-[--color-surprise] transition-colors top-0 left-0 absolute h-full w-[2px] bg-transparent" />
                      {isRequest(item.doc) && (
                        <span
                          className={
                            `w-10 flex-shrink-0 flex text-[0.65rem] rounded-sm border border-solid border-[--hl-sm] items-center justify-center
                            ${{
                              'GET': 'text-[--color-font-surprise] bg-[rgba(var(--color-surprise-rgb),0.5)]',
                              'POST': 'text-[--color-font-success] bg-[rgba(var(--color-success-rgb),0.5)]',
                              'HEAD': 'text-[--color-font-info] bg-[rgba(var(--color-info-rgb),0.5)]',
                              'OPTIONS': 'text-[--color-font-info] bg-[rgba(var(--color-info-rgb),0.5)]',
                              'DELETE': 'text-[--color-font-danger] bg-[rgba(var(--color-danger-rgb),0.5)]',
                              'PUT': 'text-[--color-font-warning] bg-[rgba(var(--color-warning-rgb),0.5)]',
                              'PATCH': 'text-[--color-font-notice] bg-[rgba(var(--color-notice-rgb),0.5)]',
                            }[item.doc.method] || 'text-[--color-font] bg-[--hl-md]'}`
                          }
                        >
                          {getMethodShortHand(item.doc)}
                        </span>
                      )}
                      {isWebSocketRequest(item.doc) && (
                        <span className="w-10 flex-shrink-0 flex text-[0.65rem] rounded-sm border border-solid border-[--hl-sm] items-center justify-center text-[--color-font-notice] bg-[rgba(var(--color-notice-rgb),0.5)]">
                          WS
                        </span>
                      )}
                      {isGrpcRequest(item.doc) && (
                        <span className="w-10 flex-shrink-0 flex text-[0.65rem] rounded-sm border border-solid border-[--hl-sm] items-center justify-center text-[--color-font-info] bg-[rgba(var(--color-info-rgb),0.5)]">
                          gRPC
                        </span>
                      )}
                      <EditableInput
                        value={getRequestNameOrFallback(item.doc)}
                        name="request name"
                        ariaLabel="request name"
                        className="px-1 flex-1"
                        onSingleClick={() => {
                          if (item && isRequestGroup(item.doc)) {
                            groupMetaPatcher(item.doc._id, { collapsed: !item.collapsed });
                            navigate(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request-group/${item.doc._id}?${searchParams.toString()}`);
                          } else {
                            navigate(
                              `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${item.doc._id}?${searchParams.toString()}`
                            );
                          }
                        }}
                        onSubmit={name => {
                          if (isRequestGroup(item.doc)) {
                            patchGroup(item.doc._id, { name });
                          } else {
                            patchRequest(item.doc._id, { name });
                          }
                        }}
                      />
                      {item.pinned && (
                        <Icon className='text-[--font-size-sm]' icon="thumb-tack" />
                      )}
                      {!isRequestGroup(item.doc) && (
                        <RequestActionsDropdown
                          activeEnvironment={activeEnvironment}
                          activeProject={activeProject}
                          request={item.doc}
                          isPinned={item.pinned}
                        />
                      )}
                    </div>
                  </GridListItem>
                );
              }}
            </GridList>

            <div className='flex-1 overflow-y-auto' ref={parentRef} >
              <GridList
                id="sidebar-request-gridlist"
                style={{ height: virtualizer.getTotalSize() }}
                items={virtualizer.getVirtualItems()}
                className="relative"
                aria-label="Request Collection"
                disallowEmptySelection
                key={sortOrder}
                dragAndDropHooks={sortOrder === 'type-manual' ? collectionDragAndDrop.dragAndDropHooks : undefined}
                selectedKeys={requestId && [requestId] || requestGroupId && [requestGroupId]}
                selectionMode="single"
                onSelectionChange={keys => {
                  if (keys !== 'all') {
                    const value = keys.values().next().value;

                    const item = collection.find(
                      item => item.doc._id === value
                    );
                    if (item && isRequestGroup(item.doc)) {
                      groupMetaPatcher(value, { collapsed: !item.collapsed });
                    } else {
                      navigate(
                        `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${value}?${searchParams.toString()}`
                      );
                    }
                  }
                }}
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
                    <GridListItem
                      className="group outline-none absolute top-0 left-0 select-none w-full"
                      textValue={label}
                      data-testid={item.doc.name}
                      style={{
                        height: `${virtualItem.size}`,
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    >
                      <div
                        className="flex select-none outline-none group-aria-selected:text-[--color-font] relative group-hover:bg-[--hl-xs] group-focus:bg-[--hl-sm] transition-colors gap-2 px-4 items-center h-[--line-height-xs] w-full overflow-hidden text-[--hl]"
                        style={{
                          paddingLeft: `${item.level + 1}rem`,
                        }}
                      >
                        <span className="group-aria-selected:bg-[--color-surprise] transition-colors top-0 left-0 absolute h-full w-[2px] bg-transparent" />
                        <Button slot="drag" className="hidden" />
                        {isRequest(item.doc) && (
                          <span
                            aria-hidden
                            role="presentation"
                            className={
                              `w-10 flex-shrink-0 flex text-[0.65rem] rounded-sm border border-solid border-[--hl-sm] items-center justify-center
                              ${{
                                'GET': 'text-[--color-font-surprise] bg-[rgba(var(--color-surprise-rgb),0.5)]',
                                'POST': 'text-[--color-font-success] bg-[rgba(var(--color-success-rgb),0.5)]',
                                'HEAD': 'text-[--color-font-info] bg-[rgba(var(--color-info-rgb),0.5)]',
                                'OPTIONS': 'text-[--color-font-info] bg-[rgba(var(--color-info-rgb),0.5)]',
                                'DELETE': 'text-[--color-font-danger] bg-[rgba(var(--color-danger-rgb),0.5)]',
                                'PUT': 'text-[--color-font-warning] bg-[rgba(var(--color-warning-rgb),0.5)]',
                                'PATCH': 'text-[--color-font-notice] bg-[rgba(var(--color-notice-rgb),0.5)]',
                              }[item.doc.method] || 'text-[--color-font] bg-[--hl-md]'}`
                            }
                          >
                            {getMethodShortHand(item.doc)}
                          </span>
                        )}
                        {isWebSocketRequest(item.doc) && (
                          <span aria-hidden role="presentation" className="w-10 flex-shrink-0 flex text-[0.65rem] rounded-sm border border-solid border-[--hl-sm] items-center justify-center text-[--color-font-notice] bg-[rgba(var(--color-notice-rgb),0.5)]">
                            WS
                          </span>
                        )}
                        {isGrpcRequest(item.doc) && (
                          <span aria-hidden role="presentation" className="w-10 flex-shrink-0 flex text-[0.65rem] rounded-sm border border-solid border-[--hl-sm] items-center justify-center text-[--color-font-info] bg-[rgba(var(--color-info-rgb),0.5)]">
                            gRPC
                          </span>
                        )}
                        {isRequestGroup(item.doc) && (
                          <Icon
                            className="w-6 flex-shrink-0"
                            icon={item.collapsed ? 'folder' : 'folder-open'}
                          />
                        )}
                        <EditableInput
                          value={getRequestNameOrFallback(item.doc)}
                          name="request name"
                          ariaLabel={label}
                          className="px-1 flex-1"
                          onSingleClick={() => {
                            if (item && isRequestGroup(item.doc)) {
                              navigate(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request-group/${item.doc._id}?${searchParams.toString()}`);
                            } else {
                              navigate(
                                `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${item.doc._id}?${searchParams.toString()}`
                              );
                            }
                          }}
                          onSubmit={name => {
                            if (isRequestGroup(item.doc)) {
                              patchGroup(item.doc._id, { name });
                            } else {
                              patchRequest(item.doc._id, { name });
                            }
                          }}
                        />
                        {isWebSocketRequest(item.doc) && <WebSocketSpinner requestId={item.doc._id} />}
                        {isRequest(item.doc) && <RequestTiming requestId={item.doc._id} />}
                        {isEventStreamRequest(item.doc) && <EventStreamSpinner requestId={item.doc._id} />}
                        {item.pinned && (
                          <Icon className='text-[--font-size-sm]' icon="thumb-tack" />
                        )}
                        {isRequestGroup(item.doc) ? (
                          <RequestGroupActionsDropdown
                            requestGroup={item.doc}
                          />
                        ) : (
                          <RequestActionsDropdown
                            activeEnvironment={activeEnvironment}
                            activeProject={activeProject}
                            request={item.doc}
                            isPinned={item.pinned}
                          />
                        )}
                      </div>
                    </GridListItem>
                  );
                }}
              </GridList>
            </div>
          </div>

          <WorkspaceSyncDropdown />

          {isEnvironmentModalOpen && (
            <WorkspaceEnvironmentsEditModal
              onClose={() => setEnvironmentModalOpen(false)}
            />
          )}
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
          {isCookieModalOpen && (
            <CookiesModal onHide={() => setIsCookieModalOpen(false)} />
          )}
          {isCertificatesModalOpen && (
            <CertificatesModal onClose={() => setCertificatesModalOpen(false)} />
          )}
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
      <PanelResizeHandle className='h-full w-[1px] bg-[--hl-md]' />
      <Panel
        onFocus={() => {
          requestId && expandAllForRequestFetcher.submit({
            requestId,
          }, {
            action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/expand-all-for-request`,
            method: 'POST',
            encType: 'application/json',
          });
        }}
      >
        <PanelGroup autoSaveId="insomnia-panels" direction={direction}>
          <Panel id="pane-one" className='pane-one theme--pane'>
            {workspaceId ? (
              <ErrorBoundary showAlert>
                {isRequestGroupId(requestGroupId) && (
                  <RequestGroupPane settings={settings} />
                )}
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
          {activeRequest ? (<>
            <PanelResizeHandle className={direction === 'horizontal' ? 'h-full w-[1px] bg-[--hl-md]' : 'w-full h-[1px] bg-[--hl-md]'} />
            <Panel id="pane-two" className='pane-two theme--pane'>
              <ErrorBoundary showAlert>
                {activeRequest && isGrpcRequest(activeRequest) && grpcState && (
                  <GrpcResponsePane grpcState={grpcState} />
                )}
                {isRealtimeRequest && (
                  <RealtimeResponsePane requestId={activeRequest._id} />
                )}
                {activeRequest && isRequest(activeRequest) && !isRealtimeRequest && (
                  <ResponsePane activeRequestId={activeRequest._id} />
                )}
              </ErrorBoundary>
            </Panel>
          </>) : null}
        </PanelGroup>
      </Panel>
    </PanelGroup>
  );
};

export default Debug;
