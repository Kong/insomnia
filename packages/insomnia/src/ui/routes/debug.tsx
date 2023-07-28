import { ServiceError, StatusObject } from '@grpc/grpc-js';
import React, { FC, Fragment, useEffect, useState } from 'react';
import { useFetcher, useParams, useRouteLoaderData } from 'react-router-dom';

import { ChangeBufferEvent, database as db } from '../../common/database';
import { generateId } from '../../common/misc';
import type { GrpcMethodInfo } from '../../main/ipc/grpc';
import * as models from '../../models';
import { GrpcRequest, isGrpcRequest, isGrpcRequestId } from '../../models/grpc-request';
import { getByParentId as getGrpcRequestMetaByParentId } from '../../models/grpc-request-meta';
import { isEventStreamRequest, isRequest, isRequestId, Request } from '../../models/request';
import { getByParentId as getRequestMetaByParentId } from '../../models/request-meta';
import { isWebSocketRequest, isWebSocketRequestId, WebSocketRequest } from '../../models/websocket-request';
import { invariant } from '../../utils/invariant';
import { EnvironmentsDropdown } from '../components/dropdowns/environments-dropdown';
import { WorkspaceSyncDropdown } from '../components/dropdowns/workspace-sync-dropdown';
import { ErrorBoundary } from '../components/error-boundary';
import { useDocBodyKeyboardShortcuts } from '../components/keydown-binder';
import { showModal, showPrompt } from '../components/modals';
import { AskModal } from '../components/modals/ask-modal';
import { CookiesModal, showCookiesModal } from '../components/modals/cookies-modal';
import { GenerateCodeModal } from '../components/modals/generate-code-modal';
import { PromptModal } from '../components/modals/prompt-modal';
import { RequestSettingsModal } from '../components/modals/request-settings-modal';
import { RequestSwitcherModal } from '../components/modals/request-switcher-modal';
import { WorkspaceEnvironmentsEditModal } from '../components/modals/workspace-environments-edit-modal';
import { GrpcRequestPane } from '../components/panes/grpc-request-pane';
import { GrpcResponsePane } from '../components/panes/grpc-response-pane';
import { PlaceholderRequestPane } from '../components/panes/placeholder-request-pane';
import { RequestPane } from '../components/panes/request-pane';
import { ResponsePane } from '../components/panes/response-pane';
import { SidebarChildren } from '../components/sidebar/sidebar-children';
import { SidebarFilter } from '../components/sidebar/sidebar-filter';
import { SidebarLayout } from '../components/sidebar-layout';
import { RealtimeResponsePane } from '../components/websockets/realtime-response-pane';
import { WebSocketRequestPane } from '../components/websockets/websocket-request-pane';
import { useRequestMetaPatcher } from '../hooks/use-request';
import { RequestLoaderData } from './request';
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

