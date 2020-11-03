// @flow
import React from 'react';
import { Pane, PaneBody, PaneHeader } from './pane';
import { Button } from 'insomnia-components';
import { Dropdown, DropdownButton, DropdownItem } from '../base/dropdown';
import { ipcRenderer } from 'electron';

import * as grpc from '../../../network/grpc';
import type { GrpcRequest } from '../../../models/grpc-request';
import * as models from '../../../models';
import {
  getMethodType,
  GrpcMethodTypeEnum,
  GrpcMethodTypeName,
} from '../../../network/grpc/method';
import type { GrpcMethodDefinition, GrpcMethodType } from '../../../network/grpc/method';

type Props = {
  forceRefreshKey: string,
  activeRequest: GrpcRequest,
};

const saveUrl = (request, url) => models.grpcRequest.update(request, { url });

const saveBody = (request, bodyText) =>
  models.grpcRequest.update(request, { body: { ...request.body, text: bodyText } });

const saveMethod = (request, protoMethodName) =>
  models.grpcRequest.update(request, { protoMethodName });

const GrpcRequestPane = ({ activeRequest, forceRefreshKey }: Props) => {
  const [methods, setMethods] = React.useState<Array<GrpcMethodDefinition>>([]);

  const selectedMethod = React.useMemo<GrpcMethodDefinition | undefined>(
    () => methods.find(c => c.path === activeRequest.protoMethodName),
    [activeRequest, methods],
  );

  const selectedMethodType = React.useMemo<GrpcMethodType | undefined>(
    () => selectedMethod && getMethodType(selectedMethod),
    [selectedMethod],
  );

  const uniquenessKey = `${forceRefreshKey}::${activeRequest._id}`;

  React.useEffect(() => {
    const func = async () => {
      const protoFile = await models.protoFile.getById(activeRequest.protoFileId);
      setMethods(await grpc.loadMethods(protoFile));
    };
    func();
  }, [activeRequest.protoFileId]);

  const handleUrlChange = React.useCallback(
    (e: ChangeEvent<HtmlInputElement>) => saveUrl(activeRequest, e.target.value),
    [activeRequest],
  );

  const handleBodyChange = React.useCallback(
    (e: ChangeEvent<HtmlInputElement>) => saveBody(activeRequest, e.target.value),
    [activeRequest],
  );

  const handleMethodChange = React.useCallback((e: string) => saveMethod(activeRequest, e), [
    activeRequest,
  ]);

  const ipc = React.useCallback(channel => ipcRenderer.send(channel, activeRequest._id), [
    activeRequest._id,
  ]);

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
          <Button onClick={() => grpc.sendUnary(activeRequest._id)}>Send</Button>
        )}
        {selectedMethodType === GrpcMethodTypeEnum.client && (
          <Button onClick={() => ipc('GRPC_START_CLIENT_STREAM')}>Start</Button>
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
              <Button onClick={() => ipc('GRPC_SEND_MESSAGE')}>Stream</Button>
              <Button onClick={() => ipc('GRPC_COMMIT')}>Commit</Button>
              <Button onClick={() => ipc('GRPC_CANCEL')}>Cancel</Button>
            </>
          )}
        </div>
      </PaneBody>
    </Pane>
  );
};

export default GrpcRequestPane;
