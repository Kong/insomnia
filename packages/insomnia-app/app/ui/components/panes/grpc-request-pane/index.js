// @flow
import React from 'react';
import { Pane, PaneBody, PaneHeader } from '../pane';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import GrpcMethodDropdown from '../../dropdowns/grpc-method-dropdown';
import GrpcTabbedMessages from '../../viewers/grpc-tabbed-messages';
import OneLineEditor from '../../codemirror/one-line-editor';
import type { Settings } from '../../../../models/settings';
import type { GrpcRequest } from '../../../../models/grpc-request';
import GrpcSendButton from '../../buttons/grpc-send-button';
import { useGrpc } from '../../../context/grpc';
import useChangeHandlers from './use-change-handlers';
import useSelectedMethod from './use-selected-method';
import useProtoFileReload from './use-proto-file-reload';
import useGrpcIpcSend from './use-grpc-ipc-send';

type Props = {
  forceRefreshKey: string,
  activeRequest: GrpcRequest,
  environmentId: string,
  settings: Settings,

  // For variables
  handleRender: string => Promise<string>,
  isVariableUncovered: boolean,
  handleGetRenderContext: Function,
};

const GrpcRequestPane = ({
  activeRequest,
  environmentId,
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

  // Used to refresh input fields to their default value when switching between requests.
  // This is a common pattern in this codebase.
  const uniquenessKey = `${forceRefreshKey}::${activeRequest._id}`;

  const { handleStart, handleCancel, handleCommit, handleMessage } = useGrpcIpcSend(
    activeRequest._id,
    environmentId,
    methodType,
    dispatch,
  );

  return (
    <Pane type="request">
      <PaneHeader className="grpc-urlbar">
        <div className="method-grpc pad">gRPC</div>
        <OneLineEditor
          className="urlbar__url-editor"
          key={uniquenessKey}
          type="text"
          forceEditor
          defaultValue={activeRequest.url}
          placeholder="grpcb.in:9000"
          onChange={handleChange.url}
          render={handleRender}
          nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
          isVariableUncovered={isVariableUncovered}
          getAutocompleteConstants={() => []}
          getRenderContext={handleGetRenderContext}
        />

        <GrpcMethodDropdown
          disabled={running}
          methods={methods}
          selectedMethod={method}
          handleChange={handleChange.method}
          handleChangeProtoFile={handleChange.protoFile}
        />

        <GrpcSendButton
          requestId={activeRequest._id}
          methodType={methodType}
          handleCancel={handleCancel}
          handleStart={handleStart}
        />
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
                handleStream={handleMessage}
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
