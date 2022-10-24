import React, { FunctionComponent, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import styled from 'styled-components';

import { getCommonHeaderNames, getCommonHeaderValues } from '../../../../common/common-headers';
import { documentationLinks } from '../../../../common/documentation';
import type { GrpcRequest } from '../../../../models/grpc-request';
import type { Settings } from '../../../../models/settings';
import { useGrpc } from '../../../context/grpc';
import { useActiveRequestSyncVCSVersion, useGitVCSVersion } from '../../../hooks/use-vcs-version';
import { selectActiveEnvironment } from '../../../redux/selectors';
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
import useExistingGrpcUrls from './use-existing-grpc-urls';
import useProtoFileReload from './use-proto-file-reload';
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
  const [state, dispatch] = useGrpc(activeRequest._id);
  const { requestMessages, running, methods } = state;
  useProtoFileReload(state, dispatch, activeRequest);
  const selection = useSelectedMethod(state, activeRequest);
  const { method, methodType, methodTypeLabel, enableClientStream } = selection;
  const handleChange = useChangeHandlers(activeRequest, dispatch);
  // @ts-expect-error -- TSCONVERSION methodType can be undefined
  const handleAction = useActionHandlers(activeRequest._id, environmentId, methodType, dispatch);
  const getExistingGrpcUrls = useExistingGrpcUrls(workspaceId, activeRequest._id);
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
              forceEditor
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
          <Tabs className="react-tabs" forceRenderTabPanel>
            <TabList>
              <Tab>
                <button>{methodTypeLabel}</button>
              </Tab>
              <Tab>
                <button>Headers</button>
              </Tab>
            </TabList>
            <TabPanel className="react-tabs__tab-panel">
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
            </TabPanel>
            <TabPanel className="react-tabs__tab-panel">
              <div className="tall wide scrollable-container">
                <div className="scrollable">
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
                </div>
              </div>
            </TabPanel>
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
