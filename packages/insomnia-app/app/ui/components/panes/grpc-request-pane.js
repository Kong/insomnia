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
import { canClientStream, getMethodType, GrpcMethodTypeName } from '../../../network/grpc/method';
import * as models from '../../../models';
import * as protoLoader from '../../../network/grpc/proto-loader';
import { GrpcRequestEventEnum } from '../../../common/grpc-events';
import GrpcSendButton from '../buttons/grpc-send-button';
import { grpcActions, useGrpc, useGrpcIpc } from '../../context/grpc';
import type { GrpcDispatch } from '../../context/grpc/grpc-actions';
import { showModal } from '../modals';
import ProtoFilesModal from '../modals/proto-files-modal';

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
  protoFile: string => Promise<void>,
};

// This will create memoized change handlers for the url, body and method selection
const useChangeHandlers = (request: GrpcRequest, dispatch: GrpcDispatch): ChangeHandlers => {
  return React.useMemo(() => {
    const url = async (value: string) => {
      await models.grpcRequest.update(request, { url: value });
    };

    const body = async (value: string) => {
      await models.grpcRequest.update(request, { body: { ...request.body, text: value } });
    };

    const method = async (value: string) => {
      await models.grpcRequest.update(request, { protoMethodName: value });
      dispatch(grpcActions.reset(request._id));
    };

    const protoFile = async () => {
      showModal(ProtoFilesModal, {
        preselectProtoFileId: request.protoFileId,
        onSave: async (protoFileId: string) => {
          if (request.protoFileId !== protoFileId) {
            const initial = models.grpcRequest.init();

            await models.grpcRequest.update(request, {
              protoFileId,
              body: initial.body,
              protoMethodName: initial.protoMethodName,
            });
            dispatch(grpcActions.reset(request._id));
          }
        },
      });
    };

    return { url, body, method, protoFile };
  }, [request, dispatch]);
};

const GrpcRequestPane = ({ activeRequest, forceRefreshKey, settings }: Props) => {
  const [{ requestMessages, running }, grpcDispatch] = useGrpc(activeRequest._id);

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

  const handleChange = useChangeHandlers(activeRequest, grpcDispatch);

  // Used to refresh input fields to their default value when switching between requests.
  // This is a common pattern in this codebase.
  const uniquenessKey = `${forceRefreshKey}::${activeRequest._id}`;

  const sendIpc = useGrpcIpc(activeRequest._id);

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
            placeholder="grpcb.in:9000"
            onChange={handleChange.url}
          />
        </form>
        <GrpcMethodDropdown
          disabled={running}
          methods={methods}
          selectedMethod={selectedMethod}
          handleChange={handleChange.method}
          handleChangeProtoFile={handleChange.protoFile}
        />

        <GrpcSendButton requestId={activeRequest._id} methodType={selectedMethodType} />
      </PaneHeader>
      <PaneBody>
        {selectedMethodType && (
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
                messages={requestMessages}
                bodyText={activeRequest.body.text}
                handleBodyChange={handleChange.body}
                showActions={running && canClientStream(selectedMethodType)}
                handleStream={() => {
                  sendIpc(GrpcRequestEventEnum.sendMessage);
                  grpcDispatch(
                    grpcActions.requestMessage(activeRequest._id, activeRequest.body.text),
                  );
                }}
                handleCommit={() => sendIpc(GrpcRequestEventEnum.commit)}
              />
            </TabPanel>
            <TabPanel className="react-tabs__tab-panel">
              <h4 className="pad">Coming soon! 😊</h4>
            </TabPanel>
          </Tabs>
        )}
        {!selectedMethodType && (
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
