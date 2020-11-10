// @flow
import React from 'react';
import { Pane, PaneBody, PaneHeader } from './pane';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import GrpcMethodDropdown from '../dropdowns/grpc-method-dropdown';
import GrpcTabbedMessages from '../viewers/grpc-tabbed-messages';
import OneLineEditor from '../codemirror/one-line-editor';
import type { Settings } from '../../../models/settings';
import type { GrpcRequest } from '../../../models/grpc-request';
import type { GrpcMethodDefinition, GrpcMethodType } from '../../../network/grpc/method';
import {
  canClientStream,
  getMethodType,
  GrpcMethodTypeEnum,
  GrpcMethodTypeName,
} from '../../../network/grpc/method';
import * as models from '../../../models';
import * as protoLoader from '../../../network/grpc/proto-loader';
import type { GrpcRequestEvent } from '../../../common/grpc-events';
import { ipcRenderer } from 'electron';
import { GrpcRequestEventEnum } from '../../../common/grpc-events';

type Props = {
  forceRefreshKey: string,
  activeRequest: GrpcRequest,
  settings: Settings,
};

type MethodSelection = {
  selectedMethod: GrpcMethodDefinition | undefined,
  selectedMethodType: GrpcMethodType | undefined,
};

const getMethodSelection = (
  methods: Array<GrpcMethodDefinition>,
  methodName: string,
): MethodSelection => {
  const selectedMethod = methods.find(c => c.path === methodName);
  const selectedMethodType = selectedMethod && getMethodType(selectedMethod);

  return { selectedMethod, selectedMethodType };
};

type ChangeHandlers = {
  url: string => Promise<void>,
  body: string => Promise<void>,
  method: string => Promise<void>,
};

// This will create cached change handlers for the url, body and method selection
const getChangeHandlers = (request: GrpcRequest): ChangeHandlers => {
  const url = async (value: string) => {
    await models.grpcRequest.update(request, { url: value });
  };

  const body = async (value: string) => {
    await models.grpcRequest.update(request, { body: { ...request.body, text: value } });
  };

  const method = async (value: string) => {
    await models.grpcRequest.update(request, { protoMethodName: value });
  };

  return { url, body, method };
};

const demoRequestMessages = [
  { id: '2', created: 1604589843467, text: '{"greeting": "Hello Stream 2"}' },
  { id: '3', created: 1604589843468, text: '{"greeting": "Hello Stream 3"}' },
  { id: '1', created: 1604589843466, text: '{"greeting": "Hello Stream 1"}' },
];
demoRequestMessages.sort((a, b) => a.created - b.created);

const GrpcRequestPane = ({ activeRequest, forceRefreshKey, settings }: Props) => {
  const [methods, setMethods] = React.useState<Array<GrpcMethodDefinition>>([]);

  // Reload the methods, on first mount, or if the request protoFile changes
  React.useEffect(() => {
    const func = async () => {
      const protoFile = await models.protoFile.getById(activeRequest.protoFileId);
      setMethods(await protoLoader.loadMethods(protoFile));
    };
    func();
  }, [activeRequest.protoFileId]);

  // If the methods, or the selected proto method changes, get an updated method selection
  const { selectedMethod, selectedMethodType } = React.useMemo(
    () => getMethodSelection(methods, activeRequest.protoMethodName),
    [methods, activeRequest.protoMethodName],
  );

  const handleChange = React.useMemo(() => getChangeHandlers(activeRequest), [activeRequest]);

  // Used to refresh input fields to their default value when switching between requests.
  // This is a common pattern in this codebase.
  const uniquenessKey = `${forceRefreshKey}::${activeRequest._id}`;

  const sendIpc = React.useCallback(
    (channel: GrpcRequestEvent) => ipcRenderer.send(channel, activeRequest._id),
    [activeRequest._id],
  );

  return (
    <Pane type="request">
      <PaneHeader className="grpc-urlbar">
        <div className="method-grpc pad">gRPC</div>
        <form className={'form-control form-control--outlined'}>
          <OneLineEditor
            key={uniquenessKey}
            type="text"
            forceEditor
            defaultValue={activeRequest.url}
            onChange={handleChange.url}
          />
        </form>
        <GrpcMethodDropdown
          methods={methods}
          selectedMethod={selectedMethod}
          handleChange={handleChange.method}
        />
        {!selectedMethod && (
          <button className="urlbar__send-btn" disabled>
            Send
          </button>
        )}
        {selectedMethodType === GrpcMethodTypeEnum.unary && (
          <button
            className="urlbar__send-btn"
            onClick={() => sendIpc(GrpcRequestEventEnum.sendUnary)}>
            Send
          </button>
        )}
        {selectedMethodType === GrpcMethodTypeEnum.client && (
          <button
            className="urlbar__send-btn"
            onClick={() => sendIpc(GrpcRequestEventEnum.startStream)}>
            Start
          </button>
        )}
        {(selectedMethodType === GrpcMethodTypeEnum.server ||
          selectedMethodType === GrpcMethodTypeEnum.bidi) && (
          <button className="urlbar__send-btn" disabled>
            Coming soon
          </button>
        )}
      </PaneHeader>
      <PaneBody>
        <Tabs className="react-tabs" forceRenderTabPanel>
          <TabList>
            <Tab>
              <button>{GrpcMethodTypeName[selectedMethodType]}</button>
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
              messages={canClientStream(selectedMethodType) ? demoRequestMessages : []}
              bodyText={activeRequest.body.text}
              handleBodyChange={handleChange.body}
              handleStream={
                canClientStream(selectedMethodType) &&
                (() => sendIpc(GrpcRequestEventEnum.sendMessage))
              }
              handleCommit={
                canClientStream(selectedMethodType) && (() => sendIpc(GrpcRequestEventEnum.commit))
              }
            />
          </TabPanel>
          <TabPanel className="react-tabs__tab-panel">
            <h4 className="pad">Coming soon! 😊</h4>
          </TabPanel>
        </Tabs>
      </PaneBody>
    </Pane>
  );
};

export default GrpcRequestPane;
