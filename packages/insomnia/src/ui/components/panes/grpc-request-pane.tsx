import React, { FunctionComponent, useRef, useState } from 'react';
import { useParams, useRouteLoaderData } from 'react-router-dom';
import { useMount } from 'react-use';
import styled from 'styled-components';

import { getCommonHeaderNames, getCommonHeaderValues } from '../../../common/common-headers';
import { documentationLinks } from '../../../common/documentation';
import { generateId } from '../../../common/misc';
import { getRenderedGrpcRequest, getRenderedGrpcRequestMessage, RENDER_PURPOSE_SEND } from '../../../common/render';
import { GrpcMethodType } from '../../../main/ipc/grpc';
import * as models from '../../../models';
import type { GrpcRequestHeader } from '../../../models/grpc-request';
import { queryAllWorkspaceUrls } from '../../../models/helpers/query-all-workspace-urls';
import { tryToInterpolateRequestOrShowRenderErrorModal } from '../../../utils/try-interpolate';
import { useRequestPatcher } from '../../hooks/use-request';
import { useActiveRequestSyncVCSVersion, useGitVCSVersion } from '../../hooks/use-vcs-version';
import { GrpcRequestState } from '../../routes/debug';
import { GrpcRequestLoaderData } from '../../routes/request';
import { WorkspaceLoaderData } from '../../routes/workspace';
import { PanelContainer, TabItem, Tabs } from '../base/tabs';
import { GrpcSendButton } from '../buttons/grpc-send-button';
import { CodeEditor, CodeEditorHandle } from '../codemirror/code-editor';
import { OneLineEditor } from '../codemirror/one-line-editor';
import { GrpcMethodDropdown } from '../dropdowns/grpc-method-dropdown/grpc-method-dropdown';
import { ErrorBoundary } from '../error-boundary';
import { KeyValueEditor } from '../key-value-editor/key-value-editor';
import { useDocBodyKeyboardShortcuts } from '../keydown-binder';
import { showAlert, showModal } from '../modals';
import { ErrorModal } from '../modals/error-modal';
import { ProtoFilesModal } from '../modals/proto-files-modal';
import { RequestRenderErrorModal } from '../modals/request-render-error-modal';
import { SvgIcon } from '../svg-icon';
import { Button } from '../themed-button';
import { Tooltip } from '../tooltip';
import { EmptyStatePane } from './empty-state-pane';
import { Pane, PaneBody, PaneHeader } from './pane';
interface Props {
  grpcState: GrpcRequestState;
  setGrpcState: (states: GrpcRequestState) => void;
  reloadRequests: (requestIds: string[]) => void;
}

const StyledUrlBar = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: stretch;
`;

const StyledUrlEditor = styled.div`
  flex: 1;
