import { dirname } from 'path';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';

import { getCommonHeaderNames, getCommonHeaderValues } from '../../../common/common-headers';
import { generateId } from '../../../common/misc';
import { getRenderedGrpcRequest, getRenderedGrpcRequestMessage, RENDER_PURPOSE_SEND } from '../../../common/render';
import type { GrpcMethodInfo, GrpcMethodType } from '../../../main/network/grpc';
import * as models from '../../../models';
import type { GrpcRequest, GrpcRequestHeader } from '../../../models/grpc-request';
import { queryAllWorkspaceUrls } from '../../../models/helpers/query-all-workspace-urls';
import { invariant } from '../../../utils/invariant';
import { useActiveRequestSyncVCSVersion, useGitVCSVersion } from '../../hooks/use-vcs-version';
import { selectActiveEnvironment } from '../../redux/selectors';
import { GrpcRequestState } from '../../routes/debug';
import { FileInputButton } from '../base/file-input-button';
import { PanelContainer, TabItem, Tabs } from '../base/tabs';
import { GrpcSendButton } from '../buttons/grpc-send-button';
import { OneLineEditor } from '../codemirror/one-line-editor';
import { GrpcMethodDropdown } from '../dropdowns/grpc-method-dropdown/grpc-method-dropdown';
import { ErrorBoundary } from '../error-boundary';
import { KeyValueEditor } from '../key-value-editor/key-value-editor';
import { useDocBodyKeyboardShortcuts } from '../keydown-binder';
import { showAlert, showModal } from '../modals';
import { RequestRenderErrorModal } from '../modals/request-render-error-modal';
import { GrpcTabbedMessages } from '../viewers/grpc-tabbed-messages';
import { Pane, PaneBody, PaneHeader } from './pane';
interface Props {
  activeRequest: GrpcRequest;
  workspaceId: string;
  grpcState: GrpcRequestState;
  setGrpcState: (state: GrpcRequestState) => void;
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
}) => {
  const [error, setError] = useState<string>('');
  const [methods, setMethods] = useState<GrpcMethodInfo[]>([]);
  const { requestMessages, running } = grpcState;
  const includeDirs = activeRequest.includeDirs.join();
  useEffect(() => {
    const loadMethods = async () => {
      if (!activeRequest.protoFilePath) {
        setMethods([]);
        return;
      }
      try {
        const methods = await window.main.grpc.loadMethods(activeRequest._id);
        setMethods(methods);
        setError('');
        console.log('[gRPC] loading proto file methods', methods.map(m => m.fullPath));

      } catch (err) {
        console.error('[gRPC] error loading protofile', err);
        setError('Proto file invalid: ' + err.message.slice(56));
        setMethods([]);
      }
    };
    loadMethods();

  }, [activeRequest._id, activeRequest.protoFilePath, includeDirs]);

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
              disabled={running || methods.length === 0}
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
        <Tabs aria-label="Grpc request pane tabs">
          <TabItem key="method-type" title="Body">
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
          <TabItem key="service-defintion" title="Service Definition">
            <PanelContainer className="tall wide pad">
              <ErrorBoundary key={uniquenessKey} errorClassName="font-error pad text-center">
                {error && <p className="notice error margin-bottom-sm">{error}</p>}
                <div className="form-control">
                  <label>
                    <small>Proto file</small>
                    <FileInputButton
                      showFileName
                      path={activeRequest.protoFilePath}
                      className="btn btn--clicky"
                      onChange={async protoFilePath => {
                        // get folder of filepath
                        const includeDir = dirname(protoFilePath);
                        const request = await models.grpcRequest.getById(activeRequest._id);
                        invariant(request, 'Could not find request');
                        await models.grpcRequest.update(activeRequest, {
                          protoFilePath,
                          includeDirs: [...new Set([...request.includeDirs, includeDir])],
                          body: {
                            text: '{}',
                          },
                          protoMethodName: '',
                        });
                      }}
                    />
                  </label>
                </div>
                <div className="form-control margin-top">
                  <label>
                    <small>Add import paths</small>
                    <FileInputButton
                      name="Folder"
                      path={activeRequest.protoFilePath}
                      itemtypes={['directory']}
                      className="btn btn--clicky"
                      onChange={async includeDir => {
                        const request = await models.grpcRequest.getById(activeRequest._id);
                        invariant(request, 'Could not find request');
                        await models.grpcRequest.update(activeRequest, {
                          includeDirs: [...new Set([...request.includeDirs, includeDir])],
                          body: {
                            text: '{}',
                          },
                          protoMethodName: '',
                        });
                      }}
                    />
                  </label>
                </div>
                <div>{activeRequest.includeDirs.map(dir => (
                  <div
                    key={dir}
                    style={{ display: 'flex', gap: 'var(--padding-sm)', paddingTop: 'var(--padding-sm)', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    {dir}
                    <button
                      onClick={async () => {
                        const request = await models.grpcRequest.getById(activeRequest._id);
                        invariant(request, 'Could not find request');
                        models.grpcRequest.update(activeRequest, {
                          includeDirs: request.includeDirs.filter(d => d !== dir),
                          body: {
                            text: '{}',
                          },
                          protoMethodName: '',
                        });
                      }}
                      title="Delete item"
                    >
                      <i className="fa fa-trash-o" />
                    </button>
                  </div>
                ))}
                </div>
              </ErrorBoundary>
            </PanelContainer>
          </TabItem>
        </Tabs>
      </PaneBody>
    </Pane>
  );
};