export const Debug: FC = () => {
  const {
    activeWorkspace,
    activeWorkspaceMeta,
    activeEnvironment,
  } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  const requestData = useRouteLoaderData('request/:requestId') as RequestLoaderData<Request | GrpcRequest | WebSocketRequest, any> | undefined;
  const { activeRequest } = requestData || {};
  const requestFetcher = useFetcher();
  const { organizationId, projectId, workspaceId, requestId } = useParams() as { organizationId: string; projectId: string; workspaceId: string; requestId: string };
  const [grpcStates, setGrpcStates] = useState<GrpcRequestState[]>([]);
  const patchRequestMeta = useRequestMetaPatcher();
  useEffect(() => {
    db.onChange(async (changes: ChangeBufferEvent[]) => {
      for (const change of changes) {
        const [event, doc] = change;
        if (isGrpcRequest(doc) && event === 'insert') {
          setGrpcStates(grpcStates => ([...grpcStates, { requestId: doc._id, ...INITIAL_GRPC_REQUEST_STATE }]));
        }
      }
    });
  }, []);
  useEffect(() => {
    const fn = async () => {
      const workspace = await models.workspace.getById(workspaceId);
      const children = await db.withDescendants(workspace);
      const grpcRequests = children.filter(d => isGrpcRequest(d));
      setGrpcStates(grpcRequests.map(r => ({ requestId: r._id, ...INITIAL_GRPC_REQUEST_STATE })));
    };
    fn();
  }, [workspaceId]);
  const {
    settings,
  } = useRouteLoaderData('root') as RootLoaderData;
  const { sidebarFilter } = activeWorkspaceMeta;
  const [runningRequests, setRunningRequests] = useState({});
  const setLoading = (isLoading: boolean) => {
    invariant(requestId, 'No active request');
    setRunningRequests({
      ...runningRequests,
      [requestId]: isLoading ? true : false,
    });
  };

  const grpcState = grpcStates.find(s => s.requestId === requestId);
  const setGrpcState = (newState: GrpcRequestState) => setGrpcStates(state => state.map(s => s.requestId === requestId ? newState : s));
  const reloadRequests = (requestIds: string[]) => {
    setGrpcStates(state => state.map(s => requestIds.includes(s.requestId) ? { ...s, methods: [] } : s));
  };
  useEffect(() => window.main.on('grpc.start', (_, id) => {
    setGrpcStates(state => state.map(s => s.requestId === id ? { ...s, running: true } : s));
  }), []);
  useEffect(() => window.main.on('grpc.end', (_, id) => {
    setGrpcStates(state => state.map(s => s.requestId === id ? { ...s, running: false } : s));
  }), []);
  useEffect(() => window.main.on('grpc.data', (_, id, value) => {
    setGrpcStates(state => state.map(s => s.requestId === id ? {
      ...s, responseMessages: [...s.responseMessages, {
        id: generateId(),
        text: JSON.stringify(value),
        created: Date.now(),
      }],
    } : s));
  }), []);
  useEffect(() => window.main.on('grpc.error', (_, id, error) => {
    setGrpcStates(state => state.map(s => s.requestId === id ? { ...s, error } : s));
  }), []);
  useEffect(() => window.main.on('grpc.status', (_, id, status) => {
    setGrpcStates(state => state.map(s => s.requestId === id ? { ...s, status } : s));
  }), []);
  useDocBodyKeyboardShortcuts({
    request_togglePin:
      async () => {
        if (requestId) {
          const meta = isGrpcRequestId(requestId) ? await getGrpcRequestMetaByParentId(requestId) : await getRequestMetaByParentId(requestId);
          patchRequestMeta(requestId, { pinned: !meta?.pinned });
        }
      },
    request_showSettings:
      () => {
        if (activeRequest) {
          showModal(RequestSettingsModal, { request: activeRequest });
        }
      },
    request_showDelete:
      () => {
        if (activeRequest) {
          showModal(AskModal, {
            title: 'Delete Request?',
            message: `Really delete ${activeRequest.name}?`,
            onDone: async (confirmed: boolean) => {
              if (confirmed) {
                requestFetcher.submit({ id: requestId },
                  {
                    action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/delete`,
                    method: 'post',
                  });
              }
            },
          });
        }
      },
    request_showDuplicate:
      () => {
        if (activeRequest) {
          showModal(PromptModal, {
            title: 'Duplicate Request',
            defaultValue: activeRequest.name,
            submitName: 'Create',
            label: 'New Name',
            selectText: true,
            onComplete: async (name: string) => {
              requestFetcher.submit({ name },
                {
                  action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${requestId}/duplicate`,
                  method: 'post',
                  encType: 'application/json',
                });
            },
          });
        }
      },
    request_createHTTP:
      async () => {
        const parentId = activeRequest ? activeRequest.parentId : activeWorkspace._id;
        requestFetcher.submit({ requestType: 'HTTP', parentId },
          {
            action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/new`,
            method: 'post',
            encType: 'application/json',
          });
      },
    request_showCreateFolder:
      () => {
        const parentId = activeRequest ? activeRequest.parentId : workspaceId;
        showPrompt({
          title: 'New Folder',
          defaultValue: 'My Folder',
          submitName: 'Create',
          label: 'Name',
          selectText: true,
          onComplete: name => requestFetcher.submit({ parentId, name },
            {
              action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request-group/new`,
              method: 'post',
            }),
        });
      },
    request_showRecent:
      () => showModal(RequestSwitcherModal, {
        disableInput: true,
        maxRequests: 10,
        maxWorkspaces: 0,
        selectOnKeyup: true,
        title: 'Recent Requests',
        hideNeverActiveRequests: true,
        // Add an open delay so the dialog won't show for quick presses
        openDelay: 150,
      }),
    request_quickSwitch:
      () => showModal(RequestSwitcherModal),
    environment_showEditor:
      () => showModal(WorkspaceEnvironmentsEditModal),
    showCookiesEditor:
      () => showModal(CookiesModal),
    request_showGenerateCodeEditor:
      () => {
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
  const isRealtimeRequest = activeRequest && (isWebSocketRequest(activeRequest) || isEventStreamRequest(activeRequest));
  return (
    <SidebarLayout
      renderPageSidebar={workspaceId ? <Fragment>
        <div className="sidebar__menu">
          <EnvironmentsDropdown
            activeEnvironment={activeEnvironment}
            workspaceId={workspaceId}
          />
          <button className="btn btn--super-compact" onClick={showCookiesModal}>
            <div className="sidebar__menu__thing">
              <span>Cookies</span>
            </div>
          </button>
        </div>

        <SidebarFilter
          key={`${workspaceId}::filter`}
          filter={sidebarFilter || ''}
        />
        <SidebarChildren
          filter={sidebarFilter || ''}
        />
        <WorkspaceSyncDropdown />
      </Fragment>
        : null}
      renderPaneOne={workspaceId ?
        <ErrorBoundary showAlert>
          {isGrpcRequestId(requestId) && grpcState && (
            <GrpcRequestPane
              grpcState={grpcState}
              setGrpcState={setGrpcState}
              reloadRequests={reloadRequests}
            />)}
          {isWebSocketRequestId(requestId) && (
            <WebSocketRequestPane environment={activeEnvironment} />)}
          {isRequestId(requestId) && (<RequestPane
            environmentId={activeEnvironment ? activeEnvironment._id : ''}
            settings={settings}
            setLoading={setLoading}
          />)}
          {!requestId && <PlaceholderRequestPane />}
        </ErrorBoundary>
        : null}
      renderPaneTwo={
        <ErrorBoundary showAlert>
          {activeRequest && isGrpcRequest(activeRequest) && grpcState && (
            <GrpcResponsePane grpcState={grpcState} />)}
          {isRealtimeRequest && (
            <RealtimeResponsePane requestId={activeRequest._id} />)}
          {activeRequest && isRequest(activeRequest) && !isRealtimeRequest && (
            <ResponsePane runningRequests={runningRequests} />)}
        </ErrorBoundary>}
    />
  );
};

export default Debug;
