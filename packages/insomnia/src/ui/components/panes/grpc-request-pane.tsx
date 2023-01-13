import React, { FunctionComponent, useState } from 'react';
import { useSelector } from 'react-redux';
import { useAsync } from 'react-use';
import styled from 'styled-components';

import { getCommonHeaderNames, getCommonHeaderValues } from '../../../common/common-headers';
import { documentationLinks } from '../../../common/documentation';
import { generateId } from '../../../common/misc';
import { getRenderContext, getRenderedGrpcRequest, getRenderedGrpcRequestMessage, render, RENDER_PURPOSE_SEND } from '../../../common/render';
import { GrpcMethodType } from '../../../main/ipc/grpc';
import * as models from '../../../models';
import type { GrpcRequest, GrpcRequestHeader } from '../../../models/grpc-request';
import { queryAllWorkspaceUrls } from '../../../models/helpers/query-all-workspace-urls';
import { useActiveRequestSyncVCSVersion, useGitVCSVersion } from '../../hooks/use-vcs-version';
import { selectActiveEnvironment } from '../../redux/selectors';
import { GrpcRequestState } from '../../routes/debug';
import { PanelContainer, TabItem, Tabs } from '../base/tabs';
import { GrpcSendButton } from '../buttons/grpc-send-button';
import { OneLineEditor } from '../codemirror/one-line-editor';
import { GrpcMethodDropdown } from '../dropdowns/grpc-method-dropdown/grpc-method-dropdown';
import { ErrorBoundary } from '../error-boundary';
import { KeyValueEditor } from '../key-value-editor/key-value-editor';
import { useDocBodyKeyboardShortcuts } from '../keydown-binder';
import { showAlert, showModal } from '../modals';
import { ProtoFilesModal } from '../modals/proto-files-modal';
import { RequestRenderErrorModal } from '../modals/request-render-error-modal';
import { SvgIcon } from '../svg-icon';
import { GrpcTabbedMessages } from '../viewers/grpc-tabbed-messages';
import { EmptyStatePane } from './empty-state-pane';
import { Pane, PaneBody, PaneHeader } from './pane';
interface Props {
  activeRequest: GrpcRequest;
  workspaceId: string;
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
  flex: 3 0 4em;
  max-width: 11em;
`;

const StyledDropdown = styled.div`
  flex: 1 0 auto;
`;
export const canClientStream = (methodType?: GrpcMethodType) => methodType === 'client' || methodType === 'bidi';
export const GrpcMethodTypeName = {
  unary: 'Unary',
  server: 'Server Streaming',
  client: 'Client Streaming',
  bidi: 'Bi-directional Streaming',
} as const;

export const GrpcRequestPane: FunctionComponent<Props> = ({
  activeRequest,
  workspaceId,
  grpcState,
  setGrpcState,
  reloadRequests,
}) => {
  const [isProtoModalOpen, setIsProtoModalOpen] = useState(false);
  const { requestMessages, running, reloadMethods, methods } = grpcState;
  useAsync(async () => {
    // don't actually reload until the request has stopped running or if methods do not need to be reloaded
    if (!reloadMethods || running) {
      return;
    }

    if (!activeRequest.protoFileId) {
      return;
    }
    console.log(`[gRPC] loading proto file methods pf=${activeRequest.protoFileId}`);
    const methods = await window.main.grpc.loadMethods(activeRequest.protoFileId);
    setGrpcState({ ...grpcState, methods, reloadMethods: false });
  }, [reloadMethods, running, setGrpcState, grpcState, activeRequest.protoFileId]);

  const gitVersion = useGitVCSVersion();
  const activeRequestSyncVersion = useActiveRequestSyncVCSVersion();
  const activeEnvironment = useSelector(selectActiveEnvironment);
  const environmentId = activeEnvironment?._id || 'n/a';
  // Reset the response pane state when we switch requests, the environment gets modified, or the (Git|Sync)VCS version changes
  const uniquenessKey = `${activeEnvironment?.modified}::${activeRequest?._id}::${gitVersion}::${activeRequestSyncVersion}`;
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
                key={uniquenessKey}
                type="text"
                defaultValue={activeRequest.url}
                placeholder="grpcb.in:9000"
                onChange={url => models.grpcRequest.update(activeRequest, { url })}
                getAutocompleteConstants={() => queryAllWorkspaceUrls(workspaceId, models.grpcRequest.type, activeRequest._id)}
              />
            </StyledUrlEditor>
            <StyledDropdown>
              <GrpcMethodDropdown
                disabled={running}
                methods={methods}
                selectedMethod={method}
                handleChange={protoMethodName => {
                  models.grpcRequest.update(activeRequest, { protoMethodName });
                  setGrpcState({
                    ...grpcState,
                    requestMessages: [],
                    responseMessages: [],
                    status: undefined,
                    error: undefined,
                  });
                }}
                handleChangeProtoFile={() => setIsProtoModalOpen(true)}
                handleServerReflection={async () => {
                  const request = await models.grpcRequest.update(activeRequest, { protoMethodName: '', protoFileId: '' });
                  const renderContext = await getRenderContext({ request, environmentId, purpose: RENDER_PURPOSE_SEND });
                  const rendered = await render({
                    url: request.url,
                    metadata: request.metadata,
                  }, renderContext);
                  const methods = await window.main.grpc.loadMethodsFromReflection(rendered);
                  setGrpcState({ ...grpcState, methods, reloadMethods: false });
                }}
              />
            </StyledDropdown>

            <GrpcSendButton
              running={running}
              methodType={methodType}
              handleCancel={() => window.main.grpc.cancel(activeRequest._id)}
              handleStart={handleRequestSend}
            />
          </StyledUrlBar>
        </PaneHeader>
        <PaneBody>
          {methodType && (
            <Tabs aria-label="Grpc request pane tabs">
              <TabItem key="method-type" title={GrpcMethodTypeName[methodType]}>
                <GrpcTabbedMessages
                  uniquenessKey={uniquenessKey}
                  tabNamePrefix="Stream"
                  messages={requestMessages}
                  bodyText={activeRequest.body.text}
                  handleBodyChange={value => models.grpcRequest.update(activeRequest, {
                    body: { ...activeRequest.body, text: value },
                  })}
                  showActions={running && canClientStream(methodType)}
                  handleStream={async () => {
                    const requestBody = await getRenderedGrpcRequestMessage({
                      request: activeRequest,
                      environmentId,
                      purpose: RENDER_PURPOSE_SEND,
                    });
                    const preparedMessage = {
                      body: requestBody,
                      requestId: activeRequest._id,
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
                  handleCommit={() => window.main.grpc.commit(activeRequest._id)}
                />
              </TabItem>
              <TabItem key="headers" title="Headers">
                <PanelContainer className="tall wide">
                  <ErrorBoundary key={uniquenessKey} errorClassName="font-error pad text-center">
                    <KeyValueEditor
                      namePlaceholder="header"
                      valuePlaceholder="value"
                      descriptionPlaceholder="description"
                      pairs={activeRequest.metadata}
                      handleGetAutocompleteNameConstants={getCommonHeaderNames}
                      handleGetAutocompleteValueConstants={getCommonHeaderValues}
                      onChange={(metadata: GrpcRequestHeader[]) => models.grpcRequest.update(activeRequest, { metadata })}
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
        onSave={async (protoFileId: string) => {
          if (activeRequest.protoFileId !== protoFileId) {
            await models.grpcRequest.update(activeRequest, {
              protoFileId,
              body: {
                text: '{}',
              },
              protoMethodName: '',
            });
            setGrpcState({ ...grpcState, reloadMethods: true });
          }
        }}
      />}
    </>
  );
};
