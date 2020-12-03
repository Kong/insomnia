// @flow
import React from 'react';
import { Pane, PaneBody, PaneHeader } from '../pane';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import { GrpcMethodDropdown } from '../../dropdowns/grpc-method-dropdown';
import GrpcTabbedMessages from '../../viewers/grpc-tabbed-messages';
import OneLineEditor from '../../codemirror/one-line-editor';
import type { Settings } from '../../../../models/settings';
import type { GrpcRequest } from '../../../../models/grpc-request';
import { GrpcRequestEventEnum } from '../../../../common/grpc-events';
import GrpcSendButton from '../../buttons/grpc-send-button';
import { grpcActions, useGrpc, useGrpcIpc } from '../../../context/grpc';
import useChangeHandlers from './use-change-handlers';
import useSelectedMethod from './use-selected-method';
import useProtoFileReload from './use-proto-file-reload';
import styled from 'styled-components';

type Props = {
  forceRefreshKey: string,
  activeRequest: GrpcRequest,
  settings: Settings,
};

const StyledUrlBar = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: stretch;
`;

const UrlEditor = styled.div`
  flex: 3 0 4em;
  max-width: 11em;
`;

const StyledDropdown = styled.div`
  flex: 1 0 auto;
`;

const GrpcRequestPane = ({ activeRequest, forceRefreshKey, settings }: Props) => {
  const [state, dispatch] = useGrpc(activeRequest._id);
  const { requestMessages, running, methods } = state;

  useProtoFileReload(state, dispatch, activeRequest);
  const selection = useSelectedMethod(state, activeRequest);

  const { method, methodType, methodTypeLabel, enableClientStream } = selection;

  const handleChange = useChangeHandlers(activeRequest, dispatch);

  // Used to refresh input fields to their default value when switching between requests.
  // This is a common pattern in this codebase.
  const uniquenessKey = `${forceRefreshKey}::${activeRequest._id}`;

  const sendIpc = useGrpcIpc(activeRequest._id);

  const handleStream = React.useCallback(() => {
    sendIpc(GrpcRequestEventEnum.sendMessage);
    dispatch(grpcActions.requestMessage(activeRequest._id, activeRequest.body.text));
  }, [activeRequest._id, activeRequest.body.text, dispatch, sendIpc]);

  const handleCommit = React.useCallback(() => sendIpc(GrpcRequestEventEnum.commit), [sendIpc]);

  return (
    <Pane type="request">
      <PaneHeader>
        <StyledUrlBar>
          <div className="method-grpc pad">gRPC</div>
          <UrlEditor title={activeRequest.url}>
            <OneLineEditor
              key={uniquenessKey}
              type="text"
              forceEditor
              defaultValue={activeRequest.url}
              placeholder="grpcb.in:9000"
              onChange={handleChange.url}
            />
          </UrlEditor>
          <StyledDropdown>
            <GrpcMethodDropdown
              disabled={running}
              methods={methods}
              selectedMethod={method}
              handleChange={handleChange.method}
              handleChangeProtoFile={handleChange.protoFile}
            />
          </StyledDropdown>

          <GrpcSendButton requestId={activeRequest._id} methodType={methodType} />
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
                handleStream={handleStream}
                handleCommit={handleCommit}
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
