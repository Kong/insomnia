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
import { GrpcRequestEventEnum } from '../../../common/grpc-events';
import GrpcSendButton from '../buttons/grpc-send-button';
import { grpcActions, useGrpc, useGrpcIpc, useGrpcRequestState } from '../../context/grpc';
import type { GrpcDispatch } from '../../context/grpc/grpc-actions';
import { showModal } from '../modals';
import ProtoFilesModal from '../modals/proto-files-modal';

type Props = {
  forceRefreshKey: string,
  activeRequest: GrpcRequest,
  settings: Settings,
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
      grpcActions.clear(dispatch, request._id);
    };

    const protoFile = async () => {
      showModal(ProtoFilesModal, {
        preselectProtoFileId: request.protoFileId,
        onSave: async (protoFileId: string) => {
          if (request.protoFileId !== protoFileId) {
            const initial = models.grpcRequest.init();

            // Reset the body as it is no longer relevant
            await models.grpcRequest.update(request, {
              protoFileId,
              body: initial.body,
              protoMethodName: initial.protoMethodName,
            });
            grpcActions.invalidate(dispatch, request._id);
          }
        },
      });
    };

    return { url, body, method, protoFile };
  }, [request, dispatch]);
};

type MethodSelection = {
  method: GrpcMethodDefinition | undefined,
  methodType: GrpcMethodType | undefined,
  methodTypeName: string | undefined,
  enableClientStream: boolean | undefined,
};

const useSelectedMethod = (requestId: string, protoMethodName: string): MethodSelection => {
  const { methods } = useGrpcRequestState(requestId);

  return React.useMemo(() => {
    const selectedMethod = methods.find(c => c.path === protoMethodName);
    const methodType = selectedMethod && getMethodType(selectedMethod);
    const methodTypeName = GrpcMethodTypeName[methodType];
    const enableClientStream = canClientStream(methodType);

    return { method: selectedMethod, methodType, methodTypeName, enableClientStream };
  }, [methods, protoMethodName]);
};

const GrpcRequestPane = ({ activeRequest, forceRefreshKey, settings }: Props) => {
  const [{ requestMessages, running, methods, reloadMethods }, grpcDispatch] = useGrpc(
    activeRequest._id,
  );

  // Reload the methods, on first mount, or if the request protoFile changes
  React.useEffect(() => {
    const func = async () => {
      await grpcActions.loadMethods(
        grpcDispatch,
        activeRequest._id,
        activeRequest.protoFileId,
        reloadMethods,
      );
    };
    func();
  }, [activeRequest._id, activeRequest.protoFileId, reloadMethods, grpcDispatch]);

  const { method, methodType, methodTypeName, enableClientStream } = useSelectedMethod(
    activeRequest._id,
    activeRequest.protoMethodName,
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
          selectedMethod={method}
          handleChange={handleChange.method}
          handleChangeProtoFile={handleChange.protoFile}
        />

        <GrpcSendButton requestId={activeRequest._id} methodType={methodType} />
      </PaneHeader>
      <PaneBody>
        {methodType && (
          <Tabs className="react-tabs" forceRenderTabPanel>
            <TabList>
              <Tab>
                <button>{methodTypeName}</button>
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
