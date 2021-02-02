// @flow
import React from 'react';
import { Pane, PaneBody, PaneHeader } from '../pane';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import { GrpcMethodDropdown } from '../../dropdowns/grpc-method-dropdown';
import GrpcTabbedMessages from '../../viewers/grpc-tabbed-messages';
import OneLineEditor from '../../codemirror/one-line-editor';
import type { Settings } from '../../../../models/settings';
import type { GrpcRequest } from '../../../../models/grpc-request';
import GrpcSendButton from '../../buttons/grpc-send-button';
import { useGrpc } from '../../../context/grpc';
import useChangeHandlers from './use-change-handlers';
import useSelectedMethod from './use-selected-method';
import useProtoFileReload from './use-proto-file-reload';
import styled from 'styled-components';
import useActionHandlers from './use-action-handlers';
import useExistingGrpcUrls from './use-existing-grpc-urls';

type Props = {
  forceRefreshKey: string,
  activeRequest: GrpcRequest,
  environmentId: string,
  workspaceId: string,
  settings: Settings,

  // For variables
  handleRender: string => Promise<string>,
  isVariableUncovered: boolean,
  handleGetRenderContext: Function,
};

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

const GrpcRequestPane = ({
  activeRequest,
  environmentId,
  workspaceId,
  forceRefreshKey,
  settings,
  handleRender,
  handleGetRenderContext,
  isVariableUncovered,
}: Props) => {
  const [state, dispatch] = useGrpc(activeRequest._id);
  const { requestMessages, running, methods } = state;

  useProtoFileReload(state, dispatch, activeRequest);
  const selection = useSelectedMethod(state, activeRequest);

  const { method, methodType, methodTypeLabel, enableClientStream } = selection;

  const handleChange = useChangeHandlers(activeRequest, dispatch);
  const handleAction = useActionHandlers(activeRequest._id, environmentId, methodType, dispatch);
  const getExistingGrpcUrls = useExistingGrpcUrls(workspaceId, activeRequest._id);

  // Used to refresh input fields to their default value when switching between requests.
  // This is a common pattern in this codebase.
  const uniquenessKey = `${forceRefreshKey}::${activeRequest._id}`;

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
              render={handleRender}
              nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
              isVariableUncovered={isVariableUncovered}
              getAutocompleteConstants={getExistingGrpcUrls}
              getRenderContext={handleGetRenderContext}
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
                settings={settings}
                tabNamePrefix="Stream"
                messages={requestMessages}
                bodyText={activeRequest.body.text}
                handleBodyChange={handleChange.body}
                showActions={running && enableClientStream}
                handleStream={handleAction.stream}
                handleCommit={handleAction.commit}
                handleRender={handleRender}
                handleGetRenderContext={handleGetRenderContext}
                isVariableUncovered={isVariableUncovered}
              />
            </TabPanel>
            <TabPanel className="react-tabs__tab-panel">
              <h4 className="pad">Coming soon! 😊</h4>
            </TabPanel>
          </Tabs>
        )}
        {!methodType && (
          <div className="overflow-hidden editor vertically-center text-center">
            <p className="pad super-faint text-sm text-center">
              <i className="fa fa-hand-peace-o" style={{ fontSize: '8rem', opacity: 0.3 }} />
              <br />
              <br />
              Select a gRPC method from above
            </p>
          </div>
        )}
      </PaneBody>
    </Pane>
  );
};

export default GrpcRequestPane;
