// @flow
// eslint-disable-next-line filenames/match-exported
import React from 'react';
import { Pane, PaneBody, PaneHeader } from './pane';
import { Button } from 'insomnia-components';
import { Dropdown, DropdownButton, DropdownItem } from '../base/dropdown';
import { ipcRenderer } from 'electron';

import * as protoLoader from '../../../network/grpc/proto-loader';
import type { GrpcRequest } from '../../../models/grpc-request';
import * as models from '../../../models';
import {
  getMethodType,
  GrpcMethodTypeEnum,
  GrpcMethodTypeName,
} from '../../../network/grpc/method';
import type { GrpcMethodDefinition, GrpcMethodType } from '../../../network/grpc/method';
import { GrpcRequestEventEnum } from '../../../common/grpc-events';
import type { GrpcRequestEvent } from '../../../common/grpc-events';

type Props = {
  forceRefreshKey: string,
  activeRequest: GrpcRequest,
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
  url: (SyntheticEvent<HTMLInputElement>) => Promise<void>,
  body: (SyntheticEvent<HTMLInputElement>) => Promise<void>,
  method: string => Promise<void>,
};

// This will create cached change handlers for the url, body and method selection
const getChangeHandlers = (request: GrpcRequest): ChangeHandlers => {
  const url = async (e: SyntheticEvent<HTMLInputElement>) => {
    await models.grpcRequest.update(request, { url: e.target.value });
  };

  const body = async (e: SyntheticEvent<HTMLInputElement>) => {
    await models.grpcRequest.update(request, { body: { ...request.body, text: e.target.value } });
  };

  const method = async (e: string) => {
    await models.grpcRequest.update(request, { protoMethodName: e });
  };

  return { url, body, method };
};

const GrpcRequestPane = ({ activeRequest, forceRefreshKey }: Props) => {
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
      <PaneHeader>
        <input
          key={uniquenessKey}
          type="text"
          onChange={handleChange.url}
          defaultValue={activeRequest.url}
          placeholder="test placeholder"
        />

        {!selectedMethod && <Button disabled>Send</Button>}
        {selectedMethodType === GrpcMethodTypeEnum.unary && (
          <Button onClick={() => sendIpc(GrpcRequestEventEnum.sendUnary)}>Send</Button>
        )}
        {selectedMethodType === GrpcMethodTypeEnum.client && (
          <Button onClick={() => sendIpc(GrpcRequestEventEnum.startStream)}>Start</Button>
        )}
        {(selectedMethodType === GrpcMethodTypeEnum.server ||
          selectedMethodType === GrpcMethodTypeEnum.bidi) && <Button disabled>Coming soon</Button>}
      </PaneHeader>

      <PaneBody>
        <div className="pad-bottom">
          <strong>RPC type</strong>
          <br />
          {GrpcMethodTypeName[selectedMethodType]}
        </div>
        <div className="pad-bottom">
          <strong>Selected Method</strong>
          <br />
          <Dropdown>
            <DropdownButton>
              {selectedMethod?.path || 'Select Method'} <i className="fa fa-caret-down" />
            </DropdownButton>
            {methods.map(c => (
              <DropdownItem key={c.path} onClick={handleChange.method} value={c.path}>
                {c.path === selectedMethod?.path && <i className="fa fa-check" />}
                {c.path}
              </DropdownItem>
            ))}
          </Dropdown>
        </div>
        <div className="pad-bottom">
          <strong>Message Body</strong>
          <br />
          <textarea
            key={uniquenessKey}
            type="text"
            rows="5"
            onChange={handleChange.body}
            defaultValue={activeRequest.body.text}
          />
          {selectedMethodType === GrpcMethodTypeEnum.client && (
            <>
              <br />
              <Button onClick={() => sendIpc(GrpcRequestEventEnum.sendMessage)}>Stream</Button>
              <Button onClick={() => sendIpc(GrpcRequestEventEnum.commit)}>Commit</Button>
              <Button onClick={() => sendIpc(GrpcRequestEventEnum.cancel)}>Cancel</Button>
            </>
          )}
        </div>
      </PaneBody>
    </Pane>
  );
};

export default GrpcRequestPane;
