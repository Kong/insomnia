import { ServiceError, StatusObject } from '@grpc/grpc-js';
import React, { FC, Fragment, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useFetcher, useParams, useRouteLoaderData } from 'react-router-dom';

import { ChangeBufferEvent, database as db } from '../../common/database';
import { generateId } from '../../common/misc';
import type { GrpcMethodInfo } from '../../main/ipc/grpc';
import * as models from '../../models';
import { GrpcRequest, isGrpcRequest, isGrpcRequestId } from '../../models/grpc-request';
import { getByParentId as getGrpcRequestMetaByParentId } from '../../models/grpc-request-meta';
import * as requestOperations from '../../models/helpers/request-operations';
import { isRequest, isRequestId, Request } from '../../models/request';
import { getByParentId as getRequestMetaByParentId } from '../../models/request-meta';
import { isWebSocketRequestId, WebSocketRequest } from '../../models/websocket-request';
import { invariant } from '../../utils/invariant';
import { SegmentEvent, trackSegmentEvent } from '../analytics';
import { EnvironmentsDropdown } from '../components/dropdowns/environments-dropdown';
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
import { WebSocketRequestPane } from '../components/websockets/websocket-request-pane';
import { WebSocketResponsePane } from '../components/websockets/websocket-response-pane';
import { updateRequestMetaByParentId } from '../hooks/create-request';
import {
  selectActiveEnvironment,
  selectActiveWorkspace,
  selectActiveWorkspaceMeta,
  selectSettings,
} from '../redux/selectors';
import { selectSidebarFilter } from '../redux/sidebar-selectors';
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
  const activeEnvironment = useSelector(selectActiveEnvironment);
  const activeRequest = useRouteLoaderData('request/:requestId') as Request | GrpcRequest | WebSocketRequest | null;

  const activeWorkspace = useSelector(selectActiveWorkspace);
  const [grpcStates, setGrpcStates] = useState<GrpcRequestState[]>([]);
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
      if (activeWorkspace) {
        const children = await db.withDescendants(activeWorkspace);
        const grpcRequests = children.filter(d => isGrpcRequest(d));
        setGrpcStates(grpcRequests.map(r => ({ requestId: r._id, ...INITIAL_GRPC_REQUEST_STATE })));
      }
    };
    fn();
  }, [activeWorkspace]);
  const requestFetcher = useFetcher();
  const { organizationId, projectId, workspaceId, requestId } = useParams() as { organizationId: string; projectId: string; workspaceId: string; requestId: string };
  const settings = useSelector(selectSettings);
  const sidebarFilter = useSelector(selectSidebarFilter);
  const activeWorkspaceMeta = useSelector(selectActiveWorkspaceMeta);
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
          updateRequestMetaByParentId(requestId, { pinned: !meta?.pinned });
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
                await requestOperations.remove(activeRequest);
                models.stats.incrementDeletedRequests();
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
              const newRequest = await requestOperations.duplicate(activeRequest, {
                name,
              });
              if (activeWorkspaceMeta) {
                await models.workspaceMeta.update(activeWorkspaceMeta, { activeRequestId: newRequest._id });
              }
              await updateRequestMetaByParentId(newRequest._id, {
                lastActive: Date.now(),
              });
              models.stats.incrementCreatedRequests();
            },
          });
        }
      },
    request_createHTTP:
      async () => {
        if (activeWorkspace) {
          const parentId = activeRequest ? activeRequest.parentId : activeWorkspace._id;
          const request = await models.request.create({
            parentId,
            name: 'New Request',
          });
          if (activeWorkspaceMeta) {
            await models.workspaceMeta.update(activeWorkspaceMeta, { activeRequestId: request._id });
          }
          await updateRequestMetaByParentId(request._id, {
            lastActive: Date.now(),
          });
          models.stats.incrementCreatedRequests();
          trackSegmentEvent(SegmentEvent.requestCreate, { requestType: 'HTTP' });
        }
      },
    request_showCreateFolder:
      () => {
        if (activeWorkspace) {
          const parentId = activeRequest ? activeRequest.parentId : activeWorkspace._id;
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
        }
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

  return (
    <SidebarLayout
      renderPageSidebar={activeWorkspace ? <Fragment>
        <div className="sidebar__menu">
          <EnvironmentsDropdown
            activeEnvironment={activeEnvironment}
            workspaceId={activeWorkspace._id}
          />
          <button className="btn btn--super-compact" onClick={showCookiesModal}>
            <div className="sidebar__menu__thing">
              <span>Cookies</span>
            </div>
          </button>
        </div>

        <SidebarFilter
          key={`${activeWorkspace._id}::filter`}
          filter={sidebarFilter || ''}
        />

        <SidebarChildren
          filter={sidebarFilter || ''}
        />
      </Fragment>
        : null}
      renderPaneOne={activeWorkspace ?
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
            workspace={activeWorkspace}
            setLoading={setLoading}
          />)}
          {!requestId && <PlaceholderRequestPane />}
        </ErrorBoundary>
        : null}
      renderPaneTwo={
        <ErrorBoundary showAlert>
          {isGrpcRequestId(requestId) && grpcState && (
            <GrpcResponsePane grpcState={grpcState} />)}
          {isWebSocketRequestId(requestId) && (
            <WebSocketResponsePane />)}
          {isRequestId(requestId) && (
            <ResponsePane runningRequests={runningRequests} />)}
        </ErrorBoundary>}
    />
  );
};

export default Debug;
