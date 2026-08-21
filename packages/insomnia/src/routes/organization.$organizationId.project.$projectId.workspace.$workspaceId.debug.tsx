import type { ServiceError, StatusObject } from '@grpc/grpc-js';
import type { ChangeBufferEvent, Request } from 'insomnia-data';
import { models, services } from 'insomnia-data';
import React, { useEffect, useRef, useState } from 'react';
import { type ImperativePanelGroupHandle, Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { href, Navigate, redirect, useMatch, useNavigate, useParams } from 'react-router';

import { getProductName } from '~/common/constants';
import { generateId } from '~/common/misc';
import type { GrpcMethodInfo } from '~/main/ipc/grpc';
import { useRootLoaderData } from '~/root';
import {
  useWorkspaceLoaderData,
  WORKSPACE_CONTENT_WRAPPER,
} from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { useRequestLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import { useRequestDuplicateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.duplicate';
import { useRequestDeleteActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.delete';
import { useRequestNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.new';
import { useRequestGroupNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.new';
import Runner from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.runner';
import { AnalyticsEvent } from '~/ui/analytics';
import { ErrorBoundary } from '~/ui/components/error-boundary';
import { useDocBodyKeyboardShortcuts } from '~/ui/components/keydown-binder';
import { McpPane } from '~/ui/components/mcp/mcp-pane';
import { showModal } from '~/ui/components/modals';
import { AskModal } from '~/ui/components/modals/ask-modal';
import { ErrorModal } from '~/ui/components/modals/error-modal';
import { GenerateCodeModal } from '~/ui/components/modals/generate-code-modal';
import { ImportModal } from '~/ui/components/modals/import-modal/import-modal';
import { PasteCurlModal } from '~/ui/components/modals/paste-curl-modal';
import { PromptModal } from '~/ui/components/modals/prompt-modal';
import { RequestSettingsModal } from '~/ui/components/modals/request-settings-modal';
import { GrpcRequestPane } from '~/ui/components/panes/grpc-request-pane';
import { GrpcResponsePane } from '~/ui/components/panes/grpc-response-pane';
import { PlaceholderRequestPane } from '~/ui/components/panes/placeholder-request-pane';
import { RequestGroupPane } from '~/ui/components/panes/request-group-pane';
import { RequestPane } from '~/ui/components/panes/request-pane';
import { ResponsePane } from '~/ui/components/panes/response-pane';
import { SocketIORequestPane } from '~/ui/components/socket-io/request-pane';
import { OrganizationTabList } from '~/ui/components/tabs/tab-list';
import { showResourceNotFoundToast } from '~/ui/components/toast-notification';
import { RealtimeResponsePane } from '~/ui/components/websockets/realtime-response-pane';
import { WebSocketRequestPane } from '~/ui/components/websockets/websocket-request-pane';
import WorkspacePaneHeader from '~/ui/components/workspace/workspace-pane-header';
import { useTabNavigate } from '~/ui/hooks/use-insomnia-tab';
import { type CreateRequestType, useRequestMetaPatcher } from '~/ui/hooks/use-request';
import { getGrpcConnectionErrorDetails, isGrpcConnectionError } from '~/ui/utils/grpc';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug';

const { isEventStreamRequest, isGraphqlSubscriptionRequest, isRequest, isRequestId } = models.request;
const { isRequestGroupId } = models.requestGroup;

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

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  if (!params.requestId && !params.requestGroupId) {
    const { projectId, workspaceId, organizationId } = params;

    const activeProject = await services.project.getById(projectId);
    if (!activeProject) {
      showResourceNotFoundToast(`Project not found: ${projectId}`);
      throw redirect(href('/organization/:organizationId/project', { organizationId }));
    }

    const activeWorkspace = await services.workspace.getById(workspaceId);
    if (!activeWorkspace) {
      showResourceNotFoundToast(`Workspace not found: ${workspaceId}`);
      throw redirect(href('/organization/:organizationId/project/:projectId', { organizationId, projectId }));
    }

    const activeApiSpec = await services.apiSpec.getByParentId(workspaceId);
    if (activeWorkspace.scope === 'collection' && activeApiSpec) {
      // redirect to the spec view for the new collection workspace with an API spec
      return redirect(
        href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/spec', {
          organizationId,
          projectId,
          workspaceId,
        }),
      );
    }
  }
  return null;
}

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
    grpcRequests,
    activeApiSpec,
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

  const isRunner = Boolean(
    useMatch('/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/runner'),
  );
  const navigate = useNavigate();

  const [grpcStates, setGrpcStates] = useState<GrpcRequestState[]>(
    grpcRequests.map(r => ({
      requestId: r._id,
      ...INITIAL_GRPC_REQUEST_STATE,
    })),
  );
  const [isRequestSettingsModalOpen, setIsRequestSettingsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const patchRequestMeta = useRequestMetaPatcher();
  useEffect(() => {
    const unsubscribe = window.main.on('db.changes', async (_, changes: ChangeBufferEvent[]) => {
      for (const change of changes) {
        const [event, doc] = change;
        if (models.grpcRequest.isGrpcRequest(doc) && event === 'insert') {
          setGrpcStates(grpcStates => [...grpcStates, { requestId: doc._id, ...INITIAL_GRPC_REQUEST_STATE }]);
        }
      }
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (activeApiSpec && activeWorkspace.scope === 'collection' && Boolean(!requestId && !requestGroupId)) {
      navigate(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/spec`);
    }
  }, [
    activeApiSpec,
    activeWorkspace.scope,
    requestId,
    requestGroupId,
    navigate,
    organizationId,
    projectId,
    workspaceId,
  ]);

  const { settings } = useRootLoaderData()!;

  const grpcState = grpcStates.find(s => s.requestId === requestId);
  const setGrpcState = (newState: GrpcRequestState) =>
    setGrpcStates(state => state.map(s => (s.requestId === requestId ? newState : s)));
  const reloadRequests = (requestIds: string[]) => {
    setGrpcStates(state => state.map(s => (requestIds.includes(s.requestId) ? { ...s, methods: [] } : s)));
  };
  useEffect(() => {
    setGrpcStates(prev => {
      const existingIds = new Set(prev.map(s => s.requestId));
      const newEntries = grpcRequests
        .filter(r => !existingIds.has(r._id))
        .map(r => ({ requestId: r._id, ...INITIAL_GRPC_REQUEST_STATE }));
      return newEntries.length ? [...prev, ...newEntries] : prev;
    });
  }, [grpcRequests]);
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

  useDocBodyKeyboardShortcuts({
    request_togglePin: async () => {
      if (requestId) {
        const meta = models.grpcRequest.isGrpcRequestId(requestId)
          ? await services.grpcRequestMeta.getByParentId(requestId)
          : await services.requestMeta.getByParentId(requestId);
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
      // When a request is active, create a sibling; when a folder is selected (and no request is
      // active), create inside that folder; otherwise create at the workspace root.
      const parentId = activeRequest
        ? activeRequest.parentId
        : requestGroupId && isRequestGroupId(requestGroupId)
          ? requestGroupId
          : activeWorkspace._id;

      window.main.trackAnalyticsEvent({
        event: AnalyticsEvent.keyboardShortcutUsed,
        properties: {
          source: parentId === activeWorkspace._id ? 'empty-collection-page' : 'collection-page-request-list',
          action: 'createHttpRequest',
        },
      });
      createRequestFetcher.submit({
        organizationId,
        projectId,
        workspaceId,
        requestType: 'HTTP',
        parentId,
        metrics: {
          source: 'shortcut',
        },
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
    (models.webSocketRequest.isWebSocketRequest(activeRequest) ||
      isEventStreamRequest(activeRequest) ||
      isGraphqlSubscriptionRequest(activeRequest) ||
      models.socketIORequest.isSocketIORequest(activeRequest));

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
      metrics: {
        source: 'sidebar',
      },
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
    <div className="new-sidebar flex h-full w-full flex-col text-(--color-font)">
      <div className="flex flex-col">
        {/* Hide tabs when it's on the tutorial panel */}
        {!panel && <OrganizationTabList currentPage="debug" />}
        {!panel && <WorkspacePaneHeader hasSettings />}
      </div>
      <PanelGroup
        ref={sidebarPanelRef}
        autoSaveId="insomnia-sidebar"
        id={WORKSPACE_CONTENT_WRAPPER}
        className="new-sidebar min-h-0 flex-1 text-(--color-font)"
        direction="horizontal"
      >
        <Panel id="workspace-content" order={2} className="flex flex-col">
          <PanelGroup autoSaveId="insomnia-panels" id="insomnia-panels" direction={direction}>
            {isRunner ? (
              <Runner />
            ) : (
              <>
                <Panel id="pane-one" order={1} minSize={10} className="pane-one theme--pane">
                  {workspaceId ? (
                    <ErrorBoundary showAlert>
                      {isRequestGroupId(requestGroupId) && <RequestGroupPane />}
                      {models.grpcRequest.isGrpcRequestId(requestId) &&
                        grpcState &&
                        activeRequest?._id === requestId && (
                          <GrpcRequestPane
                            key={grpcState.requestId}
                            grpcState={grpcState}
                            setGrpcState={setGrpcState}
                            reloadRequests={reloadRequests}
                          />
                        )}
                      {models.webSocketRequest.isWebSocketRequestId(requestId) && activeRequest?._id === requestId && (
                        <WebSocketRequestPane environment={activeEnvironment} />
                      )}
                      {models.socketIORequest.isSocketIORequestId(requestId) && activeRequest?._id === requestId && (
                        <SocketIORequestPane environment={activeEnvironment} />
                      )}
                      {isRequestId(requestId) && activeRequest?._id === requestId && (
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
                        {activeRequest && models.grpcRequest.isGrpcRequest(activeRequest) && grpcState && (
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
            )}
          </PanelGroup>
        </Panel>
      </PanelGroup>
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
  );
};

export default DebugEntry;
