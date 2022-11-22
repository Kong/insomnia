import React, { FunctionComponent, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useAsync } from 'react-use';
import styled from 'styled-components';

import { getCommonHeaderNames, getCommonHeaderValues } from '../../../../common/common-headers';
import { documentationLinks } from '../../../../common/documentation';
import * as models from '../../../../models';
import type { GrpcRequest } from '../../../../models/grpc-request';
import { queryAllWorkspaceUrls } from '../../../../models/helpers/query-all-workspace-urls';
import type { Settings } from '../../../../models/settings';
import * as protoLoader from '../../../../network/grpc/proto-loader';
import { grpcActions, useGrpc } from '../../../context/grpc';
import { useActiveRequestSyncVCSVersion, useGitVCSVersion } from '../../../hooks/use-vcs-version';
import { selectActiveEnvironment } from '../../../redux/selectors';
import { PanelContainer, TabItem, Tabs } from '../../base/tabs';
import { GrpcSendButton } from '../../buttons/grpc-send-button';
import { OneLineEditor } from '../../codemirror/one-line-editor';
import { GrpcMethodDropdown } from '../../dropdowns/grpc-method-dropdown/grpc-method-dropdown';
import { ErrorBoundary } from '../../error-boundary';
import { KeyValueEditor } from '../../key-value-editor/key-value-editor';
import { useDocBodyKeyboardShortcuts } from '../../keydown-binder';
import { SvgIcon } from '../../svg-icon';
import { GrpcTabbedMessages } from '../../viewers/grpc-tabbed-messages';
import { EmptyStatePane } from '../empty-state-pane';
import { Pane, PaneBody, PaneHeader } from '../pane';
import useActionHandlers from './use-action-handlers';
import useChangeHandlers from './use-change-handlers';
import useSelectedMethod from './use-selected-method';
interface Props {
  activeRequest: GrpcRequest;
  environmentId: string;
  workspaceId: string;
  settings: Settings;
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

export const GrpcRequestPane: FunctionComponent<Props> = ({
  activeRequest,
  environmentId,
  workspaceId,
}) => {
  const [state, grpcDispatch] = useGrpc(activeRequest._id);
  const { requestMessages, running, reloadMethods, methods } = state;
  const { _id, protoFileId } = activeRequest;
  useAsync(async () => {
    // don't actually reload until the request has stopped running or if methods do not need to be reloaded
    if (!reloadMethods || running) {
      return;
    }
    grpcDispatch(grpcActions.clear(_id));
    console.log(`[gRPC] loading proto file methods pf=${protoFileId}`);
    const protoFile = await models.protoFile.getById(protoFileId);
    const methods = await protoLoader.loadMethods(protoFile);
    grpcDispatch(grpcActions.loadMethods(_id, methods));
  }, [_id, protoFileId, reloadMethods, grpcDispatch, running]);

  const selection = useSelectedMethod(state, activeRequest);
  const { method, methodType, methodTypeLabel, enableClientStream } = selection;
  const handleChange = useChangeHandlers(activeRequest, grpcDispatch);
  // @ts-expect-error -- TSCONVERSION methodType can be undefined
  const handleAction = useActionHandlers(activeRequest._id, environmentId, methodType, grpcDispatch);
  const getExistingGrpcUrls = async () => {
    const workspace = await models.workspace.getById(workspaceId);
    return queryAllWorkspaceUrls(workspace, models.grpcRequest.type, activeRequest._id);
  };

  const gitVersion = useGitVCSVersion();
  const activeRequestSyncVersion = useActiveRequestSyncVCSVersion();
  const activeEnvironment = useSelector(selectActiveEnvironment);
  // Reset the response pane state when we switch requests, the environment gets modified, or the (Git|Sync)VCS version changes
  const uniquenessKey = `${activeEnvironment?.modified}::${activeRequest?._id}::${gitVersion}::${activeRequestSyncVersion}`;

  const { start } = handleAction;
  const handleRequestSend = useCallback(() => {
    if (method && !running) {
      start();
    }
  }, [method, running, start]);

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
              onChange={handleChange.url}
              getAutocompleteConstants={getExistingGrpcUrls}
            />
          </StyledUrlEditor>
          <StyledDropdown>
            <GrpcMethodDropdown
              disabled={running}
              methods={methods}
              selectedMethod={method}
              handleChange={handleChange.method}
              handleChangeProtoFile={handleChange.protoFile}
            />
          </StyledDropdown>

          <GrpcSendButton
            running={running}
            methodType={methodType}
            handleCancel={handleAction.cancel}
            handleStart={handleAction.start}
          />
        </StyledUrlBar>
      </PaneHeader>
      <PaneBody>
        {methodType && (
          <Tabs aria-label="Grpc request pane tabs">
            <TabItem key="method-type" title={methodTypeLabel}>
              <GrpcTabbedMessages
                uniquenessKey={uniquenessKey}
                tabNamePrefix="Stream"
                messages={requestMessages}
                bodyText={activeRequest.body.text}
                handleBodyChange={handleChange.body}
                showActions={running && enableClientStream}
                handleStream={handleAction.stream}
                handleCommit={handleAction.commit}
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
                    onChange={handleChange.metadata}
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
  );
};