`;

const StyledDropdownWrapper = styled.div({
  flex: '1',
  display: 'flex',
  alignItems: 'center',
  paddingRight: 'var(--padding-sm)',
  gap: 'var(--padding-xs)',
});

export const canClientStream = (methodType?: GrpcMethodType) => methodType === 'client' || methodType === 'bidi';
export const GrpcMethodTypeName = {
  unary: 'Unary',
  server: 'Server Streaming',
  client: 'Client Streaming',
  bidi: 'Bi-directional Streaming',
} as const;

export const GrpcRequestPane: FunctionComponent<Props> = ({
  grpcState,
  setGrpcState,
  reloadRequests,
}) => {
  const { activeRequest } = useRouteLoaderData('request/:requestId') as GrpcRequestLoaderData;

  const [isProtoModalOpen, setIsProtoModalOpen] = useState(false);
  const { requestMessages, running, methods } = grpcState;
  useMount(async () => {
    if (!activeRequest.protoFileId) {
      return;
    }
    console.log(`[gRPC] loading proto file methods pf=${activeRequest.protoFileId}`);
    const methods = await window.main.grpc.loadMethods(activeRequest.protoFileId);
    setGrpcState({ ...grpcState, methods });
  });
  const editorRef = useRef<CodeEditorHandle>(null);
  const gitVersion = useGitVCSVersion();
  const activeRequestSyncVersion = useActiveRequestSyncVCSVersion();
  const { workspaceId, requestId } = useParams() as { workspaceId: string; requestId: string };
  const patchRequest = useRequestPatcher();
  const {
    activeEnvironment,
  } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  const environmentId = activeEnvironment._id;
  // Reset the response pane state when we switch requests, the environment gets modified, or the (Git|Sync)VCS version changes
  const uniquenessKey = `${activeEnvironment.modified}::${requestId}::${gitVersion}::${activeRequestSyncVersion}`;
  const method = methods.find(c => c.fullPath === activeRequest.protoMethodName);
  const methodType = method?.type;
  const handleRequestSend = async () => {
    if (method && !running) {
      try {
        const request = await getRenderedGrpcRequest({
          request: activeRequest,
          environmentId,
          purpose: RENDER_PURPOSE_SEND,
          skipBody: canClientStream(methodType),
        });
        window.main.grpc.start({ request });
        setGrpcState({
          ...grpcState,
          requestMessages: [],
          responseMessages: [],
          status: undefined,
          error: undefined,
        });
      } catch (err) {
        if (err.type === 'render') {
          showModal(RequestRenderErrorModal, {
            request: activeRequest,
            error: err,
          });
        } else {
          showAlert({
            title: 'Unexpected Request Failure',
            message: (
              <div>
                <p>The request failed due to an unhandled error:</p>
                <code className="wide selectable">
                  <pre>{err.message}</pre>
                </code>
              </div>
            ),
          });
        }
      }

    }
  };

  useDocBodyKeyboardShortcuts({
    request_send: handleRequestSend,
  });

  return (
    <>
      <Pane type="request">
        <PaneHeader>
          <StyledUrlBar>
            <div className="method-grpc pad-right pad-left vertically-center">gRPC</div>
            <StyledUrlEditor title={activeRequest.url}>
              <OneLineEditor
                id="grpc-url"
                key={uniquenessKey}
                type="text"
                defaultValue={activeRequest.url}
                placeholder="grpcb.in:9000"
                onChange={url => patchRequest(requestId, { url })}
                getAutocompleteConstants={() => queryAllWorkspaceUrls(workspaceId, models.grpcRequest.type, requestId)}
              />
            </StyledUrlEditor>
            <StyledDropdownWrapper>
              <GrpcMethodDropdown
                disabled={running}
                methods={methods}
                selectedMethod={method}
                handleChange={protoMethodName => {
                  patchRequest(requestId, { protoMethodName });
                  setGrpcState({
                    ...grpcState,
                    requestMessages: [],
                    responseMessages: [],
                    status: undefined,
                    error: undefined,
                  });
                }}
              />
              <Button
                variant="text"
                data-testid="button-use-request-stubs"
                disabled={!method?.example}
                onClick={() => {
                  if (editorRef.current && method?.example) {
                    editorRef.current.setValue(JSON.stringify(method.example, null, 2));
                  }
                }}
              >
                <Tooltip message="Click to replace body with an example" position="bottom" delay={500}>
                  <i className="fa fa-code" />
                </Tooltip>
              </Button>
              <Button
                variant="text"
                data-testid="button-server-reflection"
                disabled={!activeRequest.url}
                onClick={async () => {
                  try {
                    const rendered = await tryToInterpolateRequestOrShowRenderErrorModal({ request: activeRequest, environmentId, payload: { url: activeRequest.url, metadata: activeRequest.metadata } });
                    const methods = await window.main.grpc.loadMethodsFromReflection(rendered);
                    setGrpcState({ ...grpcState, methods });
                    patchRequest(requestId, { protoFileId: '', protoMethodName: '' });
                  } catch (error) {
                    showModal(ErrorModal, { error });
                  }
                }}
              >
                <Tooltip message="Click to use server reflection" position="bottom" delay={500}>
                  <i className="fa fa-refresh" />
                </Tooltip>
              </Button>
              <Button
                data-testid="button-proto-file"
                variant="text"
                onClick={() => setIsProtoModalOpen(true)}
              >
                <Tooltip message="Click to change proto file" position="bottom" delay={500}>
                  <i className="fa fa-file-code-o" />
                </Tooltip>
              </Button>
            </StyledDropdownWrapper>
            <div className='flex p-1'>
              <GrpcSendButton
                running={running}
                methodType={methodType}
                handleCancel={() => window.main.grpc.cancel(requestId)}
                handleStart={handleRequestSend}
              />
            </div>
          </StyledUrlBar>
        </PaneHeader>
        <PaneBody>
          {methodType && (
            <Tabs aria-label="Grpc request pane tabs">
              <TabItem key="method-type" title={GrpcMethodTypeName[methodType]}>
                <>
                  {running && canClientStream(methodType) && (
                    <ActionButtonsContainer>
                      <button
                        className='btn btn--compact btn--clicky-small margin-left-sm bg-default'
                        onClick={async () => {
                          const requestBody = await getRenderedGrpcRequestMessage({
                            request: activeRequest,
                            environmentId,
                            purpose: RENDER_PURPOSE_SEND,
                          });
                          const preparedMessage = {
                            body: requestBody,
                            requestId,
                          };
                          window.main.grpc.sendMessage(preparedMessage);
                          setGrpcState({
                            ...grpcState, requestMessages: [...requestMessages, {
                              id: generateId(),
                              text: preparedMessage.body.text || '',
                              created: Date.now(),
                            }],
                          });
                        }}
                      >
                        Stream <i className='fa fa-plus' />
                      </button>
                      <button
                        className='btn btn--compact btn--clicky-small margin-left-sm bg-surprise'
                        onClick={() => window.main.grpc.commit(requestId)}
                      >
                        Commit <i className='fa fa-arrow-right' />
                      </button>
                    </ActionButtonsContainer>
                  )}
                  <Tabs key={uniquenessKey} aria-label="Grpc tabbed messages tabs" isNested>
                    {[
                      <TabItem key="body" title="Body">
                        <CodeEditor
                          id="grpc-request-editor"
                          ref={editorRef}
                          defaultValue={activeRequest.body.text}
                          onChange={text => patchRequest(requestId, { body: { text } })}
                          mode="application/json"
                          enableNunjucks
                          showPrettifyButton={true}
                        />
                      </TabItem>,
                      ...requestMessages.sort((a, b) => a.created - b.created).map((m, index) => (
                        <TabItem key={m.id} title={`Stream ${index + 1}`}>
                          <CodeEditor
                            id={'grpc-request-editor-tab' + m.id}
                            defaultValue={m.text}
                            mode="application/json"
                            enableNunjucks
                            readOnly
                            autoPrettify
                          />
                        </TabItem>
                      )),
                    ]}
                  </Tabs>
                </>
              </TabItem>
              <TabItem key="headers" title="Headers">
                <PanelContainer className="tall wide">
                  <ErrorBoundary key={uniquenessKey} errorClassName="font-error pad text-center">
                    <KeyValueEditor
                      namePlaceholder="header"
                      valuePlaceholder="value"
                      descriptionPlaceholder="description"
                      pairs={activeRequest.metadata}
                      isDisabled={running}
                      handleGetAutocompleteNameConstants={getCommonHeaderNames}
                      handleGetAutocompleteValueConstants={getCommonHeaderValues}
                      onChange={(metadata: GrpcRequestHeader[]) => patchRequest(requestId, { metadata })}
                    />
                  </ErrorBoundary>
                </PanelContainer>
              </TabItem>
            </Tabs>
          )}
          {!methodType && (
            <EmptyStatePane
              icon={<SvgIcon icon="bug" />}
              documentationLinks={[documentationLinks.introductionToInsomnia]}
              secondaryAction="Select a body type from above to send data in the body of a request"
              title="Enter a URL and send to get a response"
            />
          )}
        </PaneBody>
      </Pane>
      {isProtoModalOpen && <ProtoFilesModal
        reloadRequests={reloadRequests}
        defaultId={activeRequest.protoFileId}
        onHide={() => setIsProtoModalOpen(false)}
        onSave={async (protoFileId: string) => {
          if (activeRequest.protoFileId !== protoFileId) {
            patchRequest(requestId, { protoFileId, protoMethodName: '' });
            const methods = await window.main.grpc.loadMethods(protoFileId);
            setGrpcState({ ...grpcState, methods });
            setIsProtoModalOpen(false);
          }
          setIsProtoModalOpen(false);
        }}
      />}
    </>
  );
};
const ActionButtonsContainer = styled.div({
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'flex-end',
  boxSizing: 'border-box',
  height: 'var(--line-height-sm)',
  borderBottom: '1px solid var(--hl-lg)',
  padding: 3,
});
