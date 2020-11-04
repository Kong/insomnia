// @flow
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

const saveUrl = (request, url) => models.grpcRequest.update(request, { url });

const saveBody = (request, bodyText) =>
  models.grpcRequest.update(request, { body: { ...request.body, text: bodyText } });

const saveMethod = (request, protoMethodName) =>
  models.grpcRequest.update(request, { protoMethodName });

const useGrpcChangeHandlers = activeRequest => {
  const handleUrlChange = React.useCallback(e => saveUrl(activeRequest, e.target.value), [
    activeRequest,
  ]);

  const handleBodyChange = React.useCallback(e => saveBody(activeRequest, e.target.value), [
    activeRequest,
  ]);

  const handleMethodChange = React.useCallback((e: string) => saveMethod(activeRequest, e), [
    activeRequest,
  ]);

  return { handleUrlChange, handleBodyChange, handleMethodChange };
};

const GrpcRequestPane = ({ activeRequest, forceRefreshKey }: Props) => {
  const [methods, setMethods] = React.useState<Array<GrpcMethodDefinition>>([]);

  const selectedMethod = React.useMemo<GrpcMethodDefinition | undefined>(
    () => methods.find(c => c.path === activeRequest.protoMethodName),
    [activeRequest.protoMethodName, methods],
  );

  const selectedMethodType = React.useMemo<GrpcMethodType | undefined>(
    () => selectedMethod && getMethodType(selectedMethod),
    [selectedMethod],
  );

  const uniquenessKey = `${forceRefreshKey}::${activeRequest._id}`;

  React.useEffect(() => {
    const func = async () => {
      const protoFile = await models.protoFile.getById(activeRequest.protoFileId);
      setMethods(await protoLoader.loadMethods(protoFile));
    };
    func();
  }, [activeRequest.protoFileId]);

  const { handleUrlChange, handleBodyChange, handleMethodChange } = useGrpcChangeHandlers(
    activeRequest,
  );

  const sendToGrpcMain = React.useCallback(
    (channel: GrpcRequestEvent) => ipcRenderer.send(channel, activeRequest._id),
    [activeRequest._id],
  );

  return (
    <Pane type="request">
      <PaneHeader>
        <input
          key={uniquenessKey}
          type="text"
          onChange={handleUrlChange}
          defaultValue={activeRequest.url}
          placeholder="test placeholder"
        />

        {!selectedMethod && <Button disabled>Send</Button>}
        {selectedMethodType === GrpcMethodTypeEnum.unary && (
          <Button onClick={() => sendToGrpcMain(GrpcRequestEventEnum.sendUnary)}>Send</Button>
        )}
        {selectedMethodType === GrpcMethodTypeEnum.client && (
          <Button onClick={() => sendToGrpcMain(GrpcRequestEventEnum.startStream)}>Start</Button>
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
              <DropdownItem key={c.path} onClick={handleMethodChange} value={c.path}>
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
            onChange={handleBodyChange}
            defaultValue={activeRequest.body.text}
          />
          {selectedMethodType === GrpcMethodTypeEnum.client && (
            <>
              <br />
              <Button onClick={() => sendToGrpcMain(GrpcRequestEventEnum.sendMessage)}>
                Stream
              </Button>
              <Button onClick={() => sendToGrpcMain(GrpcRequestEventEnum.commit)}>Commit</Button>
              <Button onClick={() => sendToGrpcMain(GrpcRequestEventEnum.cancel)}>Cancel</Button>
            </>
          )}
        </div>
      </PaneBody>
    </Pane>
  );
};

export default GrpcRequestPane;
