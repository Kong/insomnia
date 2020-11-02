// @flow
import React from 'react';
import { Pane, PaneBody, PaneHeader } from './pane';
import { Button } from 'insomnia-components';
import { Dropdown, DropdownButton, DropdownItem } from '../base/dropdown';

import * as grpc from '../../../network/grpc';
import type { GrpcRequest } from '../../../models/grpc-request';
import * as models from '../../../models';
import { loadMethods } from '../../../network/grpc';
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
      setMethods(await loadMethods(protoFile));
    };
    func();
  }, [activeRequest.protoFileId]);

  const handleUrlChange = React.useCallback(
    (e: ChangeEvent<HtmlInputElement>) => saveUrl(activeRequest, e.target.value),
    [activeRequest],
  );

  const handleMethodChange = React.useCallback((e: string) => saveMethod(activeRequest, e), [
    activeRequest,
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
          <Button onClick={() => grpc.sendClientStreaming(activeRequest._id)}>Start</Button>
        )}
        {(selectedMethodType === GrpcMethodTypeEnum.server ||
          selectedMethodType === GrpcMethodTypeEnum.bidi) && <Button disabled>Coming soon</Button>}
      </PaneHeader>

      <PaneBody>
        <p>RPC type: {GrpcMethodTypeName[selectedMethodType]}</p>
        <Dropdown>
          <DropdownButton>{selectedMethod?.path || 'Select Method'}</DropdownButton>
          {methods.map(c => (
            <DropdownItem key={c.path} onClick={handleMethodChange} value={c.path}>
              {c.path === selectedMethod?.path && <i className="fa fa-check" />}
              {c.path}
            </DropdownItem>
          ))}
        </Dropdown>
      </PaneBody>
    </Pane>
  );
};

export default GrpcRequestPane;
